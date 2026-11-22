
export const parseRealmString = (input: string): string[] => {
  if (!input || !input.trim()) return [];

  // Tách bằng dấu "-" và làm sạch
  const rawParts = input.split('-').map(s => s.trim()).filter(Boolean);

  // Xử lý cú pháp Range (Dải số) cho Tiểu cảnh giới
  // Nếu chỉ có 2 phần (VD: "1 Tầng" và "9 Tầng")
  if (rawParts.length === 2) {
    const start = rawParts[0];
    const end = rawParts[1];
    const numberRegex = /^(\d+)\s*(.*)$/;

    const startMatch = start.match(numberRegex);
    const endMatch = end.match(numberRegex);

    if (startMatch && endMatch && startMatch[2] === endMatch[2]) {
      const startNum = parseInt(startMatch[1], 10);
      const endNum = parseInt(endMatch[1], 10);
      const suffix = startMatch[2];

      if (startNum <= endNum) {
        const range: string[] = [];
        for (let i = startNum; i <= endNum; i++) {
          range.push(`${i} ${suffix}`.trim());
        }
        return range;
      }
    }
  }
  return rawParts;
};

export const parseUnifiedRealmString = (input: string): { name: string; levels: number; description: string }[] => {
  if (!input || !input.trim()) return [];
  
  const lines = input.split('\n').map(l => l.trim()).filter(Boolean);
  return lines.map(line => {
    const parts = line.split('|').map(p => p.trim());
    return {
      name: parts[0] || 'Không rõ',
      levels: parseInt(parts[1], 10) || 1,
      description: parts[2] || ''
    };
  });
};
