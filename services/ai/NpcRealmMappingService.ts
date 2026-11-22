import { KnowledgeBase } from "../../types";
import { getEffectiveRealmSystem } from "../realmManager";

export class NpcRealmMappingService {
  /**
   * Ánh xạ một chuỗi cảnh giới thô từ văn bản sang cảnh giới chuẩn của game
   */
  public static mapRoughRealmToSystem(roughRealm: string, kb: KnowledgeBase): string {
    if (!roughRealm) return "Không rõ";

    const cleanInput = roughRealm.trim();
    const realmSystem = getEffectiveRealmSystem(kb);
    const majorRealms = realmSystem.majorRealms;
    const minorRealms = realmSystem.minorRealms;

    // 1. Tìm Major Realm khớp nhất trong chuỗi nhập vào
    let matchedMajor = "";
    // Xếp theo độ dài giảm dần để tránh việc "Trúc Cơ" bị nhầm với một phần của chữ khác nếu có
    const sortedMajors = [...majorRealms].sort((a, b) => b.length - a.length);
    for (const major of sortedMajors) {
      if (cleanInput.toLowerCase().includes(major.toLowerCase())) {
        matchedMajor = major;
        break;
      }
    }

    // Nếu không tìm thấy cảnh giới lớn nào khớp, giữ nguyên chuỗi gốc làm fallback
    if (!matchedMajor) {
      return cleanInput;
    }

    // Nếu không có tiểu cảnh giới, trả về nguyên đại cảnh giới
    if (!minorRealms || minorRealms.length === 0) {
      return matchedMajor;
    }

    // 2. Phân tích phân đoạn nhỏ (Minor/Phase Matching)
    let matchedMinor = minorRealms[0]; // Mặc định là tiểu cảnh giới thấp nhất
    let exactMatchFound = false;

    // Lọc bỏ phần Major ra khỏi chuỗi để xét Minor
    const minorRawStr = cleanInput.toLowerCase().replace(matchedMajor.toLowerCase(), "").trim();

    // Xoá bỏ các cơ chế cơ học cố gắng khớp chuỗi nếu gặp cú pháp không đúng. 
    // Nếu AI đã cung cấp đầy đủ thông tin (Major + Minor) mà không khớp chính xác mảng chuẩn, 
    // giữ nguyên chuỗi gốc để tôn trọng ý đồ AI, không gò ép đần độn.
    if (minorRawStr && minorRawStr.length > 0) {
        return cleanInput;
    }

    // Xếp theo độ dài giảm dần để "Tầng 10" được ưu tiên hơn "Tầng 1"
    const sortedMinors = [...minorRealms].sort((a, b) => b.length - a.length);
    for (const minor of sortedMinors) {
      if (minorRawStr.includes(minor.toLowerCase()) || cleanInput.toLowerCase().includes(minor.toLowerCase())) {
        matchedMinor = minor;
        exactMatchFound = true;
        break;
      }
    }

    // Nếu không khớp chính xác, thử suy luận ngữ nghĩa tương đối dựa trên độ dài mảng
    if (!exactMatchFound) {
      const lowerInput = cleanInput.toLowerCase();
      const isTenLevels = minorRealms.length >= 9 && minorRealms.some(m => m.toLowerCase().includes("tầng"));
      
      const numberMatch = lowerInput.match(/(\d+)\s*(tầng|cấp)/) || lowerInput.match(/(tầng|cấp)\s*(\d+)/) || lowerInput.match(/thứ\s*(\d+)/) || lowerInput.match(/(\d+)/);
      
      if (numberMatch && isTenLevels) {
         const numStr = numberMatch[1] || numberMatch[2] || numberMatch[0]; // lấy số
         const numRegex = new RegExp(`\\b${numStr}\\b`);
         const foundNumMinor = minorRealms.find(m => numRegex.test(m) || m.includes(numStr));
         if (foundNumMinor) {
             matchedMinor = foundNumMinor;
         }
      } else {
         // Nội suy phần trăm
         let percentage = 0; 
         if (lowerInput.includes("sơ kỳ") || lowerInput.includes("đầu") || lowerInput.includes("nhất trọng")) percentage = 0.1;
         else if (lowerInput.includes("trung kỳ") || lowerInput.includes("giữa") || lowerInput.includes("ngũ trọng")) percentage = 0.5;
         else if (lowerInput.includes("hậu kỳ") || lowerInput.includes("cuối") || lowerInput.includes("bát trọng")) percentage = 0.8;
         else if (lowerInput.includes("viên mãn") || lowerInput.includes("đỉnh phong") || lowerInput.includes("cực hạn")) percentage = 1.0;
         else percentage = 0;
         
         const targetIndex = Math.floor(percentage * (minorRealms.length - 1));
         matchedMinor = minorRealms[targetIndex] || minorRealms[0];
      }
    }

    const finalRealm = `${matchedMajor} ${matchedMinor}`.trim();
    console.log(`NpcRealmMappingService: "${roughRealm}" -> "${finalRealm}"`);
    return finalRealm;
  }
}
