import { useEffect, useRef } from 'react';
import { KnowledgeBase } from '../types';

/**
 * Hook to recover combat analysis if it's missing (e.g., after loading a save).
 * It ensures that if a combat is pending but hasn't been analyzed by AI,
 * the analysis is triggered automatically.
 */
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
        const hasCombat = !!(kb.pendingCombat && kb.pendingCombat.opponentIds && kb.pendingCombat.opponentIds.length > 0);
        
        if (hasCombat && !kb.pendingCombat?.analyzed && !isLoadingApi && !isProcessing.current) {
            isProcessing.current = true;
            
            console.log("🛡️ [CombatRecovery] Đang khôi phục phân tích chiến đấu...");
            
            analyzeCombat(kb).finally(() => {
                isProcessing.current = false;
            });
        }
    }, [kb.pendingCombat, isLoadingApi, analyzeCombat]);
};
