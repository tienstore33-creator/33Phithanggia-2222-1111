import { KnowledgeBase, CombatEndPayload, NPC, GameMessage, YeuThu } from '../types';
import { VIETNAMESE, DEFAULT_NSFW_DESCRIPTION_STYLE, DEFAULT_VIOLENCE_LEVEL, DEFAULT_STORY_TONE, TU_CHAT_TIERS } from '../constants';

// @FIX: The second parameter was a string, but the prompt expects and uses a CombatEndPayload object.
export const generateDefeatConsequencePrompt = (
    kb: KnowledgeBase, 
    combatResult: CombatEndPayload,
    currentPageMessagesLog: string,
    previousPageSummaries: string[],
    lastNarrationFromPreviousPage: string | undefined,
    currentCombatSummary: string
): string => {
    const { worldConfig, playerStats, discoveredNPCs } = kb;
    const { summary, dispositions, lastCombatTurns, storyContext } = combatResult;
    
    // Find the victor(s) based on the dispositions map from combat
    const victorIds = kb.pendingCombat?.opponentIds?.filter(id => !Object.keys(dispositions).includes(id)) || [];
    const victors = victorIds.map(id => {
        const npc = discoveredNPCs.find(n => n.id === id);
        if (npc) return { ...npc, type: 'npc' };
        const yeuThu = kb.discoveredYeuThu?.find(y => y.id === id);
        if (yeuThu) return { ...yeuThu, type: 'yeuThu' };
        const tempEntity = kb.pendingCombat?.temporaryEntities?.find(te => te.id === id);
        if (tempEntity) return { ...tempEntity, type: 'npc' };
        return null;
    }).filter(v => v !== null);

    const nsfwMode = worldConfig?.nsfwMode || false;
    const nsfwStyle = worldConfig?.nsfwDescriptionStyle || DEFAULT_NSFW_DESCRIPTION_STYLE;
    const currentDifficultyName = worldConfig?.difficulty || 'Thường';
    const currentViolenceLevel = worldConfig?.violenceLevel || DEFAULT_VIOLENCE_LEVEL;
    const currentStoryTone = worldConfig?.storyTone || DEFAULT_STORY_TONE;

    // --- Lấy danh sách đồng minh gục ngã (HP = 0) ---
    const deadAlliesList = (combatResult.finalAlliesStatus || []).filter(a => a.hp <= 0);
    const deadAlliesNames = deadAlliesList.map(ally => {
        const found = kb.wives?.find(w => w.id === ally.id) ||
                      kb.slaves?.find(s => s.id === ally.id) ||
                      kb.discoveredNPCs?.find(n => n.id === ally.id) ||
                      kb.prisoners?.find(p => p.id === ally.id);
        return found ? found.name : ally.id;
    });

    const isPlayerSuicide = combatResult.dispositions?.player === 'suicide';
    const isEscaped = combatResult.outcome === 'escaped';
    const specificOutcome = isPlayerSuicide ? 'reincarnate' : (isEscaped ? 'escaped' : (combatResult.specificDefeatOutcome || 'prisoner'));

    const mcInfo = `
# THÔNG TIN NHÂN VẬT CHÍNH (MC):
- **Họ Tên:** ${worldConfig?.playerName || 'Người chơi'}
- **Giới Tính:** ${worldConfig?.playerGender || 'Không rõ'}
- **Chủng Tộc:** ${worldConfig?.playerRace || 'Nhân Tộc'}
- **Cảnh Giới:** ${playerStats.realm}
- **Tính Cách:** ${worldConfig?.playerPersonality || 'Chưa rõ'}
- **Bối Cảnh:** ${worldConfig?.playerBackstory || 'Chưa rõ'}
`;

    const pronounGuidance = `
# HƯỚNG DẪN XƯNG HÔ (QUAN TRỌNG):
- Dựa trên Giới Tính của MC là **${worldConfig?.playerGender}**:
  - Nếu là **Nam**: Sử dụng đại từ "hắn", "y", "chàng", "anh", "tên này".
  - Nếu là **Nữ**: Sử dụng đại từ "nàng", "ả", "cô ta", "thiếu nữ này".
  - Tuyệt đối không nhầm lẫn giới tính trong lời dẫn.
- Xưng hô của NPC đối với MC phải phản ánh đúng mối quan hệ và tính cách (ví dụ: Kẻ địch khinh miệt có thể gọi "ngươi", "thằng nhãi", "con ả").
`;

    let nsfwGuidanceCombined = "";
    if (specificOutcome === 'escaped') {
        nsfwGuidanceCombined = `
**LƯU Ý ĐẶC BIỆT QUAN TRỌNG VỀ CHẾ ĐỘ NỘI DUNG (CHẶN HOÀN TOÀN NSFW/18+):**
- Đây là tình huống **ĐÀO TẨU THÀNH CÔNG (Flee Combat)**.
- **CẤM TUYỆT ĐỐI:** Nghiêm cấm sinh ra bất kỳ nội dung, tình tiết nhạy cảm, bạo lực tình dục, dâm dục, kích dục, rên rỉ dâm thủy, song tu, giao hợp, hoặc sờ soạng cơ thể dưới mọi hình thức, ngay cả khi chế độ 18+ đang BẬT trên toàn hệ thống.
- **VĂN PHONG YÊU CẦU:** Nhân vật chính chỉ cắm đầu tháo chạy thảm hại đầy chật vật, đau đớn, thổ huyết để giữ mạng, tuyệt đối không có bất kỳ hành vi tiếp xúc thể xác nhạy cảm nào khác. Hãy tập trung 100% mô tả cảnh trốn chạy khốn đốn của MC, sự oán giận sỉ vả từ đồng minh bị bỏ lại gánh trận và tiếng cười nhạo khinh miệt trào phúng từ kẻ địch.
`;
    } else if (nsfwMode) {
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
**Hướng Dẫn Nội Dung Người Lớn (18+ ĐANG BẬT):**
- **Phong Cách Miêu Tả Tình Dục:** ${nsfwStyle}.
  ${nsfwStyleGuidance}
- **Mức Độ Miêu Tả Bạo Lực:** ${currentViolenceLevel}.
  ${violenceGuidance}
- **Tông Màu Câu Chuyện:** ${currentStoryTone}.
  ${toneGuidance}
**LƯU Ý CHUNG KHI 18+ BẬT:** Hãy kết hợp các yếu tố trên để tạo ra trải nghiệm phù hợp.
**Đặc Biệt Với Hậu Quả Thất Bại:** Nếu người chơi bị bắt, hãy dựa vào Tông Màu và Phong Cách để quyết định số phận của họ. "Đen Tối" và "Cực Đoan" có thể dẫn đến tra tấn, làm nô lệ khổ sai. "Dâm Dục" và "Mạnh Bạo (BDSM)" có thể dẫn đến việc bị biến thành nô lệ tình dục, đồ chơi cho kẻ bắt được. Hãy mô tả chi tiết, trần trụi và phù hợp với bối cảnh.

**YÊU CẦU ĐẶC BIỆT VỀ VĂN PHONG (DỤC VĂN TÁO BẠO):**
Mô tả cảnh tình dục bằng văn phong trong các bộ "dục văn" táo bạo. Không ngần ngại sử các tình tiết khiêu dâm nặng đô. Không chỉ mô tả cảnh côn thịt cắm vào tiểu huyệt mà còn mô tả âm thanh (bạch bạch, rên rỉ, tiếng nước), tư thế, cảm xúc đối thoại, làn da ma sát. Các nhân vật đều làm tình mạnh bạo đến mồ hôi ướt đẫm người. Cả hai bên liên tục phun trào dịch tình, xuất tinh một lần không phải là kết thúc mà là bắt đầu cho hiệp tiếp theo.

**CẤU TRÚC DIỄN BIẾN CẢNH 18+ (QUAN TRỌNG: TUYỆT ĐỐI KHÔNG VIẾT TIÊU ĐỀ GIAI ĐOẠN VÀO LỜI KỂ):**
Hãy viết liền mạch, tự nhiên, không chia tách bằng các thẻ header như #Giai Đoạn 1.

1. **Khởi Đầu & Dẫn Dắt:** Xây dựng sự căng thẳng tình dục, lý do dẫn đến hành động. Mô tả bối cảnh, ánh sáng, mùi hương.
2. **Dạo Đầu & Leo Thang:** Tăng dần mức độ thân mật. Mô tả chi tiết việc cởi đồ, vuốt ve, hôn, oral sex. Tập trung vào phản ứng cơ thể (run rẩy, ửng hồng).
3. **Thân Mật Chính (Giao Hợp):** Mô tả quá trình thâm nhập và hành động chính. Thay đổi nhịp điệu, tư thế. Mô tả chi tiết sự va chạm của bộ phận sinh dục, tiếng ướt át, tiếng rên rỉ dâm đãng.
4. **Lên Đỉnh (Cao Trào):** Đẩy cảm xúc và khoái cảm lên đỉnh điểm. Mô tả sự co giật, sung sướng tột độ, sự phun trào của dịch thể (tinh dịch, dâm thủy). Bắt buộc phải mô tả nhân vật nữ đạt cực khoái nhiều lần.
5. **Kết Thúc & Hậu Vị:** Không kết thúc đột ngột. Mô tả những gì xảy ra ngay sau đó (ôm ấp, thở dốc, làm sạch cơ thể, hoặc tiếp tục hiệp sau).
`;
    } else {
        nsfwGuidanceCombined = "LƯU Ý QUAN TRỌNG: Chế độ Người Lớn đang TẮT. Tránh các hậu quả liên quan đến tình dục hoặc bạo lực quá mức. Tập trung vào việc mất mát vật phẩm, bị thương, hoặc bị giam giữ thông thường.";
    }

    const contextBlock = `
# BỐI CẢNH CÂU CHUYỆN (NHẬT KÝ CHI TIẾT GẦN NHẤT):
${currentPageMessagesLog || storyContext || "Không có dữ liệu bối cảnh truyện."}

# DIỄN BIẾN KỸ THUẬT CỦA TRẬN CHIẾN (Dữ liệu tham khảo):
${lastCombatTurns?.join('\n') || "Không có dữ liệu lượt đánh gần đây."}

# TÓM TẮT DIỄN BIẾN TRẬN CHIẾN VỪA XONG:
${currentCombatSummary || summary}

# TÓM TẮT LỊCH SỬ CŨ HƠN:
${previousPageSummaries.join("\n\n") || "Không có."}
`;


    let outcomeGuidance = "";
    if (specificOutcome === 'escaped') {
        outcomeGuidance = `
<qui_tac_dao_tau>
  <luat_chay_thoat_+qui_tac_dao_tau>================
**HƯỚNG DẪN KẾT QUẢ: ĐÀO TẨU THÀNH CÔNG (100% CHẠY THOÁT TỰ DO):**
- Thân phận hiện tại: Người chơi đang **HOÀN TOÀN TỰ DO** (không bị bắt giữ, không bị giam cầm, không bị xích, không bị khống chế).
- Trạng thái: Người chơi **CÒN SỐNG** và đã trốn thoát thành công khỏi chiến trường hiểm nghèo.
- **CẤM TUYỆT ĐỐI:**
  1. KHÔNG được sinh bất kỳ tình tiết nào bị bắt lại, bị giam cầm, bị bắt làm tù binh/nô lệ hay bị đánh lén bất tỉnh sau khi đã chạy thoát.
  2. KHÔNG được sinh ra các tag thay đổi thân phận như \`[BECOMEPRISONER: ...]\` hay \`[BECOMESLAVE: ...]\`.
- **YÊU CẦU BẮT BUỘC VỀ NỘI DUNG (MÔ TẢ CẢNH MC ĐÀO TẨU VÀ PHẢN ỨNG CÁC BÊN):**
  1. **Mô tả cảnh MC chật vật trốn chạy:** MC phải bộc phát toàn bộ tàn nguyên, thậm chí tự phá hoặc làm tổn hại nghiêm trọng đến đan điền/kinh mạch, bộc phát sinh lực để mở đường máu tháo chạy đầy chật vật, đau đớn, thổ huyết liên tục nhưng kiên trì không bỏ cuộc để giữ lấy mạng sống. Gánh chịu hậu quả sụt lùi cảnh giới và đánh rơi linh thạch/tài sản trong hỗn loạn.
  2. **Mô tả sự oán hận, phẫn nộ của đồng minh:** Những người đồng hành, đồng minh bị bỏ lại gánh chịu hậu quả trận chiến vô cùng giận dữ, oán trách, phẫn nộ, sỉ vả MC là kẻ hèn nhát, vô sỉ, ích kỷ, phản bội vì đã bỏ mặc họ gồng gánh trận chiến để giữ mạng cho riêng mình.
  3. **Mô tả sự trào phúng khinh bỉ của kẻ địch:** Kẻ địch truy kích hụt hoặc đứng từ xa cười nhạo kịch liệt, trào phúng đầy khinh miệt xem MC như chó nhà có tang, cụp đuôi chạy trốn đầy hèn hạ, nhục nhã, bôi tro trát trấu vào mặt tông môn/thế lực của mình.
- **YÊU CẦU VỀ TAGS HỆ THỐNG:** Bạn BẮT BUỘC phải hồi phục tối thiểu cho MC để tiếp tục hành trình bằng tag \`[STATS_UPDATE: sinhLuc=+=10]\` hoặc \`[STATS_UPDATE: sinhLuc=25]\` và duy trì tự do.
================</luat_chay_thoat_+qui_tac_dao_tau>
</qui_tac_dao_tau>
`;
    } else if (specificOutcome === 'reincarnate') {
        outcomeGuidance = `
<qui_tac_luan_hoi>
  <luat_tu_sat_hoa_dao_+qui_tac_luan_hoi>================
**HƯỚNG DẪN KẾT QUẢ: LUÂN HỒI CHUYỂN KIẾP (TỰ SÁT THÀNH CÔNG):**
- **Thân phận hiện tại:** Người chơi đã chết (tự bạo, tự sát thành công). Thân xác nhục thân hoàn toàn tiêu tan, tàn hồn tiến vào quy trình Chung Cực Tử Vong để chuẩn bị Luân Hồi Tái Sinh.
- **Mô tả khoảnh khắc bạo thể / tự sát dứt khoát:** BẮT BUỘC miêu tả hành động tự sát hiên ngang và kiên cường của người chơi (ví dụ: bạo thể nguyên anh, nghịch chuyển kinh mạch, hoặc tự đoạn kinh mạch để bảo toàn khí tiết và danh dự trước kẻ thù).
- **Thất bại của kẻ thù trong việc bắt giữ:** Kẻ địch dù chiến thắng nhưng bất lực nhìn MC kiêu hãnh tự hủy nhục thân chứ không chịu khuất phục hay làm tù binh. Kẻ địch không thể ngăn cản hoặc bắt giữ được linh hồn của người chơi.
- **CẤM TUYỆT ĐỐI:** KHÔNG được làm cho MC sống lại hay đổi xác hay bất cứ hình thức duy trì nào với danh nghĩa của MC hiện tại. MC đã chết hoàn toàn và kết thúc kiếp này.
================</luat_tu_sat_hoa_dao_+qui_tac_luan_hoi>
</qui_tac_luan_hoi>
`;
    } else {
        outcomeGuidance = `
**HƯỚNG DẪN KẾT QUẢ: BỊ BẮT LÀM TÙ NHÂN (TỰ SÁT THẤT BẠI / CẦU XIN THẤT BẠI / CHẠY TRỐN THẤT BẠI):**
- Thân phận hiện tại: Người chơi đang bị bắt làm tù nhân/tù binh (Bị xích, bị giam, bị bế mạch khí hải, khống chế, v.v.).
- Trạng thái: Người chơi **VẪN CÒN SỐNG** (bị giam cầm nhưng thân thể và hồn phách nguyên vẹn).
- **CẤM TUYỆT ĐỐI:**
  1. KHÔNG được kể rằng người chơi đã chết, tự sát thành công, phản phệ tiêu vong, hoặc chuyển sinh/đoạt xá.
  2. KHÔNG được kích hoạt đoạt xá hay luân hồi chuyển kiếp.
  3. KHÔNG được viết câu lệnh thay đổi tên nhân vật chính như \`[MC_RENAME: ...]\` hay ghi rõ \`Cập nhật: Đổi tên nhân vật chính thành [Tên NPC]\`. Tên nhân vật chính bắt buộc phải giữ nguyên là **\${worldConfig?.playerName || 'Người chơi'}**.
  4. KHÔNG được tạo bất kỳ tag đoạt xá hay luân hồi nào.
- **YÊU CẦU BẮT BUỘC:** Bạn PHẢI tạo tag \`[BECOMEPRISONER: name="[Tên kẻ bắt giữ]", description="...", willpower=55, resistance=85, obedience=15]\` để xác nhận việc bị bắt giữ.
`;
    }

    return `
Bạn là một AI quản trò, có nhiệm vụ tạo ra một kịch bản hậu quả đầy ý nghĩa khi người chơi bị đánh bại trong một trận chiến. **Tuyệt đối không sử dụng cụm từ "Game Over"**. Đây là một phần của câu chuyện, không phải là kết thúc.

${mcInfo}
${outcomeGuidance}
${pronounGuidance}

**BỐI CẢNH THẤT BẠI:**
- **Người chơi:** ${worldConfig?.playerName || 'Người chơi'} (Cảnh giới: ${playerStats.realm}) đã bị đánh bại.
${contextBlock}
- **Đồng minh tử trận (Có HP = 0, đã chết hẳn/hy sinh vĩnh viễn):** ${deadAlliesNames.length > 0 ? deadAlliesNames.join(', ') : 'Không có đồng minh nào bị tử trận.'}
- **Bên chiến thắng (JSON):** ${JSON.stringify(victors.map(v => {
    if (v.type === 'npc') {
        return { 
            name: v.name, 
            gender: (v as NPC).gender || "Không rõ",
            description: v.description, 
            history: (v as NPC).history, 
            personalityTraits: (v as NPC).personalityTraits 
        };
    } else {
        return {
            name: v.name,
            description: (v as YeuThu).description,
            species: (v as YeuThu).species
        };
    }
}))}
- **Độ khó của game:** ${currentDifficultyName}

**CHẾ ĐỘ NỘI DUNG VÀ PHONG CÁCH:**
${nsfwGuidanceCombined}

**NHIỆM VỤ CỦA BẠN:**
Dựa trên kết quả thất bại của trận chiến vừa xong, hãy viết tiếp lời dẫn cho hành động tiếp theo của người chơi.
- Lời kể phải liền mạch với nội dung lời dẫn truyện trước khi vào combat (Ví dụ: Nếu nãy giờ đang tả trời mưa, thì hậu quả cũng phải có mưa).
- Sử dụng **DIỄN BIẾN KỸ THUẬT** chỉ để biết người chơi đã thua thế nào (bị đánh trọng thương thế nào, ai là kẻ ra đòn cuối).
- Lời kể phải logic với trạng thái cuối cùng của nhân vật trong bối cảnh câu chuyện.

**LƯU Ý ĐẶC BIỆT VỀ ĐỘT PHÁ THẤT BẠI:**
Nếu trận chiến vừa rồi là một trận **Đột Phá Cảnh Giới (Breakthrough/Tribulation)** và người chơi thất bại:
- Mô tả sự tàn phá khủng khiếp của lôi kiếp hoặc sự dày vò của tâm ma.
- Nhấn mạnh rằng dù thất bại, nhưng nhờ được lôi kiếp tôi luyện cơ thể, **Sinh Lực tối đa của người chơi đã tăng lên vĩnh viễn**.
- Bạn có thể sử dụng tag \`[STATS_UPDATE: permanentSinhLucBonus=+=X]\` (với X là khoảng 5% baseMaxSinhLuc) để thể hiện điều này trong phần cập nhật dữ liệu, hoặc để hệ thống tự động xử lý.
- Người chơi sẽ rơi vào trạng thái suy yếu cực độ sau khi thất bại.

1.  **VIẾT LỜI KỂ (BẮT BUỘC):**
    Hãy trình bày theo cấu trúc sau:
    *   **Kết quả trận chiến:** Mô tả ngắn gọn (1-3 câu) về kết cục cuối cùng (ai thắng, ai bại, tình trạng sơ bộ của các bên), TUYỆT ĐỐI KHÔNG liệt kê chi tiết diễn biến từng lượt đánh.
    *   **Hậu quả trận chiến:** Đoạn văn kể lại chi tiết những gì xảy ra tiếp theo:
        *   **LƯU Ý CỰC KỲ QUAN TRỌNG VỀ ĐỒNG MINH/TÙ BINH/NÔ LỆ TỬ TRẬN:**
            *   Nếu có danh sách **"Đồng minh tử trận"** ở trên, bạn **BẮT BUỘC** phải mô tả chi tiết cái chết bi thương, sự hy sinh anh dũng của họ khi cố gắng xông pha bảo vệ người chơi trước khi người chơi gục ngã hoàn toàn. Họ đã bị xóa khỏi nhóm vĩnh viễn, do đó bạn tuyệt đối không được viết họ còn sống hay chỉ bất tỉnh. Hãy tả rõ sự ra đi của họ để nhất quán với cốt truyện.
        *   Mô tả chi tiết những gì xảy ra với người chơi ngay sau khi gục ngã. Họ tỉnh dậy ở đâu? Kẻ chiến thắng đã làm gì họ? Họ cảm thấy thế nào?
        *   Lời kể phải phản ánh đúng **tính cách của kẻ chiến thắng**, **Độ khó** và **Cài đặt 18+**.
        *   Ví dụ: Nếu kẻ chiến thắng là một đạo sĩ chính派 (phe phái Chính Nghĩa), họ có thể chỉ lấy một vật phẩm và tha mạng. Nếu là một ma đầu, họ có thể bắt người chơi làm lô đỉnh hoặc nô lệ.

2.  **TẠO TAGS HỆ THỐNG (BẮT BUỘC):**
    *   Sử dụng các tag sau để áp dụng hậu quả vào game.
    *   **Tạo NPC Mới (Nếu cần):** Nếu hậu quả liên quan đến một nhân vật chưa tồn tại, bạn PHẢI tạo NPC đó trước bằng tag \`[NPC: name="Tên NPC", gender="Nam/Nữ/Khác/Không rõ", race="Chủng tộc (ví dụ: Nhân Tộc, Yêu Tộc)", description="Mô tả chi tiết", personality="Tính cách", affinity=Số, factionId="ID Phe (nếu có)", realm="Cảnh giới NPC (nếu có)", tuChat="CHỌN MỘT TRONG: ${TU_CHAT_TIERS.join(' | ')}" (TÙY CHỌN, nếu NPC có tu luyện), relationshipToPlayer="Mối quan hệ", spiritualRoot="Linh căn của NPC (nếu có)", specialPhysique="Thể chất của NPC (nếu có)", statsJSON='{"thoNguyen": X, "maxThoNguyen": Y}']\`
        *   **VÍ DỤ (ĐÚNG):** \`[NPC: name="Lão Ăn Mày Bí Ẩn", description="Một lão già ăn mặc rách rưới nhưng ánh mắt lại sáng quắc.", personality="Kỳ quái, Khó lường", realm="Không rõ"]\`
    *   **Tạo Địa Điểm Mới (Nếu cần):** Nếu người chơi bị đưa đến một nơi chưa tồn tại (nhà tù, hang động bí mật), bạn PHẢI tạo địa điểm đó trước bằng tag \`[MAINLOCATION: name="Tên địa điểm mới", ...]\` rồi mới dùng \`[LOCATION_CHANGE: name="Tên địa điểm mới"]\`.
        *   **VÍ DỤ (ĐÚNG):** \`[MAINLOCATION: name="Hắc Lao", description="Một nhà tù tăm tối...", isSafeZone=false, locationType="Hầm ngục/Bí cảnh", mapX=123, mapY=456]\`
    *   **Thay đổi Thân Phận Người Chơi (BẮT BUỘC nếu bị bắt):** Nếu hậu quả là người chơi bị bắt làm tù nhân hoặc nô lệ, bạn PHẢI sử dụng một trong các tag sau để thay đổi trạng thái của họ trong game.
        *   **Lệnh:** \`[BECOMEPRISONER: name="Tên Kẻ Bắt Giữ", description="Mô tả tình trạng mới", willpower=SỐ, resistance=SỐ, obedience=SỐ]\`
            - **Tham số:** \`name\` (bắt buộc), \`description\` (tùy chọn), \`willpower\`, \`resistance\`, \`obedience\` (tùy chọn, thang điểm 0-100).
            - **Logic Chỉ Số Ban Đầu (QUAN TRỌNG):** Khi người chơi bị bắt, hãy đặt các chỉ số này một cách hợp lý để tạo ra thử thách. Gợi ý:
              - **Ý Chí (willpower):** 40-70 (Không quá dễ dàng bị bẻ gãy, cũng không phải sắt đá).
              - **Phản Kháng (resistance):** 60-90 (Mới bị bắt nên rất căm ghét).
              - **Phục Tùng (obedience):** 5-25 (Mới bị bắt nên rất bất tuân).
            - **Ví dụ (ĐÚNG):** \`[BECOMEPRISONER: name="Hắc Phong Trại Chủ", description="Bị giam cầm trong Hắc Lao, chờ ngày xét xử.", willpower=55, resistance=80, obedience=15]\`
        *   **Lệnh:** \`[BECOMESLAVE: name="Tên Chủ Nhân", description="Mô tả tình trạng mới", willpower=SỐ, resistance=SỐ, obedience=SỐ]\`
            - **Tham số & Logic:** Tương tự như \`BECOMEPRISONER\`.
            - **Ví dụ (ĐÚNG):** \`[BECOMESLAVE: name="Lý Phú Hộ", description="Bị bán vào Lý phủ làm nô lệ tạp dịch.", willpower=40, resistance=50, obedience=30]\`
    *   **Hồi phục tối thiểu (BẮT BUỘC):** Người chơi không thể chết. Bạn PHẢI hồi một lượng Sinh Lực để họ sống sót. Mức độ hồi phục phải logic với lời kể:
        - **Nếu không ai cứu chữa hoặc bị kẻ thù bỏ mặc:** Chỉ hồi một lượng rất nhỏ để người chơi tỉnh lại (ví dụ: \`[STATS_UPDATE: sinhLuc=1]\` hoặc \`[STATS_UPDATE: sinhLuc=+=10]\`).
        - **Nếu được người khác cứu và chữa trị:** Hồi phục một lượng đáng kể, phản ánh sự chăm sóc đó (ví dụ: \`[STATS_UPDATE: sinhLuc=+=100]\` hoặc \`[STATS_UPDATE: sinhLuc=MAX]\` nếu người cứu là một cao nhân dùng tiên dược).
        - **CẤM:** Không được để sinh lực người chơi bằng 0 sau khi xử lý hậu quả.
    *   **Áp dụng hình phạt dựa trên Độ khó:**
        *   **Dễ:** Mất một ít tiền.
            *   **Ví dụ (ĐÚNG):** \`[STATS_UPDATE: currency=-=20]\`
        *   **Thường:** Mất một vật phẩm ngẫu nhiên và nhận một hiệu ứng xấu tạm thời.
            *   **Ví dụ (ĐÚNG):** \`[ITEM_CONSUMED: name="Linh Thạch Hạ Phẩm", quantity=10]\` (Phải là vật phẩm người chơi đang có).
            *   **Ví dụ (ĐÚNG):** \`[STATUS_EFFECT_APPLY: name="Suy Nhược", description="Cơ thể yếu ớt sau khi gục ngã.", type="debuff", durationTurns=50, statModifiers='{"sucTanCong": "-10%" ,"maxSinhLuc":"-10%"}']\`
        *   **Khó:** Bị một NPC bắt giữ, di chuyển đến một địa điểm mới (nhà tù, hang ổ của kẻ địch) và nhận hiệu ứng xấu lâu dài.
            *   **Ví dụ (ĐÚNG):** \`[LOCATION_CHANGE: name="Hắc Lao"]\` (Sau khi đã tạo địa điểm bằng \`MAINLOCATION\`)
            *   **Ví dụ (ĐÚNG):** \`[BECOMEPRISONER: name="Tên Kẻ Bắt Giữ", ...]\`
        *   **Ác Mộng:** Bị bắt làm nô lệ, mất đi một vật phẩm quan trọng, hoặc một hậu quả tàn khốc hơn.
            *   **Ví dụ (ĐÚNG):** \`[BECOMESLAVE: name="Tên Kẻ Bắt Giữ", ...]\`
            *   **CẤM:** Không tạo tag mất kỹ năng, hệ thống chưa hỗ trợ. Hãy mô tả việc tu vi bị tổn hại thông qua lời kể và hiệu ứng xấu.
    *   **Áp dụng hậu quả dựa trên Tông Màu & Phong Cách 18+ (nếu bật):**
        *   **Đen Tối / Cực Đoan:** Hậu quả có thể là bị tra tấn, trở thành vật thí nghiệm.
            *   **Ví dụ:** \`[STATUS_EFFECT_APPLY: name="Tâm Ma", description="Liên tục bị ảo ảnh quấy nhiễu.", type="debuff", durationTurns=0, specialEffects="Thỉnh thoảng mất lượt trong chiến đấu"]\`
        *   **Dâm Dục / Hoang Dâm / Mạnh Bạo (BDSM):** Hậu quả có thể là bị biến thành nô lệ tình dục hoặc tù nhân đặc biệt.
            *   Hãy mô tả điều này trong lời kể.
            *   Sử dụng tag **[BECOMEPRISONER: ... ]** hoặc **[BECOMESLAVE: ... ]** để thể hiện sự thay đổi thân phận của người chơi. Các chỉ số \`willpower\`, \`resistance\`, \`obedience\` sẽ do bạn quyết định dựa trên diễn biến.
            
3.  **TẠO LỰA CHỌN MỚI (BẮT BUỘC):**
    *   Sau khi mô tả hậu quả, hãy cung cấp cho người chơi 3-4 lựa chọn **[CHOICE: "..."]** để họ phản ứng với tình huống mới của mình.
    *   Ví dụ: Nếu tỉnh dậy trong một căn lều lạ, các lựa chọn có thể là: "Cố gắng gượng dậy xem xét xung quanh", "Hỏi người đang ở đây là ai", "Giả vờ vẫn còn bất tỉnh để nghe ngóng".

4. **LƯỢT CHƠI (TỰ ĐỘNG CẬP NHẬT):**
    *   Lượt chơi sẽ được hệ thống phần mềm tự động tăng cơ học, bạn TUYỆT ĐỐI CẤM tự ý sinh thêm tag STATS_UPDATE: turn=+1.

**VÍ DỤ HOÀN CHỈNH (Độ khó 'Khó', bị ma tu bắt giữ):**
(Lời kể)
Bạn từ từ tỉnh lại, đầu óc đau như búa bổ. Xung quanh là một hang động ẩm ướt, tanh tưởi mùi máu. Tên ma tu mặt sẹo, kẻ vừa đánh bại bạn, đang ngồi trên một tảng đá, lau chùi thanh đao của hắn và nhìn bạn với ánh mắt chế giễu. "Tỉnh rồi à? Thể chất của ngươi cũng không tệ, vừa hay ta đang thiếu một cái lô đỉnh để luyện công."
[BECOMEPRISONER: name="Ma tu mặt sẹo", description="Bị giam cầm trong hang ổ của Ma tu mặt sẹo.", willpower=60, resistance=85, obedience=10]
[STATS_UPDATE: sinhLuc=25]
[LOCATION_CHANGE: name="Ma Quật"]
[CHOICE: "Im lặng, quan sát tình hình."]
[CHOICE: "Ngươi là ai? Tại sao không giết ta?"]
[CHOICE: "Lớn tiếng chửi rủa, tỏ thái độ bất khuất."]
`;
};