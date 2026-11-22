import { useEffect, useRef } from 'react';
import { KnowledgeBase } from '../../types';

export const useCombatRecovery = (
    kb: KnowledgeBase, 
    isLoadingApi: boolean,
    analyzeCombat: (kb: KnowledgeBase) => Promise<void>
) => {
    const isProcessing = useRef(false);

    useEffect(() => {
        // Kiểm tra điều kiện ngặt nghèo:
        // 1. Có pendingCombat và có dữ liệu kẻ địch bên trong
        // 2. Chưa có analysis
        // 3. AI đang rảnh
        // 4. KHÔNG đang trong quá trình khôi phục (Lock)
        const hasCombat = kb.pendingCombat && kb.pendingCombat.enemy && Object.keys(kb.pendingCombat.enemy).length > 0;
        
        if (hasCombat && !kb.pendingCombat?.analysis && !isLoadingApi && !isProcessing.current) {
            console.log("🛡️ [RECOVERY] Phát hiện trạng thái chiến đấu chưa phân tích. Bắt đầu khôi phục...");
            
            const runRecovery = async () => {
                isProcessing.current = true;
                try {
                    await analyzeCombat(kb);
                } catch (error) {
                    console.error("❌ [RECOVERY] Lỗi khi khôi phục phân tích chiến đấu:", error);
                } finally {
                    // Giữ lock thêm một chút để tránh race condition
                    setTimeout(() => {
                        isProcessing.current = false;
                    }, 1000);
                }
            };

            runRecovery();
        }
    }, [kb.pendingCombat?.analyzed, kb.pendingCombat?.enemy, isLoadingApi, analyzeCombat]);
};
