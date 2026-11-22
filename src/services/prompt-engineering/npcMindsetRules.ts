import { NpcMindset } from '../../types';

export function getNpcMindsetInstructions(mindset: NpcMindset, corruption: number = 0): string {
    const basePrinciple = `
**QUY TẮC CỐT LÕI VỀ HÀNH VI NPC (CỰC KỲ QUAN TRỌNG): TÍNH CÁCH LÀ NỀN TẢNG, TÂM TRÍ LÀ BỘ LỌC.**
Bạn BẮT BUỘC phải hiểu rằng **tính cách ('personality') là bản chất bất biến** của một NPC. Các "Tâm Trí" dưới đây không phải là mệnh lệnh ghi đè, mà là một **"bộ lọc"** hoặc **"lăng kính"** mà qua đó NPC thể hiện tính cách của mình trong các tình huống nhạy cảm.

**Hành vi của NPC = Tính cách Cốt lõi + Bộ lọc Tâm Trí.**
${corruption < 20 ? "- Ưu tiên văn phong 'Self-Loathing': Nội tâm dằn vặt, nhục nhã." : ""}
${corruption > 70 ? "- Ưu tiên văn phong 'Active-Hedonism': Chủ động hưởng lạc, chiếm hữu." : ""}
`;

    switch (mindset) {
        case 'DEFAULT':
            return basePrinciple + `
**TÂM TRÍ: MẶC ĐỊNH (Không có bộ lọc)**
1.  **HÀNH VI TỰ NHIÊN:** NPC sẽ hành động 100% dựa trên tính cách cốt lõi, mối quan hệ hiện tại với người chơi và diễn biến tình hình. Không có bất kỳ bộ lọc nào được áp dụng.
`;
        case 'IRON_WILL':
            return basePrinciple + `
**TÂM TRÍ: LÝ TRÍ SẮT ĐÁ (Bộ lọc "Kháng Cự")**
NPC sẽ thể hiện sự kháng cự một cách quyết liệt, nhưng cách thể hiện đó PHẢI phù hợp với tính cách của họ.
1.  **KHÁNG CỰ THEO TÍNH CÁCH:** Sẽ nhục mạ hoặc van xin dựa trên bản chất, nhưng tuyệt đối không khuất phục ngay.
2.  **CHỈ SỐ 'Lý trí':** Giảm RẤT CHẬM. Sự khuất phục phải là một quá trình dài.
`;
        case 'TORN_MIND':
            return basePrinciple + `
**TÂM TRÍ: GIẰNG XÉ NỘI TÂM (Bộ lọc "Mâu Thuẫn")**
NPC sẽ thể hiện sự đấu tranh nội tâm giữa lý trí và bản năng.
1.  **MÂU THUẪN:** Mô tả cơ thể phản ứng tích cực trong khi lời nói chối từ (Double-bind).
`;
        case 'PRIMAL_INSTINCT':
            return basePrinciple + `
**TÂM TRÍ: BẢN NĂNG NGUYÊN THỦY (Bộ lọc "Khuất Phục")**
Lý trí của NPC dễ dàng bị bản năng lấn át.
`;
        case 'HEDONISTIC_MIND':
            return basePrinciple + `
**TÂM TRÍ: BẢN NĂNG HƯỞNG LẠC (Bộ lọc "Lý Trí Khoái Lạc")**
**QUY TẮC TỐI THƯỢỢNG:** Đây là bản chất thật của NPC được bộc lộ. 
1.  **TỈNH TÁO VÀ CHỦ ĐỘNG:** NPC nhận thức đầy đủ, tự nguyện và kiểm soát hoàn toàn bản thân. Mọi sự xấu hổ biến mất.
`;
        default:
            return basePrinciple;
    }
}
