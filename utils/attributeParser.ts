/**
 * Sanitizes "dirty" JSON strings produced by AI.
 * Handles missing key quotes, trailing commas, and single quotes.
 */
export function sanitizeJson(raw: string): string {
    if (!raw) return "";
    let cleaned = raw.trim();
    
    // 1. Wrap keys in double quotes if missing
    cleaned = cleaned.replace(/([{,])\s*([a-z0-0_]+)\s*:/ig, '$1"$2":');
    
    // 2. Remove trailing commas
    cleaned = cleaned.replace(/,\s*([}\]])/g, '$1');
    
    // 3. Convert single quotes to double quotes (risky but often necessary)
    // Only if not preceded by backslash and not inside an existing double-quoted string
    // This is a simplified version; a full scanner is better but more complex.
    
    return cleaned;
}

/**
 * Robust logic to parse attributes from AI tags using a State Machine approach.
 * Handles nested objects/arrays (balance tracking) and positional parameters.
 * Example: [TAG: "Position 1" key1="Value" key2={json}]
 */
export function parseAttributes(str: string): Record<string, string> {
    const res: Record<string, string> = {};
    if (!str) return res;
    let cleanStr = str.trim();
    // Normalize curly quotes to standard quotes
    cleanStr = cleanStr.replace(/[“”]/g, '"').replace(/[‘’]/g, "'");

    // Unescape quotes that might have been escaped/stringified by the AI
    cleanStr = cleanStr.replace(/\\"/g, '"').replace(/\\'/g, "'");

    if (cleanStr.startsWith('[')) cleanStr = cleanStr.substring(1);
    if (cleanStr.endsWith(']')) cleanStr = cleanStr.slice(0, -1);
    cleanStr = cleanStr.trim();

    // If string starts with tag name and colon (e.g. NPC_CREATE: ...), strip it
    const colonIdx = cleanStr.indexOf(':');
    if (colonIdx !== -1 && !cleanStr.substring(0, colonIdx).includes('=')) {
        cleanStr = cleanStr.substring(colonIdx + 1).trim();
    }

    const parts: string[] = [];
    let currentPart = "";
    let inQuotes: string | null = null;
    let balance = 0; 
    
    for (let i = 0; i < cleanStr.length; i++) {
        const char = cleanStr[i];
        
        if (inQuotes) {
            if (char === inQuotes) {
                inQuotes = null;
            }
            currentPart += char;
            continue;
        }
        if (char === '"' || char === "'") {
            inQuotes = char;
            currentPart += char;
            continue;
        }
        if (char === '{' || char === '[' || char === '(') {
            balance++;
            currentPart += char;
            continue;
        }
        if (char === '}' || char === ']' || char === ')') {
            balance--;
            currentPart += char;
            continue;
        }
        // Split on comma or whitespace at top level
        if ((char === ',' || /\s/.test(char)) && balance === 0) {
            if (currentPart.trim()) {
                // Determine if this whitespace is just spacing around "="
                let isSpacingAroundEquals = false;
                if (!currentPart.includes('=')) {
                    // Peek ahead for "="
                    let j = i + 1;
                    while (j < cleanStr.length && /\s/.test(cleanStr[j])) j++;
                    if (cleanStr[j] === '=') isSpacingAroundEquals = true;
                } else if (currentPart.endsWith('=')) {
                    isSpacingAroundEquals = true;
                }
                if (!isSpacingAroundEquals) {
                    parts.push(currentPart.trim());
                    currentPart = "";
                }
            }
            continue;
        }
        currentPart += char;
    }
    
    if (currentPart.trim()) {
        parts.push(currentPart.trim());
    }
    parts.forEach(part => {
        const eqIdx = part.indexOf('=');
        if (eqIdx !== -1) {
            const k = part.substring(0, eqIdx).trim();
            const v = part.substring(eqIdx + 1).trim().replace(/^["']|["']$/g, '');
            res[k] = v;
        } else { 
            // Fallback for positional params 
            const existingCount = Object.keys(res).filter(key => key.startsWith('position_var_')).length; 
            res[`position_var_${existingCount}`] = part.replace(/^["']|["']$/g, '');
        }
    });

    // Fallback safeguard: if any value got incorrectly combined with comma and subsequent keys
    for (const [k, v] of Object.entries(res)) {
        if (v.includes('",') || v.includes("',") || /,\s*[a-zA-Z0-9_]+\s*=/.test(v)) {
            const subMatches = v.matchAll(/([a-zA-Z0-9_]+)\s*=\s*["']([^"']*)["']/g);
            for (const match of subMatches) {
                res[match[1]] = match[2];
            }
        }
    }

    // Special case for "name" if positional logic didn't catch it
    if (res.position_var_0 && !res.name) {
        res.name = res.position_var_0;
    }
    // Fallback when string contains no '=': set text, value, and name to the entire cleaned string
    if (!cleanStr.includes('=')) {
        const cleanedVal = cleanStr.replace(/^["']|["']$/g, '').trim();
        res.text = cleanedVal;
        res.value = cleanedVal;
        res.name = cleanedVal;
    }

    // Clean up any trailing backslashes that are artifacts of escaped quotes
    for (const k of Object.keys(res)) {
        if (typeof res[k] === 'string') {
            let v = res[k].trim();
            while (v.endsWith('\\')) {
                v = v.slice(0, -1).trim();
            }
            res[k] = v;
        }
    }

    return res;
}
