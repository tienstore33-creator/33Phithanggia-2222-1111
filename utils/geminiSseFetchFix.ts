/**
 * Bộ chuẩn hóa luồng SSE (Server-Sent Events) cho Gemini `:streamGenerateContent` ở phía trình duyệt.
 * Khắc phục triệt để lỗi `Error: Incomplete JSON segment at the end` trong `ApiClient.processStreamResponse_1`
 * của `@google/genai` khi Proxy hoặc Upstream:
 * 1. Trả về `data: {...}\n` (chỉ 1 dấu xuống dòng) hoặc thiếu `\n\n` ở cuối luồng.
 * 2. Gửi kèm `data: [DONE]` không đúng chuẩn Gemini SDK.
 * 3. Trả về `application/json` (object/array) thay vì `text/event-stream`.
 * 4. Đứt kết nối giữa chừng để lại một đoạn JSON bị cắt dở ở cuối buffer.
 */

const normalizeSsePayloadText = (raw: string): string | null => {
  const trimmed = raw.trim();
  if (!trimmed || trimmed === "[DONE]") return null;

  const withoutPrefix = trimmed.startsWith("data:")
    ? trimmed.slice(5).trim()
    : trimmed;

  if (!withoutPrefix || withoutPrefix === "[DONE]") return null;

  try {
    const parsed = JSON.parse(withoutPrefix);
    return JSON.stringify(parsed);
  } catch {
    return null;
  }
};

export const createNormalizedGeminiSseStream = (
  sourceBody: ReadableStream<Uint8Array>
): ReadableStream<Uint8Array> => {
  const decoder = new TextDecoder("utf-8");
  const encoder = new TextEncoder();

  let textBuffer = "";
  let currentDataLines: string[] = [];
  let emittedAnyChunk = false;

  const emitJsonFrame = (
    controller: ReadableStreamDefaultController<Uint8Array>,
    jsonStr: string
  ) => {
    controller.enqueue(encoder.encode(`data: ${jsonStr}\n\n`));
    emittedAnyChunk = true;
  };

  const tryFlushDataLines = (
    controller: ReadableStreamDefaultController<Uint8Array>,
    forceCheckSingleJson: boolean
  ): boolean => {
    if (currentDataLines.length === 0) return false;
    const combined = currentDataLines.join("\n").trim();
    if (!combined || combined === "[DONE]") {
      currentDataLines = [];
      return true;
    }

    const validJson = normalizeSsePayloadText(combined);
    if (validJson !== null) {
      emitJsonFrame(controller, validJson);
      currentDataLines = [];
      return true;
    }

    if (!forceCheckSingleJson) {
      return false;
    }
    return false;
  };

  const processCompleteLine = (
    controller: ReadableStreamDefaultController<Uint8Array>,
    rawLine: string
  ) => {
    const line = rawLine.replace(/\r$/, "");
    const trimmed = line.trim();

    // Dòng trống kết thúc 1 SSE event
    if (trimmed === "") {
      if (currentDataLines.length > 0) {
        const combined = currentDataLines.join("\n").trim();
        const validJson = normalizeSsePayloadText(combined);
        if (validJson !== null) {
          emitJsonFrame(controller, validJson);
        }
        currentDataLines = [];
      }
      return;
    }

    if (trimmed.startsWith("data:")) {
      const payload = trimmed.slice(5).trim();
      if (payload === "[DONE]") {
        currentDataLines = [];
        return;
      }

      // Nếu buffer trước đó đã là một JSON hoàn chỉnh (proxy quên dòng trống \n\n), flush trước
      if (currentDataLines.length > 0) {
        tryFlushDataLines(controller, true);
      }

      // Kiểm tra nhanh nếu dòng data: mới tự thân đã là JSON hoàn chỉnh -> đẩy ngay giảm độ trễ
      const directJson = normalizeSsePayloadText(payload);
      if (directJson !== null) {
        if (currentDataLines.length > 0) {
          // Trường hợp có line trước chưa parse được bị mồ côi -> bỏ qua rác cũ
          currentDataLines = [];
        }
        emitJsonFrame(controller, directJson);
      } else {
        currentDataLines.push(payload);
      }
      return;
    }

    // Bỏ qua các trường SSE metadata khác (event:, id:, retry:, :comment)
    if (
      trimmed.startsWith("event:") ||
      trimmed.startsWith("id:") ||
      trimmed.startsWith("retry:") ||
      trimmed.startsWith(":")
    ) {
      return;
    }

    // Fallback: proxy trả thẳng JSON không có tiền tố `data:`
    currentDataLines.push(line);
    tryFlushDataLines(controller, true);
  };

  const reader = sourceBody.getReader();

  return new ReadableStream<Uint8Array>({
    async pull(controller) {
      try {
        while (true) {
          const { done, value } = await reader.read();

          if (done) {
            const decoderTail = decoder.decode();
            if (decoderTail) {
              textBuffer += decoderTail;
            }

            // Xử lý nốt các dòng hoàn chỉnh còn lại trong textBuffer
            let newlineIdx = textBuffer.indexOf("\n");
            while (newlineIdx !== -1) {
              const line = textBuffer.slice(0, newlineIdx);
              textBuffer = textBuffer.slice(newlineIdx + 1);
              processCompleteLine(controller, line);
              newlineIdx = textBuffer.indexOf("\n");
            }

            if (textBuffer.trim().length > 0) {
              processCompleteLine(controller, textBuffer);
              textBuffer = "";
            }

            // Xử lý phần dữ liệu còn sót lại ở cuối luồng khi EOF
            if (currentDataLines.length > 0) {
              const leftover = currentDataLines.join("\n").trim();
              currentDataLines = [];

              if (leftover && leftover !== "[DONE]") {
                // Thử parse như JSON đơn hoặc mảng JSON [{...}, {...}]
                let handled = false;
                try {
                  const cleanLeftover = leftover.startsWith("data:")
                    ? leftover.slice(5).trim()
                    : leftover;
                  const parsed = JSON.parse(cleanLeftover);
                  if (Array.isArray(parsed)) {
                    for (const item of parsed) {
                      emitJsonFrame(controller, JSON.stringify(item));
                    }
                  } else {
                    emitJsonFrame(controller, JSON.stringify(parsed));
                  }
                  handled = true;
                } catch {
                  handled = false;
                }

                if (!handled) {
                  console.warn(
                    `[Gemini SSE Normalizer] Bỏ qua đoạn JSON bị cắt dở ở cuối luồng (${leftover.length} ký tự).`
                  );
                  if (!emittedAnyChunk) {
                    emitJsonFrame(
                      controller,
                      JSON.stringify({
                        error: {
                          code: 502,
                          message:
                            "Luồng phản hồi từ API/Proxy bị cắt ngang với đoạn JSON chưa hoàn chỉnh.",
                          status: "UNAVAILABLE",
                        },
                      })
                    );
                  }
                }
              }
            }

            controller.close();
            return;
          }

          if (value && value.length > 0) {
            textBuffer += decoder.decode(value, { stream: true });
            let newlineIdx = textBuffer.indexOf("\n");
            let produced = false;

            while (newlineIdx !== -1) {
              const line = textBuffer.slice(0, newlineIdx);
              textBuffer = textBuffer.slice(newlineIdx + 1);
              processCompleteLine(controller, line);
              newlineIdx = textBuffer.indexOf("\n");
              produced = true;
            }

            // Nếu đã xử lý được ít nhất 1 dòng hoặc có dữ liệu để reader tiếp tục
            if (produced) {
              return;
            }
          }
        }
      } catch (err) {
        try {
          reader.releaseLock();
        } catch {
          // Ignore
        }
        controller.error(err);
      }
    },
    cancel(reason) {
      return reader.cancel(reason);
    },
  });
};

let isFetchPatched = false;

/**
 * Cài đặt bộ chuẩn hóa SSE nhẹ trên global fetch CHỈ cho các endpoint `:streamGenerateContent`.
 * Không can thiệp vào bất kỳ request API nào khác.
 */
export const ensureGeminiSseFetchNormalizer = (): void => {
  if (typeof window === "undefined" || isFetchPatched) return;
  if (typeof window.fetch !== "function") return;

  isFetchPatched = true;
  const originalFetch = window.fetch.bind(window);

  window.fetch = async (
    input: RequestInfo | URL,
    init?: RequestInit
  ): Promise<Response> => {
    const response = await originalFetch(input, init);

    const urlStr =
      typeof input === "string"
        ? input
        : input instanceof URL
          ? input.toString()
          : input?.url || "";

    if (!urlStr.includes(":streamGenerateContent") || !response.ok || !response.body) {
      return response;
    }

    const contentType = (response.headers.get("content-type") || "").toLowerCase();

    // Nếu proxy trả về application/json thay vì text/event-stream, chuyển đổi sang SSE hợp lệ
    if (contentType.includes("application/json")) {
      const text = await response.text();
      const encoder = new TextEncoder();
      let sseBody = "";
      try {
        const parsed = JSON.parse(text);
        if (Array.isArray(parsed)) {
          sseBody = parsed.map((item) => `data: ${JSON.stringify(item)}\n\n`).join("");
        } else {
          sseBody = `data: ${JSON.stringify(parsed)}\n\n`;
        }
      } catch {
        // Fallback đưa qua bộ chuẩn hóa nếu nội dung thực chất là SSE gắn nhầm Content-Type
        const fallbackStream = new ReadableStream<Uint8Array>({
          start(c) {
            c.enqueue(encoder.encode(text));
            c.close();
          },
        });
        const normalizedHeaders = new Headers(response.headers);
        normalizedHeaders.set("content-type", "text/event-stream; charset=utf-8");
        return new Response(createNormalizedGeminiSseStream(fallbackStream), {
          status: response.status,
          statusText: response.statusText,
          headers: normalizedHeaders,
        });
      }

      const sseStream = new ReadableStream<Uint8Array>({
        start(c) {
          if (sseBody) {
            c.enqueue(encoder.encode(sseBody));
          }
          c.close();
        },
      });
      const normalizedHeaders = new Headers(response.headers);
      normalizedHeaders.set("content-type", "text/event-stream; charset=utf-8");
      return new Response(sseStream, {
        status: response.status,
        statusText: response.statusText,
        headers: normalizedHeaders,
      });
    }

    const normalizedStream = createNormalizedGeminiSseStream(response.body);
    return new Response(normalizedStream, {
      status: response.status,
      statusText: response.statusText,
      headers: response.headers,
    });
  };
};
