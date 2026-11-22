import { KnowledgeBase } from '../types';
import { RealmParserService } from './RealmParserService';

export class RealmValidatorService {
  /**
   * Chỉ lấy danh sách cảnh giới xung quanh vị trí hiện tại của người chơi
   * để tối ưu hóa Prompt và tránh AI bị nhiễu thông tin.
   */
  static getDynamicWhitelist(kb: KnowledgeBase, currentRealm: string): string[] {
    const config = kb.worldConfig.cultivationSystem;
    if (!config || !config.parsedMajors) return [];
    
    const majors = config.parsedMajors.map(m => m.name);
    const minors = config.parsedMinors || [];

    // Tìm vị trí đại cảnh giới hiện tại - Sắp xếp theo độ dài giảm dần để tránh match nhầm (VD: "Luyện Khí" vs "Luyện")
    const sortedMajors = [...majors].sort((a, b) => b.length - a.length);
    const currentMajor = sortedMajors.find(m => currentRealm.startsWith(m)) || majors[0];
    const majorIdx = majors.indexOf(currentMajor);

    const whitelist: string[] = [];
    
    // Lấy đại cảnh giới trước, hiện tại và sau (nếu có)
    const targetMajors = [
      majors[majorIdx - 1], 
      majors[majorIdx], 
      majors[majorIdx + 1]
    ].filter(Boolean);

    targetMajors.forEach(major => {
      minors.forEach(minor => {
        whitelist.push(`${major} ${minor}`);
      });
    });

    return whitelist;
  }

  /**
   * Hàm dọn dẹp chuỗi (Fail-safe) nếu AI vẫn cố tình thêm dấu ngoặc
   */
  static sanitize(input: string): string {
    return RealmParserService.cleanRealmString(input);
  }
}
