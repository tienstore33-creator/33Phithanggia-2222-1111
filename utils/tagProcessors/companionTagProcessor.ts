
import { KnowledgeBase, GameMessage, Companion } from '../../types';
import { calculateNumericValue } from '../numericLogic';
import { resolveNpcEntity } from '../npcIdentityResolver';

export const processCompanionAdd = (
    currentKb: KnowledgeBase,
    tagParams: Record<string, string>
): { updatedKb: KnowledgeBase; systemMessages: GameMessage[] } => {
    const newKb = currentKb;
    const systemMessages: GameMessage[] = [];
    const name = tagParams.name;
    const description = tagParams.description;
    const hp = parseInt(tagParams.hp || "100", 10);
    const maxHp = parseInt(tagParams.maxHp || tagParams.hp || "100", 10);
    const mana = parseInt(tagParams.mana || "0", 10);
    const maxMana = parseInt(tagParams.maxMana || tagParams.mana || "0", 10);
    const atk = parseInt(tagParams.atk || "10", 10);

    if (!name || !description) {
        console.warn("COMPANION_ADD: Missing name or description.", tagParams);
        return { updatedKb: newKb, systemMessages };
    }

    if (!newKb.companions.find(c => c.name === name)) {
        const newCompanion: Companion = {
            id: `comp-${name.replace(/\s+/g, '-')}-${Date.now()}`,
            name: name,
            description: description,
            hp: isNaN(hp) ? 100 : hp,
            maxHp: isNaN(maxHp) ? 100 : maxHp,
            mana: isNaN(mana) ? 0 : mana,
            maxMana: isNaN(maxMana) ? 0 : maxMana,
            atk: isNaN(atk) ? 10 : atk,
            affinity: 0, // Added affinity
        };
        newKb.companions.push(newCompanion);
        systemMessages.push({
            id: 'companion-joined-' + Date.now(), type: 'system',
            content: `${name} đã gia nhập đội của bạn!`,
            timestamp: Date.now(), turnNumber: newKb.playerStats.turn 
        });
    } else {
        console.warn(`COMPANION_ADD: Companion "${name}" already exists. Not adding duplicate.`);
    }
    return { updatedKb: newKb, systemMessages };
};

export const processCompanionLeave = (
    currentKb: KnowledgeBase,
    tagParams: Record<string, string>
): { updatedKb: KnowledgeBase; systemMessages: GameMessage[] } => {
    const newKb = currentKb;
    const systemMessages: GameMessage[] = [];
    const name = tagParams.name || "";
    const target = tagParams.target || "";

    if (!name && !target) {
        console.warn("COMPANION_LEAVE: Missing name or target.", tagParams);
        return { updatedKb: newKb, systemMessages };
    }

    const resolved = resolveNpcEntity(newKb, { target, name, id: tagParams.id || tagParams.targetId });
    const companion = resolved && resolved.listType === "companion" ? resolved.npc : null;
    const companionIndex = companion ? newKb.companions.findIndex(c => c.id === companion.id) : -1;

    if (companionIndex > -1) {
        const finalName = newKb.companions[companionIndex].name;
        newKb.companions.splice(companionIndex, 1);
        systemMessages.push({
            id: 'companion-left-' + Date.now(), type: 'system',
            content: `${finalName} đã rời khỏi đội.`,
            timestamp: Date.now(), turnNumber: newKb.playerStats.turn
        });
    } else {
        console.warn(`COMPANION_LEAVE: Companion "${name || target}" not found.`);
    }
    return { updatedKb: newKb, systemMessages };
};

export const processCompanionStatsUpdate = (
    currentKb: KnowledgeBase,
    tagParams: Record<string, string>
): { updatedKb: KnowledgeBase; systemMessages: GameMessage[] } => {
    const newKb = currentKb;
    const systemMessages: GameMessage[] = [];
    const name = tagParams.name || "";
    const target = tagParams.target || "";

    if (!name && !target) {
        console.warn("COMPANION_STATS_UPDATE: Missing name or target.", tagParams);
        return { updatedKb: newKb, systemMessages };
    }

    const resolved = resolveNpcEntity(newKb, { target, name, id: tagParams.id || tagParams.targetId });
    const companion = resolved && resolved.listType === "companion" ? resolved.npc : null;

    if (companion) {
        let updateOccurred = false;
        
        if (tagParams.hp) {
            const newVal = calculateNumericValue(companion.hp, tagParams.hp);
            if (newVal !== companion.hp) {
                companion.hp = Math.max(0, Math.min(newVal, companion.maxHp));
                updateOccurred = true;
            }
        }
        
        if (tagParams.mana) {
            const newVal = calculateNumericValue(companion.mana, tagParams.mana);
            if (newVal !== companion.mana) {
                companion.mana = Math.max(0, Math.min(newVal, companion.maxMana));
                updateOccurred = true;
            }
        }
        
        if (tagParams.atk) {
            const newVal = calculateNumericValue(companion.atk, tagParams.atk);
            if (newVal !== companion.atk) {
                companion.atk = Math.max(0, newVal);
                updateOccurred = true;
            }
        }
        
        if (tagParams.affinity) {
            const currentVal = companion.affinity || 0;
            const newVal = calculateNumericValue(currentVal, tagParams.affinity, true);
            let delta = newVal - currentVal;
            if (delta !== 0) {
                // Apply mechanical constraints: increase max 15, decrease max 50
                if (delta > 15) delta = 15;
                if (delta < -50) delta = -50;
                companion.affinity = Math.max(-100, Math.min(100, currentVal + delta));
                updateOccurred = true;
            }
        }

        if(updateOccurred){
             systemMessages.push({
                id: 'companion-stats-updated-' + Date.now(), type: 'system',
                content: `Chỉ số của đồng hành ${companion.name} đã thay đổi.`,
                timestamp: Date.now(), turnNumber: newKb.playerStats.turn
            });
        }

    } else {
         console.warn(`COMPANION_STATS_UPDATE: Companion "${name || target}" not found.`);
    }
    return { updatedKb: newKb, systemMessages };
};