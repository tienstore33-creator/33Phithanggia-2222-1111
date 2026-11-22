import { callGeminiAPI } from "./apiService";

export class SummaryService {
  /**
   * Summarizes a large text file using a chunked approach.
   */
  public static async summarizeLargeText(
    text: string, 
    onProgress: (message: string, percent: number) => void
  ): Promise<string> {
    const CHUNK_SIZE = 800000; // ~0.8MB chunks to stay safe with memory and token limits
    const chunks: string[] = [];
    for (let i = 0; i < text.length; i += CHUNK_SIZE) {
      chunks.push(text.substring(i, i + CHUNK_SIZE));
    }

    const chunkSummaries: string[] = [];
    for (let i = 0; i < chunks.length; i++) {
        const currentChunkNum = i + 1;
        const totalChunks = chunks.length;
        
        let success = false;
        let retries = 0;
        const maxRetries = 3;

        while (!success && retries < maxRetries) {
            onProgress(
                `Đang tóm tắt đoạn ${currentChunkNum}/${totalChunks}${retries > 0 ? ` (Thử lại lần ${retries})` : ''}...`, 
                Math.round(((i + (retries / maxRetries)) / totalChunks) * 90)
            );
            
            const prompt = `
[YÊU CẦU]: Tóm tắt chi tiết nội dung đoạn văn dưới đây từ một tác phẩm nguyên tác.
Hãy trích xuất các thông tin cốt lõi sau:
1. Các sự kiện then chốt diễn ra trong đoạn này.
2. Hệ thống cảnh giới, công pháp hoặc các quy tắc thế giới mới xuất hiện.
3. Các nhân vật quan trọng và các mối quan hệ, tính cách của họ.
4. Các địa danh và tầm quan trọng của chúng.

[ĐOẠN VĂN ${currentChunkNum}/${totalChunks}]:
${chunks[i]}
            `;
            
            try {
                const { text: summary } = await callGeminiAPI(prompt, undefined, 'main');
                chunkSummaries.push(`--- TÓM TẮT ĐOẠN ${currentChunkNum} ---\n${summary}`);
                success = true;
            } catch (error) {
                retries++;
                console.error(`Failed to summarize chunk ${currentChunkNum}, attempt ${retries}`, error);
                if (retries >= maxRetries) {
                    chunkSummaries.push(`--- LỖI TẠI ĐOẠN ${currentChunkNum} ---\n(Không thể tóm tắt đoạn này sau ${maxRetries} lần thử)`);
                } else {
                    await new Promise(r => setTimeout(r, 2000 * retries)); // Exponential backoff
                }
            }
        }
        
        // Anti-rate limit pause
        if (chunks.length > 1) {
            await new Promise(r => setTimeout(r, 500));
        }
    }

    onProgress("Đang tổng hợp toàn bộ các phần tóm tắt thành dàn khung thế giới...", 90);
    
    const combinedSummary = chunkSummaries.join("\n\n");
    
    const finalPrompt = `
[YÊU CẦU]: Dựa trên danh sách các tóm tắt từng phần dưới đây, hãy tạo ra một BẢN TỔNG HỢP NGUYÊN TÁC TOÀN DIỆN.
Bản tổng hợp này sẽ được dùng làm "Dàn khung sự kiện và thiết lập" cho một game nhập vai.

Yêu cầu format:
1. **DÀN KHUNG SỰ KIỆN NGUYÊN TÁC (WORLD TIMELINE)**: Liệt kê các đại sự kiện chính theo trình tự thời gian.
2. **HỆ THỐNG THIẾT LẬP THẾ GIỚI (WORLD BUILDING)**: Các quy tắc về sức mạnh, tiền tệ, các thế lực lớn, văn hóa đặc trưng.
3. **BẢN ĐỒ NHÂN VẬT (CHARACTER MAP)**: Tóm lược về nhân vật chính, các phản diện chính và các NPC quan trọng.
4. **THIẾT LẬP ĐỊA LÝ (GEOGRAPHICAL SETUP)**: Các khu vực cốt lõi và vai trò của chúng.

Hãy trình bày một cách chuyên nghiệp, súc tích nhưng đầy đủ các chi tiết quan trọng nhất để AI có thể bám sát nguyên tác nhất có thể.

[DANH SÁCH TÓM TẮT CÁC PHẦN]:
${combinedSummary}
    `;

    try {
        const { text: finalSummary } = await callGeminiAPI(finalPrompt, undefined, 'main');
        onProgress("Đã hoàn thành tóm tắt toàn bộ nguyên tác!", 100);
        return finalSummary;
    } catch (error) {
        console.error("Final synthesis failed", error);
        return combinedSummary; // Return the combined individual summaries if the final synthesis fails
    }
  }
}
