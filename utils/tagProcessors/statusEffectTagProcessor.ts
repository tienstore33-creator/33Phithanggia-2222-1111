import { KnowledgeBase, GameMessage, StatusEffect, PlayerStats } from '../../types';
import { VIETNAMESE } from '../../constants';
import { calculateEffectiveStats } from '../statsCalculationUtils';

export const processStatusEffectApply = (
    currentKb: KnowledgeBase,
    tagParams: Record<string, string>,
    turnForSystemMessages: number
): { updatedKb: KnowledgeBase; systemMessages: GameMessage[] } => {
    const newKb = currentKb;
    const systemMessages: GameMessage[] = [];

    const target = tagParams.target?.trim() || 'MC';
    const name = tagParams.name;
    let description = tagParams.description;
    let type = tagParams.type as StatusEffect['type'];
    let durationTurnsStr = tagParams.durationTurns;
    const statModifiersStr = tagParams.statModifiers;
    const specialEffectsStr = tagParams.specialEffects;

    if (!name) {
        return { updatedKb: newKb, systemMessages };
    }

    // Resilience: Use defaults if mandatory parameters are missing
    if (!description) description = `Hiệu ứng đang tác động lên ${target}`;
    if (!type) type = 'buff';
    if (!durationTurnsStr) durationTurnsStr = "3";

    const durationTurns = parseInt(durationTurnsStr, 10) || 3;
    
    // Check if the effect looks like a debuff based on name keywords if type is default
    if (tagParams.type === undefined) {
        const negativeKeywords = ['độc', 'yếu', 'thương', 'tàn', 'dục', 'hỏa', 'kiệt', 'phạt'];
        if (negativeKeywords.some(k => name.toLowerCase().includes(k))) {
            type = 'debuff';
        }
    }
    
    // FIX: Changed type of statModifiers to match the target type in StatusEffect interface.
    let statModifiers: StatusEffect['statModifiers'] = {};
    if (statModifiersStr) {
        try {
            statModifiers = JSON.parse(statModifiersStr);
        } catch (e) {
            console.warn("STATUS_EFFECT_APPLY: Could not parse statModifiers JSON.", statModifiersStr, e);
        }
    }

    const specialEffects = specialEffectsStr ? specialEffectsStr.split(';').map(s => s.trim()).filter(s => s) : [];

    const newEffect: StatusEffect = {
        id: `effect-${name.replace(/\s+/g, '-')}-${Date.now()}`,
        name,
        description,
        type,
        durationTurns,
        statModifiers: statModifiers, 
        specialEffects,
        source: tagParams.source || 'Không rõ',
        icon: tagParams.icon || undefined,
    };

    const targetLower = target.toLowerCase();
    const isPlayer = targetLower === 'mc' || targetLower === 'người chơi' || targetLower === 'player' || targetLower === currentKb.worldConfig?.playerName?.toLowerCase() || targetLower === 'tôi';

    if (isPlayer) {
        newKb.playerStats.activeStatusEffects = newKb.playerStats.activeStatusEffects.filter(eff => eff.name !== newEffect.name);
        newKb.playerStats.activeStatusEffects.push(newEffect);
        
        newKb.playerStats = calculateEffectiveStats(newKb.playerStats, newKb.equippedItems, newKb.inventory);

        systemMessages.push({
            id: `status-effect-applied-${newEffect.id}`, type: 'system',
            content: VIETNAMESE.statusEffectApplied(newEffect.name),
            timestamp: Date.now(), turnNumber: turnForSystemMessages
        });
    } else {
        // Tìm NPC trong các list
        let foundNpc: any = null;
        for (const list of [newKb.discoveredNPCs, newKb.wives, newKb.slaves, newKb.prisoners, newKb.companions, newKb.discoveredYeuThu]) {
            if (list) {
                foundNpc = (list as any[]).find(n => n.name.toLowerCase() === targetLower);
                if (foundNpc) break;
            }
        }
        if (!foundNpc && newKb.master && newKb.master.name.toLowerCase() === targetLower) {
            foundNpc = newKb.master;
        }

        if (foundNpc) {
            if (!foundNpc.stats) foundNpc.stats = {};
            if (!foundNpc.stats.activeStatusEffects) foundNpc.stats.activeStatusEffects = [];
            
            foundNpc.stats.activeStatusEffects = foundNpc.stats.activeStatusEffects.filter((eff: any) => eff.name !== newEffect.name);
            foundNpc.stats.activeStatusEffects.push(newEffect);

            systemMessages.push({
                id: `status-effect-applied-npc-${newEffect.id}`, type: 'system',
                content: `[${foundNpc.name}] nhận hiệu ứng: ${newEffect.name}`,
                timestamp: Date.now(), turnNumber: turnForSystemMessages
            });
        }
    }

    return { updatedKb: newKb, systemMessages };
};

export const processStatusEffectRemove = (
    currentKb: KnowledgeBase,
    tagParams: Record<string, string>,
    turnForSystemMessages: number
): { updatedKb: KnowledgeBase; systemMessages: GameMessage[] } => {
    const newKb = currentKb;
    const systemMessages: GameMessage[] = [];
    const target = tagParams.target?.trim() || 'MC';
    const name = tagParams.name;

    if (!name) {
        console.warn("STATUS_EFFECT_REMOVE: Missing name parameter.", tagParams);
        return { updatedKb: newKb, systemMessages };
    }

    const targetLower = target.toLowerCase();
    const isPlayer = targetLower === 'mc' || targetLower === 'người chơi' || targetLower === 'player' || targetLower === currentKb.worldConfig?.playerName?.toLowerCase() || targetLower === 'tôi';

    if (isPlayer) {
        const initialEffectCount = newKb.playerStats.activeStatusEffects.length;
        newKb.playerStats.activeStatusEffects = newKb.playerStats.activeStatusEffects.filter(eff => eff.name !== name);

        if (newKb.playerStats.activeStatusEffects.length < initialEffectCount) {
            newKb.playerStats = calculateEffectiveStats(newKb.playerStats, newKb.equippedItems, newKb.inventory);
            systemMessages.push({
                id: `status-effect-removed-${name.replace(/\s+/g, '-')}-${Date.now()}`, type: 'system',
                content: VIETNAMESE.statusEffectRemoved(name),
                timestamp: Date.now(), turnNumber: turnForSystemMessages
            });
        }
    } else {
        // Tìm NPC trong các list
        let foundNpc: any = null;
        for (const list of [newKb.discoveredNPCs, newKb.wives, newKb.slaves, newKb.prisoners, newKb.companions, newKb.discoveredYeuThu]) {
            if (list) {
                foundNpc = (list as any[]).find(n => n.name.toLowerCase() === targetLower);
                if (foundNpc) break;
            }
        }
        if (!foundNpc && newKb.master && newKb.master.name.toLowerCase() === targetLower) {
            foundNpc = newKb.master;
        }

        if (foundNpc && foundNpc.stats && foundNpc.stats.activeStatusEffects) {
            const initialCount = foundNpc.stats.activeStatusEffects.length;
            foundNpc.stats.activeStatusEffects = foundNpc.stats.activeStatusEffects.filter((eff: any) => eff.name !== name);
            if (foundNpc.stats.activeStatusEffects.length < initialCount) {
                systemMessages.push({
                    id: `status-effect-removed-npc-${name.replace(/\s+/g, '-')}-${Date.now()}`, type: 'system',
                    content: `[${foundNpc.name}] mất hiệu ứng: ${name}`,
                    timestamp: Date.now(), turnNumber: turnForSystemMessages
                });
            }
        }
    }

    return { updatedKb: newKb, systemMessages };
};