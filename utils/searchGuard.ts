
/**
 * Kiểm tra xem một model có khả năng chạy tính năng Google Search Grounding hay không.
 * Nguyên tắc: Chỉ dòng model "gemini-*" chính chủ mới hỗ trợ. Dòng "gemma-*", "deep-research" hay các bên thứ 3 đều không hỗ trợ.
 */
export function isGoogleSearchSupported(modelId: string): boolean {
  if (!modelId) return false;
  
  // Loại bỏ tiền tố "models/" nếu có
  const cleanModelId = modelId.replace(/^models\//, '').toLowerCase();

  // 1. Các dòng không hỗ trợ Search Grounding
  if (
    cleanModelId.includes("gemma") ||
    cleanModelId.includes("8b") ||
    cleanModelId.includes("deepseek") ||
    cleanModelId.includes("embedding") ||
    cleanModelId.includes("imagen")
  ) {
    return false;
  }

  // 2. Các dòng Gemini chính chủ (gemini-flash-latest, gemini-flash-lite-latest, gemini-2.5-flash, gemini-3.5-flash...) đều hỗ trợ Search
  if (cleanModelId.startsWith("gemini")) {
    return true;
  }

  return false;
}

/**
 * Cơ chế cơ học tự động bảo vệ gói cấu hình gửi lên API.
 * Nếu model không hỗ trợ Search, tước bỏ thuộc tính tools.googleSearch nhưng giữ lại các thuộc tính khác.
 */
export function sanitizeSearchConfig(modelId: string, config: any): any {
  if (!config) return config;

  const supported = isGoogleSearchSupported(modelId);
  
  if (!supported && config.tools) {
    console.warn(`[SearchGuard] Model '${modelId}' không hỗ trợ Google Search. Tự động tước bỏ Grounding để chạy thuần văn bản.`);
    
    // Tạo bản sao cấu hình mới tránh làm đột biến (mutate) cấu hình gốc bên ngoài
    const cleanConfig = { ...config };
    
    // Chỉ loại bỏ công cụ googleSearch, giữ lại các tools khác nếu có (như function_declarations)
    if (Array.isArray(cleanConfig.tools)) {
      cleanConfig.tools = cleanConfig.tools.filter((t: any) => !t.googleSearch);
      if (cleanConfig.tools.length === 0) {
        delete cleanConfig.tools;
      }
    } else {
      delete cleanConfig.tools;
    }
    
    return cleanConfig;
  }

  return config;
}
