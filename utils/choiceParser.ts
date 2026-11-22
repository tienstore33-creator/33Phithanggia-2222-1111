import { AiChoice } from '../types';

/**
 * Hàm làm sạch cơ học các tiền tố và ký tự đặc biệt của lựa chọn
 * Hỗ trợ các định dạng:
 * - "1 | Chạy đi", "1| Chạy đi"
 * - "1 . Chạy đi", "1. Chạy đi"
 * - "1/ Chạy đi", "1) Chạy đi", "1: Chạy đi", "1- Chạy đi"
 * - "[Choice 1] Chạy đi", "Choice 1: Chạy đi", "[1] Chạy đi"
 * - Ký hiệu bullet: -, *, +, •
 * - Các ngoặc kép hoa mỹ: "...", '...', «...», “...”
 */
export const cleanChoiceText = (text: string): string => {
  let cleaned = text.trim();
  
  // Regex loại bỏ tổ hợp tiền tố số, bullet phức tạp
  const prefixRegex = /^(?:\[choice\s*\d+\]|choice\s*\d+\s*[:\-]?|\[\d+\]|\d+\s*[\.\|\/\)\:\-]\s*|[-*+•]\s*)+/i;
  
  cleaned = cleaned.replace(prefixRegex, '').trim();
  
  // Loại bỏ dấu ngoặc kép hoặc đơn bao quanh (kể cả ngoặc kép thông minh/bản địa)
  cleaned = cleaned.replace(/^["'«»“”]|["'«»“”]$/g, '').trim();
  
  return cleaned;
};

/**
 * Tách và xử lý các thẻ [CHOICE: ...] từ phản hồi của AI.
 * Hỗ trợ định dạng mới: [CHOICE: "Hành động" - "Suy nghĩ chủ quan"]
 * Đồng thời hỗ trợ bóc tách linh hoạt từ cặp thẻ <choice>...</choice> kể cả khi không có tag [CHOICE].
 */
export const parseChoices = (text: string): AiChoice[] => {
  if (!text) return [];

  const choices: AiChoice[] = [];
  
  // 1. Tìm các tag [CHOICE: ...] truyền thống (không phân biệt hoa thường)
  const choiceRegex = /\[CHOICE:\s*((?:[^\[\]]|\[[^\[\]]*\])*)\]/gi;
  let match;

  while ((match = choiceRegex.exec(text)) !== null) {
    let fullContent = match[1].trim();
    // Loại bỏ dấu ngoặc kép bao quanh nếu có
    fullContent = fullContent.replace(/^["'«»“”]|["'«»“”]$/g, '');
    
    // Tách hành động và suy nghĩ bằng dấu gạch ngang (-)
    const parts = fullContent.split(/\s*-\s*/);
    
    if (parts.length > 1) {
      choices.push({
        text: cleanChoiceText(parts[0]),
        thought: cleanChoiceText(parts[1])
      });
    } else {
      choices.push({
        text: cleanChoiceText(fullContent)
      });
    }
  }

  // 2. Dự phòng: Nếu không tìm thấy tag [CHOICE], thử tìm kiếm trong các cặp thẻ <choice>, <choices>, <branches>
  if (choices.length === 0) {
    const choiceBlockRegex = /<(choice|choices|branches)>([\s\S]*?)<\/\1>/gi;
    let blockMatch;

    while ((blockMatch = choiceBlockRegex.exec(text)) !== null) {
      const blockContent = blockMatch[2].trim();
      
      // Tách thành các dòng để duyệt
      const lines = blockContent.split(/\n+/);
      for (let line of lines) {
        line = line.trim();
        if (!line) continue;

        // Nếu dòng này vẫn chứa tag [CHOICE] nhưng vì lý do nào đó regex ở bước 1 bỏ sót
        const nestedMatch = line.match(/\[CHOICE:\s*((?:[^\[\]]|\[[^\[\]]*\])*)\]/i);
        let itemText = line;
        if (nestedMatch) {
          itemText = nestedMatch[1].trim();
        }

        // Làm sạch tiền tố số/bullet và các dấu ngoặc kép thừa
        itemText = cleanChoiceText(itemText);

        if (itemText) {
          const parts = itemText.split(/\s*-\s*/);
          if (parts.length > 1) {
            choices.push({
              text: cleanChoiceText(parts[0]),
              thought: cleanChoiceText(parts[1])
            });
          } else {
            choices.push({
              text: itemText
            });
          }
        }
      }
    }
  }

  return choices;
};
