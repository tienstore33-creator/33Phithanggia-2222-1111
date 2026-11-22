import { removeTuongThanTag } from '../../utils/xmlSanitizerUtils';

export class StreamThinkingParser {
  private isThinking: boolean = false;
  private buffer: string = '';

  constructor(initialIsThinking: boolean = false) {
    this.isThinking = initialIsThinking;
  }

  /**
   * Xử lý từng đoạn văn bản AI trả về trong Stream
   * @returns { contentChunk: string, thinkingChunk: string }
   */
  public parseChunk(chunk: string): { contentChunk: string, thinkingChunk: string } {
    let contentChunk = '';
    let thinkingChunk = '';
    
    // Loại bỏ thẻ prethinking và tuong_than nếu xuất hiện trong chunk
    let cleanedChunk = removeTuongThanTag(chunk);
    cleanedChunk = cleanedChunk.replace(/<prethinking>/gi, '');
    cleanedChunk = cleanedChunk.replace(/<\/prethinking>/gi, '');
    
    this.buffer += cleanedChunk;

    // Logic State Machine cơ bản để tìm thẻ <think>/<thinking> và </think>/</thinking>
    while (this.buffer.length > 0) {
      if (!this.isThinking) {
        // Tìm bất kỳ thẻ mở nào: <think> hoặc <thinking>
        const thinkStart = this.buffer.search(/<(thinking|think)>/i);
        if (thinkStart !== -1) {
          // Xác định thẻ cụ thể để biết độ dài nhảy qua
          const match = this.buffer.match(/<(thinking|think)>/i);
          const tagLength = match ? match[0].length : 7;
          
          // Lấy phần nội dung trước thẻ nghĩ
          contentChunk += this.buffer.substring(0, thinkStart);
          this.isThinking = true;
          this.buffer = this.buffer.substring(thinkStart + tagLength);
        } else {
          // Đảm bảo không cắt ngang chữ thẻ đang viết dở
          if (this.buffer.includes('<') && this.buffer.length - this.buffer.lastIndexOf('<') < 10) {
             break; // Đợi chunk tiếp theo
          }
          contentChunk += this.buffer;
          this.buffer = '';
        }
      } else {
        // Tìm bất kỳ thẻ đóng nào: </think> hoặc </thinking>
        const thinkEnd = this.buffer.search(/<\/(thinking|think)>/i);
        if (thinkEnd !== -1) {
          const match = this.buffer.match(/<\/(thinking|think)>/i);
          const tagLength = match ? match[0].length : 8;
          
          // Luồng tư duy kết thúc
          thinkingChunk += this.buffer.substring(0, thinkEnd);
          this.isThinking = false;
          this.buffer = this.buffer.substring(thinkEnd + tagLength);
        } else {
          if (this.buffer.includes('</') && this.buffer.length - this.buffer.lastIndexOf('</') < 11) {
             break; // Đợi chunk tiếp theo
          }
          thinkingChunk += this.buffer;
          this.buffer = '';
        }
      }
    }

    return { contentChunk, thinkingChunk };
  }
}
