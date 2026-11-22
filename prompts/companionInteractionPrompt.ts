
import { KnowledgeBase, Wife, Slave, WorldSettings } from '../types';
import { VIETNAMESE, DEFAULT_NSFW_DESCRIPTION_STYLE, DEFAULT_VIOLENCE_LEVEL, DEFAULT_STORY_TONE } from '../constants';
import { LOI_NHAC_AN_2 } from './loinhacprompt2'; // NEW
import { AffectionBehaviorService } from '../services/AffectionBehaviorService';
import { NpcIntimacyDemandService } from '../services/NpcIntimacyDemandService';

const perspectiveInstruction = (worldConfig: WorldSettings | null, perspectiveMode: string = 'firstPerson'): string => {
    const mode = perspectiveMode || 'firstPerson';
    if (mode === 'thirdPersonOmniscient') {
      return `
**HƯỚN DẪN VỀ GÓC NHÌN KỂ CHUYỆN (CỰC KỲ QUAN TRỌNG - CHẾ ĐỘ TOÀN TRI):**
- **Góc Nhìn:** Người chơi đã chọn **GÓC NHÌN THỨ BA TOÀN TRI**.
- **Yêu cầu BẮT BUỘC:**
  1.  **Ngôi kể:** Sử dụng ngôi thứ ba (ví dụ: "Hắn", "Nàng", hoặc tên nhân vật "${worldConfig?.playerName}"). **TUYỆT ĐỐI KHÔNG** dùng "Bạn" hoặc "Ngươi".
  2.  **Quy Tắc "Nhảy Cảnh" & "Toàn Tri Câm" (CỰC KỲ QUAN TRỌNG, ÁP DỤNG MỌI LƯỢT):**
      *   **"Nhảy Cảnh":** Bạn có thể mô tả các hành động/biểu cảm tinh tế của bạn đồng hành mà nhân vật chính không nhận thấy.
      *   **"Toàn Tri Câm" & "Show, Don't Tell" (QUY TẮC VÀNG):**
          *   Bạn **TUYỆT ĐỐI BỊ CẤM** tiết lộ suy nghĩ, kế hoạch, hoặc cảm xúc thầm kín của NPC một cách trực tiếp qua lời nói (lẩm bẩm, nói một mình) hoặc văn bản (suy nghĩ, nội tâm).
          *   Thay vào đó, bạn **BẮT BUỘC PHẢI** sử dụng kỹ thuật 'Show, Don't Tell': **MÔ TẢ HÀNH ĐỘNG, CỬ CHỈ, BIỂU CẢM** để **NGỤ Ý** về trạng thái nội tâm của họ.
      *   **CẢNH BÁO:** Vi phạm quy tắc "Toàn Tri Câm" và "Show, Don't Tell" sẽ bị coi là một **lỗi kể chuyện nghiêm trọng**.
  3.  **Mục tiêu:** Làm cho người chơi cảm thấy họ đang đọc một cuốn tiểu thuyết.`;
    }
    // Default to firstPerson
    return `
**HƯỚNG DẪN VỀ GÓC NHÌN KỂ CHUYỆN (QUAN TRỌNG):**
- **Góc Nhìn:** Người chơi đã chọn **GÓC NHÌN THỨ NHẤT**.
- **Yêu cầu:**
  1.  **Ngôi kể:** Sử dụng ngôi thứ hai ("Bạn", "Ngươi") để nói chuyện với người chơi.
  2.  **Giới hạn:** Chỉ mô tả những gì nhân vật chính có thể nhìn thấy, nghe thấy, cảm nhận và biết được. **TUYỆT ĐỐI KHÔNG** tiết lộ suy nghĩ hoặc ý định thầm kín của các NPC khác.`;
};

export const generateCompanionInteractionPrompt = (
    kb: KnowledgeBase, 
    companion: Wife | Slave, 
    action: string,
    currentPageMessagesLog: string,
    previousPageSummaries: string[],
    lastNarrationFromPreviousPage?: string,
    perspectiveMode: string = 'firstPerson',
    exclusiveMode: boolean = false
): string => {
    const { worldConfig, playerStats } = kb;
    const nsfwMode = worldConfig?.nsfwMode || false;
    const nsfwStyle = worldConfig?.nsfwDescriptionStyle || DEFAULT_NSFW_DESCRIPTION_STYLE;
    const companionType = companion.entityType === 'wife' ? 'đạo lữ' : 'nô lệ';
    const updateTag = companion.entityType === 'wife' ? 'WIFE_UPDATE' : 'SLAVE_UPDATE';
    const currentDifficultyName = worldConfig?.difficulty || 'Thường';
    const currentViolenceLevel = worldConfig?.violenceLevel || DEFAULT_VIOLENCE_LEVEL;
    const currentStoryTone = worldConfig?.storyTone || DEFAULT_STORY_TONE;
    const currentLocation = kb.discoveredLocations.find(l => l.id === kb.currentLocationId);
    const affectionBehaviorBlock = AffectionBehaviorService.evaluateNpcAffectionTriggers(
        { name: companion.name, affinity: companion.affinity, gender: companion.gender },
        currentLocation
    );

    // NEW: Fatigue notice for the SPECIFIC companion based on their intimacy demand
    const totalSex = companion.totalSexCount || 0;
    const sexDemand = NpcIntimacyDemandService.calculateSexDemand(totalSex);
    const currentStreak = companion.currentSexStreak || 0;

    let fatigueNotice = "";
    if (currentStreak === sexDemand + 1) {
        fatigueNotice = `SYSTEM NOTICE: ${companion.name} hiện tại đã được thỏa mãn đủ ${sexDemand} hiệp nhu cầu và đang thấm mệt sau hiệp thứ ${currentStreak} liên tiếp. Nàng sẽ bắt đầu phản đối, xin tha và từ chối nếu bạn tiếp tục ép buộc làm tình ngay bây giờ.`;
    } else if (currentStreak >= sexDemand + 2) {
        fatigueNotice = `SYSTEM NOTICE: ${companion.name} đã kiệt sức hoàn toàn sau ${currentStreak} hiệp liên tiếp (Vượt quá nhu cầu ${sexDemand} hiệp). Nàng sẽ bị ngất lịm đi ngay trong lúc đang hành sự nếu bạn cố tình tiếp tục ép buộc nàng dập dìu.`;
    }

    let nsfwGuidanceCombined = "";
    if (nsfwMode) {
        nsfwGuidanceCombined = `
**Hướng Dẫn Nội Dung Người Lớn (18+ ĐANG BẬT):**
- **Phong Cách Miêu Tả Tình Dục:** ${nsfwStyle}.
- **Mức Độ Miêu Tả Bạo Lực:** ${currentViolenceLevel}.
- **Tông Màu Câu Chuyện:** ${currentStoryTone}.
**YÊU CẦU ĐẶC BIỆT VỀ VĂN PHONG (DỤC VĂN TÁO BẠO):**
Mô tả cảnh tình dục bằng văn phong trong các bộ "dục văn" táo bạo. Tập trung vào âm thanh, tư thế, cảm xúc đối thoại, làn da ma sát.
**ĐIỂM DỪNG NARRATIVE (CẤM MIÊU TẢ HẬU KỲ):** Kết thúc lượt kể chuyện ngay khi cao trào xuất tinh hoàn tất. Tuyệt đối không mô tả các hành động sau đó (aftercare, mặc đồ, dọn dẹp).
`;
    } else {
        nsfwGuidanceCombined = "LƯU Ý QUAN TRỌNG: Chế độ Người Lớn đang TẮT. Tránh các chủ đề nhạy cảm hoặc tình dục.";
    }

    const finalSystemRules = exclusiveMode 
        ? `
<system_prompt_10>
[HỆ THỐNG GỐC ĐÃ ĐƯỢC TẮT - CHỈ SỬ DỤNG LUẬT TỪ FILE PHỤ TÙNG]
</system_prompt_10>` 
        : `
<system_prompt_10>
${LOI_NHAC_AN_2}

Bạn là một AI kể chuyện chuyên về các tương tác tình cảm với nhân vật.
Người chơi đang tương tác với ${companion.name} (${companionType}).

**BỐI CẢNH TOÀN DIỆN:**
- **Người chơi:** Tên: ${worldConfig?.playerName || 'Người chơi'}, Giới tính: ${worldConfig?.playerGender || 'Không rõ'}, Cảnh giới: ${kb.playerStats.realm}
- **Bạn đồng hành:** ${companion.name}
  - Giới tính: ${companion.gender || "Nữ"}
  - Chỉ số: Thiện cảm: ${companion.affinity}, Ý chí: ${companion.willpower}, Phục tùng: ${companion.obedience}
  - Trạng thái: ${(companion.stats?.sinhLuc ?? (companion as any).hp ?? 100) > 0 ? "Sống" : "Chết"}, HP: ${companion.stats?.sinhLuc ?? (companion as any).hp ?? 100}, Realm: ${companion.realm}
  - Linh căn: ${companion.spiritualRoot || "Không có"}, Thể chất: ${companion.specialPhysique || "Không có"}
  - Bề ngoài/Y phục hiện tại: ${companion.avatarAppearance || companion.appearance || "Không có thông tin trang phục/bề ngoài"} ${(!companion.avatarAppearance && companion.appearanceDuration) ? `(Thời hạn còn lại: ${companion.appearanceDuration} lượt)` : ""}
  - Vị trí: ${currentLocation?.name || "Không rõ"}
- **Trạng thái đặc biệt: ${fatigueNotice || "Bình thường"}**

${perspectiveInstruction(worldConfig, perspectiveMode)}

**CHẾ ĐỘ NỘI DUNG VÀ PHONG CÁCH:**
${nsfwGuidanceCombined}
${affectionBehaviorBlock}

**NHIỆM VỤ CỦA BẠN (AI):**
1.  **VIẾT LỜI KỂ:** Mô tả chi tiết kết quả hành động. Phản ứng của ${companion.name} phải phù hợp với chỉ số và bối cảnh Fatigue (nếu có).
2.  **TẠO TAG CẬP NHẬT:** Sử dụng tag \`[${updateTag}: name="${companion.name}", ...]\` để cập nhật chỉ số. 
3.  **LƯU Ý:** Nếu số lần quan hệ liên tiếp (consecutiveSexCount) đạt ngưỡng mệt mỏi, hãy ép buộc NPC phản ứng mệt mỏi hoặc ngất xỉu theo đúng quy tắc cơ chế.
</system_prompt_10>`;

    return `
${finalSystemRules}

**DIỄN BIẾN GẦN NHẤT:**
${lastNarrationFromPreviousPage || "Chưa có."}
`;
};