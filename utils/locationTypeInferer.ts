
import * as GameTemplates from '../templates';

/**
 * Phân loại địa điểm dựa trên tên và mô tả.
 * @param name Tên địa điểm
 * @param description Mô tả địa điểm
 * @returns Loại địa điểm (LocationTypeValues)
 */
export const inferLocationType = (name: string, description: string): GameTemplates.LocationTypeValues => {
    const text = (name + " " + description).toLowerCase();

    // 1. Thủ đô (Độ ưu tiên cao nhất)
    if (/\b(thủ đô|kinh đô|hoàng thành|đại đô thị|thánh địa chính)\b/.test(text)) {
        return GameTemplates.LocationType.CAPITAL;
    }

    // 2. Thành thị / Thành phố
    if (/\b(thành|phố|đô thị|quận|phủ|city)\b/.test(text)) {
        return GameTemplates.LocationType.CITY;
    }

    // 3. Tông môn / Gia tộc
    if (/\b(tông|phái|gia tộc|clan|sect|đường|vực|cung|điện|lâu|đảo chủ|các)\b/.test(text)) {
        return GameTemplates.LocationType.SECT_CLAN;
    }

    // 4. Thị trấn
    if (/\b(trấn|thị|phường|trạm dừng|tiểu thành)\b/.test(text)) {
        return GameTemplates.LocationType.TOWN;
    }

    // 5. Làng mạc
    if (/\b(làng|thôn|bản|xóm|trại|di cư|nông trại)\b/.test(text)) {
        return GameTemplates.LocationType.VILLAGE;
    }

    // 6. Hầm ngục / Bí cảnh
    if (/\b(ngục|bí cảnh|vực|dungeon|ma giới|cấm địa|phong ấn)\b/.test(text)) {
        return GameTemplates.LocationType.DUNGEON;
    }

    // 7. Hang động
    if (/\b(động|quật|cave|hang|hầm)\b/.test(text)) {
        return GameTemplates.LocationType.CAVE;
    }

    // 8. Tàn tích
    if (/\b(tàn tích|phế tích|di tích|ruin|đổ nát|bỏ hoang)\b/.test(text)) {
        return GameTemplates.LocationType.RUIN;
    }

    // 9. Rừng rậm
    if (/\b(rừng|lâm|forest|nguyên sinh|bụi rậm|cánh đồng cỏ)\b/.test(text)) {
        return GameTemplates.LocationType.FOREST;
    }

    // 10. Núi non
    if (/\b(núi|sơn|phong|vách|đỉnh|mountain|cao nguyên)\b/.test(text)) {
        return GameTemplates.LocationType.MOUNTAIN;
    }

    // 11. Sông / Hồ
    if (/\b(sông|hồ|suối|biển|hải|đầm|river|lake|sea)\b/.test(text)) {
        return GameTemplates.LocationType.RIVER_LAKE;
    }

    // 12. Quán trọ (Thường dùng cho sublocation, nhưng nếu là main thì map vào LANDMARK hoặc DEFAULT)
    if (/\b(quán|điếm|tửu|inn)\b/.test(text)) {
        return GameTemplates.LocationType.DEFAULT;
    }

    return GameTemplates.LocationType.DEFAULT;
};
