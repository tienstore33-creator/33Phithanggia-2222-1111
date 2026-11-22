import { KnowledgeBase, GameLocation, GameMessage, NPC, Item } from '../types';
import { generateVendorRestock as generateVendorRestockPrompt, parseAiResponseText, generateVendorRestock, generateCityEconomy, generateGeneralSubLocations } from '../services/geminiService';
import { extractSatelliteTags } from '../services/satelliteTagExtractor';
import { createItemFromParams } from './tagProcessors/itemTagProcessor';
import { parseTagValue } from './parseTagValue';
import * as GameTemplates from '../templates';
import { performTagProcessing } from './tagProcessingUtils'; // Import performTagProcessing

export async function handleLocationEntryEvents(
    kb: KnowledgeBase,
    location: GameLocation,
    turn: number
): Promise<{ updatedKb: KnowledgeBase; systemMessages: GameMessage[] }> {
    let newKb = JSON.parse(JSON.stringify(kb)) as KnowledgeBase;
    const systemMessages: GameMessage[] = [];
    const currentYear = newKb.worldDate.year;

    // --- 0. First Visit & Sub-Location Generation Logic ---
    const isFirstVisit = !location.visited && !location.parentLocationId;
    
    // Mark as visited on the first entry to a main location
    if (isFirstVisit) {
        const locIndex = newKb.discoveredLocations.findIndex(l => l.id === location.id);
        if (locIndex > -1) {
            newKb.discoveredLocations[locIndex].visited = true;
        }
    }

    // Check if sub-locations need to be generated (on first visit OR if they are missing)
    if (!location.parentLocationId) { // Only generate for main locations
        const generationPromises = [];

        // Check for Economy Locations
        const eligibleForEconomy = [
            GameTemplates.LocationType.TOWN,
            GameTemplates.LocationType.CITY,
            GameTemplates.LocationType.CAPITAL,
        ].includes(location.locationType as any);

        const hasExistingEconomySubLocations = newKb.discoveredLocations.some(loc => 
            loc.parentLocationId === location.id && Object.values(GameTemplates.EconomyLocationType).includes(loc.locationType as any)
        );

        if (eligibleForEconomy && !hasExistingEconomySubLocations) {
            systemMessages.push({
                id: `gen-economy-notice-${location.id}-${Date.now()}`,
                type: 'system',
                content: `Đang tạo các khu vực kinh tế cho ${location.name}...`,
                timestamp: Date.now(),
                turnNumber: turn
            });
            generationPromises.push(
                generateCityEconomy(
                    location,
                    newKb,
                    // No need for log callbacks here as this is a background system task
                )
            );
        }

        // Check for General Sub-Locations
        const eligibleForGeneral = [
            GameTemplates.LocationType.TOWN,
            GameTemplates.LocationType.CITY,
            GameTemplates.LocationType.CAPITAL,
            GameTemplates.LocationType.SECT_CLAN,
            GameTemplates.LocationType.VILLAGE,
            GameTemplates.LocationType.FOREST,
            GameTemplates.LocationType.DUNGEON,
        ].includes(location.locationType as any);

        const hasExistingGeneralSubLocations = newKb.discoveredLocations.some(loc => 
            loc.parentLocationId === location.id && Object.values(GameTemplates.SubLocationType).includes(loc.locationType as any)
        );

        if (eligibleForGeneral && !hasExistingGeneralSubLocations) {
             systemMessages.push({
                id: `gen-general-notice-${location.id}-${Date.now()}`,
                type: 'system',
                content: `Đang tạo các khu vực chung cho ${location.name}...`,
                timestamp: Date.now(),
                turnNumber: turn
            });
            generationPromises.push(
                generateGeneralSubLocations(
                    location,
                    newKb,
                    // No log callbacks needed for this system task
                )
            );
        }

        // Await all generations and process their tags if any were queued
        if (generationPromises.length > 0) {
            try {
                const allResponses = await Promise.all(generationPromises);

                let kbAfterGeneration = newKb;
                for (const parsedResponse of allResponses) {
                    const tagsToProcess = extractSatelliteTags((parsedResponse as any).rawText, (parsedResponse as any).tags || (parsedResponse as any).response?.tags);
                    const { newKb: kbAfterTags, systemMessagesFromTags } = await performTagProcessing(
                        kbAfterGeneration,
                        tagsToProcess,
                        turn,
                        undefined
                    );
                    kbAfterGeneration = kbAfterTags;
                    systemMessages.push(...systemMessagesFromTags);
                }
                newKb = kbAfterGeneration; // Update the main mutable KB object with the final state

            } catch (error) {
                 console.error(`Failed to generate sub-locations for ${location.name}:`, error);
                systemMessages.push({
                    id: `gen-details-error-${location.id}-${Date.now()}`,
                    type: 'error',
                    content: `Lỗi khi tạo chi tiết cho ${location.name}.`,
                    timestamp: Date.now(),
                    turnNumber: turn
                });
            }
        }
    }


    // --- 1. Shop Restocking Logic ---
    const vendorsInLocation = newKb.discoveredNPCs.filter(npc =>
        (npc.locationId === location.id || newKb.discoveredLocations.some(l => l.parentLocationId === location.id && l.id === npc.locationId)) &&
        (npc.vendorType === 'MarketStall' || npc.vendorType === 'SpecializedShop')
    );

    const vendorsToRestock = vendorsInLocation.filter(vendor =>
        currentYear > (vendor.lastRestockYear || 0)
    );

    if (vendorsToRestock.length > 0) {
        systemMessages.push({
            id: `restock-notice-${location.id}-${Date.now()}`,
            type: 'system',
            content: `Các cửa hàng tại ${location.name} đã được làm mới hàng hóa.`,
            timestamp: Date.now(),
            turnNumber: turn
        });

        for (const vendor of vendorsToRestock) {
            try {
                // Find the vendor in our mutable KB copy
                const vendorInKb = newKb.discoveredNPCs.find(n => n.id === vendor.id);
                if (!vendorInKb) continue;

                // Clear old inventory
                vendorInKb.shopInventory = [];

                // Generate new inventory
                const { response, rawText } = await generateVendorRestock(vendorInKb, newKb);
                const restockTags = extractSatelliteTags(rawText, response?.tags);
                
                // Manually process the [SHOP_ITEM] tags
                if (restockTags && restockTags.length > 0) {
                    for (const tag of restockTags) {
                        const mainMatch = tag.match(/\[(.*?):(.*)\]/s);
                        if (!mainMatch) continue;
                        
                        const tagName = mainMatch[1].trim().toUpperCase();
                        const rawTagParameterString = mainMatch[2] ? mainMatch[2].trim() : '';

                        if (tagName === 'SHOP_ITEM') {
                            const parsedParams = parseTagValue(rawTagParameterString);
                            if (parsedParams.parentId === vendorInKb.name) {
                                const newItem = createItemFromParams(parsedParams, newKb);
                                if (newItem) {
                                    if (!vendorInKb.shopInventory) vendorInKb.shopInventory = [];
                                    vendorInKb.shopInventory.push(newItem as Item);
                                }
                            }
                        }
                    }
                }
                
                // Update restock year
                vendorInKb.lastRestockYear = currentYear;
                
            } catch (error) {
                console.error(`Failed to restock vendor ${vendor.name}:`, error);
                systemMessages.push({
                    id: `restock-error-${vendor.id}-${Date.now()}`,
                    type: 'error',
                    content: `Lỗi khi làm mới hàng hóa cho ${vendor.name}.`,
                    timestamp: Date.now(),
                    turnNumber: turn
                });
            }
        }
    }

    return { updatedKb: newKb, systemMessages };
}