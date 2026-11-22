
/**
 * Remote Canon Service
 * Handles fetching and searching content from remote sources like GitHub.
 */

export class RemoteCanonService {

    /**
     * Converts a standard GitHub URL to a raw content URL.
     */
    public static convertToRawUrl(url: string): string {
        if (!url) return "";
        
        // Handle github.com links
        if (url.includes("github.com") && !url.includes("raw.githubusercontent.com")) {
            return url
                .replace("github.com", "raw.githubusercontent.com")
                .replace("/blob/", "/");
        }
        
        return url;
    }

    /**
     * Fetches content from the URL (no-op as search is streaming).
     */
    public static async fetchAndCache(url: string): Promise<boolean> {
        return true;
    }

    /**
     * Tìm kiếm từ khóa bằng cách streaming dữ liệu từ URL, không tải hết vào bộ nhớ.
     */
    public static async search(url: string, query: string): Promise<string> {
        if (!url) return "Vui lòng cung cấp URL nguyên tác.";
        if (!query) return "Vui lòng cung cấp từ khóa tra cứu.";

        const response = await fetch(this.convertToRawUrl(url));
        if (!response.body) return "Không thể đọc dữ liệu từ nguồn này.";

        const reader = response.body.getReader();
        const decoder = new TextDecoder("utf-8");
        
        let buffer = ""; // Lưu một phần nhỏ dữ liệu để xử lý từ khóa bị cắt ngang
        const results: string[] = [];
        const MAX_RESULTS = 50;
        const WINDOW_SIZE = 300; // 300 ký tự xung quanh

        try {
            while (results.length < MAX_RESULTS) {
                const { done, value } = await reader.read();
                if (done) break;

                buffer += decoder.decode(value, { stream: true });

                // Kiểm tra từ khóa trong buffer
                let pos = buffer.toLowerCase().indexOf(query.toLowerCase());
                while (pos !== -1 && results.length < MAX_RESULTS) {
                    // Trích xuất ngữ cảnh xung quanh
                    const start = Math.max(0, pos - WINDOW_SIZE);
                    const end = Math.min(buffer.length, pos + query.length + WINDOW_SIZE);
                    
                    const snippet = buffer.substring(start, end).trim();
                    if (!results.includes(snippet)) {
                        results.push(snippet);
                    }

                    // Tiếp tục tìm vị trí tiếp theo trong buffer
                    pos = buffer.toLowerCase().indexOf(query.toLowerCase(), pos + 1);
                }

                // Giữ lại phần cuối buffer để xử lý từ khóa bị cắt ngang giữa 2 chunk
                if (buffer.length > WINDOW_SIZE * 2) {
                    buffer = buffer.substring(buffer.length - WINDOW_SIZE);
                }
            }
        } catch (error) {
            console.error("Streaming search failed:", error);
        } finally {
            reader.cancel();
        }

        return results.length > 0 
            ? `[KẾT QUẢ TÌM THẤY ${results.length} ĐOẠN]:\n\n${results.join("\n\n---\n\n")}`
            : `Không tìm thấy thông tin liên quan đến "${query}".`;
    }
}
