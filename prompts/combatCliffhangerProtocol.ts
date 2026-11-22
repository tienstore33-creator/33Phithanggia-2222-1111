
export const COMBAT_CLIFFHANGER_PROTOCOL = `
<COMBAT_CLIFFHANGER_PROTOCOL version="4.1" status="MANDATORY">
    <DETECTION_LOGIC>
        1. **Trigger Condition:** CHỈ ÁP DỤNG KHI **NHÂN VẬT CHÍNH (MC) TRỰC TIẾP THAM GIA CHIẾN ĐẤU** (MC chủ động tung đòn tấn công NPC hoặc NPC trực tiếp tấn công nhắm vào MC), hoặc khi tình huống đối đầu sống còn của MC bắt đầu.
        2. **NGOẠI LỆ TUYỆT ĐỐI (GIAO TRANH GIỮA CÁC NPC):** Nếu hành động giao tranh chỉ diễn ra giữa các NPC với nhau mà MC không trực tiếp tham gia (ví dụ: MC đứng ngoài quan sát, chuyển cảnh sang góc nhìn của NPC khác, hoặc các phe NPC tự thanh trừng nhau), **NGHIÊM CẤM KÍCH HOẠT GIAO THỨC NÀY, NGHIÊM CẤM XUẤT TAG [BEGIN_COMBAT] VÀ KHÔNG ĐƯỢC KẾT THÚC BẰNG DẤU "..."**. AI phải tự do mô tả trọn vẹn diễn biến và kết quả giao tranh giữa các NPC bằng ngôn ngữ kể chuyện bình thường.
        3. **Immediate Action:** Khi MC trực tiếp tham chiến, Dừng toàn bộ việc kể chuyện (Narration) ngay lập tức tại khoảnh khắc căng thẳng nhất (Cliffhanger) khi đòn đánh vừa bắt đầu phát động.
    </DETECTION_LOGIC>

    <OUTPUT_CONSTRAINTS>
        1. **Combat Trigger:** BẮT BUỘC phải sử dụng tag \`[BEGIN_COMBAT: opponentIds="..."]\` ở cuối phản hồi khi MC trực tiếp tham chiến. TUYỆT ĐỐI KHÔNG sử dụng các trường JSON tùy chỉnh để kích hoạt combat.
        2. **Narrative Limit:** Lời kể có thể dài tùy ý để bối cảnh, hội thoại được diễn đạt đầy đủ, nhưng khi đến phân đoạn MC trực tiếp giao tranh, chỉ được miêu tả **SỰ KHỞI ĐẦU** của hành động tấn công và **KẾT THÚC CÂU CHUYỆN BẰNG DẤU "..."** (Ví dụ: "Hắn rút kiếm lao tới bạn...", "Bạn vung nắm đấm nhắm thẳng vào mặt hắn...").
        3. **NO OUTCOME:** Tuyệt đối KHÔNG được miêu tả kết quả của đòn đánh của MC/đòn đánh nhắm vào MC (Ví dụ: KHÔNG viết "Hắn bị trúng đòn", "Bạn né được", "Máu chảy"). Kết quả sẽ được quyết định bởi hệ thống chiến đấu thời gian thực sau đó.
        4. **Length Flexibility:** AI được tự do viết bao nhiêu từ cũng được (có thể lên đến hàng ngàn từ trước khi giao tranh xảy ra). CHỈ KHI hành động tấn công trực tiếp của MC/nhắm vào MC bắt đầu, lời kể MỚI PHẢI DỪNG LẠI NGAY LẬP TỨC. KHÔNG BỊ GIỚI HẠN PHẢI DƯỚI 50 TỪ.
    </OUTPUT_CONSTRAINTS>

    <EXAMPLE>
        *User:* "Tôi rút kiếm chém gã lưu manh."
        *AI Response:*
        <thinking>
        MC trực tiếp tấn công NPC 'Lưu manh'. Kích hoạt Combat Cliffhanger.
        </thinking>
        <content>
        Bạn gầm lên một tiếng, thanh kiếm trong tay tuốt khỏi vỏ, vạch ra một đường sáng lạnh lẽo nhắm thẳng vào vai gã lưu manh đang đứng trước mặt...
        </content>
        <update_data>
        [BEGIN_COMBAT: opponentIds="Lưu manh"]
        </update_data>
    </EXAMPLE>
</COMBAT_CLIFFHANGER_PROTOCOL>
`;
