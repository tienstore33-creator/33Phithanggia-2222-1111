

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { GameScreen, SaveGameMeta, StorageType } from '../types';
import Button from './ui/Button';
import Spinner from './ui/Spinner';
import { VIETNAMESE, MAX_AUTO_SAVE_SLOTS } from '../constants';
import { Volume2, VolumeX } from 'lucide-react';
// loadGamesFromFirestore, deleteGameFromFirestore removed
import { loadGamesFromIndexedDB, deleteGameFromIndexedDB, optimizeGameSaveInIndexedDB } from '../services/indexedDBService';
import { useSaveGameManager } from '../hooks/useSaveGameManager';
import { ConfirmationDialog } from './ConfirmationDialog';
import { audioService } from '../src/services/AudioService';
import { SacredTimelineService } from '../services/SacredTimelineService';

// Helper function to format bytes
function formatBytes(bytes: number | undefined, decimals: number = 2): string {
  if (bytes === undefined || bytes === null || bytes === 0) return '0 Bytes';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  if (i < 0 || i >= sizes.length) return '0 Bytes'; // Handle edge cases
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

interface LoadGameScreenProps {
  setCurrentScreen: (screen: GameScreen) => void;
  onLoadGame: (saveId: string) => Promise<void>; 
  notify: (message: string, type: 'success' | 'error') => void;
  storageType: StorageType; 
}

const LoadGameScreen: React.FC<LoadGameScreenProps> = ({ 
  setCurrentScreen, 
  onLoadGame, 
  notify,
  storageType 
}) => {
  const [manualSave, setManualSave] = useState<SaveGameMeta | null>(null);
  const [autoSaves, setAutoSaves] = useState<SaveGameMeta[]>([]);
  const [otherSaves, setOtherSaves] = useState<SaveGameMeta[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionInProgress, setActionInProgress] = useState<string | null>(null);
  const [isConfirmationOpen, setIsConfirmationOpen] = useState(false);

  const [volume, setVolumeState] = useState(() => Math.round(audioService.getVolume() * 100));

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newVol = parseInt(e.target.value, 10);
    setVolumeState(newVol);
    audioService.setVolume(newVol / 100);
  };

  const toggleMute = () => {
    if (volume > 0) {
      localStorage.setItem('app_bg_volume_before_mute', (volume / 100).toString());
      setVolumeState(0);
      audioService.setVolume(0);
    } else {
      const saved = localStorage.getItem('app_bg_volume_before_mute');
      const prevVol = saved ? parseFloat(saved) : 1.0;
      const restored = Math.round(prevVol * 100) || 100;
      setVolumeState(restored);
      audioService.setVolume(restored / 100);
    }
  };

  const allSaves = useMemo(() => {
    const list: SaveGameMeta[] = [];
    if (manualSave) list.push(manualSave);
    list.push(...autoSaves);
    list.push(...otherSaves);
    return list;
  }, [manualSave, autoSaves, otherSaves]);

  const { 
    selectedIds, 
    toggleSelect, 
    toggleSelectAll, 
    clearSelection,
    deleteSelected, 
    isDeleting,
    isAllSelected,
    isSomeSelected
  } = useSaveGameManager(allSaves);

  // Background Music using SoundCloud Playlist
  // Old local audio playback removed

  const fetchSaveGames = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      // Only IndexedDB logic remains
      const fetchedSaves = await loadGamesFromIndexedDB();
      
      const currentManualSave = fetchedSaves.find(s => !s.name.startsWith("Auto Save Slot") && !s.name.startsWith(VIETNAMESE.importFileButton));
      const allAutoSaves = fetchedSaves.filter(s => s.name.startsWith("Auto Save Slot"));
      
      // Sort by timestamp newest first to identify the 8 most recent ones
      allAutoSaves.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

      let currentAutoSaves = allAutoSaves.slice(0, MAX_AUTO_SAVE_SLOTS);
      const extras = allAutoSaves.slice(MAX_AUTO_SAVE_SLOTS);

      // PHYSICAL CLEANUP: Delete the extras from IndexedDB
      if (extras.length > 0) {
        for (const extra of extras) {
          try {
            await deleteGameFromIndexedDB(extra.id);
            console.log(`Physically deleted orphaned autosave: ${extra.name} (${extra.id})`);
          } catch (err) {
            console.error(`Failed to delete orphaned autosave ${extra.id}:`, err);
          }
        }
      }

      // Now sort the remaining 8 by slot number for a consistent UI display
      currentAutoSaves.sort((a, b) => {
        const slotA = parseInt(a.name.replace("Auto Save Slot ", ""), 10) || 0;
        const slotB = parseInt(b.name.replace("Auto Save Slot ", ""), 10) || 0;
        return slotA - slotB;
      });

      const currentOtherSaves = fetchedSaves.filter(s => 
        s !== currentManualSave && 
        !currentAutoSaves.some(as => as.id === s.id) &&
        !extras.some(e => e.id === s.id)
      ).sort((a,b) => b.timestamp.getTime() - a.timestamp.getTime());

      setManualSave(currentManualSave || null);
      setAutoSaves(currentAutoSaves);
      setOtherSaves(currentOtherSaves);
      clearSelection();

    } catch (e) {
      const errorMsg = VIETNAMESE.errorLoadingGame + (e instanceof Error ? `: ${e.message}` : '');
      setError(errorMsg);
      notify(errorMsg, 'error');
    } finally {
      setIsLoading(false);
    }
  }, [notify]); 

  useEffect(() => {
    fetchSaveGames();
  }, [fetchSaveGames]);

  const handleLoad = async (saveId: string) => {
    setActionInProgress(`load-${saveId}`);
    try {
      await onLoadGame(saveId); 
    } catch (e) {
      notify(VIETNAMESE.errorLoadingGame + (e instanceof Error ? `: ${e.message}` : ''), 'error');
    } finally {
      setActionInProgress(null);
    }
  };

  const handleDelete = async (saveId: string, saveName: string) => {
    setActionInProgress(`delete-${saveId}`);
    try {
      // Only IndexedDB logic remains
      await deleteGameFromIndexedDB(saveId);
      notify(VIETNAMESE.gameDeletedSuccess, 'success');
      fetchSaveGames(); 
    } catch (e) {
      notify(VIETNAMESE.errorDeletingGame + (e instanceof Error ? `: ${e.message}` : ''), 'error');
    } finally {
      setActionInProgress(null);
    }
  };

  const handleOptimize = async (saveId: string, saveName: string) => {
    setActionInProgress(`optimize-${saveId}`);
    try {
      const res = await optimizeGameSaveInIndexedDB(saveId);
      if (res.success) {
        notify(`Đã dọn dẹp dữ liệu trùng và thặng dư lịch sử cho "${saveName}"! Dung lượng giảm từ ${formatBytes(res.oldSize)} xuống còn ${formatBytes(res.newSize)}.`, 'success');
        fetchSaveGames();
      } else {
        notify(`Dọn dẹp file "${saveName}" thất bại: ${res.message}`, 'error');
      }
    } catch (e) {
      notify(`Lỗi khi dọn dẹp file "${saveName}": ` + (e instanceof Error ? e.message : String(e)), 'error');
    } finally {
      setActionInProgress(null);
    }
  };

  const handleBulkDelete = async () => {
    setIsConfirmationOpen(false);
    setActionInProgress('bulk-delete');
    try {
      await deleteSelected(async (ids) => {
        // Delete each file one by one (IndexedDB is fast enough for 8-20 files)
        for (const id of ids) {
          await deleteGameFromIndexedDB(id);
        }
      });
      notify(`Đã xóa ${selectedIds.size} file lưu thành công.`, 'success');
      fetchSaveGames();
    } catch (e) {
      notify("Lỗi khi xóa hàng loạt: " + (e instanceof Error ? e.message : String(e)), 'error');
    } finally {
      setActionInProgress(null);
    }
  };
  
  const sacredTimelineSlotIds = useMemo(() => {
    const allSlots: SaveGameMeta[] = [
      ...(manualSave ? [manualSave] : []),
      ...autoSaves,
      ...otherSaves
    ];

    const highestMap: Record<string, { id: string; turnCount: number; timestamp: number }> = {};

    for (const slot of allSlots) {
      if (!slot.universeId) continue;
      const turn = slot.turnCount ?? 0;
      const time = slot.timestamp ? new Date(slot.timestamp).getTime() : 0;

      const existing = highestMap[slot.universeId];
      if (!existing) {
        highestMap[slot.universeId] = { id: slot.id, turnCount: turn, timestamp: time };
      } else if (turn > existing.turnCount || (turn === existing.turnCount && time > existing.timestamp)) {
        highestMap[slot.universeId] = { id: slot.id, turnCount: turn, timestamp: time };
      }
    }

    const sacredIds = new Set<string>();
    for (const uniId in highestMap) {
      sacredIds.add(highestMap[uniId].id);
    }
    return sacredIds;
  }, [manualSave, autoSaves, otherSaves]);

  const formatDate = (date: Date) => {
    return date.toLocaleString('vi-VN', { 
      year: 'numeric', month: '2-digit', day: '2-digit', 
      hour: '2-digit', minute: '2-digit', second: '2-digit' 
    });
  };

  const renderSaveSlot = (slot: SaveGameMeta, isManual: boolean = false) => {
    const isSacredTimeline = Boolean(slot.universeId && sacredTimelineSlotIds.has(slot.id));

    let containerStyle = isManual 
      ? 'bg-emerald-800/30 border border-emerald-600 hover:bg-emerald-700/40' 
      : 'bg-gray-800 hover:bg-gray-750';

    if (isSacredTimeline) {
      containerStyle = 'sacred-timeline-gold-frame border-2 border-amber-400 bg-gradient-to-r from-amber-950/60 via-gray-900 to-amber-950/60 hover:from-amber-900/60 hover:to-amber-900/60 shadow-[0_0_15px_rgba(245,158,11,0.3)]';
    }

    return (
      <div key={slot.id} className={`p-4 rounded-lg shadow-md flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 transition-all duration-200 relative overflow-hidden ${containerStyle}`}>
        {isSacredTimeline && (
          <div className="absolute inset-0 pointer-events-none overflow-hidden">
            <div className="sacred-particle-dot w-2 h-2 top-[20%] left-[12%]" style={{ animationDelay: '0s' }}></div>
            <div className="sacred-particle-dot w-1.5 h-1.5 top-[65%] left-[28%]" style={{ animationDelay: '0.7s' }}></div>
            <div className="sacred-particle-dot w-2.5 h-2.5 top-[35%] left-[52%]" style={{ animationDelay: '1.4s' }}></div>
            <div className="sacred-particle-dot w-1.5 h-1.5 top-[75%] left-[78%]" style={{ animationDelay: '2.1s' }}></div>
            <div className="sacred-particle-dot w-2 h-2 top-[15%] left-[90%]" style={{ animationDelay: '0.4s' }}></div>
            <div className="sacred-particle-dot w-1 h-1 top-[80%] left-[42%]" style={{ animationDelay: '1.8s' }}></div>
          </div>
        )}
        <div className="flex items-center gap-4 flex-grow z-10">
          <input 
            type="checkbox" 
            checked={selectedIds.has(slot.id)}
            onChange={() => toggleSelect(slot.id)}
            className="w-5 h-5 rounded border-gray-600 bg-gray-700 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
          />
          <div className="flex-grow">
            <div className="flex items-center gap-2 flex-wrap">
              <p className={`text-lg font-semibold ${isManual ? 'text-emerald-300' : 'text-indigo-300'}`}>{slot.name}</p>
              {slot.universeId && (
                <span className="text-xs px-2 py-0.5 rounded font-mono font-bold bg-cyan-950/90 text-cyan-300 border border-cyan-500/60 shadow-sm flex items-center gap-1" title={`Mã định danh Vũ trụ: ${slot.universeId}`}>
                  🌌 {slot.universeId}
                </span>
              )}
              {slot.turnCount !== undefined && (
                <span className="text-xs px-2.5 py-0.5 rounded-full font-semibold bg-amber-950/80 text-amber-300 border border-amber-600/60 shadow-sm">
                  Lượt: {slot.turnCount}
                </span>
              )}
            </div>
            <div className="text-xs text-gray-400 mt-0.5">
              <span>{VIETNAMESE.lastSaved}: {formatDate(slot.timestamp)}</span>
              {slot.size !== undefined && (
                <span className="ml-3 pl-3 border-l border-gray-600">{VIETNAMESE.fileSizeLabel}: {formatBytes(slot.size)}</span>
              )}
            </div>
          </div>
        </div>
        <div className="flex space-x-4 flex-shrink-0 mt-3 sm:mt-0 self-center sm:self-auto z-10">
          <Button 
            variant="primary" 
            size="sm"
            onClick={() => handleLoad(slot.id)}
            isLoading={actionInProgress === `load-${slot.id}`}
            disabled={!!actionInProgress}
            loadingText="Đang tải..."
            className={isManual ? 'bg-emerald-600 hover:bg-emerald-700 focus:ring-emerald-500' : ''}
          >
            {VIETNAMESE.loadGameButton}
          </Button>
          <Button 
            variant="secondary" 
            size="sm"
            onClick={() => handleOptimize(slot.id, slot.name)}
            isLoading={actionInProgress === `optimize-${slot.id}`}
            disabled={!!actionInProgress}
            loadingText="Đang dọn..."
            className="bg-amber-600 hover:bg-amber-700 text-white focus:ring-amber-500 border-none"
            title="Dọn dẹp dữ liệu trùng lặp và thặng dư lịch sử để giải phóng bộ nhớ"
          >
            🧹 Dọn dẹp thừa
          </Button>
          <Button 
            variant="danger" 
            size="sm"
            onClick={() => handleDelete(slot.id, slot.name)}
            isLoading={actionInProgress === `delete-${slot.id}`}
            disabled={!!actionInProgress}
            loadingText="Đang xóa..."
          >
            {VIETNAMESE.deleteSaveButton}
          </Button>
        </div>
      </div>
    );
  };

  const allSavesCount = (manualSave ? 1 : 0) + autoSaves.length + otherSaves.length;

  return (
    <div className="min-h-screen flex flex-col items-center justify-start bg-gray-800 p-4 py-8 sm:p-6">
      <div className="w-full max-w-2xl bg-gray-900 shadow-2xl rounded-xl p-6 sm:p-8">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <h2 className="text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 via-sky-500 to-indigo-600">
            {VIETNAMESE.loadGameScreenTitle} (Cục Bộ)
          </h2>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 bg-gray-800/50 px-2.5 py-1.5 rounded-full border border-gray-700 shadow-sm">
              <button onClick={toggleMute} className="text-gray-300 hover:text-white transition-colors focus:outline-none" title="Bật/Tắt âm thanh">
                {volume === 0 ? <VolumeX className="w-3.5 h-3.5 text-red-400" /> : <Volume2 className="w-3.5 h-3.5 text-indigo-400" />}
              </button>
              <input 
                type="range" 
                min="0" 
                max="200" 
                value={volume} 
                onChange={handleVolumeChange} 
                className="w-16 sm:w-20 h-1 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-indigo-500 focus:outline-none"
                title={`Âm lượng: ${volume}%`}
              />
              <span className="text-[9px] font-mono text-gray-400 w-7 text-right">{volume}%</span>
            </div>
            <Button variant="ghost" onClick={() => setCurrentScreen(GameScreen.Initial)}>
              {VIETNAMESE.goBackButton}
            </Button>
          </div>
        </div>

        {isLoading && <Spinner text="Đang tải danh sách lưu..." className="my-8" />}
        {error && <p className="text-red-400 bg-red-900/50 p-3 rounded-md text-center my-4 border border-red-700">{error}</p>}
        
        {!isLoading && !error && allSavesCount > 0 && (
          <div className="flex items-center justify-between bg-gray-800/50 p-3 rounded-lg mb-6 border border-gray-700">
            <div className="flex items-center gap-3">
              <input 
                type="checkbox" 
                checked={isAllSelected}
                ref={el => el && (el.indeterminate = isSomeSelected)}
                onChange={toggleSelectAll}
                className="w-5 h-5 rounded border-gray-600 bg-gray-700 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
              />
              <span className="text-sm text-gray-300 font-medium">Chọn tất cả</span>
            </div>
            
            <Button 
              variant="danger" 
              size="sm" 
              disabled={selectedIds.size === 0 || !!actionInProgress}
              onClick={() => setIsConfirmationOpen(true)}
              isLoading={actionInProgress === 'bulk-delete'}
              loadingText="Đang xóa..."
            >
              Xóa các file đã chọn ({selectedIds.size})
            </Button>
          </div>
        )}

        {!isLoading && !error && allSavesCount === 0 && (
          <p className="text-gray-400 italic text-center py-8">{VIETNAMESE.noSaveGamesFound}</p>
        )}

        {!isLoading && !error && allSavesCount > 0 && (
          <div className="space-y-6 pb-4">
            {manualSave && (
              <section>
                <h3 className="text-xl font-semibold text-emerald-400 mb-2">Lưu Thủ Công</h3>
                {renderSaveSlot(manualSave, true)}
              </section>
            )}
            
            {autoSaves.length > 0 && (
              <section>
                <h3 className="text-xl font-semibold text-sky-400 mb-2">Lưu Tự Động (Mới nhất ở trên)</h3>
                <div className="space-y-3">
                  {autoSaves.sort((a,b) => b.timestamp.getTime() - a.timestamp.getTime()).map(slot => renderSaveSlot(slot))}
                </div>
              </section>
            )}

            {otherSaves.length > 0 && (
                 <section>
                    <h3 className="text-xl font-semibold text-gray-400 mb-2">Các File Lưu Khác (Đã Nhập, Cũ)</h3>
                    <div className="space-y-3">
                        {otherSaves.map(slot => renderSaveSlot(slot))}
                    </div>
                </section>
            )}
          </div>
        )}
      </div>

      <ConfirmationDialog 
        isOpen={isConfirmationOpen}
        count={selectedIds.size}
        onConfirm={handleBulkDelete}
        onCancel={() => setIsConfirmationOpen(false)}
      />
    </div>
  );
};

export default LoadGameScreen;