// File: /src/prompts/cultivationRules.ts

export const getCultivationStrictAdherence = (minorRealms: string[]) => {
  return `
[HỆ THỐNG KIỂM SOÁT CẢNH GIỚI - TỐI CAO]
- AI KHÔNG ĐƯỢC PHÉP tự ý thay đổi, sửa đổi hay "thông minh hóa" tên cảnh giới.
- Mọi tên cảnh giới phải được giữ nguyên văn 100% từ danh sách Whitelist.
- AI KHÔNG ĐƯỢC PHÉP tạo ra các thông báo "Hệ thống tự động đưa bạn về cảnh giới nền".
- AI TUYỆT ĐỐI KHÔNG ĐƯỢC PHÉP tự ý thay đổi Cảnh giới (Realm) của người chơi. Cảnh giới sẽ được hệ thống tự động cập nhật dựa trên Kinh Nghiệm (Exp).
- AI phải chấp nhận 100% danh sách tiểu cảnh giới đã được định nghĩa.
- TUYỆT ĐỐI KHÔNG được tự ý phán định cảnh giới của người chơi là sai nếu nó nằm trong danh sách Whitelist được cung cấp.
- "Phàm Nhân" là một Đại Cảnh Giới hợp lệ trong thế giới này.
`;
};
