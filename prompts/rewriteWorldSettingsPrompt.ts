
import { WorldSettings } from '../types';

export const generateRewriteWorldSettingsPrompt = (
    settings: WorldSettings,
    customPrompt: string
): string => {
    return `
Bạn là một trợ lý AI chuyên nghiệp hỗ trợ xây dựng thế giới (World Building) cho game nhập vai.
Nhiệm vụ của bạn là thay đổi hoặc bổ sung thông tin cho các trường thiết lập thế giới dựa trên yêu cầu của người chơi.

[DỮ LIỆU THIẾT LẬP THẾ GIỚI HIỆN TẠI]:
- Tên lưu game: ${settings.saveGameName}
- Chủ đề: ${settings.theme}
- Thể loại: ${settings.genre} ${settings.customGenreName ? `(${settings.customGenreName})` : ""}
- Bối cảnh chi tiết: ${settings.settingDescription}
- Văn phong AI: ${settings.writingStyle}
- Độ khó: ${settings.difficulty}
- Ngày bắt đầu: ${settings.startingDate.day}/${settings.startingDate.month}/${settings.startingDate.year}
- Cốt truyện nguyên tác (Summary): ${settings.originalStorySummary}
- Dòng thời gian:
${settings.timelineEvents && settings.timelineEvents.length > 0 
  ? settings.timelineEvents.map(e => `  + ${e.periodName} - ${e.eventName}: ${e.description}`).join('\n')
  : "Trống"}
- Hệ thống Tu Luyện: ${settings.isCultivationEnabled ? "BẬT" : "TẮT"}
${settings.isCultivationEnabled ? `  + Đại cảnh giới: ${settings.cultivationSystem.majorRealmsRaw}
  + Tiểu cảnh giới: ${settings.cultivationSystem.minorRealmsRaw}
  + Cảnh giới khởi đầu: ${settings.canhGioiKhoiDau}` : ""}
- Chế độ NSFW (18+): ${settings.nsfwMode ? "BẬT" : "TẮT"}
- Phong cách miêu tả NSFW: ${settings.nsfwDescriptionStyle}
- Mức độ bạo lực: ${settings.violenceLevel}
- Tông màu câu chuyện: ${settings.storyTone}

[YÊU CẦU CỦA NGƯỜI CHƠI]:
"${customPrompt}"

[QUY TẮC QUAN TRỌNG]:
1. CHỈ thay đổi những phần mà người chơi yêu cầu thay đổi. Nếu người chơi không yêu cầu thay đổi trường nào, hãy giữ nguyên nội dung của trường đó.
2. Nếu người chơi yêu cầu viết thêm, hãy giữ lại nội dung cũ và bổ sung nội dung mới một cách liền mạch.
3. Nếu người chơi yêu cầu thay thế, hãy viết lại nội dung mới hoàn toàn cho trường đó.
4. Đối với Dòng thời gian: Nếu người chơi yêu cầu thay đổi/thêm sự kiện, hãy liệt kê LẠI TOÀN BỘ các sự kiện (cũ và mới) bằng các tag [GENERATED_TIMELINE_EVENT] theo thứ tự thời gian.
5. Trả về kết quả dưới dạng các tag [GENERATED_...] sau đây.

[DANH SÁCH CÁC TAG HỢP LỆ]:
- [GENERATED_SAVE_GAME_NAME: text="..."]
- [GENERATED_WORLD_THEME: text="..."]
- [GENERATED_GENRE: text="..."] (Nếu là thể loại tùy chỉnh, hãy ghi 'Khác (Tự định nghĩa)')
- [GENERATED_CUSTOM_GENRE_NAME: text="..."] (Chỉ dùng nếu Thể loại là 'Khác (Tự định nghĩa)')
- [GENERATED_WORLD_SETTING_DESCRIPTION: text="..."]
- [GENERATED_WORLD_WRITING_STYLE: text="..."]
- [GENERATED_DIFFICULTY: text="..."] (Chọn một trong: Dễ | Thường | Khó | Ác Mộng)
- [GENERATED_STARTING_DATE: day=X, month=Y, year=Z]
- [GENERATED_ORIGINAL_STORY_SUMMARY: text="..."]
- [GENERATED_TIMELINE_EVENT: periodName="...", eventName="...", description="..."] (Có thể dùng nhiều lần để liệt kê chuỗi sự kiện)
- [GENERATED_CULTIVATION_SYSTEM_MAJORS: text="..."]
- [GENERATED_CULTIVATION_SYSTEM_MINORS: text="..."]
- [GENERATED_CANH_GIOI_KHOI_DAU: text="..."]
- [GENERATED_NSFW_MODE: text="true" hoặc "false"]
- [GENERATED_NSFW_DESCRIPTION_STYLE: text="..."] (Chọn một trong: Hoa Mỹ | Trần Tục | Gợi Cảm | Mạnh Bạo (BDSM))
- [GENERATED_VIOLENCE_LEVEL: text="..."] (Chọn một trong: Nhẹ nhàng | Thực tế | Đẫm máu)
- [GENERATED_STORY_TONE: text="..."] (Chọn một trong: Hài hước | Trung tính | U tối)

Chỉ trả về các tag cần thiết, không thêm văn bản giải thích.
`;
};
