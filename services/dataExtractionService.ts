import { callGeminiAPI } from './apiService';
import { generateGameResponseStream } from './geminiStreamService';
import { PROMPT_FUNCTIONS } from '../prompts';
import { safeJsonParse, extractTagsFromJsonResponse } from '../utils/jsonUtils';
import { parseXmlSkillTransformation } from '../utils/xmlDataParser';
import { reconcilePostCombatTags } from '../utils/tagProcessors/postCombatIdentityProcessor';
import { extractTagsFromText } from '../utils/tagUtils';
import { Skill, OfflineCombatSkill } from '../types';

export interface AiTransformationResult {
  [skillId: string]: {
    matchedCombatSkillName: string; // Tên của kỹ năng trong COMBAT_MODE_SKILLS
    customDescription?: string;
  };
}

/**
 * Tự động phát hiện địa danh và sự chuyển đổi vị trí từ lời kể bằng NLP/Heuristic thuần cơ học.
 * Giúp đồng bộ hóa vị trí tức thì mà không làm tăng tải của Prompt hay phình to nội dung gửi AI.
 */
export const autoDetectLocationsAndTransitions = (
    narrative: string,
    knowledgeBase: any,
    extractedTags: string[]
): string[] => {
    if (!narrative) return extractedTags;

    const tagsSet = new Set(extractedTags);

    const existingLocations = (knowledgeBase?.discoveredLocations || []) as Array<{ id: string; name: string }>;
    
    const normalize = (str: string): string => {
        if (!str) return "";
        return str.toLowerCase()
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "")
            .replace(/đ/g, "d")
            .replace(/[^a-z0-9]/g, "");
    };

    const existingNamesNormalized = new Set(existingLocations.map(l => normalize(l.name)));

    // Phương pháp 2: Chỉ tạo địa điểm nếu bước chính đã viết tag tạo địa điểm nhưng thất bại/sai cú pháp
    const locationKeywords = [
        "LOCATION_CREATE", "CREATE_LOCATION", "LOCATION_CREATION", 
        "ADD_LOCATION", "NEW_LOCATION", "LOCATION-CREATE", "LOCATION CREATE"
    ];

    locationKeywords.forEach(kw => {
        const escapedKw = kw.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
        const regex = new RegExp(`(?:\\[|\\b)${escapedKw}[^\\n\\]]*`, 'gi');
        const matches: string[] = narrative.match(regex) || [];

        matches.forEach((matchStr: string) => {
            let name = "";
            
            // Tìm thuộc tính name="Tên" hoặc name='Tên' hoặc name=Tên
            const nameAttrMatch = matchStr.match(/name\s*=\s*["']([^"']+)["']/i) || 
                                  matchStr.match(/name\s*=\s*([^,\s\]"]+)/i);
            if (nameAttrMatch && nameAttrMatch[1]) {
                name = nameAttrMatch[1].trim();
            } else {
                // Fallback: Lấy phần text sau dấu hai chấm
                const parts = matchStr.split(/[:\s]+/);
                if (parts.length > 1) {
                    const afterKw = matchStr.substring(matchStr.toLowerCase().indexOf(kw.toLowerCase()) + kw.length).trim();
                    const cleanAfter = afterKw.replace(/^[:\s\="]+/, '').trim();
                    const firstSegment = cleanAfter.split(/[,\]"\n]+/)[0].trim();
                    if (firstSegment && 
                        !firstSegment.toLowerCase().includes("type=") && 
                        !firstSegment.toLowerCase().includes("description=")) {
                        name = firstSegment;
                    }
                }
            }

            if (name && name.length > 2) {
                const normName = normalize(name);
                
                const alreadyHasCreate = Array.from(tagsSet).some(tag => {
                    const up = tag.toUpperCase();
                    return up.includes('LOCATION_CREATE') && normalize(tag).includes(normName);
                });

                if (!existingNamesNormalized.has(normName) && !alreadyHasCreate) {
                    let type = "DEFAULT";
                    const typeMatch = matchStr.match(/type\s*=\s*["']([^"']+)["']/i);
                    if (typeMatch && typeMatch[1]) {
                        type = typeMatch[1].toUpperCase();
                    }
                    
                    let desc = "Địa danh kỳ bí xuất hiện qua lời kể, thuộc cuộc hành trình tiên đạo vạn dặm.";
                    const descMatch = matchStr.match(/description\s*=\s*["']([^"']+)["']/i);
                    if (descMatch && descMatch[1]) {
                        desc = descMatch[1];
                    }

                    tagsSet.add(`[LOCATION_CREATE: name="${name}", type="${type}", description="${desc}"]`);
                    console.log(`[CƠ CHẾ SỬA LỖI - THIÊN ĐẠO] Phát hiện và sửa tag địa điểm viết sai cú pháp từ lời kể chính: ${name}`);
                }
            }
        });
    });

    const updateDataMatch = narrative.match(/<update_data>([\s\S]*?)<\/update_data>/i);
    const entityTrackingMatch = narrative.match(/<Entity_Tracking>([\s\S]*?)<\/Entity_Tracking>/i);

    let searchableContent = "";
    if (updateDataMatch) {
        searchableContent = updateDataMatch[1];
        if (entityTrackingMatch) searchableContent += "\n" + entityTrackingMatch[1];
    } else {
        searchableContent = narrative;
    }

    // Phương pháp 3: Tự động di chuyển vị trí (nếu phát hiện có động từ chuyển vùng đến địa danh đó)
    // Cập nhật: CHỈ cho phép tìm kiếm trong update_data nếu có, tuân thủ kỷ luật Thiên Đạo Sync
    const movementKeywords = [
        "di chuyển đến", "di chuyển tới", "đi đến", "đi tới", "bước vào", "tiến vào", "trở về", "quay lại", 
        "ngự kiếm đến", "bay đến", "tìm đến", "đứng trước", "bước tới", "lẻn vào", "đột nhập", "đến bến", "đến", 
        "đến vùng", "đặt chân đến", "đặt chân tới", "độc hành đến", "chạy đến", "chạy tới"
    ];

    const escapedVerbs = movementKeywords.map(v => v.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&')).join('|');
    
    const newlyAddedNames: string[] = [];
    tagsSet.forEach(tag => {
        if (tag.toUpperCase().includes('LOCATION_CREATE')) {
            const nameMatch = tag.match(/name\s*=\s*["']([^"']+)["']/i);
            if (nameMatch && nameMatch[1]) {
                newlyAddedNames.push(nameMatch[1].trim());
            }
        }
    });

    const allLocations = Array.from(new Set([
        ...existingLocations.map(l => l.name),
        ...newlyAddedNames
    ]));

    for (const locName of allLocations) {
        const escapedLoc = locName.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
        const movementRegex = new RegExp(`\\b(?:${escapedVerbs})\\s+(?:bên trong|bên dưới|bên trên|trong|vùng|khu vực|tại)?\\s*${escapedLoc}\\b`, 'i');

        if (movementRegex.test(searchableContent)) {
            const hasLocationChange = Array.from(tagsSet).some(tag => tag.toUpperCase().includes('LOCATION_CHANGE'));
            
            if (!hasLocationChange) {
                tagsSet.add(`[LOCATION_CHANGE: name="${locName}"]`);
                console.log(`[CƠ CHẾ TỰ ĐỘNG - THIÊN ĐẠO] Tự điều hướng hành trình đến: ${locName}`);
                break; // Chỉ di chuyển đến một địa điểm chính mỗi lượt
            }
        }
    }

    
    // Đã loại bỏ hoàn toàn các regex tự động chèn tag INTERACTION sex (sexRegex, wombRegex)
    // nhằm tránh tự động phán định sai lệch khi AI không hề xuất tag trong khối JSON.

    
    const pregnancyRevealRegex = /([\p{L}\p{M}\s]+)\s+(mang thai|có thai|nôn nghén|nghén|chửa)/giu;
    let pregnancyRevealMatch;
    while ((pregnancyRevealMatch = pregnancyRevealRegex.exec(narrative)) !== null) {
        let p1 = pregnancyRevealMatch[1].trim();
        p1 = p1.replace(/^(như|rằng|khi|lúc|sau đó|và|thì|nhưng|tuy nhiên|có vẻ)\s+/i, "").trim();
        p1 = p1.split(/[\,\.\;\:\(\)]/)[0].trim();
        
        if (p1.length > 1) {
            const tag = `[INTERACTION: type="pregnancy_reveal", partner="${p1}"]`;
            if(!Array.from(tagsSet).some(t => t.includes('INTERACTION: type="pregnancy_reveal"') && t.includes(p1))) {
                tagsSet.add(tag);
                console.log(`[CƠ CHẾ TỰ ĐỘNG - THIÊN ĐẠO] Tự động phát hiện thông báo mang thai: ${p1}`);
            }
        }
    }

    
    // 1. Cú pháp rename tiếng Anh hoặc mở rộng: Cập nhật: rename [tù nhân/tù binh/NPC] [Tên Cũ] -> [Tên Mới]
    const renameEngRegex = /Cập nhật:\s+(?:rename\s+)?(?:tù nhân|tù binh|NPC\s+)?([\p{L}\p{M}\s]+)\s*(?:->|➔)\s*([\p{L}\p{M}\s]+)/giu;
    let renameEngMatch;
    while ((renameEngMatch = renameEngRegex.exec(narrative)) !== null) {
        let oldName = renameEngMatch[1].trim();
        let newName = renameEngMatch[2].trim();
        newName = newName.split(/[\,\.\;\:\(\)]/)[0].trim();
        oldName = oldName.split(/[\,\.\;\:\(\)]/)[0].trim();

        if (oldName && newName) {
            const currentMcName = knowledgeBase.worldConfig?.playerName || knowledgeBase.playerStats?.name || "";
            const isMc = currentMcName && (
                oldName.toLowerCase() === currentMcName.toLowerCase() || 
                currentMcName.toLowerCase().includes(oldName.toLowerCase()) || 
                oldName.toLowerCase().includes(currentMcName.toLowerCase()) || 
                oldName.toLowerCase() === "mc" || 
                oldName.toLowerCase() === "nhân vật chính"
            );
            
            if (isMc) {
                const tag = `[MC_RENAME: newName="${newName}"]`;
                if (!Array.from(tagsSet).some(t => t.includes('MC_RENAME'))) {
                    tagsSet.add(tag);
                    console.log(`[CƠ CHẾ TỰ ĐỘNG - THIÊN ĐẠO] Tự động phát hiện đổi tên MC: ${currentMcName} -> ${newName}`);
                }
            } else {
                const tag = `[NPC_RENAME: oldName="${oldName}", newName="${newName}"]`;
                if(!Array.from(tagsSet).some(t => t.includes('NPC_RENAME') && t.includes(oldName))) {
                    tagsSet.add(tag);
                    console.log(`[CƠ CHẾ TỰ ĐỘNG - THIÊN ĐẠO] Tự động phát hiện đổi tên (NPC/Tù nhân): ${oldName} -> ${newName}`);
                }
            }
        }
    }

    const renameRegex = /Cập nhật:\s+(?:tù nhân|tù binh|NPC\s+)?([\p{L}\p{M}\s]+)\s+(?:đã đổi tên thành|đổi tên thành|tiết lộ tên thật là|mang tên thật là)\s+([\p{L}\p{M}\s]+)/giu;
    let renameMatch;
    while ((renameMatch = renameRegex.exec(narrative)) !== null) {
        let oldName = renameMatch[1].trim();
        let newName = renameMatch[2].trim();
        newName = newName.split(/[\,\.\;\:\(\)]/)[0].trim();
        
        if (oldName && newName) {
            const tag = `[NPC_RENAME: oldName="${oldName}", newName="${newName}"]`;
            if(!Array.from(tagsSet).some(t => t.includes('NPC_RENAME') && t.includes(oldName))) {
                tagsSet.add(tag);
                console.log(`[CƠ CHẾ TỰ ĐỘNG - THIÊN ĐẠO] Tự động phát hiện đổi tên: ${oldName} -> ${newName}`);
            }
        }
    }

    const mcRenameRegex = /Cập nhật:\s+(?:Đổi tên nhân vật chính|Nhân vật chính đổi tên|Đổi tên MC|MC đổi tên)\s+(?:thành\s+)?([\p{L}\p{M}\s:]+)/giu;
    let mcRenameMatch;
    while ((mcRenameMatch = mcRenameRegex.exec(narrative)) !== null) {
        let newName = mcRenameMatch[1].trim();
        // Loại bỏ dấu hai chấm nếu có ở đầu
        newName = newName.replace(/^[\s:]+/, "").trim();
        
        // Nếu newName vẫn còn chữ "thành" ở đầu do regex tham lam nuốt mất, hãy cắt bỏ nó
        if (newName.toLowerCase().startsWith("thành")) {
            newName = newName.substring(5).replace(/^[\s:,]+/, "").trim();
        }

        newName = newName.split(/[\,\.\;\:\(\)]/)[0].trim();
        if (newName) {
            const tag = `[MC_RENAME: newName="${newName}"]`;
            if (!Array.from(tagsSet).some(t => t.includes('MC_RENAME'))) {
                tagsSet.add(tag);
                console.log(`[CƠ CHẾ TỰ ĐỘNG - THIÊN ĐẠO] Tự động phát hiện đổi tên MC -> ${newName}`);
            }
        }
    }

    
    const pregnancyUpdateRegex = /Cập nhật:\s+([\p{L}\p{M}\s]+)\s+(mang thai|đã sinh con)/giu;
    let pregnancyUpdateMatch;
    while ((pregnancyUpdateMatch = pregnancyUpdateRegex.exec(narrative)) !== null) {
        let name = pregnancyUpdateMatch[1].trim();
        let status = pregnancyUpdateMatch[2].trim().toLowerCase();
        name = name.replace(/^(như|rằng|khi|lúc|sau đó|và|thì|nhưng|tuy nhiên|có vẻ)\s+/i, "").trim();
        name = name.split(/[\,\.\;\:\(\)]/)[0].trim();
        
        if (name.length > 1) {
            let desc = status.includes("mang thai") ? "Đang mang trong mình cốt nhục" : "Đã hạ sinh con";
            let statusText = status.includes("mang thai") ? "Mang thai" : "Bình thường";
            
            const tag = `[NPC_UPDATE: id="${name}", status="${statusText}", description="${desc}"]`;
            if(!Array.from(tagsSet).some(t => t.includes('NPC_UPDATE') && t.includes(name) && t.includes(statusText))) {
                tagsSet.add(tag);
                console.log(`[CƠ CHẾ TỰ ĐỘNG - THIÊN ĐẠO] Tự động phát hiện trạng thái thai sản: ${name} - ${statusText}`);
            }
        }
    }



    return Array.from(tagsSet);
};

// Map để chống gọi đúp API (In-Flight Request Lock / Deduplication)
const activeExtractAndMemoryPromises = new Map<string, Promise<{ tags: string[]; flashSummary?: string; flashDetails?: string }>>();

/**
 * Service to extract game tags from narrative text using a fast AI model.
 */
export const DataExtractionService = {
    /**
     * Extracts tags from the provided narrative.
     * Uses the 'combat' category which maps to Flash Lite models for speed.
     */
    extractTags: async (narrative: string, knowledgeBase?: any): Promise<string[]> => {
        try {
            // [THIÊN ĐẠO SYNC] Loại bỏ các khối có khả năng chứa tag lặp lại để AI trích xuất chỉ tập trung vào narrative và update_data
            const cleanedNarrative = narrative
                .replace(/<thinking>[\s\S]*?<\/thinking>/gi, '') // Loại bỏ thinking
                .replace(/\{[\s\S]*?"tags"[\s\S]*?\}[\s\S]*$/gi, '') // Loại bỏ khối JSON ở cuối
                .trim();

            const prompt = PROMPT_FUNCTIONS.tagExtraction(cleanedNarrative || narrative, knowledgeBase);
            
            const text = await generateGameResponseStream(
                prompt,
                '', // Default model based on category
                () => {}, // Empty chunk handler 
                undefined,
                undefined,
                undefined,
                false,
                'combat', // Fast model
                undefined,
                'application/json', // Force JSON output
                "Trích xuất tag và dữ liệu hệ thống"
            );

            // Strip out <phan_tich_+extraction_result>, <thinking>, and <think> from fast agent response before scanning
            const responseWithoutAnalysis = text
                .replace(/<phan_tich_\+extraction_result>[\s\S]*?<\/phan_tich_\+extraction_result>/gi, '')
                .replace(/<phan_tich_\+[\s\S]*?<\/phan_tich_\+[\s\S]*?>/gi, '')
                .replace(/<(thinking|think)[^>]*>[\s\S]*?<\/\1>/gi, '')
                .replace(/<(thinking|think)[^>]*>[\s\S]*?(?=(?:<(?:content|narration|update_data|choice|choices|branches|json_data|tags)|$))/gi, '')
                .replace(/<\/?(thinking|think)[^>]*>/gi, '');

            const collectedTagsSet = new Set<string>();

            const parsed = safeJsonParse(text);
            if (parsed && Array.isArray(parsed.tags)) {
                parsed.tags.forEach((tag: any) => {
                    if (typeof tag === 'string' && tag.trim()) {
                        collectedTagsSet.add(tag.trim());
                    }
                });
            } else {
                // Sử dụng trích xuất tag JSON an toàn trực tiếp từ mảng "tags": [...] thay vì quét toàn văn bản bằng Regex để tránh nhận diện sai text
                const tagsFromJson = extractTagsFromJsonResponse(text);
                tagsFromJson.forEach((tag: any) => {
                    if (typeof tag === 'string' && tag.trim()) {
                        collectedTagsSet.add(tag.trim());
                    }
                });
            }

            const rawTags = Array.from(collectedTagsSet);
            if (rawTags.length > 0) {
                let extractedTags = autoDetectLocationsAndTransitions(narrative, knowledgeBase, rawTags);
                const currentTurn = knowledgeBase?.playerStats?.turn ?? 0;
                extractedTags = reconcilePostCombatTags(extractedTags, knowledgeBase, currentTurn);
                return extractedTags;
            }

            return autoDetectLocationsAndTransitions(narrative, knowledgeBase, []);
        } catch (error) {
            console.error("Failed to extract tags from narrative:", error);
            return autoDetectLocationsAndTransitions(narrative, knowledgeBase, []);
        }
    },

    /**
     * Extracts tags and builds Flash Agent Memory in an combined single API call.
     */
    extractTagsAndMemory: async (
        narrative: string, 
        playerInput: string,
        turnNumber: number,
        locationName: string,
        timeString: string,
        knowledgeBase?: any,
        onChunk?: (text: string) => void
    ): Promise<{
        tags: string[];
        flashSummary?: string;
        flashDetails?: string;
    }> => {
        // [CHỐNG GỌI ĐÚP] Tạo dedupeKey dựa trên turnNumber và trích đoạn narrative
        const dedupeKey = `turn-${turnNumber}-${(narrative || '').slice(0, 100)}`;
        if (activeExtractAndMemoryPromises.has(dedupeKey)) {
            console.log(`[DataExtractionService] Phát hiện cuộc gọi trích xuất trùng lặp cho turn ${turnNumber}. Tái sử dụng kết quả Promise đang chạy.`);
            return activeExtractAndMemoryPromises.get(dedupeKey)!;
        }

        const executionPromise = (async () => {
            try {
                // [THIÊN ĐẠO SYNC] Loại bỏ các khối có khả năng chứa tag lặp lại
                const cleanedNarrative = narrative
                    .replace(/<(thinking|think)[^>]*>[\s\S]*?<\/\1>/gi, '') // Loại bỏ thinking/think
                    .replace(/<(thinking|think)[^>]*>[\s\S]*?(?=(?:<(?:content|narration|update_data|choice|choices|branches|json_data|tags)|$))/gi, '')
                    .replace(/<\/?(thinking|think)[^>]*>/gi, '')
                    .replace(/\{[\s\S]*?"tags"[\s\S]*?\}[\s\S]*$/gi, '') // Loại bỏ khối JSON ở cuối
                    .trim();

            const pendingQuests = knowledgeBase?.allQuests?.filter((q: any) => q.status === 'pending') || [];
            const canAssignQuest = pendingQuests.length < 2;

            const prompt = PROMPT_FUNCTIONS.tagAndMemoryExtraction(
                cleanedNarrative || narrative,
                playerInput,
                turnNumber,
                locationName,
                timeString,
                knowledgeBase,
                canAssignQuest
            );
            
            let text = "";
            if (onChunk) {
                text = await generateGameResponseStream(
                    prompt,
                    "",
                    (chunk) => {
                        text += chunk;
                        if (onChunk) onChunk(text);
                    },
                    undefined,
                    undefined,
                    undefined,
                    false,
                    'combat',
                    () => {
                        text = "";
                    },
                    undefined,
                    "Trích xuất tag và tạo fast summary"
                );
            } else {
                const result = await callGeminiAPI(
                    prompt,
                    undefined,
                    'combat', // Fast model
                    undefined,
                    undefined,
                    false,
                    undefined, // Remove application/json to allow XML + JSON output
                    undefined,
                    undefined,
                    "Trích xuất tag và tạo fast summary"
                );
                text = result.text;
            }

            try {
                // Chỉ giữ duy nhất 1 lượt đồng bộ Fast Agent mới nhất
                const logs = [{ turn: turnNumber, prompt, response: text }];
                localStorage.setItem('latest_sync_logs', JSON.stringify(logs));
            } catch (e) {
                console.warn("Failed to store sync logs:", e);
            }

            const tagsFromJson = extractTagsFromJsonResponse(text);
            
            const parsed = safeJsonParse(text);
            const result: { tags: string[]; flashSummary?: string; flashDetails?: string } = {
                tags: []
            };
            
            const collectedTagsSet = new Set<string>();

            if (tagsFromJson && Array.isArray(tagsFromJson)) {
                tagsFromJson.forEach((tag: any) => {
                    if (typeof tag === 'string' && tag.trim()) {
                        collectedTagsSet.add(tag.trim());
                    }
                });
            }

            if (parsed) {
                if (typeof parsed.flashSummary === 'string') {
                    result.flashSummary = parsed.flashSummary;
                }
                if (typeof parsed.flashDetails === 'string') {
                    result.flashDetails = parsed.flashDetails;
                }
            } else {
                console.warn("[DataExtractionService] Fast Agent response JSON parsing warning.");
            }

            const rawTags = Array.from(collectedTagsSet);
            let extractedTags = autoDetectLocationsAndTransitions(narrative, knowledgeBase, rawTags);
            extractedTags = reconcilePostCombatTags(extractedTags, knowledgeBase, turnNumber);
            result.tags = extractedTags;
            
            return result;
        } catch (error) {
            console.error("Failed to extract tags and memory from narrative:", error);
            return { tags: autoDetectLocationsAndTransitions(narrative, knowledgeBase, []) };
        } finally {
            activeExtractAndMemoryPromises.delete(dedupeKey);
        }
        })();

        activeExtractAndMemoryPromises.set(dedupeKey, executionPromise);
        return executionPromise;
    },

    /**
     * Gửi danh sách kỹ năng và danh sách COMBAT_MODE_SKILLS cho AI để phân tích mapping khớp nhất
     * (Đã được gộp từ aiSkillService)
     */
    transformSkills: async (
        skills: Skill[], 
        combatSkills: readonly OfflineCombatSkill[]
    ): Promise<AiTransformationResult> => {
        if (!skills.length) return {};

        const skillsData = skills.map(s => ({
            id: s.id,
            name: s.name,
            description: s.description,
        }));

        const combatSkillsReference = combatSkills.map(cs => ({
            name: cs.name,
            description: cs.description,
        }));

        const prompt = `<he_thong_mapping_ky_nang>
<nhiem_vu_+he_thong_mapping_ky_nang>
================
Bạn là Trình điều phối Chiến đấu cấp cao. Nhiệm vụ của bạn là phân tích các kỹ năng của người chơi và map chúng vào các "Kỹ năng chiến đấu cốt lõi" (COMBAT_MODE_SKILLS) phù hợp nhất.
================
</nhiem_vu_+he_thong_mapping_ky_nang>

<danh_sach_ky_nang_+he_thong_mapping_ky_nang>
================
DANH SÁCH KỸ NĂNG CẦN MAPPING:
${JSON.stringify(skillsData, null, 2)}
================
</danh_sach_ky_nang_+he_thong_mapping_ky_nang>

<danh_sach_combat_skills_+he_thong_mapping_ky_nang>
================
DANH SÁCH COMBAT_MODE_SKILLS (CORE LOGIC):
${JSON.stringify(combatSkillsReference, null, 2)}
================
</danh_sach_combat_skills_+he_thong_mapping_ky_nang>

<quy_tac_mapping_+he_thong_mapping_ky_nang>
<luat_vu_khi_can_chien_+quy_tac_mapping_+he_thong_mapping_ky_nang>
================
BẤT KỲ kỹ năng nào có tên gọi hoặc nội dung mô tả liên quan đến đao, kiếm, các loại vũ khí cận chiến, đâm, chém, trảm, hoặc cận chiến vật lý... BẮT BUỘC phải phân định và gán thành kỹ năng có lõi là "combat Chém Chém".
================
</luat_vu_khi_can_chien_+quy_tac_mapping_+he_thong_mapping_ky_nang>
<luat_dinh_dang_output_+quy_tac_mapping_+he_thong_mapping_ky_nang>
================
1. Với mỗi kỹ năng cần mapping, hãy chọn MỘT kỹ năng từ danh sách COMBAT_MODE_SKILLS có bản chất/ý nghĩa gần nhất.
2. BẮT BUỘC chỉ trả về khối dữ liệu XML bọc bởi thẻ <ket_qua_chuan_hoa_ky_nang>...</ket_qua_chuan_hoa_ky_nang>.
3. Không bọc thẻ markdown, không kèm văn bản giải thích.

Cấu trúc XML yêu cầu:
<ket_qua_chuan_hoa_ky_nang>
  <ky_nang_bien_doi>
    <ma_ky_nang>id_cua_ky_nang</ma_ky_nang>
    <ten_chuan>ten_combat_mode_skill_tuong_ung</ten_chuan>
    <mo_ta>custom_description_neu_co</mo_ta>
  </ky_nang_bien_doi>
</ket_qua_chuan_hoa_ky_nang>
================
</luat_dinh_dang_output_+quy_tac_mapping_+he_thong_mapping_ky_nang>
</quy_tac_mapping_+he_thong_mapping_ky_nang>
</he_thong_mapping_ky_nang>`;

        try {
            const { text } = await callGeminiAPI(
                prompt,
                undefined,
                'combat',
                undefined,
                "Bạn là hệ thống xử lý logic game. BẮT BUỘC chỉ trả về duy nhất khối dữ liệu XML bọc bởi thẻ <ket_qua_chuan_hoa_ky_nang>...</ket_qua_chuan_hoa_ky_nang>.",
                false,
                'text/plain',
                undefined,
                undefined,
                "Chuyển hóa kỹ năng người chơi",
                undefined,
                false
            );
            
            return parseXmlSkillTransformation(text || '');
        } catch (error) {
            console.error("[DataExtractionService] Lỗi khi gọi AI chuyển hóa kỹ năng:", error);
            throw error;
        }
    }
};
