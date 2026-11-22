
import { removeThinkingBlocks } from './xmlSanitizerUtils';

/**
 * Trích xuất mảng tags từ phản hồi JSON của Fast Agent
 */
export function extractTagsFromJsonResponse(rawText: string): string[] {
  if (!rawText || typeof rawText !== 'string') return [];

  // 1. Áp dụng quy chế lọc thẻ XML mồ côi và cắt bỏ khối suy nghĩ
  const cleanText = removeThinkingBlocks(rawText);

  // 2. Thử parse trực tiếp nếu cleanText đã là JSON hợp lệ
  try {
    // Tìm vị trí mở { và đóng } ngoài cùng của JSON
    const firstBrace = cleanText.indexOf('{');
    const lastBrace = cleanText.lastIndexOf('}');
    if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
      const jsonString = cleanText.slice(firstBrace, lastBrace + 1);
      const parsed = JSON.parse(jsonString);
      if (parsed && Array.isArray(parsed.tags)) {
        return parsed.tags
          .filter((t: unknown) => typeof t === 'string' && t.trim().length > 0)
          .map((t: string) => t.trim());
      }
    }
  } catch {
    // Bỏ qua lỗi JSON.parse và chuyển sang fallback an toàn
  }

  // 3. Fallback bóc tách mảng "tags": [ ... ] an toàn không bị ngắt ở dấu ] bên trong chuỗi string
  const tagsKeyIndex = cleanText.indexOf('"tags"');
  if (tagsKeyIndex !== -1) {
    const openBracketIndex = cleanText.indexOf('[', tagsKeyIndex);
    if (openBracketIndex !== -1) {
      // Tìm dấu đóng ] tương ứng bằng cách quét chuỗi và bỏ qua các dấu ] nằm trong dấu ngoặc kép "..."
      let inString = false;
      let escapeNext = false;
      let closeBracketIndex = -1;

      for (let i = openBracketIndex + 1; i < cleanText.length; i++) {
        const char = cleanText[i];
        if (escapeNext) {
          escapeNext = false;
          continue;
        }
        if (char === '\\') {
          escapeNext = true;
          continue;
        }
        if (char === '"') {
          inString = !inString;
          continue;
        }
        if (char === ']' && !inString) {
          closeBracketIndex = i;
          break;
        }
      }

      if (closeBracketIndex !== -1) {
        const arrayString = cleanText.slice(openBracketIndex, closeBracketIndex + 1);
        try {
          const parsedArray = JSON.parse(arrayString);
          if (Array.isArray(parsedArray)) {
            return parsedArray
              .filter((t: unknown) => typeof t === 'string' && t.trim().length > 0)
              .map((t: string) => t.trim());
          }
        } catch {
          // Nếu parse mảng con lỗi, dùng Regex quét các phần tử dạng "[TAG_NAME: ...]" bên trong mảng đó
          const tagMatches = arrayString.match(/\[[A-Z_]+(?::\s*(?:[^[\]]|\[[^[\]]*\])*)?\]/g);
          if (tagMatches) {
            return tagMatches.map(t => t.trim());
          }
        }
      }
    }
  }

  return [];
}

/**
 * Utility for robust JSON parsing, especially for AI-generated content.
 */
export const safeJsonParse = (text: string) => {
    if (!text) return { tags: [] };
    
    // Áp dụng lọc XML và thinking blocks trước khi parse
    const cleanText = removeThinkingBlocks(text);

    try {
        // Remove markdown code blocks and excess whitespace
        let clean = cleanText.replace(/```json|```/g, "").trim();
        
        // Basic pattern cleanup: remove trailing commas in arrays/objects
        clean = clean.replace(/,\s*\]/g, "]").replace(/,\s*\}/g, "}");
        
        const parsed = JSON.parse(clean);
        if (parsed && typeof parsed === 'object') {
            return parsed;
        }
    } catch (e) {
        // Try boundary isolation for array or object
        try {
            let clean = cleanText.replace(/```json|```/g, "").trim();
            const firstBracket = clean.indexOf('[');
            const lastBracket = clean.lastIndexOf(']');
            if (firstBracket !== -1 && lastBracket !== -1 && lastBracket > firstBracket) {
                let arrayStr = clean.slice(firstBracket, lastBracket + 1);
                arrayStr = arrayStr.replace(/,\s*\]/g, "]").replace(/,\s*\}/g, "}");
                const parsedArray = JSON.parse(arrayStr);
                if (Array.isArray(parsedArray)) {
                    return parsedArray;
                }
            }

            const firstBrace = clean.indexOf('{');
            const lastBrace = clean.lastIndexOf('}');
            if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
                let objStr = clean.slice(firstBrace, lastBrace + 1);
                objStr = objStr.replace(/,\s*\]/g, "]").replace(/,\s*\}/g, "}");
                const parsedObj = JSON.parse(objStr);
                if (parsedObj && typeof parsedObj === 'object') {
                    return parsedObj;
                }
            }
        } catch {
            // Ignore boundary isolation error and continue to fallback
        }
        console.warn("safeJsonParse failed, attempting targeted fallback extraction:", e);
    }

    // Fallback: Nếu JSON là broken, dùng hàm trích xuất chuyên dụng đã viết ở trên
    const extractedTags = extractTagsFromJsonResponse(text);

    // Fallback extraction for string fields that might be lost due to JSON parsing errors
    const extractStringField = (fieldName: string) => {
        const keyIndex = cleanText.indexOf(`"${fieldName}"`);
        if (keyIndex === -1) return undefined;
        
        const colonIndex = cleanText.indexOf(':', keyIndex + fieldName.length + 2);
        if (colonIndex === -1) return undefined;
        
        const quoteIndex = cleanText.indexOf('"', colonIndex);
        if (quoteIndex === -1) return undefined;
        
        let closingQuoteIndex = -1;
        for (let i = quoteIndex + 1; i < cleanText.length; i++) {
            if (cleanText[i] === '"' && cleanText[i-1] !== '\\') {
                let j = i + 1;
                while (j < cleanText.length && /\s/.test(cleanText[j])) j++;
                if (j === cleanText.length || cleanText[j] === ',' || cleanText[j] === '}' || cleanText.indexOf('"', j) !== -1) {
                    closingQuoteIndex = i;
                    break;
                }
            }
        }
        
        if (closingQuoteIndex !== -1) {
            let val = cleanText.substring(quoteIndex + 1, closingQuoteIndex);
            return val.replace(/\\"/g, '"').replace(/\\n/g, '\n').replace(/\\\\/g, '\\');
        }
        return undefined;
    };

    const flashSummary = extractStringField('flashSummary');
    const flashDetails = extractStringField('flashDetails');

    return { 
        tags: extractedTags,
        ...(flashSummary && { flashSummary }),
        ...(flashDetails && { flashDetails })
    };
};

