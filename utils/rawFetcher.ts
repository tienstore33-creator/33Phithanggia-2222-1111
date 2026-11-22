/**
 * Lấy dữ liệu dạng text thô từ URL nguyên tác một cách an toàn.
 * Hỗ trợ các định dạng .txt hoặc raw content từ GitHub.
 */
export async function fetchRawCanonData(url: string, maxLength: number = 80000): Promise<string | null> {
    if (!url || !url.startsWith('http')) return null;

    try {
        // Chuyển đổi GitHub URL sang Raw nếu cần
        let targetUrl = url;
        if (url.includes('github.com') && !url.includes('raw.githubusercontent.com')) {
            targetUrl = url.replace('github.com', 'raw.githubusercontent.com')
                           .replace('/blob/', '/');
        }

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 15000); // 15s timeout

        const response = await fetch(targetUrl, { signal: controller.signal });
        clearTimeout(timeoutId);

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const text = await response.text();
        
        // Tranh thủ làm sạch sơ bộ: bỏ khoảng trắng thừa
        const cleanText = text.trim();
        
        // Giới hạn độ dài để tránh quá tải Token
        if (cleanText.length > maxLength) {
            return cleanText.substring(0, maxLength) + "\n... [Nội dung quá dài, đã bị cắt bớt] ...";
        }

        return cleanText;
    } catch (error) {
        console.error("[fetchRawCanonData] Lỗi khi tải dữ liệu nguyên tác:", error);
        return null;
    }
}
