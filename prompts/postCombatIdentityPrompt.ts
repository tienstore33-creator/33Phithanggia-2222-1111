/**
 * Prompt module for Post-Combat NPC Identity Revelation (Battle+1).
 * Generates instructions for the main AI Storyteller when a generic enemy is defeated
 * and identity revelation or naming occurs in the turn right after combat.
 */

export const POST_COMBAT_IDENTITY_PROMPT = `
<dinh_danh_npc_sau_chien_dau>
   <luat_dinh_danh_+dinh_danh_npc_sau_chien_dau>
================
1. QUY TẮC ĐỒNG BỘ THỂ LOẠI (GENRE MATCHING):
   - Khi kẻ địch trong trận chiến mang tên chung chung (ví dụ: "Tên cướp B", "Đệ tử A", "Cô gái lạ mặt", "Sát thủ số 3"), AI BẮT BUỘC phải lồng ghép lời kể tiết lộ danh tính thật, lai lịch ngắn gọn và ban cho nhân vật đó một tên gọi chính thức.
   - Phong cách đặt tên PHẢI tuân thủ thuộc tính thể loại (\${genre}):
     + Tu Tiên / Huyền Huyễn: Tên Hán Việt có họ tên đầy đủ (ví dụ: Tên cướp B -> Lộ Hãn Hãn, Đệ tử A -> Trịnh Sơn).
     + Cyberpunk / Sci-Fi: Tên máy móc / Code-name / Biệt hiệu kỹ thuật (ví dụ: Sát thủ số 3 -> AX-709 "Zero", Kẻ lạ mặt -> Rust-Byte).
     + Tây Phương Fantasy: Tên phong cách Âu Mỹ / Cổ điển (ví dụ: Tên cướp B -> Roderick Blackwood, Cô gái lạ mặt -> Elaria).
     + Thế giới Nguyên tác / Fanfiction: Đặt tên phù hợp với quy tắc họ tộc, thế gia hoặc văn phong của nguyên tác đó.

2. QUY TẮC CHỐNG TẠO MỚI TRÙNG LẶP (ANTI-DUPLICATE RULE):
   - TUYỆT ĐỐI KHÔNG ĐƯỢC coi nhân vật được đổi tên là một NPC hoàn toàn mới.
   - Trong khối <update_data>, BẮT BUỘC phải viết lệnh đổi tên rõ ràng:
     "Cập nhật: [Tên chung chung cũ] đã đổi tên thành [Tên mới chính thức]."
   - NGHIÊM CẤM viết các câu lệnh dạng: "Cập nhật: tạo NPC mới [Tên mới]" hoặc "Cập nhật: bắt tù nhân [Tên mới]" khi nhân vật đó vốn là [Tên chung chung cũ] vừa chiến đấu xong.
================
   </luat_dinh_danh_+dinh_danh_npc_sau_chien_dau>
</dinh_danh_npc_sau_chien_dau>
`;

export const getPostCombatIdentityPrompt = (genre?: string): string => {
  const currentGenre = genre || "Tu Tiên (Mặc định)";
  return POST_COMBAT_IDENTITY_PROMPT.replace(/\$\{genre\}/g, currentGenre);
};
