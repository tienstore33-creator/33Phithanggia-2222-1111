
/**
 * Helper Service to extract context from previous turns and format RAG tags
 */
export const RagContextExtractor = {
  /**
   * Trích xuất nội dung bên trong <content> và tất cả văn bản phi-XML
   * Lọc bỏ các thẻ kỹ thuật như <thinking>, <update_data>, v.v.
   */
  extractLastNarrationContext(rawAiResponse: string): string {
    if (!rawAiResponse) return "";

    // 1. Lấy nội dung trong <content>
    const contentMatch = rawAiResponse.match(/<content>([\s\S]*?)<\/content>/);
    const contentBody = contentMatch ? contentMatch[1].trim() : "";

    // 2. Lấy văn bản phi-XML (không nằm trong bất kỳ cặp thẻ <tag>...</tag> nào)
    // Loại bỏ các khối thẻ phổ biến trước
    let plainText = rawAiResponse
      .replace(/<thinking>[\s\S]*?<\/thinking>/g, "")
      .replace(/<update_data>[\s\S]*?<\/update_data>/g, "")
      .replace(/<json_data>[\s\S]*?<\/json_data>/g, "")
      .replace(/<content>[\s\S]*?<\/content>/g, "")
      .replace(/\[TAG_[\s\S]*?\]/g, "");

    // Loại bỏ các thẻ lẻ còn sót lại
    plainText = plainText.replace(/<[^>]+>/g, "").trim();

    return (contentBody + "\n" + plainText).trim();
  },

  /**
   * Định dạng kết quả RAG theo cấu trúc XML lượt lời cụ thể
   */
  formatRagWithTurnTag(chunks: { text: string; score: number }[], turn: number): string {
    const formattedChunks = (!chunks || chunks.length === 0) 
      ? "(Không có chunk tri thức RAG nào khớp với truy vấn ở lượt này)"
      : chunks
          .map((c, i) => `<chunk_${i + 1} score="${c.score.toFixed(4)}">\n${c.text}\n</chunk_${i + 1}>`)
          .join("\n\n");

    return `<Rag_luot_${turn}_+qui_tac_tri_thuc>
================
${formattedChunks}
================
</Rag_luot_${turn}_+qui_tac_tri_thuc>`;
  }
};
