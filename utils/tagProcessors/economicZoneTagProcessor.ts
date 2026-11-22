
import { KnowledgeBase, GameMessage, EconomicZoneStub, EconomicZoneType } from '../../types';
import { resolveParentLocation } from '../economy/locationResolver';

/**
 * Processes [ECON_ZONE: parentLocationId="...", id="...", name="...", type="...", description="..."]
 * Adds an economic zone stub to a location.
 */
export const processEconomicZone = (
    currentKb: KnowledgeBase,
    tagParams: Record<string, string>,
    turnForSystemMessages: number
): { updatedKb: KnowledgeBase; systemMessages: GameMessage[] } => {
    const newKb = currentKb;
    const systemMessages: GameMessage[] = [];

    const parentLocationId = tagParams.parentLocationId;
    const name = tagParams.name;
    const type = tagParams.type as EconomicZoneType;
    const description = tagParams.description;
    const id = tagParams.id || `econ-${name?.replace(/\s+/g, '-') || Date.now()}-${Math.random().toString(36).substring(2, 7)}`;

    if (!name || !type) {
        console.warn("ECON_ZONE: Missing name or type.", tagParams);
        return { updatedKb: newKb, systemMessages };
    }

    // Sử dụng bộ giải quyết địa điểm thông minh
    const { locationIndex, location: targetLocation, isFallback } = resolveParentLocation(newKb, parentLocationId);

    if (locationIndex > -1 && targetLocation) {
        if (!targetLocation.economicZones) {
            targetLocation.economicZones = [];
        }

        // Check if already exists by ID or name
        if (!targetLocation.economicZones.find(z => z.id === id || z.name === name)) {
            const newZone: EconomicZoneStub = {
                id,
                name,
                type,
                description: description || `Một khu vực kinh tế thuộc ${targetLocation.name}.`,
                isGenerated: false
            };
            targetLocation.economicZones.push(newZone);
            
            systemMessages.push({
                id: `econ-zone-added-${id}`,
                type: 'system',
                content: `Khu vực kinh tế mới tại ${targetLocation.name}: ${name}${isFallback ? ' (Tự động liên kết theo vị trí hiện tại)' : ''}.`,
                timestamp: Date.now(),
                turnNumber: turnForSystemMessages
            });
        }
    } else {
        console.warn(`ECON_ZONE: Không thể xác định địa điểm cha cho khu vực "${name}".`);
    }

    return { updatedKb: newKb, systemMessages };
};
