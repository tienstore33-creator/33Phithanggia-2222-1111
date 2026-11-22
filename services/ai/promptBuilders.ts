
import { KnowledgeBase, WorldSettings } from '../../types';
import { DEFAULT_PRESET_CONFIG } from '../../constants/tawa_modules';
import { getSystemConfig } from '../../utils/levelUtils';
import { PregnancyService } from '../PregnancyService';
import { getNpcRichSummaries, getCombinedActiveNpcsRichSummaries } from './NpcMemoryService';
import { getTwoRecentRawNarrations, getNpcRichSummaryForPrompt } from '../../prompts/promptTaskHelpers';
import { isMainQuest } from '../../utils/questUtils';

/**
 * Builds the leveling instruction for the AI.
 */
export const buildLevelingInstruction = (kb: KnowledgeBase): string => {
    const { dai, tieu } = getSystemConfig(kb);
    return `
--- HỆ THỐNG CẢNH GIỚI (MANDATORY LEVELING SYSTEM) ---
BẮT BUỘC: Khi tạo NPC mới bằng tag [NPC], bạn CHỈ ĐƯỢC PHÉP sử dụng các cấp độ sau:
- Đại cảnh giới: ${dai.join(", ")}
- Tiểu cảnh giới: ${tieu.join(", ")}
QUY TẮC: Cấp độ NPC phải có định dạng "Đại cảnh giới - Tiểu cảnh giới" (Ví dụ: "${dai[0]} - ${tieu[0]}").
TUYỆT ĐỐI KHÔNG tự ý sáng tạo các tên cảnh giới khác ngoài danh sách trên.
`;
};

/**
 * Builds the comprehensive prompt for the TAWA Storyteller engine.
 */
export const buildTawaEnginePrompt = (
    kb: KnowledgeBase,
    playerAction: string,
    activeNpcs: any[] = [],
    narrationMin: number = 2600,
    narrationMax: number = 3500,
    pacingLevel: number = 5,
    currentPageMessagesLog: string = "",
    previousPageSummaries: string[] = [],
    lastNarrationFromPreviousPage?: string
): string => {
    const config = kb.worldConfig;
    const workName = config?.originalWork || "Nguyên tác";

    // 1. Filter and sort modules
    const activeModules = DEFAULT_PRESET_CONFIG.modules.filter(m => {
        if (!m.isActive) return false;
        if (m.id === 'sys_combat_cliffhanger' && config?.isCultivationEnabled === false) {
            return false;
        }
        return true;
    });
    const sortedModules = activeModules.sort((a, b) => a.order - b.order);
    
    // 1.1 Extract Recent Narrations for Flash State Context
    const recentNarrations = getTwoRecentRawNarrations(kb.currentTurnLog, currentPageMessagesLog);

    const canonGroundingInstruction = `
[CANON GROUNDING PROTOCOL - QUY TẮC TRA CỨU NGUYÊN TÁC]
Bạn có quyền truy cập công cụ Google Search. BẮT BUỘC tuân thủ các quy tắc sau để bảo vệ tính nguyên tác:

1. TRIGGER CONDITION (Khi nào cần tìm kiếm):
   - CHỈ tìm kiếm khi người chơi tương tác với một DANH TỪ RIÊNG mới (Tên nhân vật, Địa danh, Pháp bảo, Môn phái) có khả năng thuộc về nguyên tác.
   - KHÔNG tìm kiếm cho các hành động thông thường hoặc bối cảnh chung chung (ví dụ: "quán trọ", "khu rừng").

2. QUERY FORMATTING (Cách thức tìm kiếm):
   - Từ khóa tìm kiếm BẮT BUỘC phải theo cú pháp: "[Tên tác phẩm nguyên tác] + [Tên thực thể] + wiki/thông tin". 
   - Ví dụ: "${workName} [Tên nhân vật] wiki".

3. SOURCE FILTERING & HALLUCINATION PREVENTION (Lọc nguồn & Chống ảo giác):
   - Chỉ tin tưởng thông tin từ cốt truyện chính thức. Bỏ qua fanfiction, giả thuyết diễn đàn.
   - Nếu kết quả tìm kiếm KHÔNG RÕ RÀNG hoặc KHÔNG TỒN TẠI: Tuyệt đối KHÔNG tự bịa ra tiểu sử hay đặc điểm quan trọng. Hãy xử lý nó như một "Thực thể vô danh" hoặc miêu tả lướt qua dựa trên góc nhìn hạn hẹp của MC.

4. IMMERSION PRESERVATION (Bảo vệ nhập vai):
   - TUYỆT ĐỐI CẤM nhắc đến các từ: "Google", "Tìm kiếm", "Wiki", "Theo kết quả", "Internet" trong lời kể gửi cho người chơi.
   - Thông tin tra cứu được phải được hòa quyện tự nhiên vào bối cảnh, thông qua quan sát, tin đồn, hoặc ký ức của nhân vật.
`;

    // 2. Assemble raw prompt
    let rawPrompt = "";

    if (config?.originalWork) {
        rawPrompt += `[TRỌNG TÂM THẾ GIỚI: Đây là tác phẩm đồng nhân của "${config.originalWork}". 
Mọi logic về tu tiên, cảnh giới, địa danh và văn phong PHẢI tuân thủ tuyệt đối theo nguyên tác này.]\n\n`;
    }
    
    rawPrompt += canonGroundingInstruction;
    rawPrompt += '\n\n';
    
    const topModules = sortedModules.filter(m => m.position === 'top');
    const systemModules = sortedModules.filter(m => m.position === 'system');
    const bottomModules = sortedModules.filter(m => m.position === 'bottom');
    const finalModules = sortedModules.filter(m => m.position === 'final');
    
    rawPrompt += topModules.map(m => m.content).join('\n\n');
    rawPrompt += '\n\n';
    rawPrompt += systemModules.map(m => m.content).join('\n\n');
    rawPrompt += '\n\n';
    
    // Inject Game State (Data)
    const activeAndRecentQuests = (kb.allQuests || [])
        .filter(q => 
            q.status === 'active' || 
            q.status === 'pending' ||
            ((q.status === 'completed' || q.status === 'failed') && q.resolvedAtTurn !== undefined && (kb.playerStats.turn - q.resolvedAtTurn <= 2))
        );

    const mainQuests = activeAndRecentQuests.filter(q => isMainQuest(q));
    const sideQuests = activeAndRecentQuests.filter(q => !isMainQuest(q));

    const activeNpcNames = activeNpcs.map(n => n.name);
    const npcsRichSummariesBlock = getCombinedActiveNpcsRichSummaries(kb, activeNpcNames);

    const currentMcName = config?.playerName || "Người chơi";
    const deceasedProtagonistsList = config?.deceasedProtagonists || kb.deceasedProtagonists || [];

    const gameStateData = {
        player: {
            name: currentMcName,
            deceasedProtagonists: deceasedProtagonistsList,
            realm: kb.playerStats.realm,
            stats: kb.playerStats,
            inventory: kb.inventory.map(i => i.name),
            location: kb.currentLocationId,
            quests: sideQuests.slice(0, 8)
        },
        worldDate: kb.worldDate,
        activeEvents: kb.activeWorldEvent,
        activeNpcs: activeNpcs.map(n => {
            const isLargePool = activeNpcs.length >= 100;
            const unmentionedTurns = n.reunionCounter ?? 0;
            if (isLargePool && unmentionedTurns >= 20) {
                return {
                    id: n.id,
                    name: n.name,
                    gender: n.gender || "Không rõ",
                    realm: n.realm || "Phàm nhân"
                };
            }

            let extraInfo = PregnancyService.getPregnancyContext(n);

            const hp = n.stats?.sinhLuc ?? n.hp ?? 100;

            return {
                id: n.id,
                name: n.name,
                gender: n.gender || "Không rõ",
                status: hp > 0 ? "Sống" : "Chết",
                hp: hp,
                description: n.description + (extraInfo ? `\n${extraInfo}` : ""),
                realm: n.realm || "Phàm nhân",
                spiritualRoot: n.spiritualRoot || "Không có",
                physique: n.specialPhysique || "Không có",
                affinity: n.affinity || 0,
                personality: (n.personalityTraits || []).join(", ") || n.personality || "Bình thường",
                position: (kb.discoveredLocations || []).find(l => l.id === n.locationId)?.name || "Không rõ",
                pregnancy: n.pregnancy
            };
        }),
        recentHistory: currentPageMessagesLog,
        summaries: previousPageSummaries
    };
    
    rawPrompt += `\n\n--- DỮ LIỆU THỰC TẾ (GAME STATE) ---\n`;
    rawPrompt += `<data>\n${JSON.stringify(gameStateData, null, 2)}\n</data>\n\n`;

    if (npcsRichSummariesBlock) {
        rawPrompt += `\n\n--- KÝ ỨC CỐT TRUYỆN LIÊN QUAN ĐẾN CÁC THỰC THỂ ĐANG HOẠT ĐỘNG (RECENT ENTITY MEMORIES) ---\n`;
        rawPrompt += `<recent_entity_memories_+qui_tac_tri_thuc>\n`;
        rawPrompt += npcsRichSummariesBlock + "\n";
        rawPrompt += `</recent_entity_memories_+qui_tac_tri_thuc>\n\n`;
    }

    if (mainQuests.length > 0) {
        rawPrompt += `--- HỆ THỐNG NHIỆM VỤ CỐT TRUYỆN BÍ MẬT ---\n`;
        rawPrompt += `<cot_truyen>\n`;
        rawPrompt += JSON.stringify(mainQuests, null, 2) + `\n\n`;
        rawPrompt += `[CHỈ THỊ CỐT TRUYỆN TUYỆT MẬT - BẮT BUỘC TUÂN THỦ]:\n`;
        rawPrompt += `- Nhân vật chính hiện tại duy nhất: "${currentMcName}". MC tiền nhiệm đã chết: [${deceasedProtagonistsList.join(', ') || 'Không có'}]. Tuyệt đối không để MC tiền nhiệm đã chết xuất hiện như nhân vật chính còn sống.\n`;
        rawPrompt += `- Đây là các nhiệm vụ cốt truyện/chính tuyến bí mật chỉ có AI (Dẫn truyện) và Người chơi biết để phối hợp dẫn dắt.\n`;
        rawPrompt += `- TUYỆT ĐỐI CẤM AI miêu tả hoặc cho phép Nhân vật chính (MC / ${currentMcName}) tự nhận thức, tự biết trước, hay tự độc thoại nội tâm về sự hiện diện của các nhiệm vụ cốt truyện này (ví dụ: MC biết trước "vận mệnh sắp đặt để gặp gỡ ai đó", MC tự nghĩ mình "đang có nhiệm vụ cốt truyện cần làm").\n`;
        rawPrompt += `- MC phải hoàn toàn không biết gì về hệ thống hay các nhiệm vụ cốt truyện này dưới góc độ meta-game. Mọi suy nghĩ, hành động hay quyết định của MC phải diễn ra hoàn toàn tự nhiên dựa trên bối cảnh thực tế khách quan bên ngoài.\n`;
        rawPrompt += `- AI PHẢI dẫn dắt MC thông qua "Mớm mồi hữu cơ" (như nghe lỏm tin đồn khách quan, gặp biến cố, thấy dị bảo, bị uy hiếp thực tế) để gián tiếp hướng MC tới mục tiêu cốt truyện một cách hợp lý và chân thật nhất.\n`;
        rawPrompt += `- [YGGDRASIL SYNC]: Thanh tra Yggdrasil BẮT BUỘC đối chiếu trực tiếp diễn biến lượt này với các mục tiêu trong <cot_truyen> ở trên để đánh giá [CHƯA HOÀN THÀNH / CÓ TIẾN TRIỂN / HOÀN THÀNH] qua tiền tố [YGGDRASIL_QUEST_AUDIT] và đẩy yêu cầu vào <update_data>.\n`;
        rawPrompt += `</cot_truyen>\n\n`;
    }
    
    rawPrompt += bottomModules.map(m => m.content).join('\n\n');
    rawPrompt += '\n\n';

    // Check for Verbal Coward status
    const isVerbalCoward = kb.playerStats.activeStatusEffects.some(s => s.id === 'verbal_coward');
    if (isVerbalCoward) {
        rawPrompt += `\n--- QUY TẮC ĐẶC BIỆT: KẺ HÈN NHÁT (VERBAL COWARD) ---\n`;
        rawPrompt += `Người chơi hiện đang mang trạng thái "Kẻ Hèn Nhát" vì đã bỏ chạy khỏi trận chiến.\n`;
        rawPrompt += `BẤT KỂ độ thiện cảm (affinity) cao hay thấp, các NPC PHẢI sỉ nhục, coi thường và mỉa mai người chơi là kẻ nhát gan, không xứng đáng làm người tu hành.\n`;
        rawPrompt += `Người chơi PHẢI đứng đó chịu đựng sự sỉ nhục này trong lời thoại của NPC.\n\n`;
    }

    rawPrompt += finalModules.map(m => m.content).join('\n\n');
    
    // 3. Variable Interpolation
    let processedPrompt = rawPrompt;
    
    // Replace specific known variables
    processedPrompt = processedPrompt.replace(/\{\{addvar::word_min::\d+\}\}/g, `{{addvar::word_min::${narrationMin}}}`);
    processedPrompt = processedPrompt.replace(/\{\{addvar::word_max::\d+\}\}/g, `{{addvar::word_max::${narrationMax}}}`);
    
    // Simple regex-based variable engine
    const vars: Record<string, string> = {};
    
    // Extract setvar/addvar/setglobalvar
    const setVarRegex = /\{\{(?:setvar|addvar|setglobalvar)::([^:]+)::(.*?)\}\}/g;
    let match;
    while ((match = setVarRegex.exec(processedPrompt)) !== null) {
        vars[match[1]] = match[2];
    }
    
    // Remove setvar/addvar/setglobalvar tags from output
    processedPrompt = processedPrompt.replace(/\{\{(?:setvar|addvar|setglobalvar)::[^:]+::.*?\}\}/g, '');
    
    // Replace getvar/getglobalvar
    processedPrompt = processedPrompt.replace(/\{\{(?:getvar|getglobalvar)::([^}]+)\}\}/g, (m, varName) => {
        return vars[varName] || '';
    });
    
    // Replace world_info, persona, scenario
    processedPrompt = processedPrompt.replace(/\{\{world_info\}\}/g, config?.settingDescription || '');
    processedPrompt = processedPrompt.replace(/\{\{persona\}\}/g, config?.playerPersonality || '');
    processedPrompt = processedPrompt.replace(/\{\{scenario\}\}/g, config?.playerBackstory || '');
    
    // Remove {{trim}} and comments {{//...}}
    processedPrompt = processedPrompt.replace(/\{\{trim\}\}/g, '');
    processedPrompt = processedPrompt.replace(/\{\{\/\/.*?\}\}/g, '');
    
    // 5. Output Structure Instructions (Removed - now at the top)
    
    // 6. Append Flash State (Short-term Context)
    if (recentNarrations) {
        processedPrompt += `\n\n--- [MEMORY - Cập nhật Bối cảnh ngắn hạn (Flash State)] ---\n`;
        processedPrompt += `Dưới đây là nội dung lời kể của 2 lượt gần nhất để đảm bảo tính liên tục của mạch truyện:\n\n${recentNarrations}\n\n`;
    }

    // 7. Append Player Action
    processedPrompt += `\n\n--- HÀNH ĐỘNG CỦA NGƯỜI CHƠI ---\n${playerAction}`;
    
    // Append Leveling Instruction
    processedPrompt += buildLevelingInstruction(kb);
    
    return processedPrompt;
};
