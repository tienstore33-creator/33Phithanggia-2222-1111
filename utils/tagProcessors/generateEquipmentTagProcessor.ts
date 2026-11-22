import { KnowledgeBase, GameMessage, VectorMetadata } from '../../types';
import { generateEquipment } from '../equipmentGenerator';
import { createItemFromParams } from './itemTagProcessor';
import { formatItemForEmbedding } from '../ragUtils';
import { getEffectiveRealmSystem } from '../../services/realmManager';

export const processGenerateEquipment = (
    workingKb: KnowledgeBase,
    tagParams: Record<string, string>,
    turn: number
): { updatedKb: KnowledgeBase, systemMessages: GameMessage[], newVectorMetadata?: VectorMetadata } => {
    const updatedKb = { ...workingKb };
    const systemMessages: GameMessage[] = [];
    let newVectorMetadata: VectorMetadata | undefined = undefined;

    const name = tagParams.name || 'Vô Danh Trang Bị';
    const levelStr = tagParams.level || '1';
    const rarity = tagParams.rarity || 'Phổ Thông';
    const equipmentType = tagParams.type || 'Vũ Khí';

    const realmSystem = getEffectiveRealmSystem(workingKb);
    const majorRealms = realmSystem?.majorRealms || workingKb.realmProgressionList || [];
    const playerRealm = tagParams.itemRealm || workingKb.playerStats.realm || 'Luyện Khí';

    const itemData = generateEquipment(name, levelStr, rarity, equipmentType, majorRealms, playerRealm);

    const newItem = createItemFromParams(itemData, updatedKb);
    const ownerId = tagParams.ownerId || tagParams.entityId || 'player';
    
    if (newItem) {
        if (ownerId === 'player') {
            updatedKb.inventory.push(newItem);
            newVectorMetadata = { entityId: newItem.id, entityType: 'item', text: formatItemForEmbedding(newItem) };
            
            systemMessages.push({
                id: 'item-acquired-gen-' + newItem.id,
                type: 'system',
                content: `🎁 Hệ thống đã thưởng: ${newItem.name} [${rarity} - ${equipmentType}]. Đã thêm vào túi đồ.`,
                timestamp: Date.now(),
                turnNumber: turn
            });
        } else {
            // Add to NPC Treasury
            if (!updatedKb.npcInventory) updatedKb.npcInventory = [];
            updatedKb.npcInventory.push(newItem);
            console.log(`[NPC_TREASURY] Item "${newItem.name}" added to NPC Treasury for owner "${ownerId}".`);
        }
    }

    return { updatedKb, systemMessages, newVectorMetadata };
};
