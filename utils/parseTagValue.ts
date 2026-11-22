import { parseAttributes } from './attributeParser';

export const parseTagValue = (tagValue: string): Record<string, string> => {
    const result = parseAttributes(tagValue);
    
    // Safety guard: if name contains comma/gender leakage, clean it up
    if (result.name && result.name.includes(',')) {
        const nameParts = result.name.split(',');
        if (nameParts[0]) {
            result.name = nameParts[0].replace(/["']/g, '').trim();
        }
    }
    
    return result;
};
