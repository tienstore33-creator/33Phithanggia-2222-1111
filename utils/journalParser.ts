export const extractNearestTagContent = (text: string, tagNames: string[]): string[] => {
    const results: string[] = [];
    const tagsPattern = tagNames.join('|');
    const closeTagRegex = new RegExp(`</(${tagsPattern})>`, 'gi');

    let match: RegExpExecArray | null;
    let lastProcessedIndex = 0;

    while ((match = closeTagRegex.exec(text)) !== null) {
        const tagName = match[1];
        const closeTagPos = match.index;

        // Tìm thẻ mở <tag> gần nhất đứng trước closeTagPos
        const subText = text.substring(0, closeTagPos);
        const openTagRegex = new RegExp(`<${tagName}(?:\\s+[^>]*)?>`, 'gi');
        
        let openMatch: RegExpExecArray | null;
        let lastOpenPos = -1;
        let lastOpenLength = 0;

        while ((openMatch = openTagRegex.exec(subText)) !== null) {
            lastOpenPos = openMatch.index;
            lastOpenLength = openMatch[0].length;
        }

        if (lastOpenPos !== -1 && lastOpenPos >= lastProcessedIndex) {
            const contentStart = lastOpenPos + lastOpenLength;
            const extracted = text.substring(contentStart, closeTagPos);
            if (extracted.trim()) {
                results.push(extracted.trim());
            }
            lastProcessedIndex = closeTagPos + match[0].length;
        }
    }

    return results;
};

/**
 * Extracts the full story narration from AI output.
 * - Keeps all text content across the response.
 * - Strips out only the XML tags and content belonging to the hidden/deleted tag list.
 * - Removes structural tags like <content> and <narration> wrapper labels while preserving their inner text.
 */
export const extractMainStoryContent = (text: string): string => {
    if (!text) return "";

    // Normalize HTML-escaped brackets
    let cleaned = text.replace(/&lt;/g, "<").replace(/&gt;/g, ">");

    // --- NEW SECURITY LAYER: ANCHOR-BASED SPLITTING ---
    // Tìm mốc phân chia nội dung thực sự dựa trên "Bắt đầu viết", </thinking>, hoặc <content>
    const anchors = ["Bắt đầu viết", "</thinking>", "<content>"];
    let lastAnchorIndex = -1;
    let anchorLength = 0;

    for (const anchor of anchors) {
        const index = cleaned.lastIndexOf(anchor);
        if (index > lastAnchorIndex) {
            lastAnchorIndex = index;
            anchorLength = anchor.length;
        }
    }

    // Nếu tìm thấy mốc, chỉ lấy nội dung sau mốc đó
    if (lastAnchorIndex !== -1) {
        cleaned = cleaned.substring(lastAnchorIndex + anchorLength).trim();
    }
    // --------------------------------------------------

    // Define standard inline/structural story tags that contain narration elements or formats
    const inlineStoryTags = new Set([
        'exp', 'thought', 'status', 'important', 'entity', 'npc_thought', 
        'secret_action', 'system', 'system_analysis', 'content', 'narration', 'dialogue'
    ]);

    // 1. Remove closed XML blocks for any tag NOT in the inlineStoryTags set
    // We use an iterative approach to support nested backstage tags if any
    let hasUpdates = true;
    let iterations = 0;
    while (hasUpdates && iterations < 5) {
        hasUpdates = false;
        iterations++;
        
        const blocks: { tag: string; content: string; fullMatch: string }[] = [];
        const openTagRegex = /<([a-zA-ZÀ-ỹ_0-9\s-]+)(?:\s+[^>]*)?>/gi;
        let match;
        while ((match = openTagRegex.exec(cleaned)) !== null) {
            const fullOpenTag = match[0];
            const tagName = match[1].trim();
            const openTagStart = match.index;
            const openTagEnd = openTagStart + fullOpenTag.length;

            if (fullOpenTag.startsWith("</")) continue;

            const escapeTagName = tagName.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&');
            const closeTagRegex = new RegExp(`</\\s*${escapeTagName}\\s*>`, 'i');
            const searchSub = cleaned.slice(openTagEnd);
            const closeMatch = closeTagRegex.exec(searchSub);

            if (closeMatch) {
                const fullBlockMatch = cleaned.slice(openTagStart, openTagEnd + closeMatch.index + closeMatch[0].length);
                if (!blocks.some(b => b.fullMatch === fullBlockMatch)) {
                    blocks.push({
                        tag: tagName,
                        content: searchSub.slice(0, closeMatch.index),
                        fullMatch: fullBlockMatch
                    });
                }
            }
        }

        // Strip non-story blocks
        for (const block of blocks) {
            const nameLower = block.tag.toLowerCase();
            if (!inlineStoryTags.has(nameLower)) {
                cleaned = cleaned.replace(block.fullMatch, '');
                hasUpdates = true;
            }
        }
    }

    // 2. Handle unclosed hidden blocks for common backstage tags to ensure safety
    const commonHiddenTags = [
        'thinking', 'think', 'memory', 'critical', 'summary', 'audit_log', 'update_data',
        'world_pulse', 'faction_dynamics', 'entity_tracking', 'warudo_secret', 'secret_action',
        'enigma_record', 'seed_plant', 'json_data', 'cot_truyen', 'world_state', 'world_data',
        'choice', 'choices', 'branches', 'thúc đẩy đồng nhân', 'thuc_day_dong_nhan', 'system_message'
    ];
    commonHiddenTags.forEach(tag => {
        const unclosedRegex = new RegExp(`<${tag}(?:\\s+[^>]*)?>[\\s\\S]*?(?=(?:<(?:content|narration)(?:\\s+[^>]*)?>|$))`, 'gi');
        cleaned = cleaned.replace(unclosedRegex, '');
    });

    // 3. Remove any remaining unclosed or orphan tags NOT in inlineStoryTags
    const anyTagRegex = /<\/?([a-zA-ZÀ-ỹ_\s-]+)(?:\s+[^>]*)?>/gi;
    cleaned = cleaned.replace(anyTagRegex, (fullMatch, tagName) => {
        const nameLower = tagName.trim().toLowerCase();
        if (!inlineStoryTags.has(nameLower)) {
            return '';
        }
        return fullMatch;
    });

    // 4. Strip only wrapper tag labels <content>, </content>, <narration>, </narration> (preserve inner text)
    cleaned = cleaned.replace(/<\/?(?:content|narration)(?:\s+[^>]*)?>/gi, "");

    // 5. Clean leftover prompt summary markers and audit logs if any
    cleaned = cleaned.replace(/\[SUMMARYText:\s*[\s\S]*?\]/gi, "");
    cleaned = cleaned.replace(/\[audit checkpoint\s*\d*\]/gi, "");
    cleaned = cleaned.replace(/<audit_log>[\s\S]*?<\/audit_log>/gi, "");

    return cleaned.trim();
};

export const parseNarration = (content: string): string => {
    if (!content) return "";
    return extractMainStoryContent(content);
};

/**
 * Strips all XML/HTML tags and SFX markers from a string.
 * Useful for generating clean preview text for TOC.
 */
export const stripAllTags = (content: string): string => {
    if (!content) return "";
    return content
        .replace(/<[^>]+>/g, '') // Remove all XML tags
        .replace(/##.*?##/g, '') // Remove SFX markers
        .trim();
};

