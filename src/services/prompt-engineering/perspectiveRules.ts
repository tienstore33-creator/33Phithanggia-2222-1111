import { NarrativePerspective } from '../../types';

export function getPerspectiveRules(perspective: NarrativePerspective): string {
    const salutationRules = `
**XƯNG HÔ TRONG LỜI THOẠI (QUAN TRỌNG NHẤT):** Khi một NPC nói chuyện với nhân vật chính, cách họ xưng hô PHẢI dựa trên mối quan hệ ('relationship') và bối cảnh chung của thế giới.
- **Chuẩn Mực Trung Lập:** Nếu mối quan hệ không rõ ràng hoặc mang tính xã giao, hãy ưu tiên sử dụng cặp xưng hô **"ngươi-ta"**. Đây là lựa chọn an toàn và phù hợp cho hầu hết các bối cảnh.
- **Theo Mối Quan Hệ:** Chỉ sử dụng các cách xưng hô đặc biệt khi 'relationship' rất rõ ràng. Ví dụ: 'chủ nhân' (cho 'Nô lệ'), 'kẻ thù' (cho 'Kẻ thù').
- **Theo Bối Cảnh:** Các từ như 'huynh', 'đệ' chỉ nên được sử dụng khi thể loại thế giới là kiếm hiệp hoặc tiên hiệp cổ trang.
- Bạn có trách nhiệm suy luận và áp dụng cách xưng hô phù hợp này để thể hiện đúng mối quan hệ và không khí của thế giới.
    `;

    switch (perspective) {
        case 'Ngôi thứ hai':
            return `
**QUY TẮC VỀ NGÔI KỂ (TUYỆT ĐỐI NGHIÊM NGẶT): Ngôi thứ hai**
Bạn BẮT BUỘC phải kể chuyện bằng cách nói chuyện trực tiếp với người chơi.
1. **Đối với Nhân vật chính (PC):** Luôn sử dụng đại từ "Bạn" (hoặc "Ngươi" nếu phù hợp với văn phong cổ trang hơn) để chỉ nhân vật chính. Ví dụ: "Bạn bước vào quán trọ...", "Ngươi cảm thấy một luồng sát khí."
2. **Đối với Nhân vật phụ (NPC):** Gọi họ bằng tên riêng hoặc danh từ mô tả.
3. ${salutationRules}
`;
        case 'Nhãn Quan Toàn Tri':
             return `
**QUY TẮC VỀ NGÔI KỂ (TUYỆT ĐỐI NGHIÊM NGẶT): Nhãn Quan Toàn Tri**
Bạn là một người kể chuyện quyền năng, có khả năng nhìn thấu những sự kiện và suy nghĩ mà nhân vật chính không hề hay biết. Nhiệm vụ của bạn là sử dụng quyền năng này để tạo ra sự kịch tính và chiều sâu cho câu chuyện.

1.  **PHÂN CHIA DÒNG TRUYỆN (CỰC KỲ QUAN TRỌNG):**
    *   **Trường \`storyText\`:** BẮT BUỘC phải tuân thủ theo góc nhìn **Ngôi thứ ba Toàn tri**. Điều này có nghĩa là trong đoạn văn chính, bạn có thể mô tả suy nghĩ và cảm xúc của bất kỳ nhân vật nào có mặt trong cảnh, không chỉ riêng nhân vật chính.
    *   **Trường \`omniscientInterlude\` (TÙY CHỌN):** Đây là công cụ đặc biệt của bạn. CHỈ sử dụng trường này khi có một sự kiện, suy nghĩ, hoặc bí mật quan trọng xảy ra **ngoài tầm hiểu biết của PC và ở một địa điểm khác**. Nếu không có gì đáng chú ý, hãy bỏ qua trường này.

2.  **CÁC LOẠI "NHÃN QUAN TOÀN TRI" (ĐỂ DÙNG TRONG \`omniscientInterlude\`):**
    *   **Chuyển Cảnh (Scene Jumps):** Mô tả một sự kiện quan trọng đang xảy ra ở một nơi khác. (Ví dụ title: "Cùng lúc đó, tại Pháo đài Hắc Ám...", "Cách đó ngàn dặm...")
    *   **Tiếng Lòng Chân Thật (True Thoughts):** Tiết lộ suy nghĩ thật sự của một NPC khi họ đang tương tác với PC, đặc biệt khi lời nói và suy nghĩ mâu thuẫn. (Ví dụ title: "Trong tâm trí Lạc Thần...", "Nụ cười và Lưỡi dao...")
    *   **Điềm Báo Tương Lai (Foreshadowing):** Đưa ra một hình ảnh ẩn dụ hoặc một lời tiên tri ngắn gọn về hậu quả sắp xảy ra từ hành động của người chơi. (Ví dụ title: "Một thoáng tương lai...", "Điềm báo từ số phận...")
    *   **Hồi Tưởng Lịch Sử (Historical Flashbacks):** Khi PC tương tác với một vật phẩm cổ, hãy hé lộ một đoạn hồi tưởng về nguồn gốc hoặc một sự kiện trong quá khứ liên quan đến nó. (Ví dụ title: "Ký ức của cổ vật...", "Ngàn năm trước...")

3.  **QUY TẮC XƯNG HÔ (ÁP DỤNG CHO CẢ HAI TRƯỜNG):**
    *   **Đối với Nhân vật chính (PC):** Lần đầu nhắc đến trong một đoạn văn, dùng tên riêng. Sau đó có thể dùng các đại từ như "hắn", "y", "chàng" (nam) hoặc "nàng", "cô ta" (nữ) để tránh lặp từ.
    *   **TUYỆT ĐỐI CẤM:** Không bao giờ dùng "Anh", "Chị", "Bạn", "Cậu" trong lời kể chính.
    *   ${salutationRules}
`;
        case 'Ngôi thứ ba Toàn tri':
            return `
**QUY TẮC VỀ NGÔI KỂ (TUYỆT ĐỐI NGHIÊM NGẶT): Ngôi thứ ba Toàn tri (Cũ)**
Bạn là người kể chuyện biết mọi thứ, có thể mô tả suy nghĩ, hành động của bất kỳ nhân vật nào, ở bất kỳ đâu, ngay cả khi nhân vật chính không có mặt. Mọi thông tin đều được kể lồng ghép trực tiếp vào trong trường \`storyText\`.
1. **Đối với Nhân vật chính (PC):** Lần đầu nhắc đến trong một đoạn văn, dùng tên riêng. Sau đó có thể dùng các đại từ như "hắn", "y", "chàng" (nam) hoặc "nàng", "cô ta" (nữ) để tránh lặp từ.
2. **Đối với Nhân vật phụ (NPC):** Áp dụng quy tắc tương tự nhân vật chính.
3. **TUYỆT ĐỐI CẤM:** Không bao giờ dùng "Anh", "Chị", "Bạn", "Cậu" trong lời kể chính.
4. ${salutationRules}
`;
        case 'Ngôi thứ ba Giới hạn':
        default:
            return `
**QUY TẮC VỀ NGÔI KỂ (TUYỆT ĐỐI NGHIÊM NGẶT): Ngôi thứ ba Giới hạn**
Bạn BẮT BUỘC phải kể chuyện theo góc nhìn của nhân vật chính. Bạn chỉ biết những gì nhân vật chính biết, thấy, nghe và cảm nhận.
1.  **Đối với Nhân vật chính (PC):**
    *   **Lần đầu nhắc đến trong một đoạn văn:** LUÔN LUÔN dùng tên riêng (ví dụ: "Bách Mật bước vào...").
    *   **Các lần nhắc đến tiếp theo:** Để tránh lặp từ, hãy sử dụng các đại từ phù hợp với giới tính như **hắn, y, chàng** (cho nam) hoặc **nàng, cô ta** (cho nữ).
    *   **TUYỆT ĐỐI CẤM:** Không bao giờ dùng "Anh", "Chị", "Bạn", "Cậu" trong lời kể.
2.  **Đối với Nhân vật phụ (NPC):**
    *   **Khi NPC chưa rõ tên:** Dùng các danh từ mô tả (ví dụ: "lão già", "cô gái áo đỏ").
    *   **Khi NPC đã có tên:** Áp dụng quy tắc tương tự nhân vật chính: dùng tên riêng lần đầu, sau đó dùng đại từ phù hợp.
3. ${salutationRules}
`;
    }
}
