import { useContext, useMemo } from 'react';
import { GameContext } from '../contexts/GameContext';
import { getEffectiveRealmSystem } from '../services/realmManager';
import { RealmSystem } from '../types';

/**
 * Hook để lấy hệ thống cảnh giới hiện tại của người chơi.
 * Tự động xử lý Fallback nếu không có cấu hình tùy chỉnh.
 */
export const useRealmSystem = (): RealmSystem => {
    const context = useContext(GameContext);
    
    if (!context) {
        throw new Error('useRealmSystem must be used within a GameProvider');
    }

    const { knowledgeBase } = context;

    return useMemo(() => {
        return getEffectiveRealmSystem(knowledgeBase);
    }, [knowledgeBase]);
};
