const fs = require('fs');
let content = fs.readFileSync('utils/tagProcessingUtils.ts', 'utf-8');

// Patch 1: Remove deduplicateTagBatch
content = content.replace(
    /const sanitizedTagBatch = \(tagBatch \|\| \[\]\)\.map\(tag => tag\.replace\(\/\\\\\/g, ''\)\);\s+const uniqueTagBatch = deduplicateTagBatch\(sanitizedTagBatch\);/,
    `// Giữ nguyên toàn bộ các tag từ AI\n    const rawTagBatch = (tagBatch || []).map(tag => tag.trim()).filter(Boolean);\n    const uniqueTagBatch = rawTagBatch; // keep variable name same for loop`
);

// Patch 2: Fix regex and push syntax errors
content = content.replace(
    /const mainMatch = originalTag\.match\(\/\\\[\(\.\*\?\)\(\?::\\s\*\(\[\\s\\S\]\*\)\)\?\\\]\$\/s\);\s+if \(!mainMatch \|\| !mainMatch\[1\]\) {\s+console\.warn\(\`Malformed tag structure: \$\{originalTag\}\`\);\s+continue;\s+\}/,
    `const mainMatch = originalTag.match(/^\\[([A-Z_]+)(?::\\s*([\\s\\S]*))?\\]$/i);\n        if (!mainMatch || !mainMatch[1]) {\n             tagErrors.push({\n                 originalTag,\n                 tagName: 'UNKNOWN',\n                 reason: 'Lỗi cú pháp định dạng cơ bản (có thể thiếu ngoặc vuông hoặc dấu hai chấm).'\n             });\n             unrecognizedTags.push(originalTag);\n             continue;\n        }`
);

// Patch 3: Default case
content = content.replace(
    /default:\s+if \(\!tagName\.startsWith\("GENERATED_"\) && tagName !== "CHOICE" && tagName\.trim\(\) !== ""\) \{\s+isHandled = false;\s+\} else \{\s+isHandled = true;\s+\}\s+\}/,
    `default:\n                    if (!tagName.startsWith("GENERATED_") && tagName !== "CHOICE" && tagName.trim() !== "") {\n                         tagErrors.push({\n                              originalTag,\n                              tagName,\n                              reason: \`Hệ thống không tồn tại thẻ nào có tên là [\${tagName}].\`\n                          });\n                         unrecognizedTags.push(originalTag);\n                         isHandled = true; // Mark handled so it's not double-pushed\n                    } else {\n                         isHandled = true;\n                    }\n            }`
);

// Patch 4: catch block
content = content.replace(
    /\} catch \(error\) \{\s+console\.error\(\`Error processing tag "\$\{tagName\}"\:\`, error, "Original tag:", originalTag, "Params:", tagParams\);\s+isHandled = false;\s+\}/,
    `} catch (error: any) {\n             console.error(\`Error processing tag "\${tagName}":\`, error, "Original tag:", originalTag, "Params:", tagParams);\n             tagErrors.push({\n                  originalTag,\n                  tagName,\n                  reason: \`Lỗi ngoại lệ khi xử lý thẻ (Exception): \${error.message || error}\`\n              });\n             unrecognizedTags.push(originalTag);\n             isHandled = true;\n        }`
);

fs.writeFileSync('utils/tagProcessingUtils.ts', content);
