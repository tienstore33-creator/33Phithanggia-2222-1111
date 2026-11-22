function matchAndFixTags(text, isFinal) {
    // We want to remove `<` and `>` from orphaned `</tag>` and unclosed `<tag>`
    // The requirement says:
    // Orphan closing tag: if `</tag>` has no matching `<tag>` before it, strip `<` and `>` -> `tag`
    // Unclosed opening tag (only if isFinal=true): if `<tag>` has no matching `</tag>`, strip `<` and `>` -> `tag`
    // Balanced tags: ignore.

    // A tag is matched if it's `<tag>` and later `</tag>`.
    // Wait, tags can have attributes like `<tag attr="1">`. Let's assume tag names are alphanumeric.
    
    // We can parse the text iteratively.
    const tagRegex = /<(\/)?([a-zA-Z0-9_]+)([^>]*)>/g;
    
    let result = "";
    let lastIndex = 0;
    
    // We need to know which tags are balanced.
    // A stack can keep track of opening tags.
    // However, what if we have `<a> <b> </a> </b>`? It's poorly nested.
    // The requirement just says "mà không tìm thấy thẻ mở tương ứng nào trước đó chưa được khớp".
    // This implies a stack-like matching.
    
    // Let's first parse all tags and find their matching pairs.
    const tags = [];
    let match;
    while ((match = tagRegex.exec(text)) !== null) {
        tags.push({
            fullMatch: match[0],
            isClosing: match[1] === '/',
            tagName: match[2],
            attributes: match[3],
            start: match.index,
            end: match.index + match[0].length,
            matched: false,
            shouldFix: false
        });
    }
    
    const stack = [];
    for (let i = 0; i < tags.length; i++) {
        const tag = tags[i];
        if (!tag.isClosing) {
            stack.push(tag);
        } else {
            // Find the most recent unmatched opening tag with the same name
            let foundIndex = -1;
            for (let j = stack.length - 1; j >= 0; j--) {
                if (stack[j].tagName === tag.tagName && !stack[j].matched) {
                    foundIndex = j;
                    break;
                }
            }
            if (foundIndex !== -1) {
                // Match them
                stack[foundIndex].matched = true;
                tag.matched = true;
                // Remove from stack (and any above it? The prompt doesn't specify strict nesting. Let's just remove it from stack)
                stack.splice(foundIndex, 1);
            } else {
                // Orphan closing tag
                tag.shouldFix = true;
            }
        }
    }
    
    // Unclosed opening tags
    if (isFinal) {
        for (let i = 0; i < stack.length; i++) {
            stack[i].shouldFix = true;
        }
    }
    
    // Now reconstruct the string
    // Sort tags by start index (they already are)
    for (let i = 0; i < tags.length; i++) {
        const tag = tags[i];
        result += text.substring(lastIndex, tag.start);
        if (tag.shouldFix) {
            // "xóa các kí tự '<' '>' của thẻ </tag> này biến nó thành nội dung trần: "tag""
            // If it's `</tag>`, we strip `<` `>` and `/`.
            // Wait, the prompt says "nội dung trần: 'tag'". So we just replace it with its tag name?
            // "biến nó thành nội dung trần: "tag""
            // If it's `<tag attr="value">`, maybe just `tag attr="value"`?
            // The prompt says: "xóa các kí tự '<' '>'"
            let fixed = tag.fullMatch.replace(/[<>]/g, '');
            // For `</tag>`, removing `<` and `>` results in `/tag`. Does the prompt mean `tag`?
            // "xóa các kí tự "<" ">" của thẻ </tag> này biến nó thành nội dung trần: "tag""
            // If it says "tag", it implies the slash is also removed. Let's strip the slash if it's a closing tag, just to perfectly match the prompt's example.
            if (tag.isClosing) {
                fixed = fixed.replace(/\//g, '');
            }
            result += fixed;
        } else {
            result += tag.fullMatch;
        }
        lastIndex = tag.end;
    }
    result += text.substring(lastIndex);
    return result;
}

console.log(matchAndFixTags("hello </foo> world <foo> ok </foo> <bar> unclosed <baz>", true));
console.log(matchAndFixTags("hello </foo> world <foo> ok </foo> <bar> unclosed <baz>", false));
