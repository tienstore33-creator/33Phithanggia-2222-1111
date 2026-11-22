
/**
 * ExpRegulator Service
 * Chịu trách nhiệm điều tiết lượng kinh nghiệm nhận được để đảm bảo tính cân bằng.
 * Ngăn chặn việc nhảy vọt quá nhanh do AI Storyteller "hào hứng" quá mức.
 */
export class ExpRegulator {
  // Ngưỡng tối đa kinh nghiệm có thể nhận trong một lượt (20% thanh EXP hiện tại)
  private static readonly DEFAULT_MAX_EXP_GAIN_PERCENT = 0.2;
  // Ngưỡng tối đa cho phần thưởng nhiệm vụ (50% thanh EXP hiện tại)
  private static readonly QUEST_MAX_EXP_GAIN_PERCENT = 0.5;

  /**
   * Tính toán lượng kinh nghiệm an toàn dựa trên trần Thiên Đạo.
   * @param currentMaxExp Lượng kinh nghiệm tối đa của cảnh giới hiện tại.
   * @param requestedGain Lượng kinh nghiệm AI muốn buff.
   * @param isQuest Có phải là phần thưởng nhiệm vụ hay không.
   * @returns Đối tượng chứa lượng kinh nghiệm thực tế và trạng thái chạm trần.
   */
  static calculateSafeGain(currentMaxExp: number, requestedGain: number, isQuest: boolean = false): { 
    finalGain: number; 
    isCapped: boolean; 
    originalGain: number 
  } {
    // Nếu maxKinhNghiem không hợp lệ (ví dụ: Phàm Nhân), không áp dụng trap
    if (!currentMaxExp || currentMaxExp <= 0) {
      return { finalGain: requestedGain, isCapped: false, originalGain: requestedGain };
    }

    const factor = isQuest ? this.QUEST_MAX_EXP_GAIN_PERCENT : this.DEFAULT_MAX_EXP_GAIN_PERCENT;
    const cap = Math.floor(currentMaxExp * factor);
    
    if (requestedGain > cap) {
      return { 
        finalGain: cap, 
        isCapped: true, 
        originalGain: requestedGain 
      };
    }
    
    return { 
      finalGain: requestedGain, 
      isCapped: false, 
      originalGain: requestedGain 
    };
  }
}
