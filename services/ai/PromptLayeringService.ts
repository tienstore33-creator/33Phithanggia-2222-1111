// /services/ai/PromptLayeringService.ts
export const buildLayeredPrompt = (isCustom: boolean, customBio: string, originalWorkData: any, toneSettings: any) => {
    // Layer 1: System (Immutable Rule)
    const layer1 = `--- LAYER 1: SYSTEM (IMMUTABLE RULE) ---
BẮT BUỘC: Tính cách nhân vật chính (MC) là cốt lõi, KHÔNG ĐƯỢC PHÉP thay đổi dù bối cảnh hay tông màu câu chuyện có biến động.`;

    // Layer 2: Data (Cleaned)
    const characterCore = isCustom ? customBio : originalWorkData.bio;
    const layer2 = `--- LAYER 2: CHARACTER DATA (CLEANED) ---
Dữ liệu nhân vật: ${characterCore}
BẮT BUỘC: Giữ nguyên tính cách, tiểu sử này. KHÔNG sao chép dữ liệu từ file gốc (fanficwork) nếu là nhân vật tùy chỉnh.`;

    // Layer 3: Tone (Situational)
    const layer3 = `--- LAYER 3: SITUATIONAL TONE (18+) ---
Tông màu 18+: ${toneSettings.enabled ? toneSettings.toneDescription : "Trung tính"}
BẮT BUỘC: Chỉ áp dụng tông màu này cho MÔI TRƯỜNG, TÌNH HUỐNG và PHẢN ỨNG CỦA NPC. TUYỆT ĐỐI KHÔNG áp dụng cho tính cách MC.`;

    return `${layer1}\n\n${layer2}\n\n${layer3}`;
};
