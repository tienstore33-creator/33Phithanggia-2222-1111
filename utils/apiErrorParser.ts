export interface ParsedApiError {
  code: number;                // 429, 404, 503, 500, 400...
  status: string;              // RESOURCE_EXHAUSTED, NOT_FOUND, UNAVAILABLE, INTERNAL...
  failedModel: string;         // Tên model bị lỗi (gemma-4-31b, gemini-3.1-pro...)
  tokenLimit?: number | string;// Giới hạn token (ví dụ: 16000)
  quotaMetric?: string;        // Loại hạn mức vi phạm
  retryDelay?: string;         // Thời gian cần chờ (ví dụ: "19.4s" hoặc "19s")
  cleanDescription: string;    // Lời giải thích ngắn gọn bằng tiếng Việt dễ hiểu
  rawMessage: string;          // Chuỗi thông điệp gốc phục vụ debug
}

export function parseApiError(error: any, fallbackModel: string = "Không rõ"): ParsedApiError {
  let rawMessage = "";
  if (typeof error === "string") {
    rawMessage = error;
  } else if (error && typeof error === "object") {
    rawMessage = error.message || JSON.stringify(error);
  } else {
    rawMessage = String(error);
  }

  const result: ParsedApiError = {
    code: 500,
    status: "UNKNOWN_ERROR",
    failedModel: fallbackModel,
    cleanDescription: "Đã xảy ra sự cố không xác định khi kết nối với máy chủ AI.",
    rawMessage
  };

  try {
    // 1. Cố gắng parse nội dung JSON lồng nhau từ message nếu có
    let errorObj: any = null;
    
    // Nếu là dạng JSON string hoàn chỉnh
    if (rawMessage.trim().startsWith("{") || rawMessage.trim().startsWith("[")) {
      try {
        errorObj = JSON.parse(rawMessage);
      } catch (e) {
        // Ignored
      }
    }

    // Nếu lồng trong chuỗi "Lỗi API: { ... }"
    if (!errorObj && rawMessage.includes("{")) {
      const startIdx = rawMessage.indexOf("{");
      const endIdx = rawMessage.lastIndexOf("}");
      if (startIdx !== -1 && endIdx !== -1 && endIdx > startIdx) {
        try {
          const jsonSub = rawMessage.substring(startIdx, endIdx + 1);
          errorObj = JSON.parse(jsonSub);
        } catch (e) {
          // Ignored
        }
      }
    }

    // Nếu parse được JSON, trích xuất cấu trúc Google RPC hoặc OpenAI standard
    if (errorObj) {
      const err = errorObj.error || errorObj;
      if (err) {
        if (err.code) result.code = Number(err.code);
        if (err.status) result.status = String(err.status);
        if (err.message) {
          // Ghi đè rawMessage bằng message sạch của lỗi
          const innerMsg = err.message;
          // Tìm thêm JSON lồng trong message lỗi Google
          if (typeof innerMsg === "string" && innerMsg.includes("{")) {
            try {
              const innerStart = innerMsg.indexOf("{");
              const innerEnd = innerMsg.lastIndexOf("}");
              const innerJson = JSON.parse(innerMsg.substring(innerStart, innerEnd + 1));
              const innerErr = innerJson.error || innerJson;
              if (innerErr.code) result.code = Number(innerErr.code);
              if (innerErr.status) result.status = String(innerErr.status);
              
              // Đọc chi tiết QuotaFailure / Help / RetryInfo
              if (innerErr.details && Array.isArray(innerErr.details)) {
                for (const detail of innerErr.details) {
                  if (detail["@type"]?.includes("QuotaFailure")) {
                    const violation = detail.violations?.[0];
                    if (violation) {
                      if (violation.quotaValue) result.tokenLimit = violation.quotaValue;
                      if (violation.quotaMetric) result.quotaMetric = violation.quotaMetric;
                      if (violation.quotaDimensions?.model) result.failedModel = violation.quotaDimensions.model;
                    }
                  }
                  if (detail["@type"]?.includes("RetryInfo")) {
                    if (detail.retryDelay) result.retryDelay = detail.retryDelay;
                  }
                }
              }
            } catch (e) {
              // Ignored
            }
          }
        }
      }
    }

    // 2. Dùng REGEX để quét thô chuỗi rawMessage dự phòng khi parse JSON thất bại hoặc thiếu trường
    
    // Quét mã lỗi (code)
    const codeMatch = rawMessage.match(/"code"\s*:\s*(\d+)/) || rawMessage.match(/code:\s*(\d+)/) || rawMessage.match(/status\s+(\d+)/);
    if (codeMatch && codeMatch[1]) {
      result.code = Number(codeMatch[1]);
    } else if (rawMessage.includes("429") || rawMessage.includes("quota exceeded") || rawMessage.includes("RESOURCE_EXHAUSTED")) {
      result.code = 429;
    } else if (rawMessage.includes("404") || rawMessage.includes("not found")) {
      result.code = 404;
    } else if (rawMessage.includes("503") || rawMessage.includes("service unavailable")) {
      result.code = 503;
    } else if (rawMessage.includes("500") || rawMessage.includes("internal server error")) {
      result.code = 500;
    }

    // Quét trạng thái (status)
    if (result.status === "UNKNOWN_ERROR" || !result.status) {
      if (rawMessage.includes("RESOURCE_EXHAUSTED")) result.status = "RESOURCE_EXHAUSTED";
      else if (rawMessage.includes("NOT_FOUND")) result.status = "NOT_FOUND";
      else if (rawMessage.includes("UNAVAILABLE")) result.status = "UNAVAILABLE";
      else if (rawMessage.includes("INTERNAL")) result.status = "INTERNAL_ERROR";
    }

    // Quét model hỏng
    const modelMatch = rawMessage.match(/model:\s*([\w-]{4,})/i) || rawMessage.match(/"model"\s*:\s*"([\w-]{4,})"/i);
    if (modelMatch && modelMatch[1]) {
      result.failedModel = modelMatch[1];
    }

    // Quét giới hạn limit / quotaValue
    const limitMatch = rawMessage.match(/limit:\s*(\d+)/i) || rawMessage.match(/"quotaValue"\s*:\s*"(\d+)"/i);
    if (limitMatch && limitMatch[1]) {
      result.tokenLimit = Number(limitMatch[1]);
    }

    // Quét thời gian retry delay
    const retryMatch = rawMessage.match(/retry in ([\d.]+s?)/i) || rawMessage.match(/retryDelay":\s*"([^"]+)"/i);
    if (retryMatch && retryMatch[1]) {
      result.retryDelay = retryMatch[1];
    }

    // 3. Việt hóa mô tả lỗi thân thiện
    switch (result.code) {
      case 429:
        result.status = "RESOURCE_EXHAUSTED";
        result.cleanDescription = `Hạn mức gọi của API Key hiện tại đã bị cạn kiệt (Quá tải RPM/TPM). Giới hạn token đầu vào tối đa là ${result.tokenLimit || 'bị hạn chế'} cho model ${result.failedModel}. Vui lòng thử lại sau giây lát hoặc đổi sang dòng model khác nhẹ hơn (như Flash / Flash-Lite).`;
        break;
      case 404:
        result.status = "NOT_FOUND";
        result.cleanDescription = `Không tìm thấy model '${result.failedModel}' được yêu cầu, hoặc vùng địa lý/tài khoản của bạn không được cấp quyền truy cập model này. Hãy chuyển sang dòng model phổ thông khác ổn định hơn.`;
        break;
      case 503:
        result.status = "UNAVAILABLE";
        result.cleanDescription = `Mô hình '${result.failedModel}' hiện đang gặp quá tải lưu lượng truy cập (Code 503 High Demand). Hệ thống đang tự động chuyển sang mô hình dự phòng tiếp theo...`;
        break;
      case 500:
        result.status = "INTERNAL_ERROR";
        result.cleanDescription = "Máy chủ Google phát sinh lỗi hệ thống không lường trước khi biên dịch hoặc phản hồi thông điệp. Thử đổi model khác hoặc thử lại.";
        break;
      case 400:
        result.status = "BAD_REQUEST";
        result.cleanDescription = "Yêu cầu gửi đi bị sai định dạng prompt, hoặc chứa từ khóa nhạy cảm bị bộ lọc an toàn của Google từ chối xử lý.";
        break;
      default:
        result.cleanDescription = `Gặp lỗi hệ thống (Mã lỗi ${result.code}). Thông báo chi tiết từ API: ${rawMessage.substring(0, 150)}...`;
    }

  } catch (e) {
    console.error("Lỗi trong quá trình parse lỗi API:", e);
  }

  return result;
}
