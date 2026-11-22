const narrative = "Lúc này, Mộng Khiết tỏa ra uy áp Luyện Khí Tầng 9. Sau đó Mộng Khiết làm tình với Hàn Tuyệt. Lát sau, Hàn Tuyệt giao cấu cùng Lý Vân. Hệ thống tử cung được kích hoạt.";

const sexRegex = /([A-ZÀ-Ỹa-zà-ỹ\\s]+)\\s+(làm tình|quan hệ|ân ái|giao cấu|hoan ái)\\s+(với|cùng)\\s+([A-ZÀ-Ỹa-zà-ỹ\\s]+)/gi;
let sexMatch;
while ((sexMatch = sexRegex.exec(narrative)) !== null) {
    let p1 = sexMatch[1].trim();
    let p2 = sexMatch[4].trim();
    p1 = p1.replace(/^(như|rằng|khi|lúc|sau đó|và|thì|nhưng)\\s+/i, "");
    p2 = p2.replace(/^(như|rằng|khi|lúc|sau đó|và|thì|nhưng)\\s+/i, "");
    p2 = p2.split(/[\\,\\.\\;\\:\\(\\)]/)[0].trim();
    
    console.log("Found sex match:", p1, "and", p2);
}

const wombRegex = /tử cung|âm đạo|hoa tâm/gi;
if (wombRegex.test(narrative)) {
    console.log("Found womb words");
}

