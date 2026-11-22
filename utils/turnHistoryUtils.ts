import { KnowledgeBase, GameMessage, TurnHistoryEntry, SaveGameData } from '../types';
import { Operation } from 'fast-json-patch';
import { MAX_TURN_HISTORY_LENGTH } from '../constants';
import * as jsonpatch from 'fast-json-patch';
import { fastCloneKb } from './cloneKb';

/**
 * Thêm một bản ghi mới vào lịch sử lượt chơi.
 * Hiện tại đã loại bỏ cơ chế Snapshot và Rollback để tối ưu hóa bộ nhớ.
 * @param existingHistory Lịch sử hiện tại
 * @param kbSnapshotForCurrentTurnStart (Không còn dùng nhưng giữ signature để tránh break code chỗ khác)
 * @param messagesSnapshotForCurrentTurnStart (Không còn dùng)
 * @returns Mảng lịch sử mới với entry tối giản
 */
export const addTurnHistoryEntryRaw = (
    existingHistory: TurnHistoryEntry[],
    _kbSnapshotForCurrentTurnStart: KnowledgeBase,    
    _messagesSnapshotForCurrentTurnStart: GameMessage[] 
): TurnHistoryEntry[] => {
  
  const turnNumberOfThisEntry = _kbSnapshotForCurrentTurnStart.playerStats?.turn || 0;

  const newHistoryEntry: TurnHistoryEntry = {
    turnNumber: turnNumberOfThisEntry,
    type: 'delta'
  } as any;

  const updatedTurnHistory = [...existingHistory, newHistoryEntry];
  
  if (updatedTurnHistory.length > MAX_TURN_HISTORY_LENGTH) {
    updatedTurnHistory.splice(0, updatedTurnHistory.length - MAX_TURN_HISTORY_LENGTH);
  }
  
  return updatedTurnHistory;
};

/**
 * Các hàm dưới đây đã trở thành legacy sau khi loại bỏ Rollback.
 * Được giữ lại signature rỗng để không làm hỏng các import ở file khác (sẽ xóa dần sau).
 */
export const sanitizeVectorPrecision = (v: number[]): number[] => v;
export const sanitizeVectorStorePrecision = (store: any): any => store;
export const stripVectorsFromHistory = (turnHistory: TurnHistoryEntry[]): TurnHistoryEntry[] => turnHistory;
export const restoreVectorsToHistory = (turnHistory: TurnHistoryEntry[], _mainVectorStore: any): TurnHistoryEntry[] => turnHistory;
export const reconstructSnapshotsForExport = (gameData: SaveGameData): SaveGameData => gameData;

