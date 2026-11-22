import React, { useState } from 'react';
import { Quest, KnowledgeBase } from '../../types';
import { VIETNAMESE } from '../../constants';
import { useGame } from '../../hooks/useGame';
import Button from '../ui/Button';
import { RefreshCw } from 'lucide-react';
import { QuestSyncService } from '../../services/QuestSyncService';
import { sanitizeQuests } from '../../utils/sanitizeUtils';

interface QuestsDisplayPanelProps {
  quests: Quest[];
  onQuestClick: (quest: Quest) => void;
  knowledgeBase: KnowledgeBase;
}

const QuestsDisplayPanel: React.FC<QuestsDisplayPanelProps> = ({ quests, onQuestClick }) => {
  const [activeTab, setActiveTab] = useState<'pending' | 'active' | 'completed' | 'failed'>('active');
  const [isSyncing, setIsSyncing] = useState(false);
  const game = useGame();
  
  const validQuests = sanitizeQuests(quests);
  // Pending quests are shown in their own tab
  const filteredQuests = validQuests.filter(q => q.status === activeTab);
  const activeQuestsCount = validQuests.filter(q => q.status === 'active').length;
  const pendingQuestsCount = validQuests.filter(q => q.status === 'pending').length;

  const handleSyncQuests = async () => {
    if (isSyncing) return;
    setIsSyncing(true);
    try {
      const syncResult = await QuestSyncService.sync(game.knowledgeBase);
      game.addMessageAndUpdateState(syncResult.systemMessages, syncResult.updatedKb);
    } catch (err) {
      console.error("Lỗi đồng bộ nhiệm vụ cốt truyện cơ học:", err);
    } finally {
      setIsSyncing(false);
    }
  };

  const handleAcceptQuest = (e: React.MouseEvent, questId: string) => {
    e.stopPropagation();
    game.setKnowledgeBase(prev => {
        const updatedQuests = prev.allQuests.map(q => 
            q.id === questId ? { ...q, status: 'active', turnsPending: undefined } : q
        );
        return { ...prev, allQuests: updatedQuests as Quest[] };
    });
    // Add a system log message visually
    const acceptMsg = {
        id: `sys_q_acc_${Date.now()}`,
        type: 'system' as const,
        content: `Đã xác nhận nhận nhiệm vụ phụ. Hành trình của bạn sẽ có thể bị ảnh hưởng.`,
        timestamp: Date.now(),
        turnNumber: game.knowledgeBase?.playerStats?.turn || 0
    };
    game.addMessageAndUpdateState([acceptMsg], null);
  };

  const handleRejectQuest = (e: React.MouseEvent, quest: Quest) => {
    e.stopPropagation();
    game.setKnowledgeBase(prev => {
        const updatedQuests = prev.allQuests.map(q => 
            q.id === quest.id ? { ...q, status: 'failed', punishmentText: q.punishmentText || "Nhiệm vụ bị từ chối.", resolvedAtTurn: prev.playerStats.turn } : q
        );
        return { ...prev, allQuests: updatedQuests as Quest[] };
    });
    // Add a system log message for rejection
    const rejectMsg = {
        id: `sys_q_rej_${Date.now()}`,
        type: 'system' as const,
        content: `BẠN ĐÃ TỪ CHỐI NHIỆM VỤ: [${quest.title}]. NPC liên quan có thể sẽ khó chịu, tình tiết có thể thay đổi theo hướng xấu ở lượt tới.`,
        timestamp: Date.now(),
        turnNumber: game.knowledgeBase?.playerStats?.turn || 0
    };
    game.addMessageAndUpdateState([rejectMsg], null);
  };

  const renderQuestList = (questsToRender: Quest[]) => {
    if (questsToRender.length === 0) {
      let message = VIETNAMESE.noActiveQuests;
      if (activeTab === 'pending') message = "Hiện không có lời đề nghị nhiệm vụ nào.";
      if (activeTab === 'completed') message = VIETNAMESE.noCompletedQuests;
      if (activeTab === 'failed') message = VIETNAMESE.noFailedQuests;
      return <p className="text-gray-400 italic p-2 text-sm">{message}</p>;
    }
    return (
      <ul className="space-y-3 p-1">
        {questsToRender.map(quest => {
          const isPending = quest.status === 'pending';
          const objectives = quest.objectives || [];
          const activeObjective = (quest.status === 'active' || isPending) ? objectives.find(obj => !obj.completed) : null;
          const completedObjectives = objectives.filter(obj => obj.completed).length;
          const totalObjectives = objectives.length;
          const progressPercent = totalObjectives > 0 ? (completedObjectives / totalObjectives) * 100 : 0;

          return (
            <li
              key={quest.id}
              className={`group relative text-sm text-gray-300 bg-gray-800/40 hover:bg-gray-700/60 p-3 rounded-xl cursor-pointer transition-all border shadow-sm ${
                  isPending ? 'border-amber-500/80 animate-pulse shadow-[0_0_8px_rgba(245,158,11,0.5)]' : 'border-gray-700/50 hover:border-indigo-500/50'
              }`}
              onClick={() => onQuestClick(quest)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => e.key === 'Enter' && onQuestClick(quest)}
              aria-label={`Details for quest ${quest.title}`}
            >
              <div className="flex flex-col gap-2">
                <div className="flex justify-between items-start gap-2">
                  <strong className={`${isPending ? 'text-amber-400' : 'text-indigo-300'} font-medium leading-tight`}>
                      {isPending && <span className="mr-1 text-[10px] bg-amber-500/20 px-1 py-0.5 rounded uppercase">Chờ</span>}
                      {quest.title}
                  </strong>
                  <span className="text-[10px] font-mono text-gray-500 whitespace-nowrap bg-gray-900/50 px-1.5 py-0.5 rounded">
                    {completedObjectives}/{totalObjectives}
                  </span>
                </div>

                {quest.completedByCanonProtagonist && (
                  <div className="text-[10px] sm:text-[11px] text-fuchsia-400 bg-fuchsia-950/40 border border-fuchsia-500/20 px-2 py-0.5 rounded-md w-fit font-medium flex items-center gap-1">
                    <span>✨</span>
                    <span>Nhân vật chính nguyên tác đã hoàn thành</span>
                  </div>
                )}

                {/* Progress Bar */}
                <div className="w-full h-1 bg-gray-900 rounded-full overflow-hidden">
                  <div 
                    className={`h-full transition-all duration-500 ease-out ${isPending ? 'bg-amber-500/50' : 'bg-indigo-500'}`}
                    style={{ width: `${progressPercent}%` }}
                  />
                </div>

                {quest.deadlineTurn && (quest.status === 'active') &&
                  <span className="text-[10px] text-red-400/80 font-medium">Hạn chót: Lượt {quest.deadlineTurn}</span>
                }
                
                {isPending && quest.turnsPending !== undefined && (
                   <span className="text-[10px] text-red-400/80 font-medium font-bold"> Sẽ tự động thất bại sau {3 - quest.turnsPending} lượt nếu không xác nhận!</span>
                )}
                
                {activeObjective && (
                  <div className={`mt-1 text-[11px] pl-2 border-l line-clamp-1 ${isPending ? 'text-amber-300/80 border-amber-500/30' : 'text-amber-300/90 border-amber-500/40'}`}>
                    <span className="opacity-80 italic">Đang làm: {activeObjective.text}</span>
                  </div>
                )}

                {(quest.rewardText || quest.rewardExp || quest.rewardCurrency) && (
                  <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[11px]">
                    <span className="text-emerald-400 font-medium">🎁 Thưởng:</span>
                    <span className="text-gray-300">
                      {quest.rewardText || `${quest.rewardCurrency || 0} Linh Thạch, +${quest.rewardExp || 0} Tu Vi`}
                    </span>
                  </div>
                )}

                {isPending && (
                  <div className="flex gap-2 mt-2" onClick={e => e.stopPropagation()}>
                    <button 
                        className="flex-1 bg-amber-600/80 hover:bg-amber-500 text-white text-xs font-bold py-1.5 rounded"
                        onClick={(e) => handleAcceptQuest(e, quest.id)}
                    >
                        Xác Nhận
                    </button>
                    <button 
                        className="flex-1 bg-gray-600/80 hover:bg-red-500 text-white text-xs font-bold py-1.5 rounded transition-colors"
                        onClick={(e) => handleRejectQuest(e, quest)}
                    >
                        Hủy Bỏ
                    </button>
                  </div>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    );
  };

  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center justify-between px-2 mb-2">
        <div className="flex border-b border-gray-700 flex-1">
          {(['pending', 'active', 'completed', 'failed'] as const).map(tab => (
            <button
              key={tab}
              className={`py-2 px-3 sm:px-4 text-xs sm:text-sm font-medium transition-all relative ${
                activeTab === tab
                  ? 'border-b-2 border-indigo-500 text-indigo-400'
                  : 'text-gray-400 hover:text-indigo-300'
              }`}
              onClick={() => setActiveTab(tab)}
            >
              {tab === 'pending' ? 'Chờ Nhận' : tab === 'active' ? VIETNAMESE.activeQuestsTab : tab === 'completed' ? VIETNAMESE.completedQuestsTab : VIETNAMESE.failedQuestsTab}
              {tab === 'pending' && pendingQuestsCount > 0 && (
                <span className="absolute -top-1 -right-1 flex h-4 w-4">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-4 w-4 bg-amber-500 text-[10px] text-white items-center justify-center font-bold">
                    {pendingQuestsCount}
                  </span>
                </span>
              )}
            </button>
          ))}
        </div>
        
        <div className="flex items-center gap-2 ml-2">
          <button
            onClick={handleSyncQuests}
            disabled={isSyncing}
            className="flex items-center gap-1.5 px-2.5 py-1 text-[10px] font-bold text-indigo-300 bg-indigo-950/40 hover:bg-indigo-900/60 border border-indigo-500/30 rounded-md transition-all active:scale-95 disabled:opacity-50 shrink-0"
            title="Đồng bộ cơ học nhiệm vụ cốt truyện theo mốc dòng thời gian (Timeline)"
          >
            <RefreshCw className={`w-3 h-3 text-indigo-400 ${isSyncing ? 'animate-spin' : ''}`} />
            {isSyncing ? 'Đồng bộ...' : 'Đồng Bộ'}
          </button>

          {(activeTab === 'active' || activeTab === 'pending') && (
            <div className="px-2 py-1 bg-indigo-900/30 rounded-md border border-indigo-500/20 shrink-0">
              <span className="text-[10px] font-bold text-indigo-400 whitespace-nowrap">
                {activeTab === 'pending' ? 'CHỜ DUYỆT' : 'SỐ LƯỢNG'}: {activeTab === 'pending' ? pendingQuestsCount : activeQuestsCount}/6
              </span>
            </div>
          )}
        </div>
      </div>
      <div className="flex-grow overflow-y-auto custom-scrollbar">
        {renderQuestList(filteredQuests)}
      </div>
    </div>
  );
};

export default QuestsDisplayPanel;
