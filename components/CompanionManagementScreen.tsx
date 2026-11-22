
import React, { useState, useMemo, useEffect } from 'react';
import { useGame } from '../hooks/useGame';
import { Wife, Slave, GameScreen, PlayerStats, ComplexCompanionBase, Item, Skill } from '../types';
import { VIETNAMESE, MALE_AVATAR_PLACEHOLDER_URL, FEMALE_AVATAR_BASE_URL, MAX_FEMALE_AVATAR_INDEX, DEFAULT_PLAYER_STATS } from '../constants';
import Button from './ui/Button';
import InputField from './ui/InputField';
import Spinner from './ui/Spinner';
import Modal from './ui/Modal';
import PlayerStatsWithEquipment from './gameplay/equipment/PlayerStatsWithEquipment';
import { calculateEffectiveStats, calculateRealmBaseStats } from '../utils/statsCalculationUtils';
import { getEffectiveRealmSystem } from '../services/realmManager';
import { getDeterministicAvatarSrc } from '../utils/avatarUtils';
import InteractionSelectionModal from './gameplay/modals/InteractionSelectionModal';

type CompanionEntityType = 'slave';

const DebugModal: React.FC<{ title: string; prompts: string[]; responses: string[]; onClose: () => void; }> = ({ title, prompts, responses, onClose }) => {
    return (
      <Modal isOpen={true} onClose={onClose} title={title}>
        <div className="space-y-4 max-h-[60vh] overflow-y-auto custom-scrollbar">
          <div>
            <h3 className="text-lg font-semibold text-sky-300 mb-2">Prompt Đã Gửi ({prompts.length})</h3>
            <div className="space-y-2 text-xs bg-gray-900 p-2 rounded-md">
              {prompts.length > 0 ? prompts.map((prompt, index) => (
                <details key={`prompt-${index}`} className="bg-gray-800 rounded group">
                  <summary className="p-1.5 text-sky-200 cursor-pointer text-[11px] group-open:font-semibold">
                    Prompt #{prompts.length - index} (Nhấn để xem)
                  </summary>
                  <pre className="p-1.5 bg-gray-850 text-sky-100 whitespace-pre-wrap break-all text-[10px] leading-relaxed max-h-60 overflow-y-auto custom-scrollbar">
                    {prompt}
                  </pre>
                </details>
              )) : <p className="text-gray-500 italic">Chưa có prompt nào được gửi.</p>}
            </div>
          </div>
          <div>
            <h3 className="text-lg font-semibold text-lime-300 mb-2">Phản Hồi Nhận Được ({responses.length})</h3>
            <div className="space-y-2 text-xs bg-gray-900 p-2 rounded-md">
              {responses.length > 0 ? responses.map((response, index) => (
                <details key={`resp-${index}`} className="bg-gray-800 rounded group">
                  <summary className="p-1.5 text-lime-200 cursor-pointer text-[11px] group-open:font-semibold">
                    Phản hồi #{responses.length - index} (Nhấn để xem)
                  </summary>
                  <pre className="p-1.5 bg-gray-850 text-lime-100 whitespace-pre-wrap break-all text-[10px] leading-relaxed max-h-60 overflow-y-auto custom-scrollbar">
                    {response}
                  </pre>
                </details>
              )) : <p className="text-gray-500 italic">Chưa có phản hồi nào được nhận.</p>}
            </div>
          </div>
        </div>
      </Modal>
    );
};

const CompanionManagementScreen: React.FC = () => {
    const game = useGame();
    const { 
        knowledgeBase, 
        setCurrentScreen, 
        isLoadingApi,
        handleFreePerson,
        handleCompanionAction 
    } = game;
    const [activeTab, setActiveTab] = useState<CompanionEntityType>('slave');
    const [selectedCompanionId, setSelectedCompanionId] = useState<string | null>(null);
    const [showDebug, setShowDebug] = useState(false);
    const [isInteractionModalOpen, setIsInteractionModalOpen] = useState(false);
    
    useEffect(() => {
        if (!selectedCompanionId && knowledgeBase.slaves.length > 0) {
            setSelectedCompanionId(knowledgeBase.slaves[0].id);
        }
    }, [knowledgeBase.slaves, selectedCompanionId]);

    const handleTabChange = (tab: CompanionEntityType) => {
        setActiveTab(tab);
        const list = knowledgeBase.slaves || [];
        setSelectedCompanionId(list.length > 0 ? list[0].id : null);
    };

    const activeList = knowledgeBase.slaves || [];
    const selectedCompanion = activeList.find(c => c.id === selectedCompanionId);

    useEffect(() => {
        if (selectedCompanionId && !activeList.some(c => c.id === selectedCompanionId)) {
            setSelectedCompanionId(activeList[0]?.id || null);
        }
    }, [activeList, selectedCompanionId]);
    
    const getFullCompanionStats = (companion: ComplexCompanionBase): PlayerStats | null => {
      if (!companion.stats || !companion.realm) return null;
  
      const baseStats = calculateRealmBaseStats(
          companion.realm,
          knowledgeBase.realmProgressionList,
          knowledgeBase.currentRealmBaseStats
      );
      
      const fullStats: PlayerStats = {
          ...DEFAULT_PLAYER_STATS,
          ...baseStats,
          ...companion.stats,
          realm: companion.realm,
          sinhLuc: companion.stats.sinhLuc ?? baseStats.baseMaxSinhLuc,
          maxSinhLuc: companion.stats.maxSinhLuc ?? baseStats.baseMaxSinhLuc,
          linhLuc: companion.stats.linhLuc ?? baseStats.baseMaxLinhLuc,
          maxLinhLuc: companion.stats.maxLinhLuc ?? baseStats.baseMaxLinhLuc,
          sucTanCong: companion.stats.sucTanCong ?? baseStats.baseSucTanCong,
          currency: 0,
          isInCombat: false,
          turn: knowledgeBase.playerStats.turn,
          hieuUngBinhCanh: false,
          activeStatusEffects: [],
          professions: [],
          thoNguyen: companion.stats.thoNguyen ?? 100,
          maxThoNguyen: companion.stats.maxThoNguyen ?? 100,
          spiritualRoot: companion.spiritualRoot || "Không rõ",
          specialPhysique: companion.specialPhysique || "Không rõ",
          tuChat: companion.tuChat, // Pass aptitude
      };
      
      return calculateEffectiveStats(fullStats, companion.equippedItems, knowledgeBase.inventory);
    };
  
    
    const handleNormalizeRealms = () => {
        const realmSystem = getEffectiveRealmSystem(game.knowledgeBase);
        const validRealms = new Set<string>();
        realmSystem.majorRealms.forEach(major => {
            validRealms.add(major);
            realmSystem.minorRealms.forEach(minor => {
                validRealms.add(major + ' ' + minor);
            });
        });
        
        const wrongNpcs = [...game.knowledgeBase.slaves, ...game.knowledgeBase.wives].filter(c => !validRealms.has(c.realm));
        
        if (wrongNpcs.length > 0) {
            game.showNotification(`Đang tiến hành chuẩn hóa cảnh giới cho ${wrongNpcs.length} hậu cung...`, "info");
        } else {
            game.showNotification("Đang kiểm tra và chuẩn hóa chỉ số hậu cung...", "info");
        }
        
        game.normalizeNpcRealms(wrongNpcs as any[]);
    };

    const companionFullStats = selectedCompanion ? getFullCompanionStats(selectedCompanion) : null;

    const handleUseItemOrSkill = (type: 'item' | 'skill', object: Item | Skill) => {
        if (!selectedCompanion) return;
        
        const actionString = type === 'item' 
            ? `Sử dụng vật phẩm "${object.name}" lên ${selectedCompanion.name}` 
            : `Thi triển kỹ năng "${object.name}" lên ${selectedCompanion.name}`;
            
        handleCompanionAction(selectedCompanion, actionString);
        setIsInteractionModalOpen(false);
    };

    return (
        <>
        <div className="min-h-screen flex flex-col bg-gray-800 p-4 text-gray-100">
            <header className="mb-4 flex justify-between items-center">
                <h1 className="text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-rose-400 via-purple-500 to-indigo-600">
                    {VIETNAMESE.companionManagementScreenTitle}
                </h1>
                <div className="flex items-center gap-2">
                    
                    <Button variant="secondary" onClick={handleNormalizeRealms} disabled={isLoadingApi} className="bg-blue-600 hover:bg-blue-700 border-none text-white">
                        Chuẩn Hoá Thực Lực
                    </Button>
                    <Button variant="ghost" onClick={() => setShowDebug(true)} className="border-yellow-500 text-yellow-300 hover:bg-yellow-700 hover:text-white">
                        Debug
                    </Button>
                    <Button variant="secondary" onClick={() => setCurrentScreen(GameScreen.Gameplay)} disabled={isLoadingApi}>
                        {VIETNAMESE.goBackButton}
                    </Button>
                </div>
            </header>

            <div className="flex border-b border-gray-600 mb-4">
                <button
                    onClick={() => handleTabChange('slave')}
                    className={`flex-1 py-2 text-sm font-semibold text-rose-400 border-b-2 border-rose-400`}
                >
                    {VIETNAMESE.nuNoTab} ({knowledgeBase.slaves.length})
                </button>
            </div>

            <div className="flex-grow grid grid-cols-1 lg:grid-cols-2 gap-4 overflow-hidden h-full">
                {/* Left Column (Narrow): Companion List */}
                <div className="lg:col-span-1 bg-gray-900 p-3 rounded-lg shadow-xl border border-gray-700 h-full overflow-y-auto custom-scrollbar">
                     <h2 className="text-xl font-semibold text-gray-300 mb-3 border-b border-gray-600 pb-2">Danh Sách</h2>
                    {activeList.length === 0 ? (
                        <p className="text-gray-400 italic">{VIETNAMESE.noSlaves}</p>
                    ) : (
                        <ul className="space-y-2">
                            {activeList.map(c => (
                                <li key={c.id}>
                                    <button
                                        onClick={() => setSelectedCompanionId(c.id)}
                                        className={`w-full text-left p-2 rounded-lg transition-colors ${selectedCompanionId === c.id ? 'bg-purple-800/50 ring-2 ring-purple-500' : 'bg-gray-700/70 hover:bg-gray-700'}`}
                                    >
                                        <div className="flex items-center gap-3">
                                            <img src={getDeterministicAvatarSrc(c)} alt={c.name} className="w-10 h-10 rounded-full object-cover border-2 border-gray-600"/>
                                            <div className="flex-grow">
                                                <span className="font-semibold block">{c.name}</span>
                                                <div className="flex justify-between items-center mt-0.5">
                                                    <span className="text-xs text-gray-400">{c.realm}</span>
                                                    <span className={`text-[11px] font-medium px-1.5 py-0.2 rounded ${
                                                        (c.satisfaction ?? 100) < 30 ? 'bg-red-950 text-red-400 border border-red-800 animate-pulse' : 'bg-green-950 text-green-400 border border-green-800'
                                                    }`}>
                                                        😊 {c.satisfaction ?? 100}%
                                                    </span>
                                                </div>
                                            </div>
                                        </div>
                                    </button>
                                </li>
                            ))}
                        </ul>
                    )}
                </div>

                 {/* Right Column (Narrow): Details */}
                <div className="lg:col-span-1 bg-gray-900 p-4 rounded-lg shadow-xl border border-gray-700 overflow-y-auto custom-scrollbar">
                    {selectedCompanion && companionFullStats ? (
                        <div className="space-y-4">
                            <h2 className="text-2xl font-bold text-rose-400 flex justify-between items-center">
                                {selectedCompanion.name}
                                <Button 
                                    size="sm" 
                                    variant="secondary" 
                                    className="text-xs bg-indigo-600 hover:bg-indigo-700 border-none text-white"
                                    onClick={() => setIsInteractionModalOpen(true)}
                                    disabled={isLoadingApi}
                                    id="btn-use-item-companion"
                                >
                                    Dùng Vật Phẩm / Kỹ Năng
                                </Button>
                            </h2>

                            {/* Thang đo mức độ thỏa mãn và Nút trả lương */}
                            <div className="bg-gray-850 p-3 rounded-lg border border-gray-700 flex flex-col gap-2" id="companion-satisfaction-card">
                                <div className="flex justify-between items-center">
                                    <span className="text-sm font-semibold text-gray-300">Mức độ thỏa mãn:</span>
                                    <div className="flex items-center gap-3">
                                        <span className={`text-sm font-bold ${
                                            (selectedCompanion.satisfaction ?? 100) < 30 ? 'text-red-400 animate-pulse' : 'text-green-400'
                                        }`}>
                                            {selectedCompanion.satisfaction ?? 100}%
                                        </span>
                                        <Button 
                                            size="sm" 
                                            className="text-xs bg-emerald-600 hover:bg-emerald-700 border-none text-white py-1 px-3 flex items-center gap-1 h-7"
                                            onClick={() => game.paySalary(selectedCompanion.id, 'slave')}
                                            disabled={isLoadingApi}
                                            id="btn-pay-salary-companion"
                                        >
                                            💸 Tiền Lương ({Math.max(10, Math.floor((selectedCompanion.stats?.maxKinhNghiem || 100) * 0.1))} {knowledgeBase.worldConfig?.currencyName || "Linh Thạch"})
                                        </Button>
                                    </div>
                                </div>
                                <div className="w-full bg-gray-900 rounded-full h-3 overflow-hidden border border-gray-750">
                                    <div 
                                        className={`h-full transition-all duration-300 ${
                                            (selectedCompanion.satisfaction ?? 100) < 30 ? 'bg-red-500' : (selectedCompanion.satisfaction ?? 100) < 60 ? 'bg-yellow-500' : 'bg-green-500'
                                        }`} 
                                        style={{ width: `${isNaN(selectedCompanion.satisfaction as any) ? 100 : (selectedCompanion.satisfaction ?? 100)}%` }}
                                    ></div>
                                </div>
                                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 mt-1">
                                    <span className="text-xs text-gray-400 italic">
                                        {(selectedCompanion.satisfaction ?? 100) < 30 ? '⚠️ Thỏa mãn dưới 30%, có nguy cơ đào tẩu!' : 'Trạng thái ổn định.'}
                                    </span>
                                </div>
                            </div>
                             <PlayerStatsWithEquipment
                                personId={selectedCompanion.id}
                                playerStats={companionFullStats}
                                equippedItems={selectedCompanion.equippedItems}
                                inventory={knowledgeBase.inventory}
                                currencyName={knowledgeBase.worldConfig?.currencyName}
                                playerName={selectedCompanion.name}
                                playerGender={selectedCompanion.gender}
                                playerAvatarUrl={selectedCompanion.avatarUrl}
                                isPlayerContext={false}
                                tuChat={selectedCompanion.tuChat}
                            />
                             {selectedCompanion.entityType === 'slave' && (
                                <div className="mt-4 pt-4 border-t border-gray-700">
                                    <Button variant="secondary" onClick={() => handleFreePerson(selectedCompanion.id, 'slave')} disabled={isLoadingApi} className="w-full">
                                        Trả Tự Do
                                    </Button>
                                </div>
                            )}
                        </div>
                    ) : (
                        <div className="flex items-center justify-center h-full">
                            <p className="text-gray-500 italic">Chọn một người để xem chi tiết.</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
        
        {isInteractionModalOpen && selectedCompanion && (
            <InteractionSelectionModal
                isOpen={isInteractionModalOpen}
                onClose={() => setIsInteractionModalOpen(false)}
                inventory={knowledgeBase.inventory}
                skills={knowledgeBase.playerSkills}
                onSelect={handleUseItemOrSkill}
                targetName={selectedCompanion.name}
            />
        )}

        {showDebug && (
            <DebugModal
                title="Nhật Ký Gỡ Lỗi Hậu Cung"
                prompts={game.sentCompanionPromptsLog}
                responses={game.receivedCompanionResponsesLog}
                onClose={() => setShowDebug(false)}
            />
        )}
        </>
    );
};

export default CompanionManagementScreen;
