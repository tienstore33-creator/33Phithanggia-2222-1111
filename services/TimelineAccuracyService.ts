import { streamSetupTaskWithPrefill } from './aiSetupStreamService';

export interface TimelineAccuracyResult {
  originLanguage: string;
  nativeTitle: string;
  nativeQuery: string;
  searchSummary: string;
  accuracyContext: string;
}

export class TimelineAccuracyService {
  /**
   * Phân tích tác phẩm để nhận diện quốc gia/ngôn ngữ nguyên tác và tạo từ khóa tra cứu bản địa.
   */
  static async detectOriginAndKeywords(
    worldTheme: string,
    originalStorySummary: string,
    onProgress?: (msg: string) => void
  ): Promise<{ originLanguage: string; nativeTitle: string; nativeQuery: string }> {
    if (onProgress) {
      onProgress('[Tiết kiệm] Nhận diện nguyên tác & Trích xuất từ khóa bản địa...');
    }

    const prompt = `
<origin_detection_prompt>
Hãy phân tích thông tin tác phẩm dưới đây để xác định quốc gia/ngôn ngữ nguyên tác và tạo từ khóa tìm kiếm bản địa chính xác nhất.

Tên Tác Phẩm / Chủ Đề: ${worldTheme}
Tóm Tắt Cốt Truyện Nguyên Tác:
${originalStorySummary || 'Chưa có tóm tắt'}

YÊU CẦU:
1. Xác định quốc gia nguyên tác (Trung Quốc, Nhật Bản, Hàn Quốc, Âu Mỹ, Việt Nam...).
2. Xác định Tên Gốc bằng ngôn ngữ bản địa (ví dụ: "Phàm Nhân Tu Tiên" -> "凡人修仙传", "Đấu La Đại Lục" -> "斗罗大陆", "Naruto" -> "NARUTO -ナルト-").
3. Tạo 1 câu lệnh tìm kiếm ngắn gọn bằng ngôn ngữ bản địa kèm tiếng Việt để tra cứu toàn bộ niên biểu sự kiện nguyên tác (ví dụ: "凡人修仙传 剧情 年表 章节 顺序", "Naruto timeline canon events").

Hãy trả về đúng định dạng tag sau, không kèm giải thích:
[ORIGIN_INFO: originLanguage="..." nativeTitle="..." nativeQuery="..."]
</origin_detection_prompt>
`;

    try {
      const { cleanContent } = await streamSetupTaskWithPrefill(
        prompt,
        '<tuong_than>',
        undefined,
        undefined,
        'economy',
        false
      );

      const match = cleanContent.match(/\[ORIGIN_INFO:\s*originLanguage="([^"]*)"\s*nativeTitle="([^"]*)"\s*nativeQuery="([^"]*)"\]/i);
      if (match) {
        return {
          originLanguage: match[1] || 'Không xác định',
          nativeTitle: match[2] || worldTheme,
          nativeQuery: match[3] || `${worldTheme} niên biểu sự kiện cốt truyện nguyên tác`
        };
      }
    } catch (err) {
      console.warn('Lỗi nhận diện nguyên tác:', err);
    }

    return {
      originLanguage: 'Chưa xác định',
      nativeTitle: worldTheme,
      nativeQuery: `${worldTheme} niên biểu sự kiện diễn biến cốt truyện`
    };
  }

  /**
   * Thực hiện tra cứu Google Search bằng ngôn ngữ bản địa/tiếng Việt để lấy dữ liệu niên biểu chuẩn xác.
   */
  static async performNativeSearch(
    nativeQuery: string,
    originLanguage: string,
    onProgress?: (msg: string) => void
  ): Promise<string> {
    if (onProgress) {
      onProgress(`[Eye] Đang kích hoạt Google Search Grounding tra cứu dữ liệu nguyên tác (${originLanguage})...`);
    }

    const prompt = `
<native_search_prompt>
Hãy sử dụng Google Search để tra cứu thông tin niên biểu lịch sử, các cột mốc sự kiện cốt truyện chính xác theo nguyên tác của câu lệnh sau:
"${nativeQuery}"

YÊU CẦU:
1. Trích xuất danh sách các cột mốc sự kiện quan trọng theo đúng thứ tự thời gian diễn ra trong nguyên tác.
2. Ghi rõ tên thời kỳ/giai đoạn, tên sự kiện, các nhân vật chính tham gia và địa điểm diễn ra.
3. Tóm tắt ngắn gọn, chính xác bằng tiếng Việt để làm tài liệu đối chiếu niên biểu.
</native_search_prompt>
`;

    try {
      const { cleanContent } = await streamSetupTaskWithPrefill(
        prompt,
        '<tuong_than>',
        undefined,
        undefined,
        'economy',
        true // Kích hoạt Google Search Grounding
      );

      return cleanContent || 'Không tìm thấy dữ liệu bổ trợ tra cứu trực tuyến.';
    } catch (err) {
      console.warn('Lỗi tra cứu Google Search nguyên tác:', err);
      return 'Không thể kết nối tra cứu trực tuyến.';
    }
  }

  /**
   * Tổng hợp ngữ cảnh tra cứu chuẩn xác nguyên tác để tiêm vào Prompt sinh Timeline.
   */
  static async getAccuracyContext(
    worldTheme: string,
    originalStorySummary: string,
    onProgress?: (msg: string) => void
  ): Promise<TimelineAccuracyResult> {
    // Bước 1: Nhận diện nguyên tác & ngôn ngữ
    const origin = await this.detectOriginAndKeywords(worldTheme, originalStorySummary, onProgress);

    // Bước 2: Kích hoạt Google Search Grounding tra cứu
    const searchSummary = await this.performNativeSearch(origin.nativeQuery, origin.originLanguage, onProgress);

    if (onProgress) {
      onProgress('[Giám sát] Đã tổng hợp dữ liệu niên biểu chuẩn xác từ nguyên tác!');
    }

    const accuracyContext = `
=== THÔNG TIN ĐỐI CHIẾU TRA CỨU NGUYÊN TÁC TRỰC TUYẾN ===
- Quốc gia/Ngôn ngữ nguyên tác: ${origin.originLanguage}
- Tên gốc bản địa: ${origin.nativeTitle}
- Dữ liệu niên biểu trích xuất từ tìm kiếm thực tế:
${searchSummary}
======================================================
`;

    return {
      originLanguage: origin.originLanguage,
      nativeTitle: origin.nativeTitle,
      nativeQuery: origin.nativeQuery,
      searchSummary,
      accuracyContext
    };
  }
}
