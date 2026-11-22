import { NATIVE_LANGUAGE_REASONING_RULE } from './promptTaskHelpers';

export const generateTimelineEventsPrompt = (
    originalStorySummary: string,
    worldTheme: string,
    canonData?: string,
    accuracyContext?: string
): string => `
<generate_timeline_events_prompt_+prompts>
================
Bạn là một trợ lý AI chuyên tạo kịch bản cho game nhập vai.

${NATIVE_LANGUAGE_REASONING_RULE}

Nhiệm vụ của bạn là trích xuất và tạo ra một Dòng Thời Gian (Timeline) chi tiết dựa trên phần tên Nguyên tác được cung cấp.

Tác phẩm/Chủ đề: ${worldTheme}

Tóm Tắt Cốt Truyện Cần Dựa Vào:
"""
${originalStorySummary || worldTheme}
"""

${accuracyContext ? `
[DỮ LIỆU TRA CỨU BẢN ĐỊA BẰNG GOOGLE SEARCH]
Bạn MUST sử dụng dữ liệu đối chiếu từ tìm kiếm trực tuyến bản địa dưới đây để đảm bảo tên nhân vật, thứ tự thời gian và diễn biến các sự kiện HOÀN TOÀN CHÍNH XÁC NGUYÊN TÁC:
<ACCURACY_CONTEXT>
${accuracyContext}
</ACCURACY_CONTEXT>
` : ""}

${canonData ? `
[CHÚ Ý] Bạn có thêm dữ liệu gốc sau đây để có thể tham khảo bổ sung.
<CANON_DATA>
${canonData}
</CANON_DATA>
` : ""}

YÊU CẦU:
1. Liệt kê toàn bộ/Tóm tắt chi tiết 10 sự kiện xảy ra đầu tiên của nguyên tác theo đúng thứ tự thời gian nguyên bản. Bao gồm cả sự kiện phụ chính, sự kiện phụ lớn, nhân vật phụ.

**Nguyên tắc bắt buộc:**
- Mỗi sự kiện chỉ được mô tả MỘT biến cố hoặc cột mốc cụ thể, riêng lẻ. Tuyệt đối không được gộp nhiều sự kiện hoặc cả một giai đoạn kéo dài nhiều sự kiện vào chung một dòng.
- Mỗi sự kiện phải chia rõ Đại Thời Kỳ (VD: "Sơ Nhập Tu Tiên", "Chiến Quốc", "Kỷ Nguyên Mới") và Tên Sự Kiện Quan Trọng, kèm theo địa điểm diễn ra, danh sách nhân vật tham gia, và hành động hoặc cột mốc mấu chốt bắt buộc người chơi phải đạt được để phân giải sự kiện đó.
- Trả về đúng định dạng tag dưới đây, và CHỈ trả về đúng định dạng này, không kèm chữ giải thích phụ. TUYỆT ĐỐI KHÔNG ĐƯỢC sinh ra dấu ba chấm "..." trong các giá trị thuộc tính, mọi trường đều phải chứa dữ liệu thực tế:

[GENERATED_TIMELINE_EVENT: periodName="Sơ Nhập Giang Hồ" eventName="Thức Tỉnh Võ Hồn" description="Đường Tam tiến hành thức tỉnh Võ Hồn Lam Ngân Thảo dưới sự giúp đỡ của Tố Vân Đào" location="Thôn Thánh Hồn" characters="Đường Tam, Tố Vân Đào" requiredAction="Thức tỉnh Võ Hồn và bộc lộ Tiên Thiên Mãn Hồn Lực"]
[GENERATED_TIMELINE_EVENT: periodName="Sơ Nhập Giang Hồ" eventName="Bái Sư Đại Sư" description="Đường Tam gia nhập học viện Nặc Đinh và chính thức bái Ngọc Tiểu Cương làm sư phụ" location="Học Viện Nặc Đinh" characters="Đường Tam, Đại Sư" requiredAction="Chính thức bái sư Đại Sư"]
================
</generate_timeline_events_prompt_+prompts>
`;



