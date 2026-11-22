import { KnowledgeBase, NPC } from '../types';

/**
 * Lấy tất cả thực thể có thể tham gia chiến đấu từ mọi nguồn trong KnowledgeBase.
 */
export function getAllCombatPoolEntities(kb: KnowledgeBase): any[] {
    const pools = [
        kb.discoveredNPCs || [],
        kb.discoveredYeuThu || [],
        kb.wives || [],
        kb.slaves || [],
        kb.prisoners || [],
        kb.pendingCombat?.temporaryEntities || []
    ];
    
    return pools.flat();
}

/**
 * Phân giải danh sách ID thực thể thành danh sách đối tượng thực thể hoàn chỉnh.
 */
export function resolveCombatEntitiesByIds(ids: string[], kb: KnowledgeBase): any[] {
    if (!ids || ids.length === 0) return [];
    
    const allEntities = getAllCombatPoolEntities(kb);
    const uniqueIds = Array.from(new Set(ids));
    
    return uniqueIds
        .map(id => {
            const found = allEntities.find(n => n && n.id === id);
            if (found) return found;
            
            // Fallback: Nếu không tìm thấy đối tượng NPC nào (có thể do lỗi dữ liệu)
            // thì trả về một object tối thiểu để tránh bị rỗng hoàn toàn trên UI
            return {
                id,
                name: `Thực thể ẩn (${id.slice(0, 4)})`,
                realm: "Không rõ",
                description: "Dữ liệu thực thể không tìm thấy trong bộ nhớ tạm."
            };
        })
        .filter(Boolean);
}
