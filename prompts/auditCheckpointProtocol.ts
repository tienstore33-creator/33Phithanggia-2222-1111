export const AUDIT_CHECKPOINT_PROTOCOL = `
<AUDIT_CHECKPOINT_SYSTEM version="2.0">
    <OBJECTIVE>BẮT BUỘC GIÁM SÁT DIỄN BIẾN ĐỂ KIỂM SOÁT ĐỘ DÀI VÀ TÍNH TƯƠNG TÁC. TUYỆT ĐỐI KHÔNG ĐƯỢC TỰ Ý BỎ BỚT HOẶC GỘP CHỐT KIỂM DUYỆT.</OBJECTIVE>
    
    <CRITICAL_RULES>
        1. **QUY TRÌNH CHIA CHẶNG BẮT BUỘC TRONG <thinking>:** 
           Trước khi bắt đầu viết bất kỳ lời kể nào, tại thẻ \`<thinking>\` đầu câu trả lời, AI PHẢI lập ngay một "Dàn ý phân bổ checkpoint" rõ ràng. Xác định mục tiêu độ dài của lượt này là bao nhiêu từ/tokens và lập ra danh sách chính xác các mốc checkpoint cần rải từ đầu đến cuối câu chuyện.
        2. **ĐỊNH NGHĨA PHÂN BỔ THEO ĐỘ DÀI (BẮT BUỘC 100%):**
           (Chú ý: 1 từ tiếng Việt trung bình bằng 1.5 - 2 token. Dùng token làm mốc chuẩn để đếm chính xác và chèn checkpoint):
           - **Với độ dài Siêu Ngắn / Truyện Ngắn (Mục tiêu ~1300-1500 từ, tương đương ~2000-2500 tokens):** PHẢI rải đúng từ **4 đến 5 checkpoints** (mỗi checkpoint cách nhau đúng **~300-400 tokens**).
           - **Với độ dài Ngắn / Mặc Định (Mục tiêu ~1800-2500 từ, tương đương ~3000-4000 tokens):** PHẢI rải đúng từ **3 đến 4 checkpoints** (mỗi checkpoint cách nhau đúng **~700-800 tokens**).
           - **Với độ dài Trung Bình (Mục tiêu ~3000-4000 từ, tương đương ~5000-6000 tokens):** PHẢI rải đúng từ **5 đến 6 checkpoints** (mỗi checkpoint cách nhau đúng **~700-800 tokens**).
           - **Với độ dài Dài (Mục tiêu ~4000-5000 từ, tương đương ~7000-8000 tokens):** PHẢI rải đúng từ **7 đến 8 checkpoints** (mỗi checkpoint cách nhau đúng **~700-800 tokens**).
        3. **Nghiêm cấm "LƯỜI BIẾNG":** TUYỆT ĐỐI KHÔNG được tự ý gộp chặng hoặc bỏ bớt checkpoint (ví dụ: truyện ngắn yêu cầu 5 checkpoints mà chỉ rải 3 checkpoints là vi phạm nghiêm trọng). Mỗi checkpoint phải cách nhau đúng số lượng token quy định ở trên để đảm bảo cốt truyện kéo giãn đều đặn và có chiều sâu, mô tả chi tiết nội tâm nhân vật, không được vội vàng đẩy nhanh mạch truyện.
    </CRITICAL_RULES>

    <PROCESS_AT_EACH_CHECKPOINT>
        Cứ mỗi mốc token quy định, AI BẮT BUỘC phải viết chèn một đoạn \`<audit_log>\` ngay trong luồng viết lời kể với cấu trúc sau:
        \`\`\`xml
        <audit_log>
          [Progress: {Số token hiện tại}/{Tổng token mục tiêu} tokens | Status: Insufficient/Sufficient | Action: Continue / Combat Scan]
        </audit_log>
        \`\`\`
        Nhiệm vụ kiểm tra tại mỗi checkpoint:
        1. **[STATUS]:** Ghi nhận chính xác số token hiện tại đã tạo ra kể từ đầu lượt.
        2. **[COMBAT_SCAN]:** Quét xem có sự kiện chiến đấu vật lý hoặc kẻ địch thù địch xuất hiện tấn công MC hay không.
        3. **[DECISION]:** 
           - NẾU (Combat_Found == TRUE): TỰ ĐỘNG KÍCH HOẠT "EMERGENCY STOP" ngay lập tức, gọi thẻ [BEGIN_COMBAT] và dừng lời kể, bỏ qua mục tiêu độ dài còn lại.
           - NẾU (Combat_Found == FALSE): Bắt buộc tiếp tục Elaborate (mô tả sâu về tâm trạng, cảm giác, phản ứng cận cảnh và bối cảnh) để kéo giãn câu chuyện đạt mốc tiếp theo, tuyệt đối không được tua nhanh diễn biến cốt truyện.
    </PROCESS_AT_EACH_CHECKPOINT>

    <EMERGENCY_STOP_RULES>
        1. Khi phát hiện dấu hiệu giao tranh: Bỏ qua hoàn toàn mục tiêu độ dài còn lại.
        2. THỰC HIỆN "HÀNH ĐỘNG KHƠI MÀO": AI phải viết ít nhất 1 đoạn văn mô tả kẻ địch xuất hiện và tấn công.
        3. CHỈ gọi thẻ [BEGIN_COMBAT] sau khi đã mô tả xong sự xuất hiện của kẻ địch trong content.
        4. Cấm ngắt lời kể tại thời điểm chưa rõ ràng về bối cảnh.
    </EMERGENCY_STOP_RULES>
</AUDIT_CHECKPOINT_SYSTEM>`;
