
import { KnowledgeBase, GameMessage, Wife, Slave, Combatant } from '../types';
import { VIETNAMESE, DEFAULT_NSFW_DESCRIPTION_STYLE, DEFAULT_VIOLENCE_LEVEL, DEFAULT_STORY_TONE } from '../constants';

const convertCombatStateToXML = (
    player: any, 
    playerSkills: any[], 
    allies: any[], 
    opponents: any[],
    turn: number = 1
): string => {
  let xml = `<combat_state_15_3 combat_turn="${turn}">\n----\n`;

  // 1. Player
  xml += "  <player_combatant_15_3_1>\n  ----\n";
  if (player) {
    xml += `    <name>${player.name || "Không rõ"}</name>\n`;
    xml += `    <gender>${player.gender || "Không rõ"}</gender>\n`;
    xml += `    <hp>${player.hp}/${player.maxHp}</hp>\n`;
    xml += `    <mp>${player.mp}/${player.maxMp}</mp>\n`;
    xml += `    <atk>${player.atk || player.stats?.sucTanCong || 10}</atk>\n`;
    xml += `    <realm>${player.realm || "Không rõ"}</realm>\n`;
    xml += `    <status>${player.status || "Bình thường"}</status>\n`;
    if (player.activeEffects && player.activeEffects.length > 0) {
      xml += "    <active_effects>\n    ----\n";
      player.activeEffects.forEach((eff: any, idx: number) => {
        xml += `      <effect_${idx + 1} name="${eff.name}">${eff.description || "Không có"}</effect_${idx + 1}>\n`;
      });
      xml += "    ----\n    </active_effects>\n";
    }
  } else {
    xml += "    <missing_data>Thông tin người chơi bị lỗi</missing_data>\n";
  }
  
  // Player Skills
  xml += "    <learnt_skills>\n    ----\n";
  if (playerSkills && playerSkills.length > 0) {
    playerSkills.forEach((sk: any, idx: number) => {
      xml += `      <skill_15_3_1_1_${idx + 1} name="${sk.name}">\n      ----\n`;
      xml += `        <description>${sk.description}</description>\n`;
      xml += `        <mana_cost>${sk.manaCost || "8% Max MP"}</mana_cost>\n`;
      xml += `      ----\n      </skill_15_3_1_1_${idx + 1}>\n`;
    });
  } else {
    xml += "      <no_skills>Chưa học kỹ năng nào</no_skills>\n";
  }
  xml += "    ----\n    </learnt_skills>\n";
  xml += "  ----\n  </player_combatant_15_3_1>\n\n";

  // 2. Allies
  xml += "  <allies_combatants_15_3_2>\n  ----\n";
  if (allies && allies.length > 0) {
    allies.forEach((all: any, idx: number) => {
      xml += `    <ally_15_3_2_${idx + 1} id="${all.id}" name="${all.name}">\n    ----\n`;
      xml += `      <gender>${all.gender || "Không rõ"}</gender>\n`;
      xml += `      <hp>${all.hp}/${all.maxHp}</hp>\n`;
      xml += `      <mp>${all.mp}/${all.maxMp}</mp>\n`;
      xml += `      <atk>${all.atk || 10}</atk>\n`;
      xml += `      <realm>${all.realm || "Không rõ"}</realm>\n`;
      xml += `      <status>${all.status || "Bình thường"}</status>\n`;
      xml += `    ----\n    </ally_15_3_2_${idx + 1}>\n`;
    });
  } else {
    xml += "    <no_allies>\n    ----\n    Không có đồng minh tham chiến\n    ----\n    </no_allies>\n";
  }
  xml += "  ----\n  </allies_combatants_15_3_2>\n\n";

  // 3. Opponents
  xml += "  <opponents_combatants_15_3_3>\n  ----\n";
  if (opponents && opponents.length > 0) {
    opponents.forEach((opp: any, idx: number) => {
      xml += `    <opponent_15_3_3_${idx + 1} id="${opp.id}" name="${opp.name}">\n    ----\n`;
      xml += `      <gender>${opp.gender || "Không rõ"}</gender>\n`;
      xml += `      <hp>${opp.hp}/${opp.maxHp}</hp>\n`;
      xml += `      <mp>${opp.mp}/${opp.maxMp}</mp>\n`;
      xml += `      <atk>${opp.atk || 10}</atk>\n`;
      xml += `      <realm>${opp.realm || "Không rõ"}</realm>\n`;
      xml += `      <status>${opp.status || "Bình thường"}</status>\n`;
      xml += `    ----\n    </opponent_15_3_3_${idx + 1}>\n`;
    });
  } else {
    xml += "    <no_opponents>\n    ----\n    Không có đối thủ nào\n    ----\n    </no_opponents>\n";
  }
  xml += "  ----\n  </opponents_combatants_15_3_3>\n";

  xml += "----\n</combat_state_15_3>";
  return xml;
};

export const generateCombatTurnPrompt = (
    knowledgeBase: KnowledgeBase,
    playerAction: string,
    combatLog: string[],
    currentPageMessagesLog: string,
    previousPageSummaries: string[],
    lastNarrationFromPreviousPage?: string
): string => {
    const { worldConfig, inventory, playerSkills } = knowledgeBase;

    // @ts-ignore - combatants is a temporary property added for the prompt
    const combatants: Combatant[] = knowledgeBase.combatants || [];
    
    const player = combatants.find(c => c.id === 'player');
    const opponents = combatants.filter(c => c.entityType === 'npc' || c.entityType === 'yeuThu');
    const allies = combatants.filter(c => c.entityType === 'wife' || c.entityType === 'slave');

    const currentDifficultyName = worldConfig?.difficulty || 'Thường';
    const currentViolenceLevel = worldConfig?.violenceLevel || DEFAULT_VIOLENCE_LEVEL;
    const currentStoryTone = worldConfig?.storyTone || DEFAULT_STORY_TONE;
    const nsfwMode = worldConfig?.nsfwMode || false;
    const nsfwStyle = worldConfig?.nsfwDescriptionStyle || DEFAULT_NSFW_DESCRIPTION_STYLE;
    const combatModeText = knowledgeBase.combatMode === 'online' ? 'Online (Vui)' : 'Offline (Không Vui)';
    
    let nsfwGuidanceCombined = "";
    if (nsfwMode) {
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
        nsfwGuidanceCombined = "LƯU Ý QUAN TRỌNG: Chế độ Người Lớn đang TẮT. Tiếp tục duy trì nội dung phù hợp với mọi lứa tuổi, tập trung vào phiêu lưu và phát triển nhân vật. Tránh các chủ đề nhạy cảm, bạo lực quá mức hoặc tình dục.";
    }
    
    const combatHistory = combatLog.length > 1 ? combatLog.slice(1).join('\n---\n') : "Đây là lượt đầu tiên của trận đấu.";
    
    const isFirstTurn = playerAction === "Bắt đầu chiến đấu";

    let aiInstructions = '';

    if (isFirstTurn) {
        aiInstructions = `
**YÊU CẦU DÀNH CHO BẠN (AI) - LƯỢT ĐẦU TIÊN (Lượt Thiết Lập):**

1.  **QUY TẮC LƯỢT ĐẦU:**
    *   Hành động của người chơi là "Bắt đầu chiến đấu". Đây là lượt thiết lập.
    *   **QUAN TRỌNG NHẤT: KHÔNG để bất kỳ ai (cả người chơi và đối thủ) thực hiện hành động tấn công hay gây sát thương trong lượt này.**

2.  **TẠO PHẢN HỒI THEO ĐỊNH DẠNG TAG (RẤT QUAN TRỌNG):**
    *   **[CHOICE: "Nội dung lựa chọn"]**: Cung cấp 10-12 lựa chọn hành động cho lượt tiếp theo của người chơi. Các lựa chọn phải đa dạng, từ hợp lý, chiến thuật cho đến những lựa chọn hoàn toàn bất ngờ, hỗn loạn, phi logic và hài hước. Ví dụ về các lựa chọn hỗn loạn: "quỳ xuống xin tha", "hỏi đối phương về thời tiết", "cố gắng thuyết phục đối phương gia nhập phe mình".
    *   **CẤM:** Không tạo bất kỳ tag \`[COMBAT_STAT_UPDATE]\`, \`[COMBAT_NARRATION]\` hay \`[COMBAT_END]\` nào trong lượt đầu tiên này.
`;
    } else {
        aiInstructions = `
**YÊU CẦU DÀNH CHO BẠN (AI):**

**CẤU TRÚC TƯ DUY BẮT BUỘC (<tuong_than>):**
Trước khi trả về bất kỳ tag nào, bạn BẮT BUỘC phải thực hiện phân tích sâu sắc bên trong thẻ suy nghĩ (ví dụ <tuong_than> hoặc <thinking>) theo đúng cấu trúc 5 bước sau đây:

1. **Phân tích bối cảnh**: Xác định địa điểm, nhân vật tham gia (MC, đồng minh, kẻ thù), trạng thái hiện tại và ý đồ hành động cụ thể của MC.
2. **Phân tích chỉ số và kỹ năng**: Xác định HP, MP, ATK, DEF và kỹ năng của từng bên từ dữ liệu bối cảnh để làm căn cứ.
3. **Tính toán chiến đấu**:
   - Đánh giá tính logic vật lý/phép thuật của đòn đánh, tính toán lượng HP/MP tiêu hao và biến động dựa trên chỉ số công/thủ thực tế.
   - **MỤC THẨM ĐỊNH 3 CÂU HỎI VỚI TẤT CẢ NPC CHIẾN ĐẤU (BẮT BUỘC DUYỆT 100% CÁC NPC KHÔNG BỎ SÓT)**: Bạn BẮT BUỘC phải duyệt qua từng nhân vật trong danh sách đồng minh, kẻ địch và trung lập đang tham chiến. Đối với MỖI VÀ MỌI NPC, bạn phải trả lời đủ 3 câu hỏi:
     • NPC là ai? (Tên, xuất thân, tính cách, phe phái).
     • Phản ứng thái độ của NPC trước hành động/ý đồ của MC?
     • NPC sẽ làm gì trong lượt này? (CỤ THỂ LÀ CÓ HÀNH ĐỘNG HOẶC ĐỘNG THÁI RÕ RÀNG - TUYỆT ĐỐI CẤM NPC ĐỨNG YÊN HOẶC BỊ QUÊN LÃNG).
     
     *Ví dụ mẫu cho mục 3 câu hỏi này*:
     Hành động của MC: "Vén váy của Liễu Thanh Thanh (đồng minh) nhằm dụ dỗ Cổ Nguyệt Lôi (kẻ địch)"
     
     - Liễu Thanh Thanh:
       + Là ai? Là bạn cùng lớp của MC, tính tình chua ngoa, đanh đá.
       + Phản ứng? Bị tốc váy: Thật xấu hổ, không thể chịu được, phải đích thân đánh cho tên ngốc này một trận.
       + Hành động? Ngay lập tức chuyển phe để đánh cho MC một trận.
       
     - Cổ Nguyệt Lôi:
       + Là ai? Là một học sinh cùng lớp đang tức tối vì bị MC khiêu khích.
       + Phản ứng? Đứng trơ mắt ra nhìn, không thể hành động được vì shock (trước quần lót của Liễu Thanh Thanh).
       + Hành động? Vận linh lực ngưng đao thủ thế, chuẩn bị lao tới thừa cơ công kích MC.
       
   - **NGUYÊN TẮC CHỐNG CƯỚP LỜI & CHỐNG GOD-MODE (BẮT BUỘC):**
     *   **Nguyên tắc "Hành động là Ý định" (Chống God-mode)**: Mọi nội dung người chơi nhập vào ô hành động CHỈ được xem là "Dự định", "Nỗ lực" hoặc "Mong muốn" thử nghiệm của MC, không phải là sự thật đã xảy ra hay kết quả đã rồi. Bạn TUYỆT ĐỐI KHÔNG được chấp nhận các kết quả có lợi do người chơi tự ý viết sẵn trong câu lệnh (ví dụ: tự viết mình đánh trúng, tự né tránh hoàn hảo, tự bắt đối thủ sợ hãi/đầu hàng/yêu thương mình). Bạn phải là trọng tài tối cao quyết định hành động có thành công hay phản tác dụng dựa trên chênh lệch thực lực chỉ số, tốc độ và tính cách thật sự của các NPC.
     *   **Nguyên tắc "Diễn biến toàn vẹn" (Chống Cướp Lời/Nhảy cóc)**: Bạn KHÔNG ĐƯỢC PHÉP nhảy cóc thời gian hoặc nhảy tắt tới bối cảnh sau khi hành động xong. Bạn bắt buộc phải mô tả đầy đủ hành động của MC từ lúc chưa hành động cho đến khi đã hành động xong qua 3 giai đoạn:
         + Giai đoạn 1 (Khởi động): MC tích tụ lực lượng, chuẩn bị tư thế, biểu cảm các bên khi MC bắt đầu di chuyển.
         + Giai đoạn 2 (Thực thi): MC lao tới tiếp cận, vung đòn hoặc thi triển chiêu thức chi tiết.
         + Giai đoạn 3 (Va chạm & Hệ quả): Phản ứng va chạm cơ học thực tế của đối phương (né tránh, đỡ đòn, chống trả, chịu đòn) theo đúng logic chỉ số.
     *   *Ví dụ minh họa*: Người chơi nhập hành động "Chạy đến tốc váy Mộ Dung (đồng minh), được nàng ta vuốt ve má, kẻ địch sợ hãi đầu hàng xin tha". Kết quả: AI phân tích thấy Mộ Dung lạnh lùng kiêu ngạo sẽ không vuốt ve, nên mô tả MC vận sức lao đến tốc váy nhưng ngay lập tức bị Mộ Dung tát một phát trời giáng "CHÁT!" bay xa 3 mét, kẻ địch đứng xem thì cười sằng sặc chế giễu chứ không hề đầu hàng hay sợ hãi.
       
4. **Diễn biến kể chuyện**: Lập kịch bản chi tiết cho lời kể lượt này.
5. **Cập nhật chỉ số**: Chốt hạ mức HP, MP tiêu hao và còn lại, kèm trạng thái mới của tất cả các bên tham chiến.

---

**QUY TẮC LINH LỰC BỘC PHÁT (BẮT BUỘC):**
- Mọi kỹ năng chủ động (có tốn linh lực) của NGƯỜI CHƠI và NPC đều tiêu hao **8% Linh Lực tối đa (Max MP)** của người thi triển.
- Lượng MP tiêu hao này được chuyển hóa 100% thành sức mạnh đòn đánh: **Sát thương/Hồi phục cuối = Chỉ số gốc + ATK + (8% Max MP)**.
- Nếu nhân vật có Linh Lực hiện tại < 8% Max MP, họ **KHÔNG THỂ** dùng kỹ năng và phải chuyển sang tấn công thường.
- Hãy mô tả việc các nhân vật rót linh lực cuồng bạo vào đòn đánh để bộc phát uy lực lớn.

**QUY TẮC QUAN TRỌNG NHẤT:** Với **MỖI** hành động gây sát thương hoặc hồi phục, bạn **BẮT BUỘC** phải tạo ra **CẢ HAI** tag sau theo đúng thứ tự:
1.  **[COMBAT_NARRATION: text="..."]** để mô tả hành động.
2.  **[COMBAT_STAT_UPDATE: targetId="...", stat="...", change=...]** để cập nhật chỉ số.
Việc thiếu tag [COMBAT_STAT_UPDATE] sẽ làm hỏng game.

1.  **Xử lý Hành Động Của Người Chơi:**
    *   Dựa vào hành động ("${playerAction}"), chỉ số, kỹ năng và trang bị của người chơi, hãy xác định kết quả.
    *   Áp dụng Quy Tắc Linh Lực Bộc Phát.
    *   Tất cả kết quả phải được phản ánh qua các tag hệ thống.

2.  **Quyết Định và Xử lý Hành Động CỦA TỪNG ĐỒNG MINH:**
    *   Lần lượt quyết định hành động cho **TỪNG** đồng minh còn sống.
    *   Áp dụng Quy Tắc Linh Lực Bộc Phát cho các kỹ năng.
    *   Tính toán kết quả và phản ánh qua các tag hệ thống.

3.  **Quyết Định và Xử lý Hành Động CỦA TỪNG Đối Thủ:**
    *   Sau khi xử lý lượt của người chơi và đồng minh, lần lượt quyết định hành động cho **TỪNG** NPC đối thủ còn sống.
    *   Áp dụng Quy Tắc Linh Lực Bộc Phát cho các kỹ năng.
    *   Tính toán kết quả và phản ánh qua các tag hệ thống.
    
4.  **Tạo Phản Hồi Theo Định Dạng Tag (RẤT QUAN TRỌNG):**
    *   **Phản hồi của bạn CHỈ được chứa các TAG và KHÔNG có bất kỳ lời kể nào.**
    *   Bạn PHẢI sử dụng các tag sau đây để điều khiển trận đấu:

    *   **[COMBAT_NARRATION: text="..."] (BẮT BUỘC):**
        *   Sử dụng tag này để mô tả **TỪNG** hành động diễn ra trong lượt.
        *   **ĐỊNH DẠNG BẮT BUỘC:** Nội dung \`text\` PHẢI theo cấu trúc máy móc, cô đọng: \`"[Nhân vật] [hành động] lên [mục tiêu] gây [sát thương/hiệu ứng]."\`
        *   **Ví dụ:**
            \`[COMBAT_NARRATION: text="Người chơi bộc phát linh lực, dùng 'Hỏa Cầu Thuật' lên Sói Xám gây 120 sát thương."]\`

    *   **[COMBAT_STAT_UPDATE: targetId="ID", stat="TênChỉSố", change=SỐ] (BẮT BUỘC SAU MỖI THAY ĐỔI CHỈ SỐ):**
        *   Sử dụng tag này **NGAY SAU** tag \`COMBAT_NARRATION\` tương ứng.
        *   \`targetId\`: ID của người bị ảnh hưởng (\`"player"\` hoặc ID NPC).
        *   \`stat\`: Chỉ số bị thay đổi (\`sinhLuc\`, \`linhLuc\`).
        *   \`change\`: Lượng thay đổi (số âm cho sát thương/tiêu hao, số dương cho hồi phục).

    *   **[CHOICE: "Nội dung lựa chọn"]**:
        *   Cung cấp ĐÚNG 6 lựa chọn phản ứng phong phú của người chơi nằm gọn trong cặp thẻ <choice> (gồm các lựa chọn: tấn công, phòng thủ, sử dụng pháp bảo/linh đan/kỹ năng, đổi đội hình/gọi viện trợ, đàm phán/ngừng chiến theo đề xuất của cố vấn, và cuối cùng là rút lui).

**QUY TẮC ĐỔI ĐỘI HÌNH & QUYỀN HẠN:**
- **Tự động & Theo lệnh**: Khi NPC có HP < 20% thì có 40% tự động lùi về dự bị; hoặc khi người chơi chủ động ra lệnh thay đổi đội hình, AI BẮT BUỘC thực hiện.
- Cú pháp bắt buộc: [change_formation: out="Tên NPC lùi về", in="Tên NPC dự bị lên thay"]
- NPC vừa được gọi lên thay thế (in) sẽ ở trạng thái phòng thủ/chuẩn bị và KHÔNG ĐƯỢC PHÉP thực hiện bất kỳ hành động tấn công hay hỗ trợ nào khác trong chính block turn này.
- **Tính minh bạch**: Tuyệt đối không thay đổi trong yên lặng. BẮT BUỘC phải có đối thoại rõ ràng: NPC lùi về thốt lên báo thương thế/xin lui, NPC lên thay đáp lời/lên chắn trước, kẻ địch có phản ứng nhận biết.

**QUY TẮC CỐ VẤN CHIẾN THUẬT TỐI ƯU:**
- Trong lời kể/đối thoại, NPC đồng minh hoặc trực giác chiến đấu đóng vai trò cố vấn đưa ra đề xuất chiến thuật tối ưu nhất (dùng chiêu thức tương khắc, thay đổi nhân sự dự bị, hoặc đề nghị ngừng chiến/rút lui khi bất lợi).
- Trong các lựa chọn [CHOICE: "..."], BẮT BUỘC cung cấp các phương án bám sát đề xuất của cố vấn.

**QUY TẮC CHỌN MỤC TIÊU THÔNG MINH:**
- Nếu hành động công kích/hỗ trợ không nói rõ mục tiêu là gì: BẠN BẮT BUỘC PHẢI tự động chọn mục tiêu là các thực thể đang có trạng thái "đang chiến đấu" (active).
- TUYỆT ĐỐI KHÔNG chọn mục tiêu là các thực thể đã "gục ngã" (HP = 0) hoặc đang ở trạng thái "dự bị" (reserve/benched) trừ khi người chơi chỉ đích danh.
`;
    }
    
    const rule2_combatEnd = `
**QUY TẮC KẾT THÚC TRẬN ĐẤU:**
*   Trận chiến chỉ kết thúc khi toàn bộ thành viên của một bên có HP về 0 hoặc dưới 0.
`;

    return `**YÊU CẦU VỀ ĐỊNH DẠNG PHẢN HỒI (CỰC KỲ QUAN TRỌNG):** Phản hồi của bạn **CHỈ** được chứa các tag đã được định nghĩa ([COMBAT_NARRATION], [COMBAT_STAT_UPDATE], [STATUS_EFFECT_APPLY], [CHOICE], [COMBAT_END]). **TUYỆT ĐỐI KHÔNG** viết bất kỳ văn bản, lời kể, hay giải thích nào khác.

Bạn là một AI "Combat Master" trong một game nhập vai thể loại ${worldConfig?.genre || 'Tu Tiên'}.

**BỐI CẢNH TOÀN DIỆN:**
- **Thế Giới:** Chủ đề "${worldConfig?.theme}", thể loại "${worldConfig?.genre}".
- **CHẾ ĐỘ CHIẾN ĐẤU HIỆN TẠI:** ${combatModeText}.
- **Địa Điểm:** "${knowledgeBase.discoveredLocations.find(l => l.id === knowledgeBase.currentLocationId)?.name || 'một nơi không xác định'}"

**TÌNH HÌNH CHIẾN TRƯỜNG HIỆN TẠI (XML):**
${convertCombatStateToXML(player, playerSkills, allies, opponents, combatLog.length)}

${rule2_combatEnd}

${aiInstructions}

**BẮT ĐẦU!** Hãy xử lý hành động của người chơi và chỉ trả về các tag hệ thống tương ứng.
`;
};
