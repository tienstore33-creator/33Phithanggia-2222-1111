
import * as GameTemplates from '../../templates';

/**
 * Registry định nghĩa các gợi ý về khu vực kinh tế và NPC phù hợp với từng loại địa điểm.
 * Giúp AI tạo ra nội dung phong phú và đúng bối cảnh (Ví dụ: Tông môn thì có Đan Đường thay vì Thương Thành).
 */
export const LOCATION_ECONOMY_THEMES: Record<string, { suggestions: string; preferredNpcTitles: string[] }> = {
    [GameTemplates.LocationType.VILLAGE]: {
        suggestions: "một 'Chợ Làng' nô nức, một 'Tiệm Thuốc Đông Y' nhỏ, hoặc 'Quán Trà Đầu Làng'.",
        preferredNpcTitles: ["Lão Bản", "Trưởng Thôn", "Lang Y", "Tiểu Nhị"],
    },
    [GameTemplates.LocationType.SECT_CLAN]: {
        suggestions: "một 'Luyện Đan Đường', một 'Tàng Kinh Các' (để trao đổi bí kíp), hoặc 'Nội Vụ Các' (nhiệm vụ và vật phẩm tông môn).",
        preferredNpcTitles: ["Chấp Sự", "Trưởng Lão", "Đan Sư", "Sư Huynh"],
    },
    [GameTemplates.LocationType.MOUNTAIN]: {
        suggestions: "một 'Hang Động Giao Dịch' của các tán tu, hoặc một 'Trạm Nghỉ Chân' ven đường núi.",
        preferredNpcTitles: ["Tán Tu", "Thợ Săn", "Ẩn Sĩ"],
    },
    [GameTemplates.LocationType.FOREST]: {
        suggestions: "một 'Trại Tập Kết' của thợ săn, hoặc 'Cửa Hàng Thảo Dược' hẻo lánh.",
        preferredNpcTitles: ["Thợ Săn", "Dược Thuật Sĩ"],
    },
    [GameTemplates.LocationType.DUNGEON]: {
        suggestions: "một 'Thương Nhân Bí Ẩn' xuất hiện ngẫu nhiên, hoặc 'Tàn Tích Trao Đổi' (nơi các mạo hiểm giả để lại đồ).",
        preferredNpcTitles: ["Kẻ Lang Thang", "Thương Nhân Thần Bí"],
    },
    [GameTemplates.LocationType.TOWN]: {
        suggestions: "một 'Phường Thị' (chợ trời) và một vài 'Cửa Hàng Tạp Hóa' chuyên dụng.",
        preferredNpcTitles: ["Tiểu Thương", "Chủ Quán"],
    },
    [GameTemplates.LocationType.CITY]: {
        suggestions: "một 'Phường Thị' sầm uất, một 'Thương Thành' (trung tâm mua sắm), và có thể có cả 'Đấu Giá Hội'.",
        preferredNpcTitles: ["Đại Chưởng Quỹ", "Gia Chủ", "Đấu Giá Sư"],
    },
    [GameTemplates.LocationType.CAPITAL]: {
        suggestions: "hàng loạt 'Thương Thành' hoa lệ, 'Đấu Giá Hội' cấp cao, và các khu vực mua bán vũ khí hoàng gia.",
        preferredNpcTitles: ["Quan Thương", "Thành Chủ", "Đấu Giá Sư Cao Cấp"],
    },
};

/**
 * Lấy gợi ý kinh tế dựa trên loại địa điểm.
 */
export const getThematicEconomySuggestion = (locType: string): string => {
    return LOCATION_ECONOMY_THEMES[locType]?.suggestions || "các khu vực trao đổi vật phẩm phù hợp với bối cảnh đặc thù của nơi này.";
};

/**
 * Lấy danh xưng NPC ưu tiên dựa trên loại địa điểm.
 */
export const getPreferredNpcTitles = (locType: string): string[] => {
    return LOCATION_ECONOMY_THEMES[locType]?.preferredNpcTitles || ["Thương Nhân", "Chủ Quán"];
};
