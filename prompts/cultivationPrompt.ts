
import { KnowledgeBase, Skill, NPC, Wife, Slave, DIALOGUE_MARKER } from '../types';
import * as GameTemplates from '../templates';
import { VIETNAMESE, DEFAULT_NSFW_DESCRIPTION_STYLE, DEFAULT_VIOLENCE_LEVEL, DEFAULT_STORY_TONE } from '../constants';

const convertCultivationStateToXML = (
    kb: any,
    cultivationType: 'skill' | 'method',
    duration: number,
    skill: any,
    method: any,
    partner: any,
    currentPageMessagesLog: string,
    previousPageSummaries: string[],
    lastNarrationFromPreviousPage?: string
): string => {
  const playerStats = kb.playerStats;
  const turn = playerStats?.turn ?? 0;
  let xml = `<cultivation_context_15_4 turn="${turn}">\n----\n`;

  // 1. Player Stats
  xml += "  <player_state_15_4_1>\n  ----\n";
  xml += `    <name>${playerStats?.playerName || playerStats?.name || "Không rõ"}</name>\n`;
  xml += `    <realm>${playerStats?.realm || "Phàm Nhân"}</realm>\n`;
  xml += `    <spiritual_root>${playerStats?.spiritualRoot || "Không có"}</spiritual_root>\n`;
  xml += `    <special_physique>${playerStats?.specialPhysique || "Không có"}</special_physique>\n`;
  xml += `    <hp>${playerStats?.hp || playerStats?.sinhLuc || 100}/${playerStats?.maxHp || playerStats?.maxSinhLuc || 100}</hp>\n`;
  xml += `    <mp>${playerStats?.mp || playerStats?.linhLuc || 50}/${playerStats?.maxMp || playerStats?.maxLinhLuc || 50}</mp>\n`;
  xml += "  ----\n  </player_state_15_4_1>\n\n";

  // 2. Cultivation Action Details
  xml += `  <action_details_15_4_2 type="${cultivationType}" duration_turns="${duration}">\n  ----\n`;
  if (cultivationType === 'skill') {
    xml += `    <target_skill_name>${skill?.name || "Không rõ"}</target_skill_name>\n`;
    xml += `    <skill_description>${skill?.description || "Không rõ"}</skill_description>\n`;
    xml += `    <current_proficiency_tier>${skill?.proficiencyTier || "Sơ Nhập"}</current_proficiency_tier>\n`;
    xml += `    <current_proficiency_points>${skill?.proficiency || 0}/${skill?.maxProficiency || 100}</current_proficiency_points>\n`;
  } else {
    xml += `    <target_method_name>${method?.name || "Tu Luyện Cơ Bản (Thiền Định)"}</target_method_name>\n`;
    xml += `    <method_description>${method?.description || "Tập trung tinh thần, hấp thụ linh khí tự nhiên"}</method_description>\n`;
    if (partner) {
      xml += `    <dual_partner_name>${partner.name}</dual_partner_name>\n`;
      xml += `    <partner_relationship_affinity>${partner.affinity || 0}</partner_relationship_affinity>\n`;
      xml += `    <partner_realm>${partner.realm || "Không rõ"}</partner_realm>\n`;
    }
  }
  xml += "  ----\n  </action_details_15_4_2>\n\n";

  // 3. Historical Events Context
  xml += "  <history_narrative_context_15_4_3>\n  ----\n";
  if (previousPageSummaries && previousPageSummaries.length > 0) {
    xml += "    <previous_pages_summaries>\n    ----\n";
    previousPageSummaries.forEach((sum: string, idx: number) => {
      xml += `      <summary_page_${idx + 1}>${sum}</summary_page_${idx + 1}>\n`;
    });
    xml += "    ----\n    </previous_pages_summaries>\n";
  }
  if (lastNarrationFromPreviousPage) {
    xml += `    <last_turn_narration>${lastNarrationFromPreviousPage}</last_turn_narration>\n`;
  }
  if (currentPageMessagesLog) {
    xml += `    <current_page_detailed_log>${currentPageMessagesLog}</current_page_detailed_log>\n`;
  }
  xml += "  ----\n  </history_narrative_context_15_4_3>\n";

  xml += "----\n</cultivation_context_15_4>";
  return xml;
};

export const generateCultivationSessionPrompt = (
    kb: KnowledgeBase,
    cultivationType: 'skill' | 'method',
    duration: number, // in turns
    currentPageMessagesLog: string,
    previousPageSummaries: string[],
    lastNarrationFromPreviousPage?: string,
    skill?: Skill, // for skill cultivation
    method?: Skill, // for method cultivation. It's also of type Skill
    partner?: NPC | Wife | Slave, // for dual cultivation
    exclusiveMode: boolean = false,
): string => {
    const { playerStats, worldConfig } = kb;
    const isNsfw = worldConfig?.nsfwMode || false;
    const nsfwStyle = worldConfig?.nsfwDescriptionStyle || DEFAULT_NSFW_DESCRIPTION_STYLE;
    const currentDifficultyName = worldConfig?.difficulty || 'Thường';
    const currentViolenceLevel = worldConfig?.violenceLevel || DEFAULT_VIOLENCE_LEVEL;
    const currentStoryTone = worldConfig?.storyTone || DEFAULT_STORY_TONE;
    const currentLocation = kb.discoveredLocations.find(l => l.id === kb.currentLocationId);

    let difficultyGuidanceText = "";
    switch (currentDifficultyName) {
        case 'Dễ': difficultyGuidanceText = VIETNAMESE.difficultyGuidanceEasy; break;
        case 'Thường': difficultyGuidanceText = VIETNAMESE.difficultyGuidanceNormal; break;
        case 'Khó': difficultyGuidanceText = VIETNAMESE.difficultyGuidanceHard; break;
        case 'Ác Mộng': difficultyGuidanceText = VIETNAMESE.difficultyGuidanceNightmare; break;
        default: difficultyGuidanceText = VIETNAMESE.difficultyGuidanceNormal;
    }

    let nsfwGuidanceCombined = "";
    if (isNsfw) {
        let nsfwStyleGuidance = "";
        switch (nsfwStyle) {
            case 'Hoa Mỹ': nsfwStyleGuidance = VIETNAMESE.nsfwGuidanceHoaMy; break;
            case 'Trần Tục': nsfwStyleGuidance = VIETNAMESE.nsfwGuidanceTranTuc; break;
            case 'Gợi Cảm': nsfwStyleGuidance = VIETNAMESE.nsfwGuidanceGoiCam; break;
            case 'Mạnh Bạo (BDSM)': nsfwStyleGuidance = VIETNAMESE.nsfwGuidanceManhBaoBDSM; break;
            default: nsfwStyleGuidance = VIETNAMESE.nsfwGuidanceHoaMy;
        }

        let violenceGuidance = "";
        switch (currentViolenceLevel) {
            case 'Nhẹ Nhàng': violenceGuidance = VIETNAMESE.violenceLevelGuidanceNheNhang; break;
            case 'Thực Tế': violenceGuidance = VIETNAMESE.violenceLevelGuidanceThucTe; break;
            case 'Cực Đoan': violenceGuidance = VIETNAMESE.violenceLevelGuidanceCucDoan; break;
            default: violenceGuidance = VIETNAMESE.violenceLevelGuidanceThucTe;
        }

        let toneGuidance = "";
        switch (currentStoryTone) {
            case 'Tích Cực': toneGuidance = VIETNAMESE.storyToneGuidanceTichCuc; break;
            case 'Trung Tính': toneGuidance = VIETNAMESE.storyToneGuidanceTrungTinh; break;
            case 'Đen Tối': toneGuidance = VIETNAMESE.storyToneGuidanceDenToi; break;
            case 'Dâm Dục': toneGuidance = VIETNAMESE.storyToneGuidanceDamDuc; break;
            case 'Hoang Dâm': toneGuidance = VIETNAMESE.storyToneGuidanceHoangDam; break;
            case 'Dâm Loạn': toneGuidance = VIETNAMESE.storyToneGuidanceDamLoan; break;
            default: toneGuidance = VIETNAMESE.storyToneGuidanceTrungTinh;
        }
        nsfwGuidanceCombined = `
**CHẾ ĐỘ NỘI DUNG VÀ PHONG CÁCH (QUAN TRỌNG):**
- **Yêu cầu nội dung 18+:** BẬT.
- **Phong Cách Miêu Tả Tình Dục:** ${nsfwStyle}.
  - ${nsfwStyleGuidance}
- **Mức Độ Miêu Tả Bạo Lực:** ${currentViolenceLevel}.
  - ${violenceGuidance}
- **Tông Màu Câu Chuyện:** ${currentStoryTone}.
  - ${toneGuidance}
Lưu ý: Hãy đảm bảo lời kể của bạn phản ánh đúng các cài đặt này.
**YÊU CẦU ĐẶC BIỆT VỀ CẢNH TÌNH DỤC (QUAN TRỌNG):**
- **Văn phong "Dục văn táo bạo":** Mô tả cảnh tình dục một cách chi tiết, không ngần ngại sử dụng các tình tiết khiêu dâm nặng đô. Tập trung vào âm thanh (tiếng da thịt "bạch bạch", rên rỉ, tiếng nước ướt át), các tư thế đa dạng, cảm xúc mãnh liệt, lời đối thoại khiêu dâm, và tình trạng làn da (mồ hôi ướt đẫm, ma sát...).
- **Cường độ mạnh bạo:** Các nhân vật đều làm tình một cách mạnh bạo, dứt khoát.
- **Không có hồi kết:** Cả hai bên liên tục phun trào dịch tình. Xuất tinh một lần không phải là kết thúc, mà có thể là khởi đầu cho hiệp tiếp theo.
- **Đối thoại và Rên rỉ:**
  - Trong khi bị côn thịt thúc mạnh, nhân vật nữ thường rên rỉ đứt quãng (BẮT BUỘC dùng cấu trúc dialogue đầy đủ, tuyệt đối không viết thiếu emoji và id; ví dụ với Tô Nguyệt Nhi): "${DIALOGUE_MARKER}Tô Nguyệt Nhi|🥵|"A..."${DIALOGUE_MARKER}", "${DIALOGUE_MARKER}Tô Nguyệt Nhi|🥵|"Ưm..."${DIALOGUE_MARKER}", "${DIALOGUE_MARKER}Tô Nguyệt Nhi|😫|"Đau..."${DIALOGUE_MARKER}", "${DIALOGUE_MARKER}Tô Nguyệt Nhi|😫|"Chậm.. chậm lại..."${DIALOGUE_MARKER}", "${DIALOGUE_MARKER}Tô Nguyệt Nhi|🥵|"Chờ... chờ đã..."${DIALOGUE_MARKER}", "${DIALOGUE_MARKER}Tô Nguyệt Nhi|🥵|"Nhanh quá... sắp ra..."${DIALOGUE_MARKER}".
  - Nhân vật chính có thể có những cuộc giao tiếp đặc biệt, ví dụ hỏi đối tác một câu hỏi. Khi đối tác đang trả lời, nhân vật chính sẽ thúc mạnh, làm gián đoạn câu nói bằng những tiếng rên rỉ, nhưng đối tác vẫn sẽ cố gắng hoàn thành câu trả lời của mình qua những tiếng nấc.
`;
    } else {
        nsfwGuidanceCombined = "**CHẾ ĐỘ NỘI DUNG VÀ PHONG CÁCH:** Chế độ Người Lớn đang TẮT. Vui lòng tạo ra các vật phẩm có tên và mô tả phù hợp với mọi lứa tuổi.";
    }
    
    let header = `Bạn là một AI kể chuyện, chuyên mô tả lại quá trình tu luyện của nhân vật trong một thế giới tu tiên.`;
    let mainRequest = '';
    let successFactors = `- Cảnh giới của người chơi (${playerStats.realm})\n- Linh căn của người chơi (${playerStats.spiritualRoot})\n- Thể chất của người chơi (${playerStats.specialPhysique})\n- May mắn`;
    let failureFactors = `- Tâm ma quấy nhiễu\n- Vận rủi`;
    let partnerUpdateTag = '';

    if (cultivationType === 'skill') {
        header += ` Người chơi đang cố gắng tu luyện để tăng độ thuần thục của một Linh Kĩ.`;
        mainRequest = `**YÊU CẦU:**
- **Mục tiêu:** Tăng độ thuần thục cho Linh Kĩ: **${skill?.name || 'Không rõ'}**.
- **Mô tả kỹ năng:** ${skill?.description || 'Không rõ'}.
- **Độ thuần thục hiện tại:** ${skill?.proficiencyTier || 'Sơ Nhập'} (${skill?.proficiency || 0}/${skill?.maxProficiency || 100}).
- **Thời gian tu luyện:** ${duration} lượt.`;
        successFactors += `\n- Ngộ tính của người chơi\n- Sự tương thích của kỹ năng với linh căn/thể chất`;
        failureFactors += `\n- Công pháp tu luyện không phù hợp`;
    } else { // method
        if (partner) { // Dual cultivation
            header += ` Người chơi đang tiến hành song tu với ${partner.name}.`;
            mainRequest = `**YÊU CẦU:**
- **Mục tiêu:** Tu luyện theo công pháp Song Tu **${method?.name || 'Không rõ'}** cùng với **${partner.name}**.
- **Mô tả công pháp:** ${method?.description || 'Không rõ'}.
- **Thời gian tu luyện:** ${duration} lượt.`;
            successFactors += `\n- Sự phối hợp ăn ý giữa hai người\n- Độ thiện cảm cao giữa hai người (${partner.affinity})\n- Cảnh giới của bạn đồng tu (${partner.realm})`;
            failureFactors += `\n- Bất đồng trong quá trình tu luyện\n- Độ thiện cảm thấp`;
            partnerUpdateTag = `*   **Cập nhật bạn đồng tu:** Dùng tag \\\`[${(partner as any).entityType === 'wife' ? 'WIFE_UPDATE' : 'SLAVE_UPDATE'}: name="${partner.name}", affinity="+=X", statsJSON='{"kinhNghiem": "+=Y"}']\\\` để thể hiện sự tiến bộ của họ.`;
        } else { // Solo cultivation
            header += ` Người chơi đang bế quan tu luyện để tăng tu vi.`;
            const methodName = method?.name || 'Tu Luyện Cơ Bản (Thiền Định)';
            const methodDesc = method?.description || 'Tập trung tinh thần, hấp thụ linh khí tự nhiên từ đất trời để rèn luyện bản thân mà không cần nương nhờ vào bất kỳ công pháp cụ thể nào.';
            
            mainRequest = `**YÊU CẦU:**
- **Mục tiêu:** Tăng trưởng kinh nghiệm/tu vi bằng cách tu luyện **${methodName}**.
- **Mô tả:** ${methodDesc}.
- **Thời gian tu luyện:** ${duration} lượt.`;
            
            if (method) {
                successFactors += `\n- Chất lượng của công pháp tu luyện (${method?.congPhapDetails?.grade || 'Không rõ'})\n- Nồng độ linh khí tại ${currentLocation?.name || 'nơi tu luyện'}`;
            } else {
                successFactors += `\n- Ý chí kiên định của người chơi\n- Nồng độ linh khí tại ${currentLocation?.name || 'nơi tu luyện'} (Tu luyện cơ bản phụ thuộc nhiều vào linh khí môi trường)`;
                failureFactors += `\n- Hiệu suất thấp do thiếu công pháp dẫn dắt linh lực`;
            }
            failureFactors += `\n- Bị ngoại cảnh quấy nhiễu`;
        }
    }

    const contextBlock = `
**BỐI CẢNH CÁC SỰ KIỆN GẦN ĐÂY (Để tham khảo và lấy cảm hứng):**
- **Tóm tắt các trang trước:**
${previousPageSummaries.length > 0 ? previousPageSummaries.join("\n\n") : "Không có."}
- **Diễn biến gần nhất (lượt trước):**
${lastNarrationFromPreviousPage || "Không có."}
- **Diễn biến chi tiết trang hiện tại:**
${currentPageMessagesLog || "Không có."}
`;
    
    const finalSystemRules = exclusiveMode 
        ? `
<system_prompt_10>
[HỆ THỐNG GỐC ĐÃ ĐƯỢC TẮT - CHỈ SỬ DỤNG LUẬT TỪ FILE PHỤ TÙNG]
</system_prompt_10>` 
        : `
<system_prompt_10>
**BỐI CẢNH THẾ GIỚI:**
- **Chủ đề:** ${worldConfig?.theme || 'Chưa xác định'}
- **Độ khó:** ${currentDifficultyName}
${nsfwGuidanceCombined}
</system_prompt_10>`;

    const prompt = `
${header}

${finalSystemRules}

**BỐI CẢNH CHI TIẾT & YÊU CẦU TU LUYỆN (XML):**
${convertCultivationStateToXML(kb, cultivationType, duration, skill, method, partner, currentPageMessagesLog, previousPageSummaries, lastNarrationFromPreviousPage)}

**NHIỆM VỤ CỦA BẠN (AI):**
1.  **VIẾT LỜI KỂ:**
    *   Mô tả chi tiết quá trình tu luyện trong ${duration} lượt.
    *   **QUY TẮC THÀNH BẠI:** Dựa vào **Độ khó** và các yếu tố bên dưới, hãy quyết định xem quá trình tu luyện có thuận lợi hay không.
        - **Yếu tố thành công:**\n${successFactors}
        - **Yếu tố thất bại:**\n${failureFactors}
    *   **Nội dung lời kể:**
        - Nếu thuận lợi: Mô tả cảm giác linh lực/kiến thức dồi dào, sự tiến bộ rõ rệt.
        - Nếu gặp trở ngại: Mô tả khó khăn (tẩu hỏa nhập ma nhẹ, tâm ma, bị quấy rầy) và cách nhân vật vượt qua (hoặc không).
        - Nếu là song tu và chế độ 18+ BẬT, hãy mô tả chi tiết cảnh ân ái hòa quyện với quá trình tu luyện theo phong cách "${nsfwStyle}".

2.  **LƯU Ý VỀ DỮ LIỆU:**
    *   **KHÔNG** tạo bất kỳ tag hệ thống nào (như [CHANGE_TIME], [STATS_UPDATE], [SKILL_UPDATE]). 
    *   Việc cập nhật dữ liệu sẽ được xử lý bởi một AI khác dựa trên nội dung lời kể của bạn.
    *   Hãy đảm bảo lời kể đề cập rõ ràng đến kết quả tu luyện (thành công/thất bại, thời gian trôi qua, sự tiến bộ) để AI xử lý dữ liệu có thể trích xuất chính xác.
    *   **KHÔNG** dùng tag [CHOICE].

**VÍ DỤ (Tu luyện công pháp thành công):**
(Lời kể bạn viết ra sẽ nằm ở đây)
Sau 10 ngày bế quan, linh lực trong cơ thể bạn trở nên tinh thuần hơn, tu vi cũng có chút tiến triển.
`;
    // FIX: A function whose declared type is neither 'undefined', 'void', nor 'any' must return a value.
    return prompt;
};
