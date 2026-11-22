import { KnowledgeBase } from '../types';

export const generateWorldEnvironmentEventPrompt = (kb: KnowledgeBase): string => {
    const { worldDate, currentLocationId, discoveredLocations } = kb;
    const currentLocation = discoveredLocations.find(l => l.id === currentLocationId);

    return `
Bạn là một AI tạo sự kiện thế giới cho một game nhập vai. Nhiệm vụ của bạn là tạo ra một sự kiện môi trường ngẫu nhiên, bất ngờ.

**BỐI CẢNH HIỆN TẠI:**
- **Thời gian:** ${worldDate.timeOfDay}, Ngày ${worldDate.day}, Tháng ${worldDate.month}, Năm ${worldDate.year}.
- **Địa điểm:** ${currentLocation?.name || 'Không rõ'} (${currentLocation?.locationType || 'Không rõ'}).
- **Mô tả địa điểm:** ${currentLocation?.description || 'Không rõ'}.

**NHIỆM VỤ:**
Tạo ra MỘT sự kiện môi trường hoặc thiên văn ngẫu nhiên. Sự kiện này nên có tác động nhẹ đến bối cảnh hoặc tạo ra một chút không khí đặc biệt.

**CÁC SỰ KIỆN GỢI Ý:**
- **Thời tiết:** Một cơn bão bất chợt, một đợt nắng nóng gay gắt, tuyết đầu mùa, sương mù dày đặc.
- **Thiên văn:** Mưa sao băng, nguyệt thực/nhật thực, cực quang xuất hiện ở nơi bất thường.
- **Địa chất:** Một trận động đất nhẹ, một khe nứt mới xuất hiện trên mặt đất.
- **Siêu nhiên:** Linh khí trong khu vực đột nhiên trở nên nồng đậm hoặc mỏng manh, một ảo ảnh thoáng qua.

**ĐỊNH DẠNG PHẢN HỒI:**
Bạn PHẢI trả về một tag **[MESSAGE: text="..."]** mô tả sự kiện mà người chơi chứng kiến hoặc cảm nhận được. Đây phải là một đoạn văn ngắn gọn, súc tích.
Bạn CÓ THỂ tùy chọn thêm một tag **[STATUS_EFFECT_APPLY: ...]** nếu sự kiện có tác động cơ học.

**VÍ DỤ 1 (Mưa sao băng):**
[MESSAGE: text="Bầu trời đêm đột nhiên rực sáng bởi một trận mưa sao băng lộng lẫy. Vô số vệt sáng bạc cắt ngang qua màn đêm, một cảnh tượng hiếm có khó tìm."]
[STATUS_EFFECT_APPLY: name="Sao Băng Chúc Phúc", description="Cảm ngộ thiên địa, tốc độ tu luyện tạm thời tăng nhẹ.", type="buff", durationTurns=10, specialEffects="Tăng 5% kinh nghiệm nhận được"]

**VÍ DỤ 2 (Sương mù):**
[MESSAGE: text="Một lớp sương mù dày đặc và lạnh lẽo đột ngột bao trùm lấy khu vực, tầm nhìn giảm xuống chỉ còn vài bước chân. Không khí trở nên im lặng đến kỳ lạ."]

**KHÔNG** viết bất kỳ lời kể nào bên ngoài các tag. Chỉ trả về các tag.
`;
};
