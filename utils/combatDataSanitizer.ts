
/**
 * Tiện ích làm sạch và chuẩn hóa dữ liệu chiến đấu
 */
export const sanitizeCombatAnalysis = (analysis: any) => {
  // Đảm bảo participants luôn là một mảng
  const participants = Array.isArray(analysis?.participants) 
    ? analysis.participants 
    : [];

  return {
    ...analysis,
    isCombat: !!analysis?.isCombat,
    participants: participants,
    combatReason: analysis?.combatReason || "Xung đột không rõ nguyên nhân"
  };
};

/**
 * Đảm bảo thuộc tính equipmentPassives luôn là một object hợp lệ
 */
export const sanitizeEquipmentPassives = (passives: any): Record<string, number> => {
  if (!passives || typeof passives !== 'object') return {};
  return passives;
};

/**
 * Đảm bảo giá trị số không bao giờ là NaN
 */
export const safeNumber = (value: any, fallback = 0): number => {
  const num = Number(value);
  return isNaN(num) ? fallback : num;
};

/**
 * Định dạng số với dấu chấm phân cách hàng nghìn (ví dụ: 127616423 -> 127.616.423)
 * Cũng hỗ trợ tự động tìm và định dạng các số trong một chuỗi công thức phức tạp.
 */
export const formatNumberDot = (value: any): string => {
  if (value === undefined || value === null || value === "") return "0";
  const valStr = String(value);
  
  // Nếu là số đơn thuần (nguyên hoặc thực)
  if (/^-?\d+(\.\d+)?$/.test(valStr)) {
    const parts = valStr.split('.');
    parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ".");
    return parts.join(',');
  }

  // Nếu là một chuỗi phức tạp chứa cả số lẫn chữ (ví dụ: công thức tính toán)
  return valStr.replace(/\b\d+(\.\d+)?\b/g, (match) => {
    if (match.includes('.')) {
      const parts = match.split('.');
      parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ".");
      return parts.join(',');
    }
    return match.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  });
};
