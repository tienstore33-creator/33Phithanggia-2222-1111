import { KnowledgeBase, NPC, Skill, AnalyzedCombatant } from '../types';
import { callGeminiAPI } from './apiService';
import { analyzeCombatantsPrompt } from '../prompts/analyzeCombatantsPrompt';
import { parseXmlCombatAnalysis } from '../utils/xmlDataParser';
import { diceCoefficient, normalizeStringForComparison } from '../utils/questUtils';
import { DEFAULT_PLAYER_STATS } from '../constants';
import * as GameTemplates from '../templates';
import { CombatEquipmentGenerator } from './CombatEquipmentGenerator';
import { calculateRealmBaseStats } from '../utils/statsCalculationUtils';
import { limitCombatParticipants } from '../utils/combatLimiter';
import { CombatIdentityInferenceService } from './CombatIdentityInferenceService';

const SIMILARITY_THRESHOLD = 0.8;

export interface CombatAnalysisResult {
    opponents: AnalyzedCombatant[];
    allies: AnalyzedCombatant[];
    reasoning: string;
    winProbability: number;
}

export const analyzeCombatants = async (
    kb: KnowledgeBase,
    currentNarration: string,
    previousNarration: string,
    onPromptLog?: (p: string) => void
): Promise<CombatAnalysisResult> => {
    const prompt = analyzeCombatantsPrompt(kb, currentNarration, previousNarration);
    
    const { text: response } = await callGeminiAPI(
        prompt, 
        onPromptLog, 
        'combat',
        undefined,
        "Bạn là hệ thống phân tích đối thủ & bối cảnh chiến đấu. Chỉ trả về khối dữ liệu XML bọc bởi thẻ <ket_qua_phan_tich_chien_dau>...</ket_qua_phan_tich_chien_dau>.",
        undefined,
        'text/plain',
        undefined,
        undefined,
        "Phân tích đối thủ & Bối cảnh chiến đấu"
    );
    
    try {
        return parseXmlCombatAnalysis(response || '');
    } catch (e) {
        console.error("Failed to parse combat analysis XML:", e);
        return { opponents: [], allies: [], reasoning: "Lỗi phân tích AI.", winProbability: 50 };
    }
};

export const resolveCombatantIds = (
    analysis: CombatAnalysisResult,
    kb: KnowledgeBase
): { opponentIds: string[], allyIds: string[], reasoning: string, winProbability: number, temporaryEntities: NPC[] } => {
    const temporaryEntities: NPC[] = [];
    const allEntities = [
        ...kb.discoveredNPCs,
        ...kb.discoveredYeuThu,
        ...kb.wives,
        ...kb.slaves,
        ...kb.prisoners
    ];

    const resolveList = (combatants: AnalyzedCombatant[], isAlly: boolean): string[] => {
        const resolvedIds: string[] = [];
        const currentPlayerName = (kb.worldConfig?.playerName || '').trim().toLowerCase();
        const deceasedMcNames = (kb.worldConfig?.deceasedProtagonists || kb.deceasedProtagonists || []).map(n => n.trim().toLowerCase());
        
        combatants.forEach(combatant => {
            const rawCombatantName = (combatant.name || '').trim();
            const lowerName = rawCombatantName.toLowerCase();

            // 1. Skip if matches current player (player cannot be opponent/ally NPC)
            if (lowerName && lowerName === currentPlayerName) {
                console.log(`[COMBAT_ANALYST] Bỏ qua vì trùng tên nhân vật chính hiện tại: "${combatant.name}"`);
                return;
            }

            // 2. Skip if matches any deceased protagonist
            if (deceasedMcNames.includes(lowerName)) {
                console.log(`[COMBAT_ANALYST] Bỏ qua vì là nhân vật chính tiền nhiệm đã chết: "${combatant.name}"`);
                return;
            }

            const nameOrId = combatant.id || combatant.name;
            const quantity = combatant.quantity || 1;
            
            // For Mechanical Spawning: We need to resolve/create 'quantity' times
            for (let i = 0; i < quantity; i++) {
                let entity: any | undefined;
                
                // If it's a single entity and we have a name/id, try to find it first (only for the first one or if quantity is 1)
                if (i === 0) {
                    // 1. Direct ID match
                    entity = allEntities.find(e => e.id === nameOrId);
                    
                    // 2. Direct Name match
                    if (!entity) {
                        entity = allEntities.find(e => e.name.toLowerCase() === combatant.name.toLowerCase());
                    }

                    // 3. Fuzzy match
                    if (!entity) {
                        let bestMatch: { entity: any | null; score: number } = { entity: null, score: 0 };
                        const normalizedInput = normalizeStringForComparison(combatant.name);

                        allEntities.forEach(e => {
                            const score = diceCoefficient(normalizedInput, normalizeStringForComparison(e.name));
                            if (score > bestMatch.score) {
                                bestMatch = { entity: e, score };
                            }
                        });

                        if (bestMatch.entity && bestMatch.score >= SIMILARITY_THRESHOLD) {
                            entity = bestMatch.entity;
                        }
                    }
                }

                // Check if the matched entity is dead
                if (entity && (('status' in entity && entity.status === 'Đã chết') || (entity.stats && typeof entity.stats.sinhLuc === 'number' && entity.stats.sinhLuc <= 0))) {
                    console.log(`[COMBAT_ANALYST] Bỏ qua vì thực thể đã tử vong: "${entity.name}" (status: ${('status' in entity ? entity.status : 'N/A')})`);
                    return;
                }

                // 4. Auto-generate if not found OR if we are spawning multiples (clones)
                // We only use the original entity for the FIRST one. Subsequent ones in a "quantity > 1" group are always clones.
                if (!entity || i > 0) {
                    // Double check if name matches any dead entity in allEntities
                    const isDeadEntity = allEntities.some(e => 
                        e.name.toLowerCase() === combatant.name.toLowerCase() && 
                        (('status' in e && e.status === 'Đã chết') || (e.stats && typeof e.stats.sinhLuc === 'number' && e.stats.sinhLuc <= 0))
                    );
                    if (isDeadEntity) {
                        console.log(`[COMBAT_ANALYST] Không tự tạo NPC cho thực thể đã chết: "${combatant.name}"`);
                        return;
                    }

                    const suffix = quantity > 1 ? ` #${i + 1}` : '';
                    const displayName = `${combatant.name}${suffix}`;
                    
                    console.log(`[COMBAT_AUTOGEN] Creating temporary NPC for "${displayName}"`);
                    const profile = CombatIdentityInferenceService.createInferredProfile(combatant, kb);

                    const autoSkills: Skill[] = [{
                        id: `auto-skill-basic-${Date.now()}-${i}`,
                        name: "Tấn công thường",
                        description: "Đòn tấn công cơ bản",
                        skillType: GameTemplates.SkillType.KHAC,
                        manaCost: 0,
                        baseDamage: 10,
                        healingAmount: 0,
                        damageMultiplier: 0,
                        healingMultiplier: 0,
                        detailedEffect: "Gây sát thương nhỏ",
                        effect: { type: 'DAMAGE_HP', target: 'single_enemy', basePower: 10 },
                        ownerId: `auto-npc-${combatant.name.replace(/\s+/g, '-')}-${Date.now()}-${i}`
                    }];

                    const generatedNpc: NPC = {
                        id: `auto-npc-${combatant.name.replace(/\s+/g, '-')}-${Date.now()}-${i}`,
                        name: displayName,
                        description: combatant.description || (isAlly ? `Đồng minh xuất hiện bất ngờ.` : `Kẻ địch xuất hiện bất ngờ.`),
                        gender: profile.gender as any,
                        race: profile.race,
                        realm: profile.inferredRealm,
                        affinity: isAlly ? 50 : -50,
                        tuChat: 'Trung Phẩm',
                        stats: DEFAULT_PLAYER_STATS,
                        skills: autoSkills,
                        personalityTraits: isAlly ? ['Hữu hảo'] : ['Hung hăng'],
                        locationId: kb.currentLocationId,
                        isNewlyGenerated: true
                    };

                    // Áp dụng chỉ số chuẩn từ tu vi & định danh vừa suy luận
                    CombatIdentityInferenceService.applyInferredStatsToNPC(generatedNpc, profile, kb);

                    CombatEquipmentGenerator.equipNPCsBeforeBattle([generatedNpc], kb);
                    // NOT PUSHING TO discoveredNPCs ANYMORE
                    temporaryEntities.push(generatedNpc);
                    entity = generatedNpc;
                }

                if (entity) {
                    CombatEquipmentGenerator.equipNPCsBeforeBattle([entity], kb);
                    resolvedIds.push(entity.id);
                }
            }
        });
        
        return resolvedIds;
    };

    const rawOpponents = resolveList(analysis.opponents, false);
    const allyIds = resolveList(analysis.allies, true);
    const { limitedOpponentIds } = limitCombatParticipants(allyIds, rawOpponents);

    return {
        opponentIds: limitedOpponentIds,
        allyIds: allyIds,
        reasoning: analysis.reasoning,
        winProbability: analysis.winProbability,
        temporaryEntities
    };
};

