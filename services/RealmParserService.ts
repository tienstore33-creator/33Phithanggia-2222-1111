export const RealmParserService = {
    /**
     * Chuyển chuỗi "A - B - C" thành mảng ["A", "B", "C"]
     */
    parseMajorRealms: (input: string): string[] => {
        if (!input) return [];
        return input.split('-').map(s => s.trim()).filter(Boolean);
    },

    /**
     * Tuyệt đối không mở rộng dải số. 
     * Người dùng nhập gì, trả về mảng đó qua dấu "-".
     */
    parseMinorRealms: (input: string): string[] => {
        if (!input) return [];
        return input.split('-').map(s => s.trim()).filter(Boolean);
    },

    /**
     * Dọn dẹp chuỗi cảnh giới: Xóa dấu ngoặc đơn, gạch ngang, hai chấm, v.v.
     * Đảm bảo định dạng [Major] [Minor]
     */
    cleanRealmString: (realm: string): string => {
        if (!realm) return realm;
        // Xóa các ký tự đặc biệt AI hay tự thêm vào
        let cleaned = realm.replace(/[()\[\]\-:]/g, ' ');
        // Chuẩn hóa khoảng trắng
        cleaned = cleaned.replace(/\s+/g, ' ').trim();
        return cleaned;
    }
};
