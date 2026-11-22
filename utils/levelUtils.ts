import { KnowledgeBase, NPC } from '../types';

export const getSystemConfig = (kb: KnowledgeBase) => {
  // Use worldConfig properties if they exist, otherwise fallback to cultivationSystem or defaults
  const dai = kb.worldConfig?.daiCanhGioi || 
              kb.worldConfig?.cultivationSystem?.parsedMajors?.map(m => m.name) || 
              ["Phàm Nhân"];
  const tieu = kb.worldConfig?.tieuCanhGioi || 
               kb.worldConfig?.cultivationSystem?.parsedMinors || 
               ["Nhất Giai"];
  return { dai, tieu };
};

/**
 * Hàm ánh xạ sức mạnh sang tên cảnh giới động
 * @param powerScore: 0 - 100
 */
export const resolveDynamicLevel = (powerScore: number, kb: KnowledgeBase): string => {
  const { dai, tieu } = getSystemConfig(kb);
  
  // Tính toán vị trí dựa trên tỷ lệ phần trăm sức mạnh
  const totalPossibleLevels = dai.length;
  const daiIndex = Math.min(
    Math.floor((powerScore / 100) * totalPossibleLevels),
    totalPossibleLevels - 1
  );
  
  // Lấy ngẫu nhiên hoặc tính toán tiểu cảnh giới (ví dụ lấy Nhất Giai cho NPC mới)
  const tieuIndex = 0; 

  return `${dai[daiIndex]} - ${tieu[tieuIndex]}`;
};

/**
 * Hàm chuẩn hóa NPC cũ (Case 3)
 */
export const normalizeOldNPC = (npc: NPC, kb: KnowledgeBase): NPC => {
  // Giữ nguyên 100% cảnh giới hiện tại của NPC, không tự ý ghi đè cảnh giới nền hay resolveDynamicLevel
  return npc;
};
