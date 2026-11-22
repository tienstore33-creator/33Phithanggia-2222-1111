
export class StrictLibrarianService {
  /**
   * Tìm kiếm chính xác các đoạn văn bản chứa từ khóa thủ công bằng JS thuần.
   **/
  static strictSearch(rawText: string, keyword: string, windowSize: number = 1000): string[] {
    const findings: string[] = [];
    if (!rawText || !keyword) return findings;
    
    let pos = rawText.indexOf(keyword);
    
    while (pos !== -1) {
      const start = Math.max(0, pos - windowSize);
      const end = Math.min(rawText.length, pos + keyword.length + windowSize);
      findings.push(rawText.substring(start, end));
      pos = rawText.indexOf(keyword, pos + 1);
    }
    return findings;
  }
}
