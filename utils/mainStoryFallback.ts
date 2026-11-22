/**
 * Tạo chuỗi fallback động dựa trên danh sách model từ Menu thiết lập
 * @param selectedModel Model người dùng chọn làm mặc định
 * @param availableModels Danh sách model lấy từ menu thả xuống (settings.availableModels)
 */
export const generateMainFallbackChain = (
    selectedModel: string, 
    availableModels: string[]
): string[] => {
    // 1. Hàm tính trọng số sức mạnh (Càng cao càng ưu tiên)
    const getWeight = (m: string) => {
        const name = m.toLowerCase();
        let versionWeight = 0;
        
        // Extract version number
        const versionMatch = name.match(/gemini-(\d+\.\d+|\d+)/);
        if (versionMatch) {
            versionWeight = parseFloat(versionMatch[1]) * 10; // e.g., 3.1 -> 31, 2.5 -> 25
        }

        let typeWeight = 0;
        if (name.includes('pro')) typeWeight = 3;
        else if (name.includes('flash-lite')) typeWeight = 1;
        else if (name.includes('flash')) typeWeight = 2;
        
        return versionWeight * 10 + typeWeight; // Version is primary, type is secondary
    };

    // 2. Sắp xếp danh sách model từ Menu theo trọng số (Giảm dần)
    const sortedModels = [...availableModels].sort((a, b) => getWeight(b) - getWeight(a));

    // 3. Tìm vị trí của model người dùng đã chọn trong danh sách đã sắp xếp
    const startIndex = sortedModels.indexOf(selectedModel);

    // 4. Trả về danh sách xoay vòng tịnh tiến: Bắt đầu từ model được chọn đến hết, sau đó vòng lại các model đứng trước nó.
    if (startIndex === -1) {
        return Array.from(new Set([selectedModel, ...sortedModels]));
    }
    
    const rotatedChain = sortedModels.slice(startIndex).concat(sortedModels.slice(0, startIndex));
    return Array.from(new Set(rotatedChain));
};
