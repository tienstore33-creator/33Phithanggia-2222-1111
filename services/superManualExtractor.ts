import { DIALOGUE_MARKER } from '../types';

interface SuperManualExtractionResult {
    tags: string[];
    flashSummary: string;
    flashDetails: string;
}

/**
 * Extracts tags, flashSummary, and flashDetails completely offline
 * without calling any external APIs during Super Manual Mode.
 */
export function extractSuperManualTurnData(
    rawText: string,
    locationName: string = "Không rõ",
    timeString: string = "Không rõ"
): SuperManualExtractionResult {
    console.log("[superManualExtractor] Starting offline extraction for Super Manual Mode...");

    // 1. Extract Tags ONLY from <update_data> block and filter via Blacklist
    const tagsSet = new Set<string>();
    
    // Extract tags ONLY from <update_data>
    const updateDataMatch = rawText.match(/<update_data>([\s\S]*?)<\/update_data>/i);
    const updateDataText = updateDataMatch ? updateDataMatch[1] : "";
    
    // Regex for finding [TAG_NAME: optional params]
    const tagRegex = /\[([A-Z_]+)(?::\s*((?:[^\[\]]|\[[^\[\]]*\])*))?\]/gs;
    let tagMatch;
    while ((tagMatch = tagRegex.exec(updateDataText)) !== null) {
        const fullTag = tagMatch[0];
        const tagName = tagMatch[1];
        
        // Blacklist: loại bỏ các tag không phải là game tag (như [SYSTEM: ...], [TRIBUNAL...])
        const isSystemTag = tagName.includes("SYSTEM") || tagName.includes("TRIBUNAL") || fullTag.toUpperCase().includes("SYSTEM") || fullTag.toUpperCase().includes("TRIBUNAL");
        
        if (tagName !== 'CHOICE' && tagName !== 'choices' && tagName !== 'branches' && !isSystemTag) {
            tagsSet.add(fullTag);
        }
    }
    const tags = Array.from(tagsSet);

    // 2. Extract Flash Summary with high reliability fallback
    let flashSummary = "";
    const flashSummaryMatch = rawText.match(/<flash_summary>([\s\S]*?)<\/flash_summary>/i);
    if (flashSummaryMatch && flashSummaryMatch[1]) {
        flashSummary = flashSummaryMatch[1].trim();
    }

    // Fallback if flash_summary is missing, empty, or unclosed
    if (!flashSummary) {
        console.log("[superManualExtractor] <flash_summary> not found. Activating fallback sentence extraction.");
        
        // Extract content from <content> block if exists
        let contentText = "";
        const contentMatch = rawText.match(/<content>([\s\S]*?)<\/content>/i);
        if (contentMatch && contentMatch[1]) {
            contentText = contentMatch[1];
        } else {
            // Remove xml blocks to keep only narrative text
            contentText = rawText
                .replace(/<(thinking|think|update_data|choices|flash_summary)[^>]*>[\s\S]*?<\/\1>/gi, "")
                .replace(/<[^>]+>/g, "");
        }

        // Clean dialogue markers and other tag-like strings for clean summary sentences
        const cleanText = contentText
            .replace(/##[^#]+##/g, "")
            .replace(/\[[A-Z_]+(?::[^\]]+)?\]/g, "")
            .trim();

        // Split into sentences using punctuation
        const sentences = cleanText
            .split(/(?<=[.!?])\s+/)
            .map(s => s.trim())
            .filter(s => s.length > 5 && !s.startsWith("Cập nhật:") && !s.startsWith("-"));

        if (sentences.length > 0) {
            if (sentences.length <= 3) {
                flashSummary = sentences.join(" ");
            } else {
                // Take first 2 sentences and the last sentence
                const firstTwo = sentences.slice(0, 2).join(" ");
                const lastOne = sentences[sentences.length - 1];
                flashSummary = `${firstTwo} ${lastOne}`;
            }
        }

        if (!flashSummary || flashSummary.length < 10) {
            flashSummary = `Hình Hàm tiếp tục hành trình khám phá và thích nghi với hoàn cảnh mới tại ${locationName}.`;
        }
    }

    // 3. Extract Accurate Dialogue (Ký ức hội thoại chính xác)
    const dialogues: string[] = [];
    
    // Regex matching standard dialogue markers: ##id|emoji|dialogue##
    // Supporting escaped characters and some variations
    const dialogueRegex = /##([^|#]+)\|([^|#]*)\|([^#]+)##/g;
    let diagMatch;
    while ((diagMatch = dialogueRegex.exec(rawText)) !== null) {
        const name = diagMatch[1].trim();
        const dialogueText = diagMatch[3].trim();
        // Skip empty dialogues
        if (name && dialogueText) {
            dialogues.push(`- ${name}: "${dialogueText}"`);
        }
    }

    // Fallback: if no dialogue markers found, try to look for quoted speech patterns: "Name: "Dialogue"" or "Name nói: "Dialogue""
    if (dialogues.length === 0) {
        const quotedSpeechRegex = /(?:^|\n)([A-ZẮẰẲẴẶẤẦẨẪẬỄỆỐỒỔỖỘỨỪỬỮỰa-zA-ZàáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđĐ\s]{2,25}):\s*["“]([^"”\n]{2,300})["”]/g;
        let quotedMatch;
        while ((quotedMatch = quotedSpeechRegex.exec(rawText)) !== null) {
            const name = quotedMatch[1].trim();
            const dialogueText = quotedMatch[2].trim();
            dialogues.push(`- ${name}: "${dialogueText}"`);
        }
    }

    const dialogueBulletPoints = dialogues.length > 0
        ? dialogues.join("\n")
        : "- No direct dialogue in this turn.";

    // 4. Construct rich Flash Details complying with both Vietnamese & English parsers
    const flashDetails = `1. Fast Summary: ${flashSummary}
---
Current Location: ${locationName}
Time: ${timeString}
---
2. Core Developments:
- ${flashSummary}

3. Accurate Dialogue:
${dialogueBulletPoints}

4. Knowledge & Context:
- Vị trí hiện tại: ${locationName}
- Thời gian: ${timeString}
- Trạng thái: Siêu Mạt Pháp (Thủ công toàn phần)`;

    return {
        tags,
        flashSummary,
        flashDetails
    };
}
