import { NATIVE_LANGUAGE_REASONING_RULE } from './promptTaskHelpers';

export const appendTimelineEventsPrompt = (
    lastEvents: any[],
    originalStorySummary: string,
    worldTheme: string,
    canonData?: string,
    startIndex: number = 11,
    accuracyContext?: string
): string => {
    const formattedLastEvents = lastEvents.map((evt, idx) => {
        const actualNum = startIndex - lastEvents.length + idx;
        return `- [Sự kiện ${actualNum}] (Thời kỳ: ${evt.periodName || 'N/A'}) ${evt.eventName || 'N/A'}: ${evt.description || 'N/A'} (Địa điểm: ${evt.location || 'N/A'}, Nhân vật: ${Array.isArray(evt.characters) ? evt.characters.join(', ') : evt.characters || 'N/A'}, Mục tiêu: ${evt.requiredAction || 'N/A'})`;
    }).join('\n');

    return `
<append_timeline_events_prompt_+prompts>
================
Bạn là một trợ lý AI chuyên tạo kịch bản cho game nhập vai.

${NATIVE_LANGUAGE_REASONING_RULE}

Nhiệm vụ của bạn là tiếp tục tạo thêm Dòng Thời Gian (Timeline) chi tiết cho tác phẩm, nối tiếp ngay sau các sự kiện gần đây nhất.

Tác phẩm/Chủ đề: ${worldTheme}

Tóm Tắt Cốt Truyện Nguyên Tác để bám sát và phát triển tiếp diễn biến:
${originalStorySummary}

Danh sách 5 sự kiện gần nhất hiện có trong timeline:
${formattedLastEvents}

${accuracyContext ? `
[DỮ LIỆU TRA CỨU BẢN ĐỊA BẰNG GOOGLE SEARCH]
Bạn MUST sử dụng dữ liệu đối chiếu từ tìm kiếm trực tuyến bản địa dưới đây để đảm bảo tên nhân vật, thứ tự thời gian và diễn biến các sự kiện HOÀN TOÀN CHÍNH XÁC NGUYÊN TÁC:
<ACCURACY_CONTEXT>
${accuracyContext}
</ACCURACY_CONTEXT>
` : ""}

${canonData ? `
[CHÚ Ý] Bạn có thêm dữ liệu gốc sau đây để có thể tham khảo bổ sung:
<CANON_DATA>
${canonData}
</CANON_DATA>
` : ""}

YÊU CẦU:
1. Bạn phải dựa vào "Tóm Tắt Cốt Truyện Nguyên Tác" và danh sách 5 sự kiện gần nhất ở trên để nhớ lại và liệt kê 10 sự kiện có thật tiếp theo trong nguyên tác (bắt đầu từ Sự kiện ${startIndex} đến Sự kiện ${startIndex + 9}).
2. TUYỆT ĐỐI KHÔNG ĐƯỢC lặp lại, sao chép, hoặc tạo lại các sự kiện đã có trong quá khứ hoặc tương tự như các sự kiện từ đầu truyện đã liệt kê ở trên. Phải viết tiếp diễn biến tiếp theo và đẩy nhanh mạch truyện về phía trước theo đúng thứ tự lịch sử nguyên tác.
3. Phạm vi hẹp: 10 sự kiện tiếp theo nối tiếp diễn biến từ sự kiện cuối cùng.
4. Điều kiện bắt buộc: Bao gồm cả sự kiện phụ chính, sự kiện phụ lớn, nhân vật phụ.

**Nguyên tắc bắt buộc:**
- Mỗi sự kiện chỉ được mô tả MỘT biến cố hoặc cột mốc cụ thể, riêng lẻ. Tuyệt đối không được gộp nhiều sự kiện hoặc cả một giai đoạn dài vào chung một dòng.
- Mỗi sự kiện phải chia rõ Đại Thời Kỳ (VD: "Sơ Nhập Tu Tiên", "Chiến Quốc", "Kỷ Nguyên Mới") và Tên Sự Kiện Quan Trọng, kèm theo địa điểm diễn ra, danh sách nhân vật tham gia, và hành động hoặc cột mốc mấu chốt bắt buộc người chơi phải đạt được để phân giải sự kiện đó.
- Trả về đúng định dạng tag dưới đây, và CHỈ trả về đúng định dạng này, không kèm chữ giải thích phụ. TUYỆT ĐỐI KHÔNG ĐƯỢC sinh ra dấu ba chấm "..." trong các giá trị thuộc tính, mọi trường đều phải chứa dữ liệu thực tế:

[GENERATED_TIMELINE_EVENT: periodName="Đại Chiến Tông Môn" eventName="Trận Chiến Gia Lăng Quan" description="Đường Tam và Thần giới liên minh tiến công tổng lực vào cứ điểm của Võ Hồn Điện tại Gia Lăng Quan" location="Gia Lăng Quan" characters="Đường Tam, Bỉ Bỉ Đông, Thiên Nhận Tuyết" requiredAction="Đánh bại các đại Hồn Đấu La và Thần Cấp của đối phương"]
================
</append_timeline_events_prompt_+prompts>
`;
};

