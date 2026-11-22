const fs = require('fs');
let content = fs.readFileSync('utils/tagProcessingUtils.ts', 'utf-8');
content = content.replace(
    /\/\/ Không khử trùng lặp nữa, dùng thẳng tagBatch    const rawTagBatch = \(tagBatch \|\| \[\]\)\.map\(tag => tag\.trim\(\)\)\.filter\(Boolean\);    \/\/ Count YEUTHU_APPEAR tags before processing to provide context for group encounters    const yeuThuAppearCount = rawTagBatch\.filter\(tag => tag\.toUpperCase\(\)\.startsWith\('\\[YEUTHU_APPEAR'\)\)\.length;        \/\/ Check if any quest is being completed\/resolved in this batch to allow higher EXP cap    const hasQuestCompletion = rawTagBatch\.some\(tag => \{        const uTag = tag\.toUpperCase\(\);        return uTag\.startsWith\('\\[QUEST_COMPLETED'\) \|\| uTag\.startsWith\('\\[QUEST_RESOLVED'\);    \}\);    const isBattlePlusOne = workingKb\.battlePlusOneTurn === turnForSystemMessages;    for \(const originalTag of rawTagBatch\) \{        \/\/ Use the s flag for multiline tags content        const mainMatch = originalTag\.match\(\/\^\\[\(\[A-Z_\]\+\)\(\?\:\\s\*\(\[\\s\\S\]\*\)\)\?\\]\$\/i\);        if \(!mainMatch \|\| !mainMatch\[1\]\) \{             tagErrors\.push\(\{                 originalTag,                 tagName: 'UNKNOWN',                 reason: 'Lỗi cú pháp định dạng cơ bản \\(có thể thiếu ngoặc vuông hoặc dấu hai chấm\\).'             \}\);             unrecognizedTags\.push\(originalTag\);             continue;         \}/,
    `// Không khử trùng lặp nữa, dùng thẳng tagBatch
    const rawTagBatch = (tagBatch || []).map(tag => tag.trim()).filter(Boolean);
    // Count YEUTHU_APPEAR tags before processing to provide context for group encounters
    const yeuThuAppearCount = rawTagBatch.filter(tag => tag.toUpperCase().startsWith('[YEUTHU_APPEAR')).length;
    
    // Check if any quest is being completed/resolved in this batch to allow higher EXP cap
    const hasQuestCompletion = rawTagBatch.some(tag => {
        const uTag = tag.toUpperCase();
        return uTag.startsWith('[QUEST_COMPLETED') || uTag.startsWith('[QUEST_RESOLVED');
    });

    const isBattlePlusOne = workingKb.battlePlusOneTurn === turnForSystemMessages;

    for (const originalTag of rawTagBatch) {
        // Use the s flag for multiline tags content
        const mainMatch = originalTag.match(/^\\[([A-Z_]+)(?::\\s*([\\s\\S]*))?\\]$/i);
        if (!mainMatch || !mainMatch[1]) {
             tagErrors.push({
                 originalTag,
                 tagName: 'UNKNOWN',
                 reason: 'Lỗi cú pháp định dạng cơ bản (có thể thiếu ngoặc vuông hoặc dấu hai chấm).'
             });
             unrecognizedTags.push(originalTag);
             continue;
        }`
);
fs.writeFileSync('utils/tagProcessingUtils.ts', content);
