export const calculateNumericValue = (currentVal: number, input: string, allowNegative: boolean = false): number => {
    try {
        const base = typeof currentVal === 'number' ? currentVal : (parseFloat(currentVal as any) || 0);
        const trimmed = input.trim().toLowerCase();
        if (trimmed === 'max') return 99999;
        
        const operatorMatch = trimmed.match(/^(\+=|-=|\+|-)(\d+(\.\d+)?)$/);
        if (operatorMatch) {
            const op = operatorMatch[1];
            const val = parseFloat(operatorMatch[2]);
            const calculated = (op === '+=' || op === '+') ? base + val : base - val;
            return allowNegative ? calculated : Math.max(0, calculated);
        }
        const directVal = parseFloat(trimmed);
        return isNaN(directVal) ? base : directVal;
    } catch (e) {
        return typeof currentVal === 'number' ? currentVal : 0;
    }
};
