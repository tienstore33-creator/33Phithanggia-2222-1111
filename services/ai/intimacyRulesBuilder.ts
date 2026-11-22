import { NPC, Wife, Slave, Prisoner, KnowledgeBase } from '../../types';
import { calculatePayoffWeights } from '../../utils/gameTheoryAffinity';
import { GAME_THEORY_AFFINITY_PROMPT } from '../../prompts/gameTheoryRules';
import { AffectionBehaviorService } from '../AffectionBehaviorService';

/**
 * Xây dựng khối luật tương tác thể xác (Intimacy Rules) dựa trên dữ liệu THỰC TẾ của NPC.
 * Đảm bảo AI miêu tả đúng phản ứng tâm/sinh lý của NPC dựa trên Hảo cảm và HP.
 * Đồng thời tích hợp Lý thuyết trò chơi (Game Theory Strategic Assessment) một cách vô điều kiện.
 */
export const buildIntimacyRulesPrompt = (
    targetNpc: NPC | Wife | Slave | Prisoner,
    nsfwStyle: string,
    kb?: KnowledgeBase
): string => {
    // 1. Lấy dữ liệu thực tế từ JSON Object của NPC
    const affinity = targetNpc.affinity || 0;
    const currentHp = targetNpc.stats?.sinhLuc || 1;
    const maxHp = targetNpc.stats?.maxSinhLuc || 1;
    const hpPercentage = Math.round((currentHp / maxHp) * 100);
    const isBDSM = nsfwStyle === 'Mạnh Bạo (BDSM)';

    // 2. Khởi tạo khối lệnh
    let rulesPrompt = `\n\n=== QUY TẮC TÂM SINH LÝ & TƯƠNG TÁC THỂ XÁC (STRICT INTIMACY RULES) ===\n`;
    rulesPrompt += `DỮ LIỆU GỐC CỦA [${targetNpc.name}]:\n`;
    rulesPrompt += `- Hảo cảm (Affinity): ${affinity}/100\n`;
    rulesPrompt += `- Sức khỏe (HP): ${currentHp}/${maxHp} (${hpPercentage}%)\n\n`;

    // 2b. Tính toán và chèn ma trận quyết định Game Theory vô điều kiện nếu có kb
    if (kb) {
        const gt = calculatePayoffWeights(kb, targetNpc);
        rulesPrompt += `=== MA TRẬN QUYẾT ĐỊNH GAME THEORY (ALWAYS-ON STRATEGIC ASSESSMENT) ===\n`;
        rulesPrompt += `- Chỉ số mô phỏng: Trust (Niềm tin): ${gt.trust}/100, Fear (Sợ hãi): ${gt.fear}/100\n`;
        rulesPrompt += `- Ma trận lợi ích định lượng:\n`;
        rulesPrompt += `  + Chiến lược HỢP TÁC (Cooperate - coop): Lợi ích thu về = ${gt.payoffs.coop}\n`;
        rulesPrompt += `  + Chiến lược TRỤC LỢI/PHẢN BỘI (Defect/Exploit - exploit): Lợi ích thu về = ${gt.payoffs.exploit}\n`;
        rulesPrompt += `  + Chiến lược PHÒNG THỦ/NÉ TRÁNH (Defend/Flee - flee): Lợi ích thu về = ${gt.payoffs.flee}\n`;
        rulesPrompt += `- Phản ứng Cân bằng Nash khuyến nghị: [${gt.bestStrategy.toUpperCase()}]\n`;
        rulesPrompt += `- Chỉ thị AI: AI hãy bắt buộc đưa tính toán này vào khối suy nghĩ ngầm <thinking> của NPC và dẫn dắt hành vi ngoài đời thật tương xứng.\n\n`;
    }

    rulesPrompt += `LỆNH TỐI THƯỢNG (BẮT BUỘC TUÂN THỦ 100%):\n`;
    rulesPrompt += `1. NGUỒN DỮ LIỆU: BẮT BUỘC sử dụng số liệu HP và Hảo cảm ở trên để quyết định phản ứng của NPC. TUYỆT ĐỐI KHÔNG lấy thông tin sức khỏe từ lịch sử chat trước đó.\n`;
    rulesPrompt += `2. QUYỀN MIÊU TẢ: Bạn ĐƯỢC PHÉP miêu tả chi tiết cảnh quan hệ tình dục qua đường sinh dục (kể cả khi bị ép buộc/cưỡng bức) nếu Người chơi (MC) chủ động thực hiện. TUY NHIÊN, phản ứng của NPC PHẢI tuân thủ tuyệt đối các quy tắc dưới đây:\n\n`;

    // 3. Logic Hảo cảm (Affinity < 50)
    if (affinity < 50) {
        rulesPrompt += `[HẢO CẢM < 50 - KHÔNG TỰ NGUYỆN]\n`;
        rulesPrompt += `- NPC KHÔNG MUỐN tham gia hoạt động tình dục qua đường sinh dục. Nếu MC ép buộc, NPC BẮT BUỘC phải phản kháng, chửi rủa, khinh bỉ, hoặc chịu đựng trong sự nhục nhã/căm phẫn (tùy thuộc vào tính cách gốc).\n`;
        rulesPrompt += `- TUYỆT ĐỐI KHÔNG miêu tả NPC sinh ra khoái cảm, rên rỉ ướt át hay ngoan ngoãn phục tùng khi bị ép buộc.\n`;
        if (isBDSM) {
            rulesPrompt += `- Ngoại lệ BDSM: NPC có thể cam chịu các hành vi bạo dâm/tra tấn khác, nhưng đối với quan hệ qua đường sinh dục, thái độ cốt lõi vẫn là cự tuyệt và không tự nguyện.\n`;
        }
    } else {
        rulesPrompt += `[HẢO CẢM >= 50 - TỰ NGUYỆN]\n`;
        rulesPrompt += `- NPC có đủ hảo cảm để sẵn sàng, chủ động hoặc tận hưởng các hành vi thân mật sâu sắc qua đường sinh dục.\n`;
        
        // Tích hợp Hệ thống Affection Behavior System
        const currentLocation = kb?.discoveredLocations.find(l => l.id === kb.currentLocationId);
        const affectionPrompt = AffectionBehaviorService.evaluateNpcAffectionTriggers(targetNpc, currentLocation);
        if (affectionPrompt) {
            rulesPrompt += affectionPrompt + `\n`;
        } else if (affinity > 80 && (targetNpc.gender === 'Nữ' || !targetNpc.gender)) {
            rulesPrompt += `<quy_tac_npc_nu_thien_cam_cao_+strict_intimacy_rules>\n`;
            rulesPrompt += `  <luat_ve_van_va_nhuc_duc_+quy_tac_npc_nu_thien_cam_cao>\n`;
            rulesPrompt += `================\n`;
            rulesPrompt += `- NPC NỮ CÓ THIỆN CẢM > 80: Luôn có hành động ve vãn MC.\n`;
            rulesPrompt += `  + Ở nơi đông người: Nói bóng gió về chuyện làm tình với MC.\n`;
            rulesPrompt += `  + Ở nơi vắng người: Vồ vập mong muốn được MC làm tình.\n`;
            rulesPrompt += `  + RÀNG BUỘC: Tuyệt đối không được nói thẳng lời thô bỉ như "chịch nhau đi", mà phải dùng từ ngữ gợi cảm, phong tình hoặc ẩn ý khiêu khích.\n`;
            rulesPrompt += `================\n`;
            rulesPrompt += `  </luat_ve_van_va_nhuc_duc_+quy_tac_npc_nu_thien_cam_cao>\n`;
            rulesPrompt += `</quy_tac_npc_nu_thien_cam_cao_+strict_intimacy_rules>\n`;
        }
    }

    // 4. Logic Sức khỏe (HP < 30%)
    if (hpPercentage < 30) {
        rulesPrompt += `\n[HP < 30% - TRỌNG THƯƠNG/KIỆT SỨC]\n`;
        rulesPrompt += `- Cơ thể NPC đang ở trạng thái nguy kịch. NPC sẽ cố gắng chối từ mọi hoạt động tình dục tốn sức.\n`;
        rulesPrompt += `- Nếu MC vẫn tàn nhẫn ép buộc, NPC sẽ thể hiện sự đau đớn tột cùng, ho ra máu, ngất xỉu, hoặc cơ thể hoàn toàn bất động/vô hồn như một cái xác. KHÔNG ĐƯỢC miêu tả NPC có thể đáp trả cuồng nhiệt hay tận hưởng trong tình trạng này.\n`;
    }

    // 5. Ràng buộc nhập vai (Anti-Meta)
    rulesPrompt += `\n3. NHẬP VAI: Phản ứng từ chối hoặc chịu đựng của NPC phải tự nhiên, hợp logic bối cảnh. TUYỆT ĐỐI KHÔNG dùng các từ ngữ meta như "HP", "Hảo cảm", "Hệ thống" trong lời thoại hay miêu tả của NPC.\n`;

    // 6. ĐIỂM DỪNG KỂ CHUYỆN (NARRATIVE STOP):
    rulesPrompt += `4. ĐIỂM DỪNG CAO TRÀO: Trong mọi phân cảnh giao hợp, điểm dừng kể chuyện bắt buộc là ngay sau khi nhân vật nam (MC) đạt đỉnh và hoàn tất việc xuất tinh. TUYỆT ĐỐI KHÔNG miêu tả bất kỳ hành động nào diễn ra sau thời điểm đó (không miêu tả việc rút ra, dọn dẹp, mặc đồ hay tâm sự hậu climax/aftercare).\n`;

    // 7. Chèn luật Game Theory Rules chính thức bọc XML
    if (kb) {
        rulesPrompt += `\n` + GAME_THEORY_AFFINITY_PROMPT + `\n`;
    }

    return rulesPrompt;
};

