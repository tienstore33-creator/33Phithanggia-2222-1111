import React, { useState } from 'react';
import { useGame } from '../../hooks/useGame';
import { useGameActions } from '../../hooks/useGameActions';
import { VIETNAMESE } from '../../constants';
import Button from '../ui/Button';
import Modal from '../ui/Modal';

export const CombatTriggerOverlay = () => {
    const game = useGame();
    const { uiState, setUiState } = game;
    const [showFleeConfirm, setShowFleeConfirm] = useState(false);
    
    if (!game.knowledgeBase.pendingCombat || uiState.pendingCombatNoticeHidden) return null;

    const pendingCombat = game.knowledgeBase.pendingCombat;
    const isRecovering = !pendingCombat.analysis && !pendingCombat.analyzed;

    return (
        <>
            <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-300">
                <div className="w-full max-w-md bg-slate-900 border border-red-900/50 rounded-2xl shadow-2xl overflow-hidden flex flex-col">
                    <div className="p-6 border-b border-red-900/30 bg-gradient-to-r from-red-950/40 to-slate-900">
                        <div className="flex items-center justify-between mb-2">
                            <h3 className="text-xl font-bold text-red-100 flex items-center gap-2">
                                <span className="relative flex h-3 w-3">
                                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                                    <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500"></span>
                                </span>
                                {VIETNAMESE.pendingCombatNotice}
                            </h3>
                            <button 
                                onClick={() => setUiState(prev => ({ ...prev, pendingCombatNoticeHidden: true }))}
                                className="text-slate-400 hover:text-white transition-colors"
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            </button>
                        </div>
                        <p className="text-slate-400 text-sm italic">
                            {VIETNAMESE.combatSatKhiNotice}
                        </p>
                    </div>

                    <div className="p-6 bg-slate-900/50 space-y-4 max-h-[60vh] overflow-y-auto custom-scrollbar">
                        {/* Quick Actions at the top */}
                        <div className="flex gap-2 pb-2 border-b border-red-900/20">
                            <Button 
                                variant="secondary" 
                                className="flex-1 !py-2.5 font-bold text-xs text-cyan-300 bg-indigo-950/80 hover:bg-indigo-900/80 border-indigo-500/40"
                                onClick={() => !isRecovering && game.setIsCompanionSelectionModalOpen(true)}
                                disabled={isRecovering}
                                title="Chọn đội hình chiến đấu (Nô lệ, tù binh xuất trận)"
                            >
                                🛡️ Đội Hình
                            </Button>
                            <Button 
                                variant="secondary" 
                                className="flex-1 !py-2.5 font-bold text-xs text-indigo-300 bg-indigo-950/60 hover:bg-indigo-900/80 border-indigo-500/40"
                                onClick={() => !isRecovering && game.onAutoCombat()}
                                disabled={isRecovering}
                                title="Tự động so khớp chỉ số định đoạt kết quả"
                            >
                                ⚡ Tự Động Chiến
                            </Button>
                            <Button 
                                variant="warning" 
                                className="flex-1 !py-2.5 font-bold text-xs text-amber-300 bg-amber-950/60 hover:bg-amber-900/80 border-amber-500/40"
                                onClick={() => !isRecovering && setShowFleeConfirm(true)}
                                disabled={isRecovering}
                                title="100% thoát hiểm, phạt 1 tiểu cảnh giới, 70% tiền, -50 thiện cảm"
                            >
                                🏃 Bỏ Chạy
                            </Button>
                        </div>

                        {isRecovering ? (
                            <div className="flex flex-col items-center justify-center py-8 space-y-4">
                                <div className="w-12 h-12 border-4 border-red-500/20 border-t-red-500 rounded-full animate-spin"></div>
                                <p className="text-red-200/70 text-sm font-medium animate-pulse">{VIETNAMESE.analyzingCombatants}</p>
                            </div>
                        ) : (
                            <div className="space-y-4 animate-in slide-in-from-bottom-4 duration-500">
                                {/* Allies */}
                                {pendingCombat.allyIds && pendingCombat.allyIds.length > 0 && (
                                    <div className="space-y-2">
                                        <h4 className="text-xs font-bold text-blue-400 uppercase tracking-wider flex items-center gap-2">
                                            <div className="h-px flex-1 bg-blue-400/20"></div>
                                            {VIETNAMESE.combatAlliesLabel}
                                            <div className="h-px flex-1 bg-blue-400/20"></div>
                                        </h4>
                                        <div className="flex flex-wrap gap-2">
                                            {pendingCombat.allyIds.map(id => {
                                                const npc = game.knowledgeBase.discoveredNPCs.find(n => n.id === id) || 
                                                           game.knowledgeBase.pendingCombat?.temporaryEntities?.find(n => n.id === id);
                                                return (
                                                    <div key={id} className="px-3 py-1.5 bg-blue-950/30 border border-blue-900/30 rounded-lg text-blue-100 text-sm flex items-center gap-2">
                                                        <div className="w-2 h-2 rounded-full bg-blue-500"></div>
                                                        {npc?.name || "Đồng minh ẩn danh"}
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                )}

                                {/* Opponents */}
                                <div className="space-y-2">
                                    <h4 className="text-xs font-bold text-red-400 uppercase tracking-wider flex items-center gap-2">
                                        <div className="h-px flex-1 bg-red-400/20"></div>
                                        {VIETNAMESE.combatOpponentsLabel} - PHÂN TÍCH & SUY LUẬN
                                        <div className="h-px flex-1 bg-red-400/20"></div>
                                    </h4>
                                    <div className="space-y-2">
                                        {(() => {
                                            const allyCount = Math.max(1, (pendingCombat.allyIds?.length || 0) + 1);
                                            const maxAllowed = allyCount * 3;
                                            return pendingCombat.opponentIds.map((id, idx) => {
                                                const npc = game.knowledgeBase.discoveredNPCs.find(n => n.id === id) || 
                                                           game.knowledgeBase.pendingCombat?.temporaryEntities?.find(n => n.id === id);
                                                const yeuThu = game.knowledgeBase.discoveredYeuThu.find(y => y.id === id);
                                                const name = npc?.name || yeuThu?.name || "Kẻ địch ẩn danh";
                                                const realm = npc?.realm || yeuThu?.realm || game.knowledgeBase.worldRealmBase || "Phàm Nhân";
                                                
                                                let identityReasoning = npc?.description || yeuThu?.description || "";
                                                const reasoningMatch = /\[Suy luận định danh\]:\s*([\s\S]*)/i.exec(identityReasoning);
                                                if (reasoningMatch) {
                                                    identityReasoning = reasoningMatch[1].trim();
                                                }

                                                const isDimmed = idx >= maxAllowed;
                                                return (
                                                    <div key={id} className={`p-3 border rounded-xl text-sm space-y-1 transition-all ${isDimmed ? 'bg-slate-900/40 border-slate-800 text-gray-500 opacity-40 grayscale' : 'bg-red-950/30 border-red-900/40 text-red-100 shadow-sm'}`}>
                                                        <div className="flex items-center justify-between font-semibold">
                                                            <div className="flex items-center gap-2">
                                                                <div className={`w-2.5 h-2.5 rounded-full ${isDimmed ? 'bg-gray-600' : 'bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.6)]'}`}></div>
                                                                <span className={isDimmed ? 'line-through' : 'text-red-200'}>{name}</span>
                                                            </div>
                                                            {isDimmed && <span className="text-[10px] italic text-gray-400">(Bị làm mờ / Dự bị)</span>}
                                                        </div>
                                                        
                                                        <div className="pl-4 text-xs space-y-0.5 text-slate-300">
                                                            <div className="flex items-center gap-1.5 text-amber-300/90 font-medium">
                                                                <span>├─ Tu vi suy luận:</span>
                                                                <span className="bg-amber-950/50 border border-amber-800/40 px-1.5 py-0.5 rounded text-[11px] text-amber-200">⭐ {realm}</span>
                                                            </div>
                                                            {identityReasoning && (
                                                                <div className="flex items-start gap-1.5 text-slate-400">
                                                                    <span className="shrink-0">└─ Định danh:</span>
                                                                    <span className="italic leading-tight">{identityReasoning}</span>
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>
                                                );
                                            });
                                        })()}
                                    </div>
                                </div>

                                {/* Reasoning */}
                                {pendingCombat.reasoning && (
                                    <p className="text-xs text-slate-400 italic mt-4 border-t border-white/10 pt-4 leading-relaxed">
                                        {pendingCombat.reasoning}
                                    </p>
                                )}
                            </div>
                        )}
                    </div>

                    <div className="p-4 bg-slate-950/70 border-t border-red-900/20 flex gap-2">
                        <Button 
                            variant="secondary" 
                            className="flex-1 !py-2.5 font-bold text-slate-400 border-slate-700 hover:bg-slate-800 text-xs"
                            onClick={() => setUiState(prev => ({ ...prev, pendingCombatNoticeHidden: true }))}
                        >
                            {VIETNAMESE.laterButton}
                        </Button>
                        <Button 
                            variant="danger" 
                            className={`flex-[2] !py-2.5 font-bold tracking-wider uppercase shadow-[0_0_15px_rgba(220,38,38,0.3)] transition-all text-xs ${isRecovering ? 'opacity-50 grayscale cursor-not-allowed' : 'hover:scale-[1.02] active:scale-95'}`}
                            onClick={() => !isRecovering && game.onEnterCombat()}
                            disabled={isRecovering}
                        >
                            ⚔️ {VIETNAMESE.enterCombatButton}
                        </Button>
                    </div>
                </div>
            </div>

            {showFleeConfirm && (
                <Modal
                    isOpen={showFleeConfirm}
                    onClose={() => setShowFleeConfirm(false)}
                    title="XÁC NHẬN ĐÀO TẨU KHỎI CHIẾN TRƯỜNG"
                >
                    <div className="p-4 space-y-4 text-gray-200">
                        <div className="p-3 bg-amber-950/40 border border-amber-500/40 rounded-lg text-sm text-amber-200">
                            <p className="font-bold mb-1">⚠️ CẢNH BÁO TỔN THẤT KHI BỎ CHẠY:</p>
                            <p>Bạn sẽ <strong>100% bỏ chạy thành công</strong>, nhưng phải gánh chịu những hậu quả nặng nề sau:</p>
                            <ul className="list-disc list-inside mt-2 space-y-1 text-xs text-amber-300/90">
                                <li><strong>Mất 1 tiểu cảnh giới:</strong> Tổn thương kinh mạch làm tụt giảm tu vi và đưa EXP hiện tại về 0.</li>
                                <li><strong>Mất 70% ngân lượng:</strong> Đánh rơi phần lớn Linh Thạch trong lúc hoảng loạn tháo chạy.</li>
                                <li><strong>Giảm 50 điểm thiện cảm:</strong> Đối thủ và các NPC liên quan trong trận chiến sẽ căm ghét/khinh miệt bạn.</li>
                            </ul>
                        </div>
                        <p className="text-xs text-gray-400 italic">
                            Bạn có chắc chắn muốn bỏ chạy ngay lúc này không?
                        </p>
                        <div className="flex justify-end gap-3 pt-2">
                            <Button 
                                variant="ghost" 
                                onClick={() => setShowFleeConfirm(false)}
                            >
                                Hủy bỏ
                            </Button>
                            <Button 
                                variant="warning" 
                                onClick={() => {
                                    setShowFleeConfirm(false);
                                    game.onFleeCombat();
                                }}
                                className="bg-amber-600 hover:bg-amber-500 text-white font-bold"
                            >
                                Xác Nhận Bỏ Chạy
                            </Button>
                        </div>
                    </div>
                </Modal>
            )}
        </>
    );
};
