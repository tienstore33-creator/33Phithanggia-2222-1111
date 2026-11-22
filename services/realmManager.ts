
import { KnowledgeBase, RealmSystem } from '../types';
import { GENERIC_REALM_SYSTEM, SUB_REALM_NAMES } from '../constants';
import { RealmParserService } from './RealmParserService';
import { RealmValidatorService } from './RealmValidatorService';

// Hàm trọng tài quyết định hệ thống cảnh giới
export const getEffectiveRealmSystem = (kb: KnowledgeBase): RealmSystem => {
    // Nếu không bật hệ thống tu luyện, trả về null hoặc hệ thống rỗng
    if (!kb.worldConfig?.isCultivationEnabled) {
        return { majorRealms: [], minorRealms: [] };
    }

    // Nếu đã có danh sách cảnh giới tùy chỉnh hợp lệ
    if (kb.realmProgressionList && kb.realmProgressionList.length > 0) {
        return {
            majorRealms: kb.realmProgressionList,
            minorRealms: kb.minorRealmProgressionList && kb.minorRealmProgressionList.length > 0 
                ? kb.minorRealmProgressionList 
                : SUB_REALM_NAMES
        };
    }

    // Fallback về hệ thống song song mặc định
    return GENERIC_REALM_SYSTEM;
};

/**
 * Lấy hệ thống cảnh giới dựa trên chủng tộc.
 * Hiện tại hỗ trợ: Yêu Tộc (Yêu Thú), Nhân Tộc (Mặc định).
 */
export const getRealmSystemByRace = (kb: KnowledgeBase, race?: string): RealmSystem => {
    // Nếu là Yêu Tộc hoặc Yêu Thú -> Sử dụng hệ thống Yêu Thú nếu có
    if ((race === 'Yêu Tộc' || race === 'Yêu Thú') && kb.worldConfig?.yeuThuRealmSystem) {
        return {
            majorRealms: RealmParserService.parseMajorRealms(kb.worldConfig.yeuThuRealmSystem),
            minorRealms: kb.minorRealmProgressionList && kb.minorRealmProgressionList.length > 0 
                ? kb.minorRealmProgressionList 
                : SUB_REALM_NAMES
        };
    }
    
    // Mặc định sử dụng hệ thống hiệu dụng của thế giới
    return getEffectiveRealmSystem(kb);
};

export const realmManager = {
  /**
   * Lấy danh sách toàn bộ cảnh giới hợp lệ từ hệ thống tu luyện trong KnowledgeBase.
   */
  getProgressionList: (kb: KnowledgeBase): string[] => {
    const realmSystem = getEffectiveRealmSystem(kb);
    const list: string[] = [];
    if (realmSystem.majorRealms.length === 0) return [];
    
    realmSystem.majorRealms.forEach(major => {
      // Nếu không có tiểu cảnh giới, chỉ thêm đại cảnh giới
      if (realmSystem.minorRealms.length === 0) {
        list.push(major);
      } else {
        realmSystem.minorRealms.forEach(minor => {
          list.push(`${major} ${minor}`);
        });
      }
    });
    return list;
  },

  /**
   * Lấy cảnh giới nền (Base Realm) của thế giới hiện tại.
   * Mặc định là cảnh giới đầu tiên trong danh sách.
   */
  getBaseRealm: (kb: KnowledgeBase): string => {
    const list = realmManager.getProgressionList(kb);
    return list[0] || "Cảnh giới thứ 1 1 Tầng";
  },

  /**
   * Kiểm tra xem một cảnh giới có hợp lệ (nằm trong danh sách hệ thống) hay không.
   */
  isValidRealm: (realm: string, kb: KnowledgeBase): boolean => {
    if (!realm) return false;
    const sanitizedRealm = RealmValidatorService.sanitize(realm);
    const progressionList = realmManager.getProgressionList(kb).map(r => r.trim());
    
    // Check exact match
    if (progressionList.includes(sanitizedRealm)) return true;
    
    // Try to normalize "Major (Minor)" to "Major Minor"
    // Regex to match "Major (Minor)"
    const match = sanitizedRealm.match(/^(.*)\s*\((.*)\)$/);
    if (match) {
        const major = match[1].trim();
        const minor = match[2].trim();
        const normalized = `${major} ${minor}`;
        return progressionList.includes(normalized);
    }
    
    return false;
  },

  /**
   * Tính toán cảnh giới tiếp theo khi đột phá.
   * Nếu cảnh giới hiện tại không hợp lệ, sẽ tự động Fallback về Base Realm.
   */
  getBreakthroughRealm: (currentRealm: string, kb: KnowledgeBase): string => {
    const progressionList = realmManager.getProgressionList(kb);
    const cleanList = progressionList.map(r => r.trim());
    let trimmedCurrent = currentRealm ? currentRealm.trim() : "";
    
    // Normalize if needed
    const match = trimmedCurrent.match(/^(.*)\s*\((.*)\)$/);
    if (match) {
        const major = match[1].trim();
        const minor = match[2].trim();
        trimmedCurrent = `${major} ${minor}`;
    }

    const currentIndex = cleanList.indexOf(trimmedCurrent);

    // Nếu không tìm thấy cảnh giới hiện tại trong danh sách -> Kích hoạt Fallback về Base Realm
    if (currentIndex === -1) {
      console.warn(`Cảnh giới "${currentRealm}" không hợp lệ. Kích hoạt Fallback về Nền cảnh giới.`);
      return realmManager.getBaseRealm(kb);
    }

    // Nếu đã ở cảnh giới cuối cùng -> Giữ nguyên
    if (currentIndex >= cleanList.length - 1) {
      return currentRealm;
    }

    // Trả về cảnh giới tiếp theo trong danh sách
    return progressionList[currentIndex + 1];
  },

  /**
   * Tiến hóa cảnh giới thêm n bước (tiểu cảnh giới).
   */
  advanceRealm: (currentRealm: string, steps: number, kb: KnowledgeBase): string => {
    const realmSystem = getEffectiveRealmSystem(kb);
    const progression = realmSystem.majorRealms;
    const subRealms = realmSystem.minorRealms;
    
    if (progression.length === 0) return currentRealm;

    let mainIndex = -1;
    let subIndex = -1;
    const sortedMajors = [...progression].sort((a, b) => b.length - a.length);
    
    for (const r of sortedMajors) {
        if (currentRealm.startsWith(r)) {
            mainIndex = progression.indexOf(r);
            const subStr = currentRealm.substring(r.length).trim();
            subIndex = subRealms.indexOf(subStr);
            if (subIndex === -1) subIndex = 0;
            break;
        }
    }

    if (mainIndex === -1) return currentRealm;

    const stepsPerMajor = subRealms.length;
    const totalSteps = (mainIndex * stepsPerMajor) + subIndex + steps;
    
    const finalMainIndex = Math.min(Math.floor(totalSteps / stepsPerMajor), progression.length - 1);
    const finalSubIndex = finalMainIndex === progression.length - 1 
        ? Math.min(totalSteps % stepsPerMajor, subRealms.length - 1) 
        : (totalSteps % stepsPerMajor);

    return `${progression[finalMainIndex]} ${subRealms[finalSubIndex]}`;
  },

  /**
   * Nắn chỉnh hoặc tìm cảnh giới gần nhất dựa trên từ khóa.
   */
  repairOrFindClosestRealm: (realmStr: string, kb: KnowledgeBase): string => {
    if (!realmStr) return realmManager.getBaseRealm(kb);
    const realmSystem = getEffectiveRealmSystem(kb);
    const cleaned = realmStr.trim();
    
    // Tìm Major Realm gần nhất
    let foundMajor = "";
    for (const major of realmSystem.majorRealms) {
      if (cleaned.toLowerCase().includes(major.toLowerCase())) {
        foundMajor = major;
        break;
      }
    }

    // Nếu không tìm thấy Major, giữ nguyên chuỗi cũ (để Tier 3 xử lý)
    if (!foundMajor) return cleaned;

    // Tìm Minor Realm gần nhất
    let foundMinor = "";
    for (const minor of realmSystem.minorRealms) {
      if (cleaned.toLowerCase().includes(minor.toLowerCase())) {
        foundMinor = minor;
        break;
      }
    }

    // Tái tạo lại chuỗi chuẩn
    return foundMinor ? `${foundMajor} ${foundMinor}` : foundMajor;
  }
};

