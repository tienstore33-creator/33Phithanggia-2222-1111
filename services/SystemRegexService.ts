/**
 * System-level Regex Service
 * Xử lý làm sạch bối cảnh hệ thống (Prompt) và kết quả trả về của AI (Response)
 */

/**
 * Trích xuất nội dung nằm giữa tag mở và tag đóng, hỗ trợ cả thẻ unclosed khi streaming
 * @param text Văn bản gốc
 * @param tagName Tên thẻ (không bao gồm < >)
 * @returns Nội dung bên trong hoặc null
 */
export const extractTagContent = (text: string, tagName: string): string | null => {
  if (!text) return null;
  const regex = new RegExp(`<${tagName}>([\\s\\S]*?)(?:<\/${tagName}>|$)`, 'i');
  const match = text.match(regex);
  return match ? match[1].trim() : null;
};

/**
 * Loại bỏ các thẻ hệ thống để lấy nội dung truyện thuần túy hiển thị ra UI
 * @param text Văn bản gốc
 * @returns Văn bản đã làm sạch
 */
export const cleanRawText = (text: string): string => {
  if (!text) return "";
  
  let cleaned = text;

  // Loại bỏ tag tóm tắt lượt [SUMMARYText: ...] nếu còn sót
  cleaned = cleaned.replace(/\[SUMMARYText:\s*[\s\S]*?\]/gi, "");

  // Loại bỏ các thẻ richsummary_X nếu vô tình bị lặp lại hoặc rò rỉ trong câu chuyện
  cleaned = cleaned.replace(/<richsummary_\d+>[\s\S]*?(?:<\/richsummary_\d+>|$)/gi, "");

  // Danh sách các thẻ cần loại bỏ hoàn toàn (bao gồm cả nội dung bên trong, hỗ trợ unclosed)
  // Không bao gồm 'thinking' để UI có thể hiển thị trong Dev Mode
  const tagsToRemove = [
    'table_stored',
    'tableThink',
    'tableEdit',
    'table_rule',
    'memory_table_guide',
    'user_input',
    'tom_tat_luot_truoc',
    'word_count',
    'finish'
  ];

  tagsToRemove.forEach(tag => {
    const regex = new RegExp(`<${tag}>[\\s\\S]*?(?:<\/${tag}>|$)`, 'gi');
    cleaned = cleaned.replace(regex, '');
  });

  // Thu thập các khối <details> và <branches> để đưa vào <system_analysis>
  const detailsBlocks: string[] = [];
  const detailsRegex = /<details>([\s\S]*?)(?:<\/details>|$)/gi;
  let detailsMatch;
  while ((detailsMatch = detailsRegex.exec(cleaned)) !== null) {
    detailsBlocks.push(detailsMatch[0]);
  }
  cleaned = cleaned.replace(detailsRegex, '');

  const branchesBlocks: string[] = [];
  const branchesRegex = /<branches>([\s\S]*?)(?:<\/branches>|$)/gi;
  let branchesMatch;
  while ((branchesMatch = branchesRegex.exec(cleaned)) !== null) {
    branchesBlocks.push(branchesMatch[0]);
  }
  cleaned = cleaned.replace(branchesRegex, '');

  const extraAnalysisContent = [...detailsBlocks, ...branchesBlocks].join("\n\n");

  // Trích xuất nội dung của <logic_thiencam> và loại bỏ thẻ này, đưa nội dung hòa cùng vào <thinking> hoặc <think>
  let logicThiencamContent = "";
  const logicThiencamRegex = /<logic_thiencam>([\s\S]*?)(?:<\/logic_thiencam>|$)/gi;
  let tempMatch;
  while ((tempMatch = logicThiencamRegex.exec(cleaned)) !== null) {
    logicThiencamContent += (logicThiencamContent ? "\n\n" : "") + tempMatch[1].trim();
  }
  cleaned = cleaned.replace(logicThiencamRegex, '');

  // Tìm và gộp vào <thinking> hoặc <think>
  let thinkingBody = "";
  let hasThinking = false;
  let useThinkTag = false;

  const thinkingContent = extractTagContent(cleaned, 'thinking');
  if (thinkingContent !== null) {
    thinkingBody = thinkingContent;
    hasThinking = true;
  } else {
    const thinkContent = extractTagContent(cleaned, 'think');
    if (thinkContent !== null) {
      thinkingBody = thinkContent;
      hasThinking = true;
      useThinkTag = true;
    }
  }

  if (logicThiencamContent) {
    if (hasThinking) {
      thinkingBody = `${logicThiencamContent}\n\n${thinkingBody}`.trim();
    } else {
      thinkingBody = logicThiencamContent;
      hasThinking = true;
    }
  }

  if (hasThinking) {
    // Xóa thẻ cũ
    cleaned = cleaned.replace(/<(?:thinking|think)>[\s\S]*?(?:<\/(?:thinking|think)>|$)/gi, '');
    const tagName = useThinkTag ? 'think' : 'thinking';
    // Chèn lại thẻ mới có chứa nội dung đã gộp
    cleaned = `<${tagName}>\n${thinkingBody}\n</${tagName}>\n` + cleaned;
  }

  // Ưu tiên: Nếu có <content>, ta vẫn muốn lấy nội dung trong <content> nhưng có ghép thêm các khối quan trọng khác như <thinking>, <update_data>, <entity_tracking>, v.v.
  const contentBody = extractTagContent(cleaned, 'content');
  if (contentBody) {
      const thinkingBlock = cleaned.match(/<(?:thinking|think)>[\s\S]*?(?:<\/(?:thinking|think)>|$)/gi)?.[0] || "";
      const updateDataBlock = cleaned.match(/<update_data>[\s\S]*?(?:<\/update_data>|$)/gi)?.[0] || "";
      const entityTrackingBlock = cleaned.match(/<entity_tracking>[\s\S]*?(?:<\/entity_tracking>|$)/gi)?.[0] || "";
      const secretActionBlock = cleaned.match(/<SECRET_ACTION>[\s\S]*?(?:<\/SECRET_ACTION>|$)/gi)?.[0] || "";

      let remainingText = cleaned;
      remainingText = remainingText.replace(/<content\b[^>]*>[\s\S]*?(?:<\/content>|$)/gi, '');
      remainingText = remainingText.replace(/<(?:thinking|think)\b[^>]*>[\s\S]*?(?:<\/(?:thinking|think)>|$)/gi, '');
      remainingText = remainingText.replace(/<update_data\b[^>]*>[\s\S]*?(?:<\/update_data>|$)/gi, '');
      remainingText = remainingText.replace(/<world_pulse\b[^>]*>[\s\S]*?(?:<\/world_pulse>|$)/gi, '');
      remainingText = remainingText.replace(/<faction_dynamics\b[^>]*>[\s\S]*?(?:<\/faction_dynamics>|$)/gi, '');
      remainingText = remainingText.replace(/<entity_tracking\b[^>]*>[\s\S]*?(?:<\/entity_tracking>|$)/gi, '');
      remainingText = remainingText.replace(/<warudo_secret\b[^>]*>[\s\S]*?(?:<\/warudo_secret>|$)/gi, '');
      remainingText = remainingText.replace(/<SECRET_ACTION\b[^>]*>[\s\S]*?(?:<\/SECRET_ACTION>|$)/gi, '');

      let parts = [];
      if (thinkingBlock) parts.push(thinkingBlock);
      parts.push(contentBody);
      if (updateDataBlock) parts.push(updateDataBlock);
      if (entityTrackingBlock) parts.push(entityTrackingBlock);
      if (secretActionBlock) parts.push(secretActionBlock);

      let otherTagsContent = remainingText.trim();
      if (extraAnalysisContent) {
          otherTagsContent = otherTagsContent ? `${otherTagsContent}\n\n${extraAnalysisContent}` : extraAnalysisContent;
      }

      if (otherTagsContent) {
          parts.push(`<system_analysis>\n${otherTagsContent}\n</system_analysis>`);
      }

      return parts.join("\n\n");
  }

  // Fallback: Xóa nốt thẻ <content> rỗng hoặc lỗi nếu còn sót
  cleaned = cleaned.replace(/<\/?content>/gi, '');

  let result = cleaned.trim();
  if (extraAnalysisContent) {
      result += `\n\n<system_analysis>\n${extraAnalysisContent}\n</system_analysis>`;
  }

  return result.trim();
};

export const cleanText = (text: string): string => {
  return cleanRawText(text);
};

export const SystemRegexService = {
  /**
   * Làm sạch và tối ưu Prompt hệ thống trước khi gửi tới AI
   */
  processSystemPrompt: (prompt: string): string => {
    if (!prompt) return "";

    let processed = prompt;

    // 1. Chuẩn hóa dải phân cách context (biến các chuỗi gạch ngang dài thành chuẩn '---')
    processed = processed.replace(/-{4,}/g, '---');

    // 2. Loại bỏ các khoảng trắng thừa ở cuối mỗi dòng
    processed = processed.replace(/[ \t]+$/gm, '');

    // 3. Hợp nhất nhiều dòng trống liên tiếp thành tối đa 2 dòng (giữ cấu trúc nhưng tiết kiệm token)
    processed = processed.replace(/\n{3,}/g, '\n\n');

    // 4. Loại bỏ các tab thừa thường xuất hiện khi ghép các khối code
    processed = processed.replace(/\t/g, '  ');

    return processed.trim();
  },

  /**
   * Làm sạch phản hồi từ AI trước khi hiển thị cho người dùng hoặc parse dữ liệu
   */
  sanitizeAiResponse: (text: string): string => {
    if (!text) return "";

    let cleaned = text;

    // Lọc sạch các tag rác hệ thống thông qua cleanRawText
    cleaned = cleanRawText(cleaned);

    // 1. Loại bỏ các tiền ngữ AI (AI chatter) thường gặp
    const noisePrefixes = [
      /^Dưới đây là nội dung tiếp theo của câu chuyện:?\n*/i,
      /^Tất nhiên, tôi sẽ tiếp tục:?\n*/i,
      /^Chắc chắn rồi.?\n*/i,
      /^Dưới đây là kết quả:?\n*/i
    ];
    noisePrefixes.forEach(regex => {
      cleaned = cleaned.replace(regex, '');
    });

    // 2. Loại bỏ các marker kết thúc hoặc tag mô tả thừa mà AI tự bịa ra
    cleaned = cleaned.replace(/\[(END|FINISH|COMPLETED)\]/gi, '');
    cleaned = cleaned.replace(/---+\s*$/g, ''); // Gạch ngang thừa ở cuối

    // 3. Xử lý triệt để các khối Markdown code block nếu AI bao bọc text thuần trong đó
    if (cleaned.startsWith('```') && cleaned.endsWith('```')) {
       cleaned = cleaned.replace(/^```[a-z]*\n/i, '').replace(/\n```$/m, '');
    }

    // 4. Loại bỏ các ký tự điều khiển lạ phát sinh trong quá trình stream
    cleaned = cleaned.replace(/[\u0000-\u0008\u000B-\u000C\u000E-\u001F]/g, "");

    return cleaned.trim();
  }
};
