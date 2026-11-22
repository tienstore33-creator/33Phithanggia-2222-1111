import React, { useState } from 'react';
import { useGame } from '../../../hooks/useGame';
import { processItemSkillStats } from '../../../services/ai/itemSkillStatProcessorService';
import { Item, Skill, GameMessage } from '../../../types';
import { calculateEffectiveStats } from '../../../utils/statsCalculationUtils';

interface ItemSkillUsageModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ItemSkillUsageModal: React.FC<ItemSkillUsageModalProps> = ({ isOpen, onClose }) => {
  const { knowledgeBase, addMessageAndUpdateState, showNotification } = useGame();
  const [activeTab, setActiveTab] = useState<'items' | 'skills'>('items');
  const [selectedItemIds, setSelectedItemIds] = useState<Record<string, boolean>>({});
  const [selectedSkillIds, setSelectedSkillIds] = useState<Record<string, boolean>>({});
  const [itemQuantities, setItemQuantities] = useState<Record<string, number>>({});
  const [isLoading, setIsLoading] = useState(false);

  if (!isOpen || !knowledgeBase) return null;

  const playerStats = knowledgeBase.playerStats;
  const currentTurn = playerStats?.turn ?? 1;
  const lastItemUsedTurn = knowledgeBase.lastItemUsedTurn ?? 0;
  const hasUsedThisTurn = lastItemUsedTurn === currentTurn;

  const inventory = knowledgeBase.inventory || [];
  const skills = knowledgeBase.playerSkills || [];

  const handleToggleItem = (itemId: string) => {
    if (hasUsedThisTurn) return;
    setSelectedItemIds(prev => {
      const isChecking = !prev[itemId];
      if (isChecking && !itemQuantities[itemId]) {
        setItemQuantities(qPrev => ({ ...qPrev, [itemId]: 1 }));
      }
      return {
        ...prev,
        [itemId]: isChecking
      };
    });
  };

  const handleUpdateQty = (itemId: string, newQty: number) => {
    const item = inventory.find(i => i.id === itemId);
    if (!item) return;
    const maxQty = item.quantity || 1;
    const boundedQty = Math.max(1, Math.min(maxQty, newQty));
    setItemQuantities(prev => ({
      ...prev,
      [itemId]: boundedQty
    }));
  };

  const handleToggleSkill = (skillId: string) => {
    if (hasUsedThisTurn) return;
    setSelectedSkillIds(prev => ({
      ...prev,
      [skillId]: !prev[skillId]
    }));
  };

  const handleConfirmUsage = async () => {
    if (hasUsedThisTurn) {
      showNotification("Bạn đã sử dụng vật phẩm/kỹ năng ở lượt này rồi. Hãy đi tiếp sang lượt sau!", "error");
      return;
    }

    const selectedItems = inventory.filter(item => selectedItemIds[item.id]).map(item => ({
      ...item,
      quantity: itemQuantities[item.id] || 1
    }));
    const selectedSkills = skills.filter(skill => selectedSkillIds[skill.id]);

    if (selectedItems.length === 0 && selectedSkills.length === 0) {
      showNotification("Vui lòng chọn ít nhất một vật phẩm hoặc kỹ năng để sử dụng!", "error");
      return;
    }

    setIsLoading(true);
    try {
      const playerName = knowledgeBase.worldConfig?.playerName || "Hình Hàm";
      const playerGender = knowledgeBase.worldConfig?.playerGender || "Nam";

      // Gọi API xử lý chỉ số
      const result = await processItemSkillStats(
        selectedItems,
        selectedSkills,
        playerStats,
        playerName,
        playerGender
      );

      // Clone và cập nhật trạng thái KnowledgeBase
      const updatedKb = JSON.parse(JSON.stringify(knowledgeBase));
      const stats = updatedKb.playerStats;

      // Áp dụng biến động chỉ số vào base & permanent trước khi recalculate
      if (result.statDeltas) {
        const deltas = result.statDeltas;
        
        // 1. HP thay đổi (Sinh lực hiện tại)
        stats.sinhLuc = Math.max(0, stats.sinhLuc + (deltas.hp || 0));
        
        // Max HP thay đổi vĩnh viễn (Cộng vào base & permanentSinhLucBonus)
        if (deltas.maxHp) {
          stats.baseMaxSinhLuc = Math.max(1, (stats.baseMaxSinhLuc || 100) + deltas.maxHp);
          stats.permanentSinhLucBonus = (stats.permanentSinhLucBonus || 0) + deltas.maxHp;
        }

        // 2. Mana thay đổi (Linh lực hiện tại)
        stats.linhLuc = Math.max(0, stats.linhLuc + (deltas.mana || 0));
        
        // Max Mana thay đổi vĩnh viễn (Cộng vào baseMaxLinhLuc)
        if (deltas.maxMana) {
          stats.baseMaxLinhLuc = Math.max(1, (stats.baseMaxLinhLuc || 50) + deltas.maxMana);
        }

        // 3. Tấn công thay đổi vĩnh viễn (Cộng vào baseSucTanCong)
        if (deltas.atk) {
          stats.baseSucTanCong = Math.max(1, (stats.baseSucTanCong || 10) + deltas.atk);
        }

        // 4. Kinh nghiệm thay đổi (Kinh nghiệm hiện tại)
        if (deltas.exp) {
          stats.kinhNghiem = Math.max(0, stats.kinhNghiem + deltas.exp);
        }

        // Max EXP thay đổi vĩnh viễn
        if (deltas.maxExp) {
          stats.baseMaxKinhNghiem = Math.max(1, (stats.baseMaxKinhNghiem || 100) + deltas.maxExp);
        }

        // 5. Tiền tệ / Linh thạch
        if (deltas.currency) {
          stats.currency = Math.max(0, stats.currency + deltas.currency);
        }

        // 6. Thọ nguyên
        if (deltas.thoNguyen) {
          stats.thoNguyen = Math.max(1, (stats.thoNguyen || 100) + deltas.thoNguyen);
        }
      }

      // Áp dụng trạng thái đặc thù (Status Effect)
      if (result.status) {
        const newEffect = {
          id: `effect-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
          name: result.status,
          description: `Nhận hiệu ứng từ việc dùng vật phẩm/kỹ năng tự chọn`,
          type: (result.statusDuration && result.statusDuration > 0) ? 'debuff' : 'neutral',
          durationTurns: result.statusDuration || 3,
          statModifiers: {},
          specialEffects: []
        };
        stats.activeStatusEffects = [...(stats.activeStatusEffects || []), newEffect];
      }

      // Tiêu hao vật phẩm để chuẩn bị cho calculateEffectiveStats
      if (result.itemsConsumed && result.itemsConsumed.length > 0) {
        updatedKb.inventory = updatedKb.inventory.map((item: any) => {
          const consumed = result.itemsConsumed?.find(c => c.id === item.id);
          if (consumed) {
            const currentQty = item.quantity || 1;
            return { ...item, quantity: currentQty - consumed.quantity };
          }
          return item;
        }).filter((item: any) => (item.quantity ?? 1) > 0);
      }

      // CHẠY TÍNH TOÁN LẠI CHỈ SỐ EFFECTIVE ĐỂ ĐỒNG BỘ TRANG BỊ & BONUS VĨNH VIỄN LẬP TỨC
      const finalStats = calculateEffectiveStats(stats, updatedKb.equippedItems, updatedKb.inventory);
      
      // Giới hạn HP và MP hiện tại theo Max HP/MP mới tính toán xong
      finalStats.sinhLuc = Math.max(0, Math.min(finalStats.maxSinhLuc, finalStats.sinhLuc));
      finalStats.linhLuc = Math.max(0, Math.min(finalStats.maxLinhLuc, finalStats.linhLuc));
      
      updatedKb.playerStats = finalStats;

      // Áp dụng học kỹ năng mới
      if (result.skillsLearned && result.skillsLearned.length > 0) {
        const newSkillsList = result.skillsLearned.map(sk => ({
          ...sk,
          id: `skill-learned-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
          level: 1,
          skillType: 'Linh kỹ'
        }));
        updatedKb.playerSkills = [...(updatedKb.playerSkills || []), ...newSkillsList];
      }

      // Khóa lượt dùng hiện tại
      updatedKb.lastItemUsedTurn = currentTurn;

      // Tạo tin nhắn thông báo dạng hệ thống gửi vào gameMessages
      const systemMessageText = `[HỆ THỐNG - DÙNG VẬT PHẨM & KỸ NĂNG | LƯỢT ${currentTurn}]\n${result.systemLogs}`;
      const systemMsg: GameMessage = {
        id: `system-use-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        type: 'system',
        content: systemMessageText,
        timestamp: Date.now(),
        turnNumber: currentTurn
      };

      // Đồng bộ trạng thái mới & tin nhắn vào hệ thống
      addMessageAndUpdateState([systemMsg], updatedKb);
      showNotification("Sử dụng vật phẩm/kỹ năng thành công, chỉ số đã thay đổi!", "success");
      onClose();
    } catch (err: any) {
      console.error(err);
      showNotification(`Lỗi xử lý: ${err.message || String(err)}`, "error");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-gray-900 border border-teal-500/50 w-full max-w-2xl rounded-xl shadow-2xl flex flex-col max-h-[85vh] overflow-hidden">
        
        {/* Header */}
        <div className="p-4 border-b border-gray-800 flex justify-between items-center bg-gray-950">
          <div>
            <h3 className="text-xl font-bold text-teal-400 flex items-center gap-2">
              <span>⚡</span> Dùng Vật Phẩm & Kỹ Năng
            </h3>
            <p className="text-xs text-gray-400 mt-1">
              Lượt hiện tại: <span className="text-amber-400 font-semibold">{currentTurn}</span> 
              {hasUsedThisTurn ? (
                <span className="text-rose-400 ml-2 font-semibold">(Đã dùng ở lượt này, vui lòng đi tiếp lượt mới)</span>
              ) : (
                <span className="text-emerald-400 ml-2 font-semibold">(Sẵn sàng sử dụng - Giới hạn 1 lần/lượt)</span>
              )}
            </p>
          </div>
          <button 
            onClick={onClose}
            className="text-gray-400 hover:text-white bg-gray-800 hover:bg-gray-700 p-1.5 rounded-lg transition-colors"
          >
            ✕
          </button>
        </div>

        {/* Tab Selector */}
        <div className="flex border-b border-gray-800 bg-gray-900/60 p-2 gap-2">
          <button
            onClick={() => setActiveTab('items')}
            className={`flex-1 py-2 px-4 rounded-lg font-medium text-sm transition-all ${
              activeTab === 'items' 
                ? 'bg-teal-600/25 text-teal-300 border border-teal-500/30' 
                : 'text-gray-400 hover:text-gray-200 hover:bg-gray-800/50'
            }`}
          >
            🎒 Túi Đồ ({inventory.length})
          </button>
          <button
            onClick={() => setActiveTab('skills')}
            className={`flex-1 py-2 px-4 rounded-lg font-medium text-sm transition-all ${
              activeTab === 'skills' 
                ? 'bg-teal-600/25 text-teal-300 border border-teal-500/30' 
                : 'text-gray-400 hover:text-gray-200 hover:bg-gray-800/50'
            }`}
          >
            📜 Linh Kỹ & Thần Thông ({skills.length})
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 p-4 overflow-y-auto bg-gray-900/30">
          {activeTab === 'items' ? (
            inventory.length === 0 ? (
              <p className="text-gray-500 italic text-center py-8">Túi đồ của bạn hiện tại trống rỗng.</p>
            ) : (
              <div className="space-y-2">
                {inventory.map(item => {
                  const isChecked = !!selectedItemIds[item.id];
                  return (
                    <div 
                      key={item.id}
                      onClick={() => !hasUsedThisTurn && handleToggleItem(item.id)}
                      className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-all ${
                        isChecked 
                          ? 'bg-teal-950/40 border-teal-500/50' 
                          : 'bg-gray-800/50 border-gray-800 hover:bg-gray-800'
                      } ${hasUsedThisTurn ? 'opacity-60 cursor-not-allowed' : ''}`}
                    >
                      <input
                        type="checkbox"
                        checked={isChecked}
                        disabled={hasUsedThisTurn}
                        onChange={() => {}} // Handle inside parent div
                        className="mt-1 h-4 w-4 rounded border-gray-600 bg-gray-700 text-teal-600 focus:ring-teal-500 cursor-pointer"
                      />
                      <div className="flex-1">
                        <div className="flex justify-between items-center">
                          <span className="font-semibold text-gray-200 text-sm">{item.name}</span>
                          <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                            {isChecked && (item.quantity ?? 1) > 1 ? (
                              <div className="flex items-center border border-teal-500/30 rounded bg-gray-950 overflow-hidden text-[11px]">
                                <button
                                  type="button"
                                  disabled={hasUsedThisTurn}
                                  onClick={() => handleUpdateQty(item.id, (itemQuantities[item.id] || 1) - 1)}
                                  className="px-2 py-0.5 bg-gray-800 hover:bg-gray-700 text-teal-400 font-bold transition-colors disabled:opacity-50"
                                >
                                  -
                                </button>
                                <span className="px-2 font-semibold text-teal-300 font-mono">Dùng: {itemQuantities[item.id] || 1}</span>
                                <button
                                  type="button"
                                  disabled={hasUsedThisTurn}
                                  onClick={() => handleUpdateQty(item.id, (itemQuantities[item.id] || 1) + 1)}
                                  className="px-2 py-0.5 bg-gray-800 hover:bg-gray-700 text-teal-400 font-bold transition-colors disabled:opacity-50"
                                >
                                  +
                                </button>
                              </div>
                            ) : null}
                            <span className="text-xs text-amber-400 font-mono">Tổng: x{item.quantity || 1}</span>
                          </div>
                        </div>
                        <p className="text-xs text-gray-400 mt-1">{item.description || "Chưa có mô tả tác dụng."}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )
          ) : (
            skills.length === 0 ? (
              <p className="text-gray-500 italic text-center py-8">Bạn chưa sở hữu linh kỹ hay thần thông nào.</p>
            ) : (
              <div className="space-y-2">
                {skills.map(skill => {
                  const isChecked = !!selectedSkillIds[skill.id];
                  return (
                    <div 
                      key={skill.id}
                      onClick={() => !hasUsedThisTurn && handleToggleSkill(skill.id)}
                      className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-all ${
                        isChecked 
                          ? 'bg-teal-950/40 border-teal-500/50' 
                          : 'bg-gray-800/50 border-gray-800 hover:bg-gray-800'
                      } ${hasUsedThisTurn ? 'opacity-60 cursor-not-allowed' : ''}`}
                    >
                      <input
                        type="checkbox"
                        checked={isChecked}
                        disabled={hasUsedThisTurn}
                        onChange={() => {}} // Handle inside parent div
                        className="mt-1 h-4 w-4 rounded border-gray-600 bg-gray-700 text-teal-600 focus:ring-teal-500 cursor-pointer"
                      />
                      <div className="flex-1">
                        <span className="font-semibold text-gray-200 text-sm">{skill.name}</span>
                        <p className="text-xs text-gray-400 mt-1">{skill.description || "Kỹ năng tự thân, tiêu hao linh lực khi vận hành."}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )
          )}
        </div>

        {/* Footer actions */}
        <div className="p-4 border-t border-gray-800 bg-gray-950 flex gap-3 justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-850 hover:bg-gray-800 text-gray-300 rounded-lg text-sm transition-colors"
          >
            Hủy Bỏ
          </button>
          
          <button
            onClick={handleConfirmUsage}
            disabled={isLoading || hasUsedThisTurn}
            className={`px-5 py-2 font-bold rounded-lg text-sm transition-all flex items-center gap-2 ${
              hasUsedThisTurn
                ? 'bg-gray-800 text-gray-500 cursor-not-allowed border border-gray-700'
                : 'bg-gradient-to-r from-teal-600 to-indigo-600 text-white hover:from-teal-500 hover:to-indigo-500 border border-teal-400/30 shadow-lg shadow-teal-500/10'
            }`}
          >
            {isLoading ? (
              <>
                <span className="animate-spin text-xs">⏳</span> Đang Tính Toán Chỉ Số...
              </>
            ) : hasUsedThisTurn ? (
              "Đã Sử Dụng Ở Lượt Này"
            ) : (
              "⚡ Xác Nhận Sử Dụng"
            )}
          </button>
        </div>

      </div>
    </div>
  );
};
