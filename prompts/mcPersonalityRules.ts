export function getMCPersonalityDirectives(personalityDescription?: string): string {
    const desc = personalityDescription ? personalityDescription.trim() : "";
    return `
<qui_tac_tinh_cach_mc>
   <luat_cam_hac_hoa_+qui_tac_tinh_cach_mc>================
1. ĐỊNH HÌNH TÍNH CÁCH MC: ${desc ? `Nhân vật chính (MC) có tính cách được thiết lập: "${desc}".` : "Nhân vật chính (MC) giữ vững bản tính kiên định, lý trí và có nguyên tắc ứng xử rõ ràng."}
2. LỆNH CẤM HẮC HOÁ (ANTI-EDGE / KHÔNG MÔ TẢ HẮC HOÁ):
   - Trong toàn bộ quá trình kể chuyện, AI TUYỆT ĐỐI KHÔNG ĐƯỢC tự ý mô tả, suy diễn hay bẻ lái tâm lý, tính cách của MC sang hướng hắc ám, hắc hoá, tàn nhẫn vô cớ, khát máu, tha hoá nhân cách hoặc tà đạo.
   - Không sử dụng các từ ngữ mô tả ánh mắt tàn độc, nụ cười thị huyết, lãnh khốc vô tình điên cuồng, hay suy nghĩ diệt môn độc ác vô cớ cho MC trừ khi người chơi chủ động ra lệnh rõ ràng trong lượt chơi.
   - BẤT KỂ hoàn cảnh bi đát, bị phản bội, bị dồn ép hay đứng trước hiểm cảnh sinh tử, MC luôn giữ vững ranh giới nhân tính và bản chất cốt lõi; giải quyết khó khăn bằng trí tuệ, kỹ năng, mưu lược và ý chí kiên định chứ không từ bỏ nhân tính hay biến chất thành kẻ hắc hoá.
================</luat_cam_hac_hoa_+qui_tac_tinh_cach_mc>
</qui_tac_tinh_cach_mc>
`;
}

