import { KnowledgeBase, GameLocation } from '../types';

export const generateTravelPrompt = (
    kb: KnowledgeBase,
    currentLocation: GameLocation,
    targetLocation: GameLocation
): string => {
    const { worldConfig, playerStats } = kb;

    // Logic random sự kiện con khỉ (30%)
    let randomMonkeyEventInstruction = "";
    if (Math.random() < 0.3) {
        randomMonkeyEventInstruction = `
**SỰ KIỆN NGẪU NHIÊN ĐẶC BIỆT (BẮT BUỘC MÔ TẢ TRONG LỜI KỂ):**
- Trong quá trình di chuyển, nhân vật chính chứng kiến một cảnh tượng chấn động thiên địa: Một con khỉ khổng lồ cầm thiết bảng vung vẩy, khí thế kinh người bay ngang qua bầu trời.
- Con khỉ này tự xưng là **"Một sợi lông khỉ"** và miệng liên tục la lớn: **"ta bị hói rồi!"**.
- **QUAN TRỌNG:** Đây chỉ là một cảnh nền hài hước và kỳ lạ để tô điểm cho thế giới. Nhân vật chính chỉ nhìn thấy từ xa hoặc nó lướt qua rất nhanh. **TUYỆT ĐỐI KHÔNG** cho người chơi tương tác, nói chuyện hay chiến đấu với con khỉ này. **KHÔNG** tạo tag [NPC] cho con khỉ này. Nó chỉ xuất hiện và biến mất về phía chân trời.
`;
    }

    return `
Bạn là một AI kể chuyện trong một game nhập vai. Người chơi quyết định di chuyển từ địa điểm này đến địa điểm khác.

**BỐI CẢNH:**
- **Người chơi:** ${worldConfig?.playerName || 'Người chơi'}
- **Vị trí hiện tại:** "${currentLocation.name}"
- **Điểm đến:** "${targetLocation.name}"

${randomMonkeyEventInstruction}

**YÊU CẦU:**
1.  **TÍNH TOÁN THỜI GIAN (BẮT BUỘC):**
    *   Dựa vào mô tả 2 địa điểm, hãy quyết định một khoảng thời gian di chuyển hợp lý từ **2 đến 10 ngày**.
    *   Sử dụng tag **[CHANGE_TIME: ngay=X]** để thể hiện thời gian đã trôi qua. **X** phải là một số từ 2 đến 10.

2.  **VIẾT LỜI KỂ (RẤT ĐƠN GIẢN - 2 đến 3 CÂU):**
    *   Viết ngắn gọn mô tả chuyến đi${randomMonkeyEventInstruction ? " và sự kiện con khỉ kỳ lạ vừa gặp" : ""}.
    *   **Áp dụng kỹ thuật "cắt cảnh":** KHÔNG mô tả chi tiết hành trình, chỉ tóm tắt việc di chuyển đã hoàn tất.
    *   Câu kết: "Đã tốn X ngày." (X phải khớp với số ngày trong tag CHANGE_TIME).

3.  **CẬP NHẬT VỊ TRÍ (BẮT BUỘC):**
    *   Sử dụng tag **[LOCATION_CHANGE: name="${targetLocation.name}"]**.

4.  **TẠO LỰA CHỌN MỚI (BẮT BUỘC):**
    *   Cung cấp 3-4 lựa chọn **[CHOICE: "..."]** để người chơi bắt đầu hành động tại địa điểm mới.

5.  **LƯỢT CHƠI (TỰ ĐỘNG CẬP NHẬT):**
    *   Lượt chơi sẽ được hệ thống phần mềm tự động tăng cơ học, bạn TUYỆT ĐỐI CẤM sinh thêm tag STATS_UPDATE: turn=+1.

**VÍ DỤ HOÀN CHỈNH:**
Nhân vật chính đi tới ${targetLocation.name}. Đã tốn 2 ngày.

[CHANGE_TIME: ngay=2]
[LOCATION_CHANGE: name="${targetLocation.name}"]
[CHOICE: "Tìm một quán trọ để nghỉ ngơi và tắm rửa."]
[CHOICE: "Đi thẳng đến trung tâm để xem có gì đặc biệt không."]
[CHOICE: "Tìm một người dân địa phương để hỏi thăm về tình hình gần đây."]
`;
};