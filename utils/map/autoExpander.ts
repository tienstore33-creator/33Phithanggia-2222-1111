
import { KnowledgeBase, GameLocation, GameMessage } from '../../types';
import * as GameTemplates from '../../templates';
import { applyAutoLayout } from '../tagProcessors/locationTagProcessor';
import { callGeminiAPI } from '../../services/apiService';

const HUB_TYPES = [
    GameTemplates.LocationType.TOWN,
    GameTemplates.LocationType.CITY,
    GameTemplates.LocationType.CAPITAL,
    GameTemplates.LocationType.SECT_CLAN,
    GameTemplates.LocationType.VILLAGE
];

const WILD_TYPES = [
    GameTemplates.LocationType.FOREST,
    GameTemplates.LocationType.MOUNTAIN,
    GameTemplates.LocationType.CAVE,
    GameTemplates.LocationType.DUNGEON,
    GameTemplates.LocationType.RUIN,
    GameTemplates.LocationType.RIVER_LAKE,
    GameTemplates.LocationType.LANDMARK
];

/**
 * Logic to automatically expand the map when the player enters a location.
 * Implements the "Auto-Radar" discovery mechanism.
 */
export async function checkAndExpandConnections(
    kb: KnowledgeBase,
    currentLocationId: string,
    _apiKey: string // Kept for compatibility but we use callGeminiAPI internally
): Promise<{ updatedKb: KnowledgeBase; systemMessages: GameMessage[] }> {
    const newKb = JSON.parse(JSON.stringify(kb)) as KnowledgeBase;
    const systemMessages: GameMessage[] = [];

    const currentLocation = newKb.discoveredLocations.find(l => l.id === currentLocationId);
    if (!currentLocation || currentLocation.parentLocationId) return { updatedKb: newKb, systemMessages };

    // 1. Calculate existing connections
    const connections = currentLocation.connections || [];
    if (connections.length > 2) return { updatedKb: newKb, systemMessages };

    const targetDegree = 3; // Cấu trúc Honey Grid (Lưới tổ ong) thường có bậc 3
    const neededConnections = targetDegree - connections.length;
    
    if (neededConnections <= 0) return { updatedKb: newKb, systemMessages };
    
    console.log(`[AutoExpander] Honey Grid Check: "${currentLocation.name}" có ${connections.length} kết nối. Mục tiêu là ${targetDegree}.`);

    // 2. Thử kết nối với các địa điểm hiện có theo thứ tự ưu tiên: 0 -> 2 -> 1
    const allMainLocations = newKb.discoveredLocations.filter(l => !l.parentLocationId && l.id !== currentLocationId);
    
    // Lọc bỏ những điểm đã kết nối với điểm hiện tại và những điểm đã có >= 3 kết nối
    const candidates = allMainLocations.filter(l => 
        !currentLocation.connections?.some(c => c.targetLocationId === l.id) &&
        (l.connections?.length || 0) < 3
    );

    // Xếp hạng ưu tiên: 0 kết nối (cao nhất) > 2 kết nối (tạo đỉnh lục giác) > 1 kết nối
    const getPriority = (degrees: number) => {
        if (degrees === 0) return 0; // Ưu tiên số 1: Điểm cô lập
        if (degrees === 2) return 1; // Ưu tiên số 2: Điểm sắp hoàn thiện bậc 3
        if (degrees === 1) return 2; // Ưu tiên số 3: Điểm đơn độc
        return 3;
    };

    candidates.sort((a, b) => {
        const degA = a.connections?.length || 0;
        const degB = b.connections?.length || 0;
        return getPriority(degA) - getPriority(degB);
    });
    
    let addedCount = 0;
    
    // Kết nối với ứng viên tốt nhất nếu có
    if (candidates.length > 0) {
        const candidate = candidates[0];
        if (!currentLocation.connections) currentLocation.connections = [];
        if (!candidate.connections) candidate.connections = [];
        
        currentLocation.connections.push({ targetLocationId: candidate.id, isDiscovered: true });
        candidate.connections.push({ targetLocationId: currentLocationId, isDiscovered: true });
        
        addedCount++;
        console.log(`[AutoExpander] Honey Grid: Đã kết nối với điểm cũ ${candidate.name} (Bậc mới: ${candidate.connections.length})`);
        
        systemMessages.push({
            id: `auto-discover-honey-${candidate.id}`,
            type: 'system',
            content: `✨ Liên kết lưới tổ ong: Đường mòn cổ xưa dẫn bạn quay lại ${candidate.name}.`,
            timestamp: Date.now(),
            turnNumber: newKb.playerStats.turn
        });
    }

    // 3. Chỉ tạo DUY NHẤT 1 địa điểm mới nếu vẫn cần mở rộng (Theo yêu cầu người dùng)
    if (addedCount === 0) {
        const isHub = Math.random() < 0.3;
        const typePool = isHub ? HUB_TYPES : WILD_TYPES;
        const requestedTypes = [typePool[Math.floor(Math.random() * typePool.length)]];

        try {
            const aiLocations = await generateLocationsViaAI(currentLocation, requestedTypes, newKb.worldConfig?.genre);
            
            aiLocations.forEach(locData => {
                const newLoc: GameLocation = {
                    id: `loc-auto-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
                    name: locData.name,
                    description: locData.description,
                    locationType: locData.type as any,
                    visited: false,
                    isSafeZone: HUB_TYPES.includes(locData.type as any),
                    connections: [{ targetLocationId: currentLocationId, isDiscovered: true }]
                };
                
                newKb.discoveredLocations.push(newLoc);
                
                if (!currentLocation.connections) currentLocation.connections = [];
                currentLocation.connections.push({ targetLocationId: newLoc.id, isDiscovered: true });

                systemMessages.push({
                    id: `auto-discover-${newLoc.id}`,
                    type: 'system',
                    content: `✨ Khám phá mới: Phát hiện ${newLoc.name} (${newLoc.locationType}) ở rìa lãnh thổ.`,
                    timestamp: Date.now(),
                    turnNumber: newKb.playerStats.turn
                });
            });

        } catch (error) {
            console.error("[AutoExpander] AI generation failed:", error);
        }
    }

    // 4. Finalize layout
    return { updatedKb: applyAutoLayout(newKb), systemMessages };
}

async function generateLocationsViaAI(
    contextLoc: GameLocation,
    types: string[],
    genre?: string
): Promise<Array<{ name: string; description: string; type: string }>> {
    const prompt = `
        Bối cảnh thế giới: ${genre || "Tu tiên huyền huyễn"}.
        Địa điểm hiện tại: "${contextLoc.name}" - ${contextLoc.description}.
        
        Hãy tạo ra ${types.length} địa điểm mới kết nối với địa điểm này.
        Chủng loại yêu cầu: [${types.join(", ")}].
        
        Yêu cầu trả về mảng JSON:
        [
          { "name": "Tên địa điểm (phù hợp bối cảnh)", "description": "Mô tả ngắn gọn 1 câu", "type": "Chủng loại tương ứng" }
        ]
    `;

    const { text } = await callGeminiAPI(
        prompt, 
        undefined, 
        'economy', // Use economy model (Flash-Lite) for efficiency
        undefined,
        "Bạn là một kiến trúc sư thế giới game chuyên nghiệp. Hãy tạo ra các địa điểm thú vị và nhất quán với bối cảnh.",
        false,
        "application/json",
        undefined,
        undefined,
        "Tự động mở rộng bản đồ"
    );

    try {
        const cleanedText = text.replace(/```json/g, "").replace(/```/g, "").trim();
        return JSON.parse(cleanedText);
    } catch (e) {
        console.error("[AutoExpander] Failed to parse AI response:", text);
        return [];
    }
}
