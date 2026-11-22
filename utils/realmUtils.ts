import { RealmSystem, KnowledgeBase } from '../types';
import { realmManager, getEffectiveRealmSystem } from '../services/realmManager';

/**
 * Phân giải chuỗi cảnh giới thành chỉ số đại cảnh giới và tiểu cảnh giới.
 * @param realmStr Chuỗi cảnh giới (ví dụ: "Luyện Khí (3 Tầng)")
 * @param system Hệ thống cảnh giới đang áp dụng
 * @returns Đối tượng chứa majorIndex và minorIndex
 */
export const parseRealm = (realmStr: string, system: RealmSystem) => {
    if (!realmStr || !system.majorRealms.length) {
        return { majorIndex: 0, minorIndex: 0 };
    }

    // Làm sạch chuỗi: Loại bỏ ngoặc đơn và khoảng trắng thừa
    const cleanedRealmStr = realmStr.replace(/[()]/g, ' ').replace(/\s+/g, ' ').trim();

    // Tìm đại cảnh giới khớp với phần đầu của chuỗi
    // Sắp xếp theo độ dài giảm dần để tránh khớp nhầm (ví dụ: "Hợp Thể" vs "Hợp")
    const sortedMajors = [...system.majorRealms].sort((a, b) => b.length - a.length);
    let major = "";
    let majorIndex = -1;

    for (const r of sortedMajors) {
        if (cleanedRealmStr.startsWith(r) || realmStr.startsWith(r)) {
            major = r;
            majorIndex = system.majorRealms.indexOf(r);
            break;
        }
    }

    if (majorIndex === -1) {
        return { majorIndex: 0, minorIndex: 0 };
    }

    // Phần còn lại của chuỗi sau khi loại bỏ đại cảnh giới là tiểu cảnh giới
    let minorStr = "";
    if (realmStr.startsWith(major)) {
        minorStr = realmStr.substring(major.length).trim().replace(/[()]/g, '').trim();
    } else {
        minorStr = cleanedRealmStr.substring(major.length).trim();
    }

    // Tìm tiểu cảnh giới khớp nhất
    const sortedMinors = [...system.minorRealms].sort((a, b) => b.length - a.length);
    let minorIndex = -1;

    for (const r of sortedMinors) {
        if (minorStr.includes(r) || cleanedRealmStr.includes(r)) {
            minorIndex = system.minorRealms.indexOf(r);
            break;
        }
    }

    return { 
        majorIndex: majorIndex, 
        minorIndex: minorIndex === -1 ? 0 : minorIndex 
    };
};

export const ensureValidOrLowestRealm = (realm: string, kb: KnowledgeBase): string => {
    if (!kb.worldConfig?.isCultivationEnabled) return realm || "Phàm Nhân";

    const cleaned = realm ? realm.trim() : "";
    const baseRealm = realmManager.getBaseRealm(kb);
    const realmSystem = getEffectiveRealmSystem(kb);
    
    // Tầng 1: Kiểm tra rỗng hoặc các chuỗi vô nghĩa/rác
    const nonsense = ["undefined", "null", "???", "không có", "không rõ", "nan", "none", "chưa rõ", "n/a", "không xác định", "bí ẩn", "...", "tên cảnh giới", "chưa có"];
    if (!cleaned || nonsense.includes(cleaned.toLowerCase()) || cleaned.includes("???")) {
        return baseRealm;
    }

    // Tầng 2: Kiểm tra tính hợp lệ chuẩn hoặc nắn chỉnh thông minh
    if (realmManager.isValidRealm(cleaned, kb)) {
        return cleaned;
    }

    // Thử trích xuất và tái tạo cảnh giới dựa trên hệ thống của thế giới (Fuzzy Repair)
    const reconstructed = realmManager.repairOrFindClosestRealm(cleaned, kb);
    if (reconstructed && reconstructed !== cleaned && realmManager.isValidRealm(reconstructed, kb)) {
        console.log(`[Cơ Học] Tự động nắn chỉnh cảnh giới: "${cleaned}" -> "${reconstructed}"`);
        return reconstructed;
    }

    // Tầng 3: Bảo toàn nguyên văn nếu chuỗi có nội dung ý nghĩa
    const hasPhamNhanInSystem = realmSystem.majorRealms.includes("Phàm Nhân");
    if (cleaned.toLowerCase().includes("phàm nhân") && !hasPhamNhanInSystem) {
        return baseRealm;
    }

    // Nếu chuỗi đủ dài (> 2 ký tự) và không phải rác, giữ nguyên thay vì ép về baseRealm
    if (cleaned.length > 2) {
        console.log(`[Cơ Học] Chấp nhận cảnh giới không chuẩn nhưng có ý nghĩa: "${cleaned}"`);
        return cleaned;
    }

    return baseRealm;
};

