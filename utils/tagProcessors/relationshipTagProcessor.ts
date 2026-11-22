
import { KnowledgeBase, GameMessage, NPC, Wife, Slave, Prisoner, Master, VectorMetadata } from '../../types';
import { formatPersonForEmbedding } from '../ragUtils';
import { diceCoefficient, normalizeStringForComparison } from '../questUtils';
import { calculateNumericValue } from '../numericLogic';
import { resolveNpcEntity } from '../npcIdentityResolver';

const SIMILARITY_THRESHOLD = 0.8;

const findEntityByName = (kb: KnowledgeBase, name: string): { entity: NPC | Wife | Slave | Prisoner | Master | null, type: string | null } => {
    if (!name) return { entity: null, type: null };
    
    // Prioritize explicit ID matches if user/AI uses them
    // ...

    const allEntities: { entity: NPC | Wife | Slave | Prisoner | Master, type: string }[] = [
        ...kb.discoveredNPCs.map(e => ({ entity: e, type: 'npc' })),
        ...kb.wives.map(e => ({ entity: e, type: 'wife' })),
        ...kb.slaves.map(e => ({ entity: e, type: 'slave' })),
        ...kb.prisoners.map(e => ({ entity: e, type: 'prisoner' })),
    ];
    if (kb.master) {
        allEntities.push({ entity: kb.master, type: 'master' });
    }

    let bestMatch = { entity: null as any, type: null as string | null, score: 0 };
    const normalizedName = normalizeStringForComparison(name);

    allEntities.forEach(item => {
        const score = diceCoefficient(normalizedName, normalizeStringForComparison(item.entity.name));
        if (score > bestMatch.score) {
            bestMatch = { entity: item.entity, type: item.type, score };
        }
    });

    if (bestMatch.entity && bestMatch.score >= SIMILARITY_THRESHOLD) {
        return { entity: bestMatch.entity, type: bestMatch.type };
    }
    
    return { entity: null, type: null };
};

export const processRelationshipUpdate = (
    currentKb: KnowledgeBase,
    tagParams: Record<string, string>,
    turnForSystemMessages: number,
    originalTag?: string
): { 
    updatedKb: KnowledgeBase; 
    systemMessages: GameMessage[]; 
    updatedVectorMetadata?: VectorMetadata;
    affinityChange?: { name: string; delta: number };
    error?: { reason: string; originalTag: string; tagName: string };
} => {
    const newKb = currentKb;
    const systemMessages: GameMessage[] = [];
    let updatedVectorMetadata: VectorMetadata | undefined = undefined;

    const id = tagParams.targetId || tagParams.id || tagParams.target;
    const affinityRaw = tagParams.affinity;
    const status = tagParams.status || tagParams.relationship || tagParams.relationshipToPlayer || tagParams.description;

    // KIỂM TRA SAI CẤU TRÚC (Theo yêu cầu người dùng)
    if (!tagParams.target && tagParams.id && !tagParams.targetId) {
        return { 
            updatedKb: newKb, 
            systemMessages, 
            error: { 
                reason: "Sử dụng 'id' thay vì 'targetId'", 
                originalTag: originalTag || "", 
                tagName: "RELATIONSHIP_UPDATE" 
            } 
        };
    }
    if (tagParams.description && !tagParams.status) {
         return { 
            updatedKb: newKb, 
            systemMessages, 
            error: { 
                reason: "Sử dụng 'description' thay vì 'status'", 
                originalTag: originalTag || "", 
                tagName: "RELATIONSHIP_UPDATE" 
            } 
        };
    }

    const sourceName = tagParams.sourceName || tagParams.source; // "Nguyễn Văn A"
    const targetName = tagParams.targetName || tagParams.target; // "Nguyễn Thị B"
    const relType = tagParams.type; // "Cha", "Sư phụ", "Kẻ thù"
    const action = tagParams.action || 'add'; // "add" or "remove"

    // 1. Nếu có ID mục tiêu cụ thể, hoặc có (affinity/status) mà KO có cả sourceName và targetName đồng thời
    // Thể hiện cập nhật thiện cảm/mối quan hệ của NPC với người chơi
    if (id || (affinityRaw && !sourceName && !targetName) || (status && !sourceName && !targetName)) {
        let npcToProcess: any = null;
        let pType = '';
        
        const resolved = resolveNpcEntity(newKb, {
            target: tagParams.target,
            id: tagParams.id,
            targetId: tagParams.targetId,
            name: tagParams.name,
            targetName: tagParams.targetName,
        });

        if (resolved) {
            npcToProcess = resolved.npc;
            pType = resolved.listType;
        }

        if (!npcToProcess) {
            console.warn(`RELATIONSHIP_UPDATE: Không tìm thấy NPC ứng với target="${tagParams.target}" hoặc id="${id}" hoặc name="${tagParams.name}"`);
            return { updatedKb: newKb, systemMessages };
        }

        let affinityChange: { name: string; delta: number } | undefined = undefined;

        if (affinityRaw) {
            const currentVal = npcToProcess.affinity || 0;
            const newVal = calculateNumericValue(currentVal, affinityRaw, true);
            let delta = newVal - currentVal;
            if (delta !== 0) {
                // Apply mechanical constraints: increase max 15, decrease max 50
                if (delta > 15) delta = 15;
                if (delta < -50) delta = -50;
                const safeDelta = delta;
                npcToProcess.affinity = Math.max(-100, Math.min(100, currentVal + safeDelta));
                affinityChange = { name: npcToProcess.name, delta: safeDelta };
            }
        }

        // Xử lý các chỉ số Game Theory (Trust & Fear)
        const trustRaw = tagParams.trust || tagParams.trustModifier || tagParams.gt_trust_modifier || tagParams.gt_trust;
        const fearRaw = tagParams.fear || tagParams.fearModifier || tagParams.gt_fear_modifier || tagParams.gt_fear;

        if (trustRaw) {
            const currentTrust = npcToProcess.trust !== undefined ? npcToProcess.trust : (npcToProcess.affinity || 0);
            const newTrust = calculateNumericValue(currentTrust, trustRaw, true);
            npcToProcess.trust = Math.max(0, Math.min(100, newTrust));
        }

        if (fearRaw) {
            const currentFear = npcToProcess.fear !== undefined ? npcToProcess.fear : Math.max(0, 100 - (npcToProcess.affinity || 0));
            const newFear = calculateNumericValue(currentFear, fearRaw, true);
            npcToProcess.fear = Math.max(0, Math.min(100, newFear));
        }

        if (status) {
            npcToProcess.relationshipToPlayer = status;
            npcToProcess.relationship = status;
        }

        npcToProcess.lastInteractionTurn = turnForSystemMessages;

        let gtMsgPart = "";
        if (trustRaw || fearRaw || npcToProcess.trust !== undefined || npcToProcess.fear !== undefined) {
            const tVal = npcToProcess.trust !== undefined ? npcToProcess.trust : Math.round(npcToProcess.affinity || 0);
            const fVal = npcToProcess.fear !== undefined ? npcToProcess.fear : Math.max(0, 100 - Math.round(npcToProcess.affinity || 0));
            gtMsgPart = ` (Trust: ${tVal}/100, Fear: ${fVal}/100)`;
        }

        systemMessages.push({
            id: `rel-player-update-${Date.now()}`,
            type: 'system',
            content: `❤️ Thiện cảm của ${npcToProcess.name} đối với bạn: ${affinityRaw ? (affinityRaw.startsWith('+') || affinityRaw.startsWith('-') ? affinityRaw : '+' + affinityRaw) : 'Không đổi'} (Hiện tại: ${npcToProcess.affinity ?? 0})${gtMsgPart}. Mối quan hệ: ${status || npcToProcess.relationshipToPlayer || npcToProcess.relationship || 'Bình thường'}.`,
            timestamp: Date.now(),
            turnNumber: turnForSystemMessages
        });

        updatedVectorMetadata = {
            entityId: npcToProcess.id,
            entityType: pType as any,
            text: formatPersonForEmbedding(npcToProcess)
        };

        return { 
            updatedKb: newKb, 
            systemMessages, 
            updatedVectorMetadata,
            affinityChange 
        };
    }

    // 2. Logic NPC-NPC nguyên bản
    if (!sourceName || !targetName || !relType) {
        console.warn("RELATIONSHIP_UPDATE: Missing required parameters.", tagParams);
        return { updatedKb: newKb, systemMessages };
    }

    // 1. Find Source Entity
    const { entity: sourceEntity, type: sourceType } = findEntityByName(newKb, sourceName);
    if (!sourceEntity) {
        console.warn(`RELATIONSHIP_UPDATE: Source entity "${sourceName}" not found.`);
        return { updatedKb: newKb, systemMessages };
    }

    let targetIdRef = '';
    let finalTargetName = targetName;
    
    if (targetName.toLowerCase() === 'player' || targetName.toLowerCase() === 'người chơi' || targetName.toLowerCase() === newKb.worldConfig?.playerName?.toLowerCase()) {
        targetIdRef = 'player';
        finalTargetName = newKb.worldConfig?.playerName || 'Người Chơi';
    } else {
        const { entity: targetEntity } = findEntityByName(newKb, targetName);
        if (targetEntity) {
            targetIdRef = targetEntity.id;
            finalTargetName = targetEntity.name;
        } else {
             targetIdRef = `abstract-${targetName.replace(/\s+/g, '-')}`;
        }
    }

    if (!sourceEntity.relationships) {
        sourceEntity.relationships = [];
    }

    if (action === 'add' || action === 'update') {
        sourceEntity.relationships = sourceEntity.relationships.filter(r => r.targetId !== targetIdRef && r.targetName !== finalTargetName);
        
        sourceEntity.relationships.push({
            targetId: targetIdRef,
            targetName: finalTargetName,
            type: relType,
            note: tagParams.note
        });
        
        systemMessages.push({
            id: `rel-update-${Date.now()}`,
            type: 'system',
            content: `🤝 Mối quan hệ mới: ${sourceEntity.name} là ${relType} của ${finalTargetName}.`,
            timestamp: Date.now(),
            turnNumber: turnForSystemMessages
        });

    } else if (action === 'remove') {
        sourceEntity.relationships = sourceEntity.relationships.filter(r => r.targetId !== targetIdRef && r.targetName !== finalTargetName);
        
        systemMessages.push({
            id: `rel-remove-${Date.now()}`,
            type: 'system',
            content: `💔 Mối quan hệ giữa ${sourceEntity.name} và ${finalTargetName} đã chấm dứt.`,
            timestamp: Date.now(),
            turnNumber: turnForSystemMessages
        });
    }
    
    updatedVectorMetadata = {
        entityId: sourceEntity.id,
        entityType: sourceType as any, 
        text: formatPersonForEmbedding(sourceEntity)
    };

    return { updatedKb: newKb, systemMessages, updatedVectorMetadata };
};
