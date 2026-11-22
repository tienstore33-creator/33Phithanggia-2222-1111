import { LocationType } from '../templates';

export type LocationContext = 'crowded' | 'secluded';

/**
 * Service quản lý Hệ Thống Thái Độ Hảo Cảm (Affection Behavior System)
 * Theo dõi mức độ hảo cảm của NPC (Affinity > 80) và chèn chỉ thị hành vi,
 * lời thoại thả thính / bóng gió / vồ vập dựa trên bối cảnh địa điểm (đông người vs vắng người).
 */
export class AffectionBehaviorService {
    /**
     * Kiểm tra ngưỡng hảo cảm có vượt quá 80 hay không.
     */
    public static isAffectionTriggered(affinity: number): boolean {
        return typeof affinity === 'number' && affinity > 80;
    }

    /**
     * Phân loại bối cảnh địa điểm là "đông người" (crowded) hay "vắng người" (secluded).
     */
    public static classifyLocationContext(
        locationName?: string,
        locationDesc?: string,
        locationType?: string
    ): LocationContext {
        const text = `${locationName || ''} ${locationDesc || ''} ${locationType || ''}`.toLowerCase();

        // Kiểm tra từ khóa nơi vắng người / riêng tư trước
        const secludedRegex = /\b(phòng|động|quật|hang|rừng|lâm|núi|vách|sơn|phế tích|tàn tích|ngục|bí cảnh|cấm địa|mật thất|sương phòng|tẩm cung|suối nước nóng|giai giam|hầm|hoang|vắng|riêng tư|hẻm tối|trướng|giường)\b/i;
        
        // Kiểm tra từ khóa nơi đông người / công cộng
        const crowdedRegex = /\b(thành|phố|trấn|thị|thủ đô|kinh đô|phủ|quảng trường|sân|chợ|tiệm|quán|tửu lâu|tông môn|đại điện|giảng đường|đấu trường|hội đường|đông người|nhộn nhịp|đại sảnh|bến tàu)\b/i;

        if (secludedRegex.test(text)) {
            return 'secluded';
        }

        if (crowdedRegex.test(text)) {
            return 'crowded';
        }

        // Nếu dựa theo locationType đã phân loại
        if (locationType === LocationType.CAPITAL || locationType === LocationType.CITY || locationType === LocationType.TOWN || locationType === LocationType.SECT_CLAN) {
            return 'crowded';
        }

        if (locationType === LocationType.CAVE || locationType === LocationType.DUNGEON || locationType === LocationType.RUIN || locationType === LocationType.FOREST || locationType === LocationType.MOUNTAIN) {
            return 'secluded';
        }

        // Mặc định nơi không rõ là vắng người để tạo bối cảnh riêng tư mềm mại
        return 'secluded';
    }

    /**
     * Sinh khối chỉ thị prompt XML bọc quy tắc hành vi cho NPC có điểm hảo cảm > 80.
     */
    public static getAffectionBehaviorPrompt(
        npcName: string,
        affinity: number,
        locationContext: LocationContext,
        gender?: string
    ): string {
        if (!this.isAffectionTriggered(affinity)) {
            return '';
        }

        const isFemale = gender === 'Nữ' || gender === 'Female' || !gender;
        const locationText = locationContext === 'crowded' ? 'NƠI ĐÔNG NGƯỜI / CÔNG CỘNG' : 'NƠI VẮNG NGƯỜI / CHỐN RIÊNG TƯ';

        let behaviorGuidance = '';
        if (locationContext === 'crowded') {
            behaviorGuidance = `
- **BỐI CẢNH NƠI ĐÔNG NGƯỜI (CÔNG CỘNG):**
  + ${npcName} chủ động thả thính, liếc mắt đưa tình, va chạm cơ thể tinh tế (nắm tay lén, ghé sát tai, tựa vai, va nhẹ hông).
  + Nói bóng gió, ẩn ý nồng nàn về chuyện mây mưa/ân ái với MC khi chỉ có hai người.
  + Thể hiện sự ghen tuông nhẹ hoặc muốn độc chiếm MC trước mặt người khác một cách khéo léo.`;
        } else {
            behaviorGuidance = `
- **BỐI CẢNH NƠI VẮNG NGƯỜI (RIÊNG TƯ):**
  + ${npcName} trở nên vồ vập, ôm chồm, quấn quít, mãnh liệt thể hiện sự thèm muốn và khát khao được MC cưng chiều/làm tình.
  + Chủ động áp sát, cởi bỏ bớt sự e ấp, thì thầm những lời tình tứ, khiêu khích nồng nàn.`;
        }

        return `
<he_thong_thai_do_affection_+affection_behavior_system>
  <chi_thi_hành_vi_+he_thong_thai_do_affection>
================
[HỆ THỐNG THÁI ĐỘ HẢO CẢM CAO (>80) - AFFECTION BEHAVIOR TRIGGERED]
- **Nhân vật:** ${npcName} (Thiện cảm: ${affinity}/100)
- **Giới tính:** ${isFemale ? 'Nữ' : 'Nam/Khác'}
- **Bối cảnh hiện tại:** ${locationText}

**CHỈ THỊ DIỄN XUẤT LỜI THOẠI VÀ HÀNH ĐỘNG:**${behaviorGuidance}

- **RÀNG BUỘC TÔN TRỌNG VĂN PHONG (BẮT BUỘC):**
  + Duy trì tông giọng tình cảm, gợi cảm, phong tình, quyến rũ hoặc nồng nàn.
  + TUYỆT ĐỐI KHÔNG sử dụng ngôn từ thô bỉ, tục tĩu trực diện (như "chịch nhau đi", "đụ nhau đi").
  + Mọi câu từ phải thể hiện sự khát khao, rung động sâu sắc nhưng tinh tế và đầy ma mị.
================
  </chi_thi_hành_vi_+he_thong_thai_do_affection>
</he_thong_thai_do_affection_+affection_behavior_system>
`;
    }

    /**
     * Hàm trigger tổng hợp kiểm tra NPC và địa điểm hiện tại.
     */
    public static evaluateNpcAffectionTriggers(
        npc: { name: string; affinity?: number; gender?: string },
        location?: { name?: string; description?: string; type?: string }
    ): string {
        const affinity = npc.affinity || 0;
        if (!this.isAffectionTriggered(affinity)) {
            return '';
        }

        const locationContext = this.classifyLocationContext(
            location?.name,
            location?.description,
            location?.type
        );

        return this.getAffectionBehaviorPrompt(
            npc.name,
            affinity,
            locationContext,
            npc.gender
        );
    }
}
