// utils/tagProcessors/memoryTagProcessor.ts
import { KnowledgeBase, GameMessage, CoreMemory, NPC, Slave, Prisoner, Wife, Master } from '../../types';
import { VIETNAMESE } from '../../constants';

const MAX_CORE_MEMORIES = 30;

export const processCoreMemoryAdd = (
    currentKb: KnowledgeBase,
    tagParams: Record<string, string>,
    turnForSystemMessages: number
): { updatedKb: KnowledgeBase; systemMessages: GameMessage[] } => {
    const newKb = currentKb;
    const systemMessages: GameMessage[] = [];

    const text = tagParams.text;
    const strengthStr = tagParams.strength;
    let entityId = tagParams.entityId || 'player'; // Default to player if not specified

    if (!text || !strengthStr) {
        console.warn("CORE_MEMORY_ADD: Missing 'text' or 'strength' parameter.", tagParams);
        return { updatedKb: newKb, systemMessages };
    }

    // Attempt to find the full ID if only a name was provided
    if (entityId !== 'player') {
        // FIX: Explicitly type the array to include all possible entity types, including Master.
        const allEntities: (NPC | Wife | Slave | Prisoner | Master)[] = [
            ...newKb.discoveredNPCs,
            ...newKb.wives,
            ...newKb.slaves,
            ...newKb.prisoners,
        ];
        if (newKb.master) {
            allEntities.push(newKb.master);
        }
        
        // FIX: The variable was named `entityNameOrId` but it should be `entityId`.
        const foundEntity = allEntities.find((e: any) => e.name === entityId || e.id === entityId);
        if (foundEntity) {
            entityId = foundEntity.id;
        } else {
            console.warn(`CORE_MEMORY_ADD: Could not find entity with name or ID "${entityId}". Memory will not be assigned.`);
            return { updatedKb: newKb, systemMessages };
        }
    }


    const strength = parseInt(strengthStr, 10);
    if (isNaN(strength) || strength < 0 || strength > 100) {
        console.warn(`CORE_MEMORY_ADD: Invalid strength value "${strengthStr}". Must be between 0 and 100.`);
        return { updatedKb: newKb, systemMessages };
    }

    if (!newKb.coreMemories) {
        newKb.coreMemories = [];
    }

    const newMemory: CoreMemory = {
        id: `core-memory-${Date.now()}-${Math.random()}`,
        text: text,
        strength: strength,
        turn: turnForSystemMessages,
        entityId: entityId 
    };

    const entityMemories = newKb.coreMemories.filter(m => m.entityId === entityId);

    if (entityMemories.length < MAX_CORE_MEMORIES) {
        newKb.coreMemories.push(newMemory);
        if (entityId === 'player') {
            systemMessages.push({
                id: `core-memory-added-${newMemory.id}`,
                type: 'system',
                content: `Một ký ức cốt lõi mới đã được hình thành: "${text}" (Độ mạnh: ${strength})`,
                timestamp: Date.now(),
                turnNumber: turnForSystemMessages
            });
        }
    } else {
        // Find the weakest memory for that specific entity
        let weakestMemoryIndex = -1;
        let weakestStrength = 101;
        
        // We need the global index from the original coreMemories array
        newKb.coreMemories.forEach((mem, index) => {
            if (mem.entityId === entityId && mem.strength < weakestStrength) {
                weakestStrength = mem.strength;
                weakestMemoryIndex = index;
            }
        });

        // Replace if the new memory is stronger
        if (weakestMemoryIndex > -1 && strength > weakestStrength) {
            const replacedMemory = newKb.coreMemories[weakestMemoryIndex];
            newKb.coreMemories[weakestMemoryIndex] = newMemory;
            if (entityId === 'player') {
                systemMessages.push({
                    id: `core-memory-replaced-${newMemory.id}`,
                    type: 'system',
                    content: `Một ký ức mới mạnh hơn đã thay thế ký ức cũ. Mới: "${text}" (Độ mạnh: ${strength}). Cũ: "${replacedMemory.text}" (Độ mạnh: ${replacedMemory.strength})`,
                    timestamp: Date.now(),
                    turnNumber: turnForSystemMessages
                });
            }
        }
        // If the new memory is not stronger than the weakest, it is discarded.
    }

    return { updatedKb: newKb, systemMessages };
};