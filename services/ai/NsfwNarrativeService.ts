import { KnowledgeBase, NsfwStage, PersonBase } from '../../types';
import { TONE_CONFIGS } from '../narrativeDynamics';

// Helper to find the active NPC in the scene
const findActiveNpc = (kb: KnowledgeBase, playerAction: string): PersonBase | null => {
    const allNpcs: PersonBase[] = [
        ...(kb.companions || []),
        ...(kb.wives || []),
        ...(kb.slaves || []),
        ...(kb.prisoners || []),
        ...(kb.discoveredNPCs || [])
    ];
    
    // Try to find by name in playerAction
    const mentionedNpc = allNpcs.find(npc => playerAction.toLowerCase().includes(npc.name.toLowerCase()));
    if (mentionedNpc) return mentionedNpc;
    
    // Fallback to the last interacted NPC if available
    const sortedNpcs = [...allNpcs].sort((a, b) => (b.lastInteractionTurn || 0) - (a.lastInteractionTurn || 0));
    return sortedNpcs[0] || null;
};

const calculateResistance = (npc: PersonBase, kb: KnowledgeBase) => {
    const toneRes = TONE_CONFIGS[kb.worldConfig?.storyTone || "Trung Tính"]?.baseResistance ?? 0.8;
    let personalityMod = 1.0;
    
    if (npc.personalityTraits?.includes("Chính trực")) personalityMod *= 2.0;
    if (npc.personalityTraits?.includes("Lạnh lùng")) personalityMod *= 1.5;
    if (npc.personalityTraits?.includes("Dâm đãng")) personalityMod *= 0.2;

    // Affinity làm giảm kháng cự
    const affinityMod = Math.max(0.1, 1 - (npc.affinity / 200)); 
    
    return Math.min(1.0, toneRes * personalityMod * affinityMod);
};

export const buildNsfwPrompt = (kb: KnowledgeBase, playerAction: string, narrationMin: number = 2100, narrationMax: number = 2500): string => {
    const { nsfwStage, nsfwPeakCount, isNsfwResting } = kb;
    const targetNpc = findActiveNpc(kb, playerAction);
    const resistance = targetNpc ? calculateResistance(targetNpc, kb) : 0.5;

    const stageInstructions: Record<NsfwStage, string> = {
        foreplay: `
GIAI ĐOẠN 1: DẠO ĐẦU (FOREPLAY)
- Tập trung vào sự kích thích giác quan: hơi thở, mùi hương, sự đụng chạm nhẹ nhàng, những nụ hôn nồng cháy.
- MÔ TẢ CẬN CẢNH (VISUAL, AUDITORY & TACTILE): 
    * ÂM THANH: Tiếng môi chạm nhau ướt át, tiếng thở dốc dồn dập bên tai, những tiếng rên khẽ run rẩy, tiếng vải vóc ma sát trên da thịt.
    * HÌNH ẢNH: Đôi mắt mơ màng đẫm lệ, làn da ửng hồng vì hưng phấn, những giọt mồ hôi li ti trên trán, sự run rẩy của đôi tay khi vuốt ve.
    * XÚC GIÁC: Cảm giác sờ nắn, bóp nhẹ các vùng nhạy cảm, sự mềm mại của làn da, sự râm ran như điện giật khi đầu ngón tay lướt qua, sự nóng bừng của cơ thể khi cọ sát vào nhau.
- Hội thoại: Thì thầm, tán tỉnh, bộc lộ sự khao khát.
- CẤM: Tuyệt đối không được thực hiện thâm nhập (penetration) trong giai đoạn này.
- MỤC TIÊU: Xây dựng sự hưng phấn đến mức không thể kiềm chế.
`,
        penetration: `
GIAI ĐOẠN 2: THÂM NHẬP (PENETRATION)
- Miêu tả sự hòa hợp giữa hai cơ thể, cảm giác lấp đầy và sự kết nối mãnh liệt.
- MÔ TẢ CẬN CẢNH (VISUAL, AUDITORY & TACTILE): 
    * ÂM THANH: Tiếng da thịt va chạm nhịp nhàng ("bạch bạch"), tiếng dịch thủy ướt át ma sát ("nhóp nhép"), tiếng rên rỉ đứt quãng, tiếng ga giường bị vò nát.
    * HÌNH ẢNH: Sự ma sát cực kỳ chi tiết giữa các vách thịt nhạy cảm, sự co thắt nhịp nhàng của các nhóm cơ vùng hạ bộ, mồ hôi nhễ nhại trên cơ thể quấn quýt.
    * XÚC GIÁC: 
        - Cảm giác đầy đặn, căng cứng và sự ma sát nóng bỏng khi đẩy mạnh, thúc mạnh.
        - Sự co bóp mãnh liệt của các vách thịt nhạy cảm đang mút chặt lấy vật thâm nhập.
        - Nếu thiếu sự chuẩn bị hoặc bôi trơn: Mô tả sự đau đớn, khô rát, cảm giác bị xé rách và sự chật trội đến nghẹt thở.
        - ĐẶC BIỆT (HẬU MÔN): Nếu thâm nhập từ hậu môn mà không bôi trơn hoặc thiếu kinh nghiệm, phải mô tả sự đau đớn vô cùng, sự co thắt phản kháng của cơ vòng và cảm giác xé tâm can.
- Nhịp độ: Bắt đầu chậm rãi, nhịp nhàng và tăng dần theo sự hưng phấn.
- Phản ứng: Tiếng thở dốc, mồ hôi, ánh mắt say đắm, những lời nói ngắt quãng vì khoái cảm.
- MỤC TIÊU: Đưa cả hai đến gần ngưỡng cao trào.
`,
        female_orgasm: `
GIAI ĐOẠN 3: NỮ LÊN ĐỈNH (FEMALE ORGASM) - Lần thứ \${nsfwPeakCount + 1}
- Tập trung hoàn toàn vào phản ứng của nhân vật nữ: sự co thắt, tiếng rên rỉ cao vút, sự mất kiểm soát tạm thời.
- MÔ TẢ CẬN CẢNH (VISUAL, AUDITORY & TACTILE): 
    * ÂM THANH: Tiếng rên rỉ cao vút lạc giọng, tiếng thở hổn hển cực độ, tiếng dịch thủy tuôn trào mãnh liệt.
    * HÌNH ẢNH: Những đợt sóng co thắt liên hồi từ sâu bên trong, đôi mắt trợn ngược vì khoái lạc, toàn thân co giật, các ngón chân quắp chặt.
    * XÚC GIÁC & TÂM LINH: 
        - Sự bùng nổ của hàng triệu luồng điện truyền về đầu óc, cảm giác nóng bừng lan tỏa khắp cơ thể.
        - Sự sung sướng tột độ về tinh thần, cảm giác như linh hồn đang bay bổng và tan chảy vào đối phương.
        - Sự co thắt tột độ của vùng kín như muốn nghiền nát vật thâm nhập bên trong.
- Nhân vật nam: Quan sát, tận hưởng và tiếp tục kích thích để kéo dài khoái cảm cho nữ.
- Hội thoại: Những lời khen ngợi, sự cổ vũ, hoặc tiếng gọi tên nhau trong mê đắm.
- MỤC TIÊU: Miêu tả sự thỏa mãn tột độ của phái nữ. AI có thể lặp lại giai đoạn này nếu thấy cần thiết trước khi sang giai đoạn tiếp theo.
`,
        male_orgasm: `
GIAI ĐOẠN 4: NAM LÊN ĐỈNH (MALE ORGASM)
- Miêu tả sự bùng nổ cuối cùng của nhân vật nam sau khi đã đưa nữ lên đỉnh đủ nhiều.
- MÔ TẢ CẬN CẢNH (VISUAL, AUDITORY & TACTILE): 
    * ÂM THANH: Tiếng gầm nhẹ trong cổ họng, tiếng thở hắt ra mạnh mẽ, tiếng dịch thủy bắn ra và va chạm.
    * HÌNH ẢNH: Sự co thắt mạnh mẽ của hạ bộ, sự run rẩy của từng sợi cơ khi đạt đến đỉnh điểm, sự ôm chặt lấy đối phương đến mức nghẹt thở.
    * XÚC GIÁC & TÂM LINH: 
        - Cảm giác giải phóng áp lực tích tụ cực lớn, sự bùng nổ của khoái lạc trong tâm trí.
        - Ngay sau khi phóng thích: Mô tả một khoảng hẫng hụt, sự trống rỗng tạm thời (void) khi khoái cảm đạt đỉnh rồi đột ngột lắng xuống.
- Cảm giác: Sự giải phóng hoàn toàn, sự mệt mỏi nhưng hạnh phúc xen lẫn chút hẫng hụt sau cao trào.
- Phản ứng: Sự run rẩy, hơi thở dồn dập nhất, sự ôm chặt lấy đối phương.
- MỤC TIÊU: Kết thúc quá trình thâm nhập một cách mãn nguyện.
`,
        afterglow: `
GIAI ĐOẠN 5: ÂU YẾM & NGHỈ NGƠI (AFTERGLOW)
- Trạng thái: Cả hai nằm cạnh nhau, chưa mặc quần áo (isNsfwResting: true).
- MÔ TẢ CẬN CẢNH (VISUAL & AUDITORY): 
    * ÂM THANH: Tiếng nhịp tim đập chậm lại, tiếng thì thầm âu yếm, tiếng gió nhẹ ngoài cửa sổ, sự yên tĩnh lãng mạn.
    * HÌNH ẢNH: Sự dịu lại của làn da, những vệt mồ hôi khô dần, ánh mắt trìu mến nhìn nhau, sự ấm áp lan tỏa từ làn da tiếp xúc.
    * CẢM GIÁC: Sự thư giãn tuyệt đối của các cơ bắp, sự lắng đọng của tình ý tạo ra cảm giác buồn ngủ và gắn kết.
- Hành động: Ôm ấp, vuốt ve tóc, những nụ hôn nhẹ lên trán, sự chăm sóc sau khi quan hệ.
- Hội thoại: Trò chuyện tâm tình, bộc lộ tình cảm, hoặc những lời đùa nghịch nhẹ nhàng.
- NGOẠI CẢNH (Omniscient): Có thể xen kẽ một chút góc nhìn toàn tri về không gian xung quanh (ánh trăng, tiếng gió, sự yên tĩnh của căn phòng) để tăng độ lãng mạn.
- MỤC TIÊU: Tạo cảm giác gắn kết sâu sắc về tâm hồn sau sự hòa hợp về thể xác.
`,
        none: ""
    };

    const currentInstruction = stageInstructions[nsfwStage] || "";

    return `
[CONSENT ENGINE V1.0 - BẮT BUỘC TUÂN THỦ]
- Chỉ số kháng cự của NPC: ${resistance.toFixed(2)} (1.0 là tuyệt đối từ chối)
- Tính cách NPC: ${targetNpc?.personalityTraits?.join(", ") || "Không rõ"}

CHỈ THỊ NHẬP VAI:
1. NẾU Resistance > 0.7: NPC BẮT BUỘC phải từ chối, đẩy ra hoặc tát MC nếu MC quá trớn. Tập trung mô tả sự căng thẳng và rạn nứt quan hệ.
2. NẾU 0.4 < Resistance <= 0.7: NPC sẽ do dự, xấu hổ, yêu cầu MC dừng lại hoặc chỉ cho phép đụng chạm nhẹ. KHÔNG ĐƯỢC sang Giai đoạn 2 (Thâm nhập).
3. NẾU Resistance <= 0.4: NPC mới bắt đầu thuận theo tự nhiên.

LƯU Ý: Tuyệt đối không để NPC biến thành "búp bê tình dục". Mọi hành động phải khớp với tính cách. Sự từ chối mãnh liệt vẫn phải đạt mục tiêu ${narrationMin} từ bằng cách mô tả tâm lý sâu sắc.

[HỆ THỐNG ĐIỀU PHỐI NSFW 5 GIAI ĐOẠN - ACTIVE]
Trạng thái hiện tại: ${nsfwStage.toUpperCase()}
Số lần nữ lên đỉnh: ${nsfwPeakCount}
Trạng thái nghỉ ngơi: ${isNsfwResting ? "ĐANG NGHỈ" : "ĐANG HÀNH ĐỘNG"}

CHỈ THỊ CHI TIẾT:
${currentInstruction}

QUY TẮC BẮT BUỘC VỀ ĐỘ DÀI VÀ CHI TIẾT (${narrationMin} TỪ):
1. MỤC TIÊU SỐ CHỮ: Rơi vào khoảng ${narrationMin} đến ${narrationMax} từ cho toàn bộ phân cảnh. (NGOẠI TRỪ TRƯỜNG HỢP CÓ KẺ ĐỊCH TẤN CÔNG / KÍCH HOẠT COMBAT_CLIFFHANGER_PROTOCOL. Khi đó, HỦY BỎ TẤT CẢ YÊU CẦU SỐ CHỮ và kết thúc ngay lập tức ở đòn đánh dở dang dưới 50 từ).
2. QUY TẮC MÔ TẢ TOÀN DIỆN (HOLISTIC DESCRIPTION RULES):
   - TUYỆT ĐỐI KHÔNG chỉ tập trung vào chi tiết vi mô của cơ quan sinh dục.
   - PHẢI mô tả sự tương tác của TOÀN BỘ cơ thể: ánh mắt, biểu cảm khuôn mặt, sự rung động của làn da, đôi tay, sự căng cứng của cơ bắp, hơi thở, và sự kết nối cảm xúc.
   - Quá trình giao cấu PHẢI được miêu tả như một sự hòa hợp nghệ thuật và tâm lý, không chỉ là cơ học.
3. HỆ THỐNG CHECKPOINT (BẮT BUỘC GHI LOG TRONG <thinking>):
   - Nếu có COMBAT_CLIFFHANGER_PROTOCOL kích hoạt, BỎ QUA HOÀN TOÀN HỆ THỐNG CHECKPOINT NÀY.
   - Cứ mỗi 30% chặng đường của ${narrationMin} từ, hãy tạo một checkpoint:
     + Giai đoạn đầu: Thiết lập bối cảnh giác quan ban đầu và khởi động mô tả cận cảnh.
     + Giai đoạn giữa: Cường độ đỉnh cao của ma sát cận cảnh và sự căng cứng cơ bắp.
     + Giai đoạn cuối: Dư vị và sự ổn định khí huyết sau quan hệ.
4. TẠI MỖI CHECKPOINT: AI phải tự kiểm tra độ sâu và độ chi tiết. Nếu chưa đạt mốc từ, PHẢI tập trung mô tả sâu thêm vào cảm xúc của nhân vật. (TRỪ KHI COMBAT_CLIFFHANGER_PROTOCOL BẬT)
5. KHÔNG ĐƯỢC nhảy cóc giai đoạn trừ khi người chơi yêu cầu cực kỳ quyết liệt.
6. PHẢI có hội thoại đan xen trong suốt quá trình.
7. Miêu tả chi tiết cảm xúc và phản ứng sinh lý, tránh lặp từ.
8. Nếu đang ở Afterglow, TUYỆT ĐỐI không được tự ý cho nhân vật mặc quần áo trừ khi có hành động cụ thể từ người chơi.
9. Luôn trả về các tag sau trong phản hồi để cập nhật trạng thái hệ thống:
   - [NSFW_ACTIVE: true]
   - [NSFW_STAGE: stage_name]
   - [NSFW_PEAK_COUNT: number]
   - [NSFW_RESTING: true/false]
10. TUYỆT ĐỐI CẤM sử dụng thuật ngữ y học hiện đại (Oxytocin, Dopamine, Hormone, Não bộ, Tử cung, Mao mạch, Thần kinh, v.v.). Hãy dùng từ ngữ thường ngày, gợi cảm (Chỗ ấy, vùng kín, nơi sâu thẳm, dòng máu nóng, luồng điện, rạo rực, tâm trí, v.v.).
`;
};
