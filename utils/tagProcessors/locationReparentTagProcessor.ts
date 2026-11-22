
import { KnowledgeBase, GameMessage } from '../../types';

export const processLocationReparent = (
    currentKb: KnowledgeBase,
    tagParams: Record<string, string>,
    turnForSystemMessages: number
): { updatedKb: KnowledgeBase; systemMessages: GameMessage[] } => {
    const newKb = currentKb;
    const systemMessages: GameMessage[] = [];

    const childId = tagParams.childId;
    const parentId = tagParams.parentId;

    if (!childId || !parentId) {
        console.warn("LOCATION_REPARENT: Missing childId or parentId.", tagParams);
        return { updatedKb: newKb, systemMessages };
    }

    const childLoc = newKb.discoveredLocations.find(l => l.id === childId);
    const parentLoc = newKb.discoveredLocations.find(l => l.id === parentId);

    if (childLoc && parentLoc) {
        childLoc.parentLocationId = parentId;
        
        // [CẬP NHẬT KINH TẾ] Gộp và thêm các khu vực kinh tế từ địa điểm phụ vào địa điểm chính
        if (childLoc.economicZones && childLoc.economicZones.length > 0) {
            if (!parentLoc.economicZones) {
                parentLoc.economicZones = [];
            }
            
            childLoc.economicZones.forEach(zone => {
                // Tránh trùng lặp ID hoặc tên
                const alreadyExists = parentLoc.economicZones?.some(z => z.id === zone.id || z.name === zone.name);
                if (!alreadyExists) {
                    parentLoc.economicZones?.push({ ...zone });
                }
            });
            console.log(`[ECON-MERGE] Đã gộp các khu vực kinh tế từ "${childLoc.name}" vào "${parentLoc.name}".`);
            childLoc.economicZones = [];
        }

        // When reparenting, we usually remove map coordinates since it's now a sub-location
        delete childLoc.mapX;
        delete childLoc.mapY;
        
        systemMessages.push({
            id: `location-reparented-${childId}`,
            type: 'system',
            content: `[Quy hoạch bản đồ] Địa điểm "${childLoc.name}" hiện đã được xếp vào làm địa điểm phụ của "${parentLoc.name}".`,
            timestamp: Date.now(),
            turnNumber: turnForSystemMessages
        });
    } else {
        console.warn(`LOCATION_REPARENT: Child (${childId}) or Parent (${parentId}) not found.`);
    }

    return { updatedKb: newKb, systemMessages };
};
