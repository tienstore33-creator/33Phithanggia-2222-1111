/**
 * Utility functions for parsing XML data structures returned by the AI.
 * Provides robust extraction of game data from nested XML tags.
 */
import { AiTransformationResult } from '../services/dataExtractionService';
import { AnalyzedCombatant } from '../types';
import { CombatAnalysisResult } from '../services/CombatTriggerAnalyst';

/**
 * Extracts the contents of a specific XML tag from text.
 */
export function extractXmlTagContent(text: string, tagName: string): string {
    const escapedTagName = tagName.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
    const regex = new RegExp(`<${escapedTagName}>([\\s\\S]*?)(?:<\\/${escapedTagName}>|$)`, 'i');
    const match = regex.exec(text);
    return match ? match[1].trim() : '';
}

/**
 * Parses XML-based NPC realm normalization results.
 * Expects format:
 * <ket_qua_chuan_hoa>
 *   <nhan_vat>
 *     <id>character_id</id>
 *     <canh_gioi_chuan>standardized_realm</canh_gioi_chuan>
 *   </nhan_vat>
 * </ket_qua_chuan_hoa>
 */
export function parseXmlRealmNormalization(text: string): { id: string; newRealm: string }[] {
    const results: { id: string; newRealm: string }[] = [];
    
    // Scan each <nhan_vat> block
    const nhanVatRegex = /<nhan_vat>([\s\S]*?)<\/nhan_vat>/gi;
    let match;
    while ((match = nhanVatRegex.exec(text)) !== null) {
        const block = match[1];
        const idMatch = /<id>([\s\S]*?)<\/id>/i.exec(block);
        const realmMatch = /<canh_gioi_chuan>([\s\S]*?)<\/canh_gioi_chuan>/i.exec(block);
        
        if (idMatch && realmMatch) {
            results.push({
                id: idMatch[1].trim(),
                newRealm: realmMatch[1].trim()
            });
        }
    }
    return results;
}

/**
 * Parses XML-based skill transformation results.
 * Expects format:
 * <ket_qua_chuan_hoa_ky_nang>
 *   <ky_nang_bien_doi>
 *     <ma_ky_nang>skill_id</ma_ky_nang>
 *     <ten_chuan>matched_combat_skill_name</ten_chuan>
 *     <mo_ta>custom_description</mo_ta>
 *   </ky_nang_bien_doi>
 * </ket_qua_chuan_hoa_ky_nang>
 */
export function parseXmlSkillTransformation(text: string): AiTransformationResult {
    const result: AiTransformationResult = {};
    
    // Scan each <ky_nang_bien_doi> block
    const skillRegex = /<ky_nang_bien_doi>([\s\S]*?)<\/ky_nang_bien_doi>/gi;
    let match;
    while ((match = skillRegex.exec(text)) !== null) {
        const block = match[1];
        const idMatch = /<ma_ky_nang>([\s\S]*?)<\/ma_ky_nang>/i.exec(block);
        const nameMatch = /<ten_chuan>([\s\S]*?)<\/ten_chuan>/i.exec(block);
        const descMatch = /<mo_ta>([\s\S]*?)<\/mo_ta>/i.exec(block);
        
        if (idMatch && nameMatch) {
            const skillId = idMatch[1].trim();
            result[skillId] = {
                matchedCombatSkillName: nameMatch[1].trim(),
                customDescription: descMatch ? descMatch[1].trim() : undefined
            };
        }
    }
    return result;
}

/**
 * Parses XML-based Player Zero actions.
 * Expects format:
 * <hanh_dong_p0>
 *   <npc>
 *     <npcId>id_cua_p0</npcId>
 *     <action>travel | scavenge | cultivate | interaction | combat</action>
 *     <targetName>target_name_if_any</targetName>
 *     <details>narration_description</details>
 *   </npc>
 * </hanh_dong_p0>
 */
export function parseXmlPlayerZero(text: string): { npcId: string; action: string; targetName?: string; details: string }[] {
    const results: { npcId: string; action: string; targetName?: string; details: string }[] = [];
    
    const npcRegex = /<npc>([\s\S]*?)<\/npc>/gi;
    let match;
    while ((match = npcRegex.exec(text)) !== null) {
        const block = match[1];
        const npcIdMatch = /<npcId>([\s\S]*?)<\/npcId>/i.exec(block);
        const actionMatch = /<action>([\s\S]*?)<\/action>/i.exec(block);
        const targetMatch = /<targetName>([\s\S]*?)<\/targetName>/i.exec(block);
        const detailsMatch = /<details>([\s\S]*?)<\/details>/i.exec(block);
        
        if (npcIdMatch && actionMatch && detailsMatch) {
            results.push({
                npcId: npcIdMatch[1].trim(),
                action: actionMatch[1].trim(),
                targetName: targetMatch ? targetMatch[1].trim() : undefined,
                details: detailsMatch[1].trim()
            });
        }
    }
    return results;
}

/**
 * Parses XML-based Combat Analysis results.
 * Expects format:
 * <ket_qua_phan_tich_chien_dau>
 *   <reasoning>Mô tả ngắn gọn...</reasoning>
 *   <winProbability>50</winProbability>
 *   <opponents>
 *     <combatant>
 *       <id>ID_neu_co</id>
 *       <name>tên_hoặc_id</name>
 *       <quantity>1</quantity>
 *       <isNew>false</isNew>
 *       <powerLevel>1.0</powerLevel>
 *       <description>...</description>
 *     </combatant>
 *   </opponents>
 *   <allies>
 *     <combatant>
 *       <id>ID_neu_co</id>
 *       <name>tên_hoặc_id</name>
 *       <quantity>1</quantity>
 *       <isNew>false</isNew>
 *       <powerLevel>1.0</powerLevel>
 *       <description>...</description>
 *     </combatant>
 *   </allies>
 * </ket_qua_phan_tich_chien_dau>
 */
export function parseXmlCombatAnalysis(text: string): CombatAnalysisResult {
    const opponents: AnalyzedCombatant[] = [];
    const allies: AnalyzedCombatant[] = [];
    let reasoning = "";
    let winProbability = 50;

    const block = extractXmlTagContent(text, 'ket_qua_phan_tich_chien_dau');
    if (block) {
        const reasoningMatch = /<reasoning>([\s\S]*?)(?:<\/reasoning>|$)/i.exec(block);
        if (reasoningMatch) reasoning = reasoningMatch[1].trim();

        const wpMatch = /<winProbability>([\s\S]*?)(?:<\/winProbability>|$)/i.exec(block);
        if (wpMatch) {
            const parsedWp = parseInt(wpMatch[1].trim(), 10);
            if (!isNaN(parsedWp)) winProbability = parsedWp;
        }

        const parseList = (listBlock: string, targetList: AnalyzedCombatant[]) => {
            const combatantRegex = /<combatant>([\s\S]*?)(?:<\/combatant>|$)/gi;
            let match;
            while ((match = combatantRegex.exec(listBlock)) !== null) {
                const itemBlock = match[1];
                const nameMatch = /<name>([\s\S]*?)(?:<\/name>|$)/i.exec(itemBlock);
                const quantityMatch = /<quantity>([\s\S]*?)(?:<\/quantity>|$)/i.exec(itemBlock);
                const isNewMatch = /<isNew>([\s\S]*?)(?:<\/isNew>|$)/i.exec(itemBlock);
                const descMatch = /<description>([\s\S]*?)(?:<\/description>|$)/i.exec(itemBlock);
                const powerMatch = /<powerLevel>([\s\S]*?)(?:<\/powerLevel>|$)/i.exec(itemBlock);
                const idMatch = /<id>([\s\S]*?)(?:<\/id>|$)/i.exec(itemBlock);
                const realmMatch = /<realm>([\s\S]*?)(?:<\/realm>|$)/i.exec(itemBlock);
                const identityMatch = /<identityReasoning>([\s\S]*?)(?:<\/identityReasoning>|$)/i.exec(itemBlock);
                const raceMatch = /<race>([\s\S]*?)(?:<\/race>|$)/i.exec(itemBlock);
                const genderMatch = /<gender>([\s\S]*?)(?:<\/gender>|$)/i.exec(itemBlock);

                if (nameMatch) {
                    targetList.push({
                        id: idMatch ? idMatch[1].trim() : undefined,
                        name: nameMatch[1].trim(),
                        isNew: isNewMatch ? isNewMatch[1].trim().toLowerCase() === 'true' : false,
                        description: descMatch ? descMatch[1].trim() : undefined,
                        powerLevel: powerMatch ? powerMatch[1].trim() : "1.0",
                        quantity: quantityMatch ? Number(quantityMatch[1].trim()) || 1 : 1,
                        realm: realmMatch ? realmMatch[1].trim() : undefined,
                        identityReasoning: identityMatch ? identityMatch[1].trim() : undefined,
                        race: raceMatch ? raceMatch[1].trim() : undefined,
                        gender: genderMatch ? genderMatch[1].trim() : undefined
                    });
                }
            }
        };

        const opponentsBlock = extractXmlTagContent(block, 'opponents');
        if (opponentsBlock) parseList(opponentsBlock, opponents);

        const alliesBlock = extractXmlTagContent(block, 'allies');
        if (alliesBlock) parseList(alliesBlock, allies);
    }

    return { opponents, allies, reasoning, winProbability };
}

/**
 * Parses XML-based Combat Turn results.
 * Expects format:
 * <ket_qua_giao_tranh>
 *   <updatedOpponents>
 *     <opponent>
 *       <id>id_cua_ke_dich</id>
 *       <damageTaken>10</damageTaken>
 *       <statusEffect>Bình thường</statusEffect>
 *     </opponent>
 *   </updatedOpponents>
 *   <playerDamageTaken>0</playerDamageTaken>
 *   <playerMpUsed>0</playerMpUsed>
 *   <isCombatEnded>false</isCombatEnded>
 *   <victory>false</victory>
 * </ket_qua_giao_tranh>
 */
export function parseXmlCombatTurnResult(text: string): any {
    const block = extractXmlTagContent(text, 'ket_qua_giao_tranh');
    if (!block) return undefined;

    const updatedOpponents: { id: string; damageTaken: number; statusEffect: string }[] = [];
    
    const opponentsBlock = extractXmlTagContent(block, 'updatedOpponents');
    const oppsToUse = opponentsBlock || block;
    
    const opponentRegex = /<opponent>([\s\S]*?)(?:<\/opponent>|$)/gi;
    let match;
    while ((match = opponentRegex.exec(oppsToUse)) !== null) {
        const oppBlock = match[1];
        const idMatch = /<id>([\s\S]*?)(?:<\/id>|$)/i.exec(oppBlock);
        const dmgMatch = /<damageTaken>([\s\S]*?)(?:<\/damageTaken>|$)/i.exec(oppBlock);
        const statusMatch = /<statusEffect>([\s\S]*?)(?:<\/statusEffect>|$)/i.exec(oppBlock);

        if (idMatch) {
            updatedOpponents.push({
                id: idMatch[1].trim(),
                damageTaken: dmgMatch ? Number(dmgMatch[1].trim()) || 0 : 0,
                statusEffect: statusMatch ? statusMatch[1].trim() : "Bình thường"
            });
        }
    }

    const playerDmgMatch = /<playerDamageTaken>([\s\S]*?)(?:<\/playerDamageTaken>|$)/i.exec(block);
    const playerMpMatch = /<playerMpUsed>([\s\S]*?)(?:<\/playerMpUsed>|$)/i.exec(block);
    const endedMatch = /<isCombatEnded>([\s\S]*?)(?:<\/isCombatEnded>|$)/i.exec(block);
    const victoryMatch = /<victory>([\s\S]*?)(?:<\/victory>|$)/i.exec(block);

    return {
        updatedOpponents,
        playerDamageTaken: playerDmgMatch ? Number(playerDmgMatch[1].trim()) || 0 : 0,
        playerMpUsed: playerMpMatch ? Number(playerMpMatch[1].trim()) || 0 : 0,
        isCombatEnded: endedMatch ? endedMatch[1].trim().toLowerCase() === 'true' : false,
        victory: victoryMatch ? victoryMatch[1].trim().toLowerCase() === 'true' : false
    };
}
