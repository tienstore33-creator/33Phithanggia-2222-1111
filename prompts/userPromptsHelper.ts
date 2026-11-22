/**
 * Helper định dạng "Lời nhắc cho AI" (userPrompts) của người dùng
 * Bọc trong nhãn <loinhacAI>, mỗi lời nhắc bên trong bọc tiếp tầng 2 <loinhacAI_#i>
 */
export const formatUserPromptsBlock = (userPrompts?: string[]): string => {
  if (!userPrompts || !Array.isArray(userPrompts) || userPrompts.length === 0) {
    return "";
  }

  const validPrompts = userPrompts.map(p => (typeof p === 'string' ? p.trim() : '')).filter(Boolean);
  if (validPrompts.length === 0) {
    return "";
  }

  const innerTags = validPrompts.map((prompt, index) => {
    return `  <loinhacAI_#${index + 1}>\n================\n${prompt}\n================\n  </loinhacAI_#${index + 1}>`;
  }).join("\n");

  return `
<loinhacAI>
================
[QUY TẮC BẮT BUỘC TỪ NGƯỜI CHƠI (LỜI NHẮC CHO AI)]:
Đây là các quy tắc tối thượng do người chơi trực tiếp thiết lập. Bạn BẮT BUỘC PHẢI tuân thủ nghiêm ngặt trong mọi tình huống và lời kể.
${innerTags}
================
</loinhacAI>
`;
};
