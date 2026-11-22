/**
 * satthuonglogcombatold.ts
 * 
 * Định nghĩa cấu trúc, cú pháp Tag, Interface và Hướng dẫn AI cho việc 
 * tính toán sát thương, biến động HP/MP và gán trạng thái trong Nhật Ký Chiến Đấu & Hội Thoại (Neon Roleplay).
 */

export interface CombatTag {
  type: 'HP_CHANGE' | 'MP_CHANGE' | 'STATUS';
  target: 'player' | 'enemy' | 'companion' | string;
  amount?: number;
  effect?: string;
  duration?: number;
  source?: string;
  skill?: string;
  raw: string;
}
export interface HpChangeTag extends CombatTag {
  type: 'HP_CHANGE';
  amount: number; // Âm: mất HP, Dương: hồi HP
}

export interface MpChangeTag extends CombatTag {
  type: 'MP_CHANGE';
  amount: number; // Âm: tiêu tốn MP, Dương: hồi MP
}

export interface StatusTag extends CombatTag {
  type: 'STATUS';
  effect: string;
  duration: number; // Số lượt
}

// Biểu thức chính quy (Regex) quét các tag chiến đấu chuẩn (bao gồm cả COMBAT_ACTION mới)
export const COMBAT_TAG_REGEX = /\[(HP_CHANGE|MP_CHANGE|STATUS|COMBAT_ACTION):\s*([^\]]+)\]/gi;

// Biểu thức quét cả định dạng text tiếng Việt tự nhiên nếu AI diễn giải trực tiếp
export const NATURAL_HP_LOSS_REGEX = /([^\n.]+?)\s*(?:mất|bị trừ|nhận|tổn hại|giảm)\s*([\d,.]+)\s*(?:điểm\s*)?HP/gi;
export const NATURAL_MP_LOSS_REGEX = /([^\n.]+?)\s*(?:tiêu tốn|tiêu hao|tốn|mất|giảm)\s*([\d,.]+)\s*(?:điểm\s*)?MP/gi;
export const NATURAL_HP_GAIN_REGEX = /([^\n.]+?)\s*(?:hồi phục|hồi|nhận thêm|tăng)\s*([\d,.]+)\s*(?:điểm\s*)?HP/gi;

/**
 * Khối hướng dẫn quy định về Tag gửi kèm vào System Prompt cho AI
 */
export const COMBAT_TAG_INSTRUCTIONS = `
<huong_dan_tag_chien_dau>
   <luat_hanh_dong_co_hoc_+huong_dan_tag_chien_dau>
================
[QUY TẮC PHÂN CÔNG QUYẾT ĐỊNH CHIẾN ĐẤU & Ý ĐỒ HÀNH ĐỘNG]
Để đảm bảo chỉ số sát thương/hồi máu chính xác, AI TUYỆT ĐỐI không tự ý bốc thuốc số hay tính nhẩm HP. Hãy sử dụng tag hành động [COMBAT_ACTION] để cơ chế cơ học tự động tính toán sát thương thực tế dựa trên chỉ số nhân vật:

1. Định dạng Tag Ý đồ Hành động (COMBAT_ACTION):
   - Tấn công kẻ địch:
     [COMBAT_ACTION: source="player", target="enemy", action="attack", skill="Tên_Chiêu_Thức", hit_type="crit|normal|glance"]
   - Trị liệu/Hồi phục:
     [COMBAT_ACTION: source="Tên_Người_Hồi", target="Tên_Người_Nhận", action="heal", skill="Tên_Chiêu_Thức", intensity="high|medium|low"]
   - Kích hoạt Buff/Hiệu ứng:
     [COMBAT_ACTION: source="player", target="self", action="buff", skill="Tên_Hộ_Thể", duration="3"]

* Lưu ý: "source" và "target" có thể điền: "player" (hoặc "mc"), "enemy" hoặc "ID@@Tên_NPC" (ví dụ: "npc_01@@Huyết Ma").

2. Các tag biến động thủ công (HP_CHANGE, MP_CHANGE, STATUS - fallback hỗ trợ):
   - [HP_CHANGE: target="enemy", amount="-125000", source="player", skill="Cửu Thiên Lôi Đình"]
   - [MP_CHANGE: target="player", amount="-15000", skill="Cửu Thiên Lôi Đình"]
   - [STATUS: target="enemy", effect="Trúng Độc", duration="3", source="player"]
   - [FACTION_CHANGE: target="Tên_NPC" faction="ally"|"enemy"|"neutral"]
   - [SUMMON_ALLY: name="Kiếm Linh" hp="80000" mp="30000" atk="15000" faction="ally"]

Ví dụ ở cuối phản hồi:
[COMBAT_ACTION: source="player", target="enemy", action="attack", skill="Cửu Thiên Lôi Đình", hit_type="crit"]
[COMBAT_ACTION: source="enemy", target="player", action="attack", skill="Hoả Cầu Thuật", hit_type="normal"]
[MP_CHANGE: target="player", amount="-15000", skill="Cửu Thiên Lôi Đình"]
================
   </luat_hanh_dong_co_hoc_+huong_dan_tag_chien_dau>
</huong_dan_tag_chien_dau>
`;
