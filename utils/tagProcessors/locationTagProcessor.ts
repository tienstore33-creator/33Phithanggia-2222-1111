
import { KnowledgeBase, GameMessage, GameLocation, VectorMetadata } from '../../types';
import * as GameTemplates from '../../templates';
import { handleLocationEntryEvents } from '../locationEvents';

import { formatLocationForEmbedding } from '../ragUtils';
import { inferLocationType } from '../locationTypeInferer';
// FIX: Moved imports for map constants here as they are used by applyAutoLayout.
import { MAP_CONFIG, MAP_SIZES } from '../../components/gameplay/map/mapConstants';
import { diceCoefficient, normalizeStringForComparison } from '../questUtils';

// Helper function for fuzzy matching location IDs by normalizing their name part.
const normalizeForIdComparison = (str: string): string => {
    if (!str) return '';
    return str
        .toLowerCase()
        // Decompose accented letters into base letters and combining marks
        .normalize("NFD")
        // Remove combining diacritical marks
        .replace(/[\u0300-\u036f]/g, "")
        // Special case for the letter 'đ'
        .replace(/đ/g, "d")
        // Remove all non-alphanumeric characters (spaces, numbers)
        // FIX: Changed a-0-9 to a-z0-9 to avoid 'Range out of order' error
        .replace(/[^a-z0-9]/g, '');
};

// --- NEW: Spiral Search Algorithm for finding unoccupied coordinates ---

/**
 * Checks if a given coordinate is too close to any existing location.
 * @param x The x-coordinate to check.
 * @param y The y-coordinate to check.
 * @param existingCoords An array of existing coordinates.
 * @param minDistance The minimum allowed distance.
 * @returns True if the coordinate is free, false otherwise.
 */
const isCoordinateFree = (
    x: number,
    y: number,
    existingCoords: { x: number; y: number }[],
    minDistance: number
): boolean => {
    for (const coord of existingCoords) {
        const distance = Math.sqrt(Math.pow(x - coord.x, 2) + Math.pow(y - coord.y, 2));
        if (distance < minDistance) {
            return false; // Too close
        }
    }
    return true; // The spot is free
};

/**
 * Finds an unoccupied coordinate on the map using an optimized proximity & density search.
 * This ensures new locations are created close to the starting point (current location)
 * while selecting the least crowded spot to avoid overlap.
 * @param existingCoords An array of existing location coordinates.
 * @param startX The initial x-coordinate (usually from current location or AI target).
 * @param startY The initial y-coordinate.
 * @returns An object with the new { x, y } coordinates.
 */
const findUnoccupiedCoordinates = (
    existingCoords: { x: number; y: number }[],
    startX: number,
    startY: number
): { x: number; y: number } => {
    const { SVG_VIEWBOX_WIDTH, SVG_VIEWBOX_HEIGHT } = MAP_SIZES;

    // Khoảng cách an toàn tối thiểu giữa các địa điểm để hiển thị thoáng đãng và dễ bấm chọn
    const minDistance = 100; 

    let bestX = startX;
    let bestY = startY;
    let bestScore = Infinity; // Càng thấp càng tốt (kết hợp khoảng cách gần và mật độ ít đông đúc nhất)

    const stepSize = 30;
    const maxRadius = 600; // Tăng một chút vùng tìm kiếm
    let foundAnyValid = false;

    // Quét các bán kính từ tâm ra ngoài để ưu tiên các vị trí "gần" nhất
    // KHỞI ĐẦU TỪ R=100 để đảm bảo địa điểm mới "cách ra một đoạn" so với điểm gốc (người chơi)
    for (let r = 100; r <= maxRadius; r += stepSize) {
        // Sinh các điểm phân bố đều trên đường tròn bán kính r
        const numPoints = r === 0 ? 1 : Math.max(8, Math.round((2 * Math.PI * r) / stepSize));
        
        for (let i = 0; i < numPoints; i++) {
            const angle = (i * 2 * Math.PI) / numPoints;
            const px = Math.round(startX + r * Math.cos(angle));
            const py = Math.round(startY + r * Math.sin(angle));

            // Kiểm tra giới hạn của bản đồ (giữ lề 60px để không sát mép)
            if (px < 60 || px > SVG_VIEWBOX_WIDTH - 60 || py < 60 || py > SVG_VIEWBOX_HEIGHT - 60) {
                continue;
            }

            // Kiểm tra khoảng cách an toàn tối thiểu và đo lường độ đông đúc xung quanh
            let isValid = true;
            let densityScore = 0; // Tổng mức độ chen chúc quanh điểm này

            for (const coord of existingCoords) {
                const dist = Math.sqrt(Math.pow(px - coord.x, 2) + Math.pow(py - coord.y, 2));
                if (dist < minDistance) {
                    isValid = false;
                    break;
                }
                // Nếu có các địa điểm khác trong bán kính 200px lân cận, tích lũy điểm đông đúc
                if (dist < 200) {
                    densityScore += (200 - dist);
                }
            }

            if (isValid) {
                foundAnyValid = true;
                // Điểm số tối ưu: ưu tiên mật độ thấp (ít đông đúc nhất) trước, sau đó là cự ly gần tâm nhất
                const score = (densityScore * 1.5) + r;

                if (score < bestScore) {
                    bestScore = score;
                    bestX = px;
                    bestY = py;
                }
            }
        }

        // Dừng sớm nếu đã tìm thấy điểm tốt ở bán kính nhỏ hơn hoặc bằng 120 để tối ưu hiệu suất
        if (foundAnyValid && r >= 120) {
            break;
        }
    }

    if (foundAnyValid) {
        return { x: bestX, y: bestY };
    }

    // Fallback nếu không quét được điểm nào trống: tìm ngẫu nhiên điểm thoáng nhất
    console.warn("Could not find ideal placement using smart search. Using fallback.");
    let maxMinDist = -1;
    let fallbackX = startX;
    let fallbackY = startY;

    for (let attempt = 0; attempt < 100; attempt++) {
        const rx = Math.round(60 + Math.random() * (SVG_VIEWBOX_WIDTH - 120));
        const ry = Math.round(60 + Math.random() * (SVG_VIEWBOX_HEIGHT - 120));

        let minDist = Infinity;
        for (const coord of existingCoords) {
            const dist = Math.sqrt(Math.pow(rx - coord.x, 2) + Math.pow(ry - coord.y, 2));
            if (dist < minDist) {
                minDist = dist;
            }
        }

        if (minDist > maxMinDist) {
            maxMinDist = minDist;
            fallbackX = rx;
            fallbackY = ry;
        }
    }

    return { x: fallbackX, y: fallbackY };
};


export const processMainLocation = (
    currentKb: KnowledgeBase,
    tagParams: Record<string, string>,
    turnForSystemMessages: number
): { updatedKb: KnowledgeBase; systemMessages: GameMessage[]; newVectorMetadata?: VectorMetadata } => {
    const newKb = currentKb;
    const systemMessages: GameMessage[] = [];
    let newVectorMetadata: VectorMetadata | undefined = undefined;

    const name = tagParams.name;
    const description = tagParams.description;
    const locationType = tagParams.locationType as GameTemplates.LocationTypeValues | undefined;

    if (!name || !description) {
        console.warn("MAINLOCATION: Missing name or description.", tagParams);
        return { updatedKb: newKb, systemMessages };
    }

    if (!newKb.discoveredLocations.find(l => l.name === name)) {
        let mapX = tagParams.mapX ? parseInt(tagParams.mapX, 10) : undefined;
        let mapY = tagParams.mapY ? parseInt(tagParams.mapY, 10) : undefined;
        
        const existingCoords = newKb.discoveredLocations
            .filter(l => l.mapX !== undefined && l.mapY !== undefined)
            .map(l => ({ x: l.mapX!, y: l.mapY! }));

        let startX, startY;
        let correctionMessage: string | null = null;
        
        if (mapX !== undefined && mapY !== undefined && !isNaN(mapX) && !isNaN(mapY)) {
            // AI provided coordinates, use them as the starting point
            startX = mapX;
            startY = mapY;
            if (!isCoordinateFree(startX, startY, existingCoords, MAP_CONFIG.MIN_DISTANCE_BETWEEN_LOCATIONS)) {
                correctionMessage = `AI-provided coordinates for "${name}" (${startX},${startY}) caused a collision. Finding nearest empty spot.`;
            }
        } else {
            // AI did not provide coordinates, use current location as starting point
            const currentLocation = newKb.discoveredLocations.find(l => l.id === newKb.currentLocationId);
            startX = currentLocation?.mapX || MAP_SIZES.SVG_VIEWBOX_WIDTH / 2;
            startY = currentLocation?.mapY || MAP_SIZES.SVG_VIEWBOX_HEIGHT / 2;
             correctionMessage = `AI did not provide coordinates for "${name}". Finding an empty spot near current location.`;
        }

        const finalCoords = findUnoccupiedCoordinates(existingCoords, startX, startY);
        mapX = Math.round(finalCoords.x);
        mapY = Math.round(finalCoords.y);

        if(correctionMessage) {
            console.log(`[MAP-PLACEMENT] ${correctionMessage}`);
        }

        const newLocation: GameLocation = {
            id: `loc-${name.replace(/\s+/g, '-')}-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
            name: name,
            description: description,
            isSafeZone: tagParams.isSafeZone !== undefined ? tagParams.isSafeZone.toLowerCase() === 'true' : true,
            regionId: tagParams.regionId || undefined,
            mapX: mapX,
            mapY: mapY,
            visited: false,
            locationType: (locationType && Object.values(GameTemplates.LocationType).includes(locationType as any) && locationType !== GameTemplates.LocationType.DEFAULT)
                ? (locationType as GameTemplates.LocationTypeValues)
                : inferLocationType(name, description),
            economicZones: tagParams.economicZonesJSON ? (() => {
                try {
                    return JSON.parse(tagParams.economicZonesJSON).map((z: any) => ({
                        ...z,
                        isGenerated: false
                    }));
                } catch (e) {
                    console.error("Lỗi parse economicZonesJSON:", e);
                    return [];
                }
            })() : []
        };
        newKb.discoveredLocations.push(newLocation);
        newVectorMetadata = { entityId: newLocation.id, entityType: 'location', text: formatLocationForEmbedding(newLocation) };
        
        systemMessages.push({
            id: 'location-discovered-' + newLocation.id,
            type: 'system',
            content: `Địa điểm mới được khám phá: ${name}.`,
            timestamp: Date.now(),
            turnNumber: turnForSystemMessages
        });
    }

    return { updatedKb: newKb, systemMessages, newVectorMetadata };
};

export const processSubLocation = (
    currentKb: KnowledgeBase,
    tagParams: Record<string, string>,
    turnForSystemMessages: number
): { updatedKb: KnowledgeBase; systemMessages: GameMessage[]; newVectorMetadata?: VectorMetadata; } => {
    const newKb = currentKb;
    const systemMessages: GameMessage[] = [];
    let newVectorMetadata: VectorMetadata | undefined = undefined;

    const name = tagParams.name;
    const description = tagParams.description;
    let parentLocationId = tagParams.parentLocationId;
    const locationType = tagParams.locationType as GameTemplates.AnyLocationType | undefined;

    if (!name || !description || !parentLocationId) {
        console.warn("SUBLOCATION: Missing name, description, or parentLocationId.", tagParams);
        return { updatedKb: newKb, systemMessages };
    }

    let parentLocation = newKb.discoveredLocations.find(l => l.id === parentLocationId);

    if (!parentLocation) {
        let correctedParentFound = false;
        const aiIdParts = parentLocationId.split('-');
        if (aiIdParts.length > 2) {
            const aiNamePart = aiIdParts.slice(1, -1).join('-');
            const normalizedAiName = normalizeForIdComparison(aiNamePart);
            for (const potentialParent of newKb.discoveredLocations) {
                const existingIdParts = potentialParent.id.split('-');
                if (existingIdParts.length > 2) {
                    const existingNamePart = existingIdParts.slice(1, -1).join('-');
                    const normalizedExistingName = normalizeForIdComparison(existingNamePart);

                    if (normalizedAiName === normalizedExistingName) {
                        const originalIdFromAI = parentLocationId;
                        parentLocationId = potentialParent.id;
                        parentLocation = potentialParent;
                        correctedParentFound = true;
                        console.log(`[DEBUG] Đã tự động sửa lỗi ID của địa điểm cha cho "${name}". ID gốc từ AI: "${originalIdFromAI}", ID đã sửa: "${parentLocationId}".`);
                        break;
                    }
                }
            }
        }
        if (!correctedParentFound) {
            console.warn(`SUBLOCATION: Parent location with ID "${tagParams.parentLocationId}" not found for sub-location "${name}" (fuzzy match also failed).`);
            systemMessages.push({
                id: `parent-id-fail-${Date.now()}`,
                type: 'system',
                content: `[DEBUG] Lỗi tạo địa điểm phụ "${name}": Không tìm thấy địa điểm cha với ID "${tagParams.parentLocationId}", kể cả sau khi đã cố gắng sửa lỗi.`,
                timestamp: Date.now(),
                turnNumber: turnForSystemMessages
            });
            return { updatedKb: newKb, systemMessages };
        }
    }

    if (!newKb.discoveredLocations.find(l => l.name === name && l.parentLocationId === parentLocationId)) {
        const newLocation: GameLocation = {
            id: `loc-${name.replace(/\s+/g, '-')}-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
            name: name,
            description: description,
            isSafeZone: tagParams.isSafeZone !== undefined ? tagParams.isSafeZone.toLowerCase() === 'true' : true,
            parentLocationId: parentLocationId,
            locationType: locationType && (Object.values(GameTemplates.LocationType).includes(locationType as any) || Object.values(GameTemplates.EconomyLocationType).includes(locationType as any) || Object.values(GameTemplates.SubLocationType).includes(locationType as any))
                ? locationType
                : GameTemplates.SubLocationType.OTHER,
            economicZones: tagParams.economicZonesJSON ? (() => {
                try {
                    return JSON.parse(tagParams.economicZonesJSON).map((z: any) => ({
                        ...z,
                        isGenerated: false
                    }));
                } catch (e) {
                    return [];
                }
            })() : []
        };
        
        // Sub-locations don't get map coordinates, they are accessed via the parent.

        newKb.discoveredLocations.push(newLocation);
        newVectorMetadata = { entityId: newLocation.id, entityType: 'location', text: formatLocationForEmbedding(newLocation) };

        systemMessages.push({
            id: 'sublocation-discovered-' + newLocation.id,
            type: 'system',
            content: `Khu vực mới trong ${parentLocation!.name} được khám phá: ${name}.`,
            timestamp: Date.now(),
            turnNumber: turnForSystemMessages
        });
    }

    return { updatedKb: newKb, systemMessages, newVectorMetadata };
};

export const processLocationUpdate = (
    currentKb: KnowledgeBase,
    tagParams: Record<string, string>,
    turnForSystemMessages: number
): { updatedKb: KnowledgeBase; systemMessages: GameMessage[]; updatedVectorMetadata?: VectorMetadata; } => {
    const newKb = currentKb;
    const systemMessages: GameMessage[] = [];
    const name = tagParams.name;
    const newName = tagParams.newName;
    const description = tagParams.description;
    const isSafeZone = tagParams.isSafeZone || tagParams.isSafe;
    const mapX = tagParams.mapX;
    const mapY = tagParams.mapY;
    // FIX: Changed type cast to AnyLocationType to allow for all valid location types.
    const locationType = tagParams.locationType as GameTemplates.AnyLocationType | undefined;
    let updatedVectorMetadata: VectorMetadata | undefined = undefined;

    if (!name) {
        console.warn("LOCATION_UPDATE: Missing name.", tagParams);
        return { updatedKb: newKb, systemMessages };
    }

    const locIndex = newKb.discoveredLocations.findIndex(l => l.name === name);
    if (locIndex > -1) {
        const locToUpdate = newKb.discoveredLocations[locIndex];
        if (newName) locToUpdate.name = newName;
        if (description) locToUpdate.description = description;
        if (isSafeZone !== undefined) locToUpdate.isSafeZone = isSafeZone.toLowerCase() === 'true';
        if (mapX !== undefined && !isNaN(parseInt(mapX,10))) locToUpdate.mapX = parseInt(mapX, 10);
        if (mapY !== undefined && !isNaN(parseInt(mapY,10))) locToUpdate.mapY = parseInt(mapY, 10);
        // FIX: Check against all valid location types (main, sub, economy) to fix type error.
        if (locationType && (
            Object.values(GameTemplates.LocationType).includes(locationType as any) ||
            Object.values(GameTemplates.EconomyLocationType).includes(locationType as any) ||
            Object.values(GameTemplates.SubLocationType).includes(locationType as any)
        )) {
            // Refine if AI provided DEFAULT or if we want to ensure classification
            if (locationType === GameTemplates.LocationType.DEFAULT || locationType === GameTemplates.SubLocationType.OTHER) {
                locToUpdate.locationType = inferLocationType(newName || locToUpdate.name, description || locToUpdate.description);
            } else {
                locToUpdate.locationType = locationType;
            }
        }
        if (tagParams.economicZonesJSON) {
            try {
                const newZones = JSON.parse(tagParams.economicZonesJSON).map((z: any) => ({
                    ...z,
                    isGenerated: false
                }));
                locToUpdate.economicZones = newZones;
            } catch (e) {
                console.error("Lỗi cập nhật economicZonesJSON:", e);
            }
        }
        systemMessages.push({
            id: 'location-updated-' + locToUpdate.id,
            type: 'system',
            content: `Thông tin về địa điểm ${name} đã được cập nhật.`,
            timestamp: Date.now(),
            turnNumber: turnForSystemMessages
        });
        updatedVectorMetadata = {
            entityId: locToUpdate.id,
            entityType: 'location',
            text: formatLocationForEmbedding(locToUpdate)
        };
    } else {
        console.warn(`LOCATION_UPDATE: Location "${name}" not found.`);
    }

    return { updatedKb: newKb, systemMessages, updatedVectorMetadata };
};

export const processLocationChange = async (
    currentKb: KnowledgeBase,
    tagParams: Record<string, string>,
    turnForSystemMessages: number
): Promise<{ updatedKb: KnowledgeBase; systemMessages: GameMessage[] }> => {
    let newKb = currentKb;
    const systemMessages: GameMessage[] = [];
    const locationName = tagParams.name;

    if (!locationName) {
        console.warn("LOCATION_CHANGE: Missing location name.", tagParams);
        return { updatedKb: newKb, systemMessages };
    }

    let targetLocationIndex = newKb.discoveredLocations.findIndex(l => l.name === locationName);

    // --- NEW: AUTO-CREATE SAFETY NET ---
    if (targetLocationIndex === -1) {
        console.log(`[Safety Net] Location "${locationName}" not found. Auto-creating...`);
        const { updatedKb: kbAfterAutoCreate, systemMessages: createMessages } = processMainLocation(newKb, {
            name: locationName,
            description: `Một địa điểm mới được phát hiện trong hành trình: ${locationName}.`,
            locationType: GameTemplates.LocationType.DEFAULT
        }, turnForSystemMessages);
        
        newKb = kbAfterAutoCreate;
        systemMessages.push(...createMessages);
        // Re-find index
        targetLocationIndex = newKb.discoveredLocations.findIndex(l => l.name === locationName);
    }
    // ------------------------------------

    if (targetLocationIndex > -1) {
        const targetLocation = newKb.discoveredLocations[targetLocationIndex];
        const locationChanged = newKb.currentLocationId !== targetLocation.id;
        
        if (locationChanged) {
            const oldLocation = newKb.discoveredLocations.find(l => l.id === newKb.currentLocationId);
            
            // Record last movement path for map visualization
            if (oldLocation) {
                newKb.lastMovementPath = {
                    fromId: oldLocation.id,
                    toId: targetLocation.id,
                    timestamp: Date.now()
                };
            }

            newKb.currentLocationId = targetLocation.id;
            // Reset safety override when moving to a new location to force AI re-evaluation, unless set in this turn
            if (newKb.lastSafetyAssessmentTurn !== turnForSystemMessages) {
                newKb.currentLocationSafetyOverride = undefined;
                newKb.lastSafetyAssessmentTurn = undefined;
            }
            
            systemMessages.push({
                id: 'location-changed-' + targetLocation.id,
                type: 'system',
                content: `Bạn đã di chuyển đến: ${locationName}.`,
                timestamp: Date.now(),
                turnNumber: turnForSystemMessages
            });

            // --- AUTO TRAVEL TIME CALCULATOR ---
            let distance = 150; // default distance if coordinates not set
            if (oldLocation && oldLocation.mapX !== undefined && oldLocation.mapY !== undefined && targetLocation.mapX !== undefined && targetLocation.mapY !== undefined) {
                distance = Math.round(Math.sqrt(Math.pow(targetLocation.mapX - oldLocation.mapX, 2) + Math.pow(targetLocation.mapY - oldLocation.mapY, 2)));
            } else if (oldLocation?.connections) {
                // If there's an explicit connection travel time, use it
                const conn = oldLocation.connections.find(c => c.targetLocationId === targetLocation.id);
                if (conn?.travelTimeTurns) {
                    distance = conn.travelTimeTurns * 50; // map back to distance scale
                }
            }

            const baseSpeed = 50;
            const speedMult = newKb.playerStats.permanentBonuses?.speedMult || 1;
            const levelBonus = 1 + (newKb.playerStats.level || 0) * 0.1; // +10% travel speed per level
            const finalSpeed = baseSpeed * speedMult * levelBonus;
            const calculatedDays = Math.max(1, Math.min(15, Math.round(distance / finalSpeed)));

            // --- PLAYER-CREATED ROAD BUILDER ---
            if (oldLocation && oldLocation.id !== targetLocation.id) {
                const getActiveConnectionsCount = (loc: GameLocation) => {
                    if (!loc.connections) return 0;
                    return loc.connections.filter(c => c.isDiscovered).length;
                };

                const connCountOld = getActiveConnectionsCount(oldLocation);
                const connCountTarget = getActiveConnectionsCount(targetLocation);

                // Nếu CẢ HAI địa điểm đều có dưới 3 kết nối, ta tự động tạo đường kết nối hai chiều giữa chúng để khai phá
                if (connCountOld < 3 && connCountTarget < 3) {
                    oldLocation.connections = oldLocation.connections || [];
                    targetLocation.connections = targetLocation.connections || [];

                    const hasDirectConnection = oldLocation.connections.some(c => c.targetLocationId === targetLocation.id);
                    if (!hasDirectConnection) {
                        oldLocation.connections.push({
                            targetLocationId: targetLocation.id,
                            isDiscovered: true,
                            isPlayerCreated: true,
                            travelTimeTurns: calculatedDays
                        });
                        targetLocation.connections.push({
                            targetLocationId: oldLocation.id,
                            isDiscovered: true,
                            isPlayerCreated: true,
                            travelTimeTurns: calculatedDays
                        });
                        
                        systemMessages.push({
                            id: `player-path-created-${oldLocation.id}-${targetLocation.id}`,
                            type: 'system',
                            content: `Cơ chế mở đường: Khi bạn thực hiện di chuyển từ một địa điểm (có dưới 3 kết nối) đến một địa điểm hẻo lánh hoặc mới khai phá (có dưới 3 kết nối), bước chân của bạn sẽ tự động khai phá ra một con đường kết nối mới giữa ${oldLocation.name} và ${targetLocation.name}.`,
                            timestamp: Date.now(),
                            turnNumber: turnForSystemMessages
                        });
                    }
                }
            }

            // Travel duration bypasses system time progression

            // --- DUNGEON CRAWL MODE ACTIVATION ---
            const DANGEROUS_LOCATION_TYPES: GameTemplates.LocationTypeValues[] = [
                GameTemplates.LocationType.DUNGEON,
                GameTemplates.LocationType.CAVE,
                GameTemplates.LocationType.RUIN,
            ];
            if (targetLocation.locationType && DANGEROUS_LOCATION_TYPES.includes(targetLocation.locationType as any)) {
                // Only start a new crawl if not already in one.
                if (!newKb.dungeonCrawlState?.isActive) {
                    newKb.dungeonCrawlState = {
                        isActive: true,
                        dungeonLocationId: targetLocation.id,
                        dungeonName: targetLocation.name,
                        stage: 'entry', // Player has entered, so start at 'entry' stage
                        startTurn: turnForSystemMessages,
                        objective: `Bạn đã bước vào ${targetLocation.name}. Mục tiêu hiện tại là tìm lối đi sâu hơn.`
                    };
                    systemMessages.push({
                        id: `dungeon-start-${targetLocation.id}`,
                        type: 'system',
                        content: `Bạn đã bắt đầu thám hiểm ${targetLocation.name}!`,
                        timestamp: Date.now(),
                        turnNumber: turnForSystemMessages
                    });
                }
            } else {
                // If moving to a non-dungeon location, ensure dungeon mode is off
                if (newKb.dungeonCrawlState?.isActive) {
                    newKb.dungeonCrawlState = null;
                }
            }
            // --- END DUNGEON CRAWL ACTIVATION ---

            const { updatedKb: kbAfterEvents, systemMessages: eventMessages } = await handleLocationEntryEvents(newKb, targetLocation, turnForSystemMessages);
            newKb = kbAfterEvents;
            systemMessages.push(...eventMessages);
        }
    } else {
        console.warn(`LOCATION_CHANGE: Location "${locationName}" not found in discovered locations.`);
        systemMessages.push({
            id: 'location-change-error-' + Date.now(),
            type: 'system',
            content: `[DEBUG] Lỗi di chuyển: Không tìm thấy địa điểm "${locationName}".`,
            timestamp: Date.now(),
            turnNumber: turnForSystemMessages
        });
    }

    return { updatedKb: newKb, systemMessages };
};

interface Connection {
    sourceLocationId: string;
    targetLocationId: string;
}

/**
 * Checks if there are any locations that are not connected to the map network.
 * Ignores temporary and hidden locations.
 */
export const checkDisconnectedLocations = (locations: GameLocation[], connections: Connection[]): boolean => {
    if (locations.length <= 1) return false;

    const connectedIds = new Set<string>();
    connections.forEach(c => {
        connectedIds.add(c.sourceLocationId);
        connectedIds.add(c.targetLocationId);
    });

    // Check if any non-temporary, non-hidden location is missing from connections
    return locations.some(loc => {
        if (loc.isTemporary || loc.isHidden) return false;
        return !connectedIds.has(loc.id);
    });
};

/**
 * Tự động phát hiện và gán quan hệ cha-con dựa trên độ tương đồng và bao hàm tên gọi.
 * Ví dụ: "Sảnh đường Túy Tiên Các" -> trở thành con của "Túy Tiên Các" hoặc "Túy Tiên Các, Việt Kinh"
 */
export const applyHierarchyDetection = (locations: GameLocation[]): GameLocation[] => {
    const cleanAndNormalizeName = (name: string): string => {
        return name
            .toLowerCase()
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '') // Bỏ dấu tiếng Việt
            .replace(/[.,\/#!$%\^&\*;:{}=\-_`~()]/g, "") // Bỏ dấu câu
            .trim();
    };

    const getCoreTerm = (name: string): string => {
        const parts = name.split(/[,-\u2013]/);
        let base = parts[0].trim();
        return cleanAndNormalizeName(base);
    };

    // Tạo danh sách các ứng viên làm địa điểm cha (những địa điểm chính thực thụ, không có parentId)
    // Sắp xếp theo độ dài tên tăng dần để ưu tiên tên ngắn nhất (gốc nhất) trước
    const parentCandidates = locations
        .filter(l => !l.parentLocationId)
        .sort((a, b) => a.name.length - b.name.length);

    locations.forEach(loc => {
        if (loc.parentLocationId) return; // Đã là con rồi thì bỏ qua

        const locClean = cleanAndNormalizeName(loc.name);

        for (const parent of parentCandidates) {
            if (parent.id === loc.id) continue;

            const parentCore = getCoreTerm(parent.name);
            // Bỏ qua các từ khóa quá ngắn (dưới 5 ký tự) để tránh so khớp rác chung chung
            if (parentCore.length < 5) continue;

            // Nếu tên của loc chứa core term của parent, và độ dài tên parent ngắn hơn loc
            if (locClean.includes(parentCore) && parent.name.length < loc.name.length) {
                loc.parentLocationId = parent.id;
                
                // [CẬP NHẬT KINH TẾ] Gộp và thêm các khu vực kinh tế vào địa điểm cha
                if (loc.economicZones && loc.economicZones.length > 0) {
                    if (!parent.economicZones) parent.economicZones = [];
                    loc.economicZones.forEach(zone => {
                        const alreadyExists = parent.economicZones?.some(z => z.id === zone.id || z.name === zone.name);
                        if (!alreadyExists) {
                            parent.economicZones?.push({ ...zone });
                        }
                    });
                }

                console.log(`[Auto-Hierarchy] Gom nhóm tự động: "${loc.name}" trở thành khu vực phụ của "${parent.name}"`);
                break;
            }
        }
    });

    return locations;
};

/**
 * Applies a basic cleanup layout to the discovered locations.
 * Cleans up temporary or auto-generated connection networks, keeping ONLY paths created
 * by the player during travel (isPlayerCreated === true).
 * Also runs automatic hierarchy detection to bundle matching/sub-locations cleanly.
 * @param kb The KnowledgeBase to modify.
 * @returns The updated KnowledgeBase.
 */
export const applyAutoLayout = (kb: KnowledgeBase): KnowledgeBase => {
    const newKb = { ...kb };
    
    // 1. Tự động gom nhóm các địa điểm có tên tương tự thành quan hệ cha-con
    newKb.discoveredLocations = applyHierarchyDetection(newKb.discoveredLocations);

    // 2. Dọn dẹp connections: Chỉ giữ lại các con đường thực sự do người chơi tạo ra khi di chuyển
    newKb.discoveredLocations.forEach(loc => {
        if (loc.connections) {
            loc.connections = loc.connections.filter(conn => conn.isPlayerCreated === true);
        } else {
            loc.connections = [];
        }
    });

    return newKb;
};
