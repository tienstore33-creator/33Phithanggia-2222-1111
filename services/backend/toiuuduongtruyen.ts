import type { Request, Response } from "express";

export const FAST_LANE_MODELS = new Set<string>([
  "gemini-4-hydrogen",
  "gemini-3.8-flash",
  "gemini-3.7-flash",
  "gemini-3.6-flash",
  "gemini-3.5-flash",
]);

/**
 * Kiểm tra xem model hiện tại có nằm trong danh sách 5 model được phép dùng đường truyền tối ưu Fast-Lane hay không.
 */
export function isFastLaneModel(modelName: string): boolean {
  if (!modelName) return false;
  const cleanId = modelName.replace(/^models\//i, "").trim().toLowerCase();
  if (!cleanId || cleanId.includes("lite")) return false;
  return FAST_LANE_MODELS.has(cleanId);
}

/**
 * Tạo body gửi thẳng lên Google API.
 * Ưu tiên tái sử dụng rawBody gốc (zero re-serialization), chỉ lọc bỏ tham số xung đột nếu phát hiện sót trên gemini-4-hydrogen.
 */
function buildFastLaneBody(
  modelName: string,
  rawBody: Buffer | undefined,
  parsedBody: any
): BodyInit {
  const cleanId = modelName.replace(/^models\//i, "").trim().toLowerCase();

  if (cleanId === "gemini-4-hydrogen" && parsedBody && typeof parsedBody === "object") {
    const genCfg = parsedBody.generationConfig;
    const topThinkCfg = parsedBody.thinkingConfig;
    const hasBlockedGenFields = !!(
      genCfg &&
      (genCfg.temperature !== undefined ||
        genCfg.topP !== undefined ||
        genCfg.topK !== undefined ||
        genCfg.candidateCount !== undefined ||
        genCfg.thinkingConfig?.thinkingBudget !== undefined)
    );
    const hasBlockedTopThinkingBudget = topThinkCfg?.thinkingBudget !== undefined;

    if (hasBlockedGenFields || hasBlockedTopThinkingBudget) {
      const sanitized = { ...parsedBody };
      if (sanitized.generationConfig) {
        const nextGen = { ...sanitized.generationConfig };
        delete nextGen.temperature;
        delete nextGen.topP;
        delete nextGen.topK;
        delete nextGen.candidateCount;
        if (nextGen.thinkingConfig) {
          const nextThink = { ...nextGen.thinkingConfig };
          delete nextThink.thinkingBudget;
          if (Object.keys(nextThink).length > 0) {
            nextGen.thinkingConfig = nextThink;
          } else {
            delete nextGen.thinkingConfig;
          }
        }
        sanitized.generationConfig = nextGen;
      }
      if (sanitized.thinkingConfig?.thinkingBudget !== undefined) {
        const nextTopThink = { ...sanitized.thinkingConfig };
        delete nextTopThink.thinkingBudget;
        if (Object.keys(nextTopThink).length > 0) {
          sanitized.thinkingConfig = nextTopThink;
        } else {
          delete sanitized.thinkingConfig;
        }
      }
      return JSON.stringify(sanitized);
    }
  }

  if (rawBody && rawBody.length > 0) {
    return rawBody as unknown as BodyInit;
  }

  if (typeof parsedBody === "string") {
    return parsedBody;
  }

  return JSON.stringify(parsedBody || {});
}

function buildTargetGoogleUrl(reqUrl: string, apiPath: string, apiKey: string, ensureSse: boolean): string {
  const urlObj = new URL(`https://generativelanguage.googleapis.com/${apiPath}`);
  const qIndex = reqUrl.indexOf("?");
  if (qIndex !== -1) {
    const searchParams = new URLSearchParams(reqUrl.substring(qIndex + 1));
    searchParams.forEach((val, key) => {
      urlObj.searchParams.set(key, val);
    });
  }
  urlObj.searchParams.set("key", apiKey);
  if (ensureSse && !urlObj.searchParams.has("alt")) {
    urlObj.searchParams.set("alt", "sse");
  }
  return urlObj.toString();
}

export interface FastLaneProxyParams {
  req: Request;
  res: Response;
  apiPath: string;
  apiKey: string;
  modelName: string;
  rawBody?: Buffer;
  parsedBody: any;
}

/**
 * Đường truyền Fast-Lane Stream Pass-Through (:streamGenerateContent)
 * - Truyền thẳng byte SSE từ Google xuống client không qua Double-SDK / JSON.parse+stringify mỗi chunk
 * - Đồng bộ AbortController theo sự kiện đóng kết nối client (res.on('close'))
 * - Tắt Nagle buffering (setNoDelay) và đẩy header ngay lập tức (flushHeaders)
 */
export async function handleFastLaneStreamProxy({
  req,
  res,
  apiPath,
  apiKey,
  modelName,
  rawBody,
  parsedBody,
}: FastLaneProxyParams): Promise<void> {
  const abortController = new AbortController();
  let clientClosed = false;

  const onClientClose = () => {
    if (!res.writableEnded) {
      clientClosed = true;
      abortController.abort();
    }
  };
  res.on("close", onClientClose);

  try {
    res.socket?.setNoDelay(true);
    const targetUrl = buildTargetGoogleUrl(req.url, apiPath, apiKey, true);
    const requestBody = buildFastLaneBody(modelName, rawBody, parsedBody);

    const googleRes = await fetch(targetUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": apiKey,
        "Accept-Encoding": "identity",
      },
      body: requestBody,
      signal: abortController.signal,
    });

    if (!googleRes.ok) {
      const errText = await googleRes.text().catch(() => "");
      let parsedErr: any = null;
      try {
        parsedErr = JSON.parse(errText);
      } catch {
        // Giữ nguyên chuỗi thô nếu không phải JSON
      }
      const errStatus = googleRes.status || 500;
      if (errStatus === 429 || (errStatus >= 400 && errStatus < 500)) {
        console.warn(`[FAST-LANE Stream Warning (${errStatus}) - ${modelName}]:`, errText);
      } else {
        console.error(`[FAST-LANE Stream Error (${errStatus}) - ${modelName}]:`, errText);
      }
      if (!res.headersSent) {
        res.status(errStatus).json(parsedErr || { error: errText || "Lỗi luồng Fast-Lane Gemini API." });
      } else if (!res.writableEnded) {
        res.end();
      }
      return;
    }

    res.status(200);
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache, no-transform");
    res.setHeader("Connection", "keep-alive");
    res.setHeader("X-Accel-Buffering", "no");
    if (typeof (res as any).flushHeaders === "function") {
      (res as any).flushHeaders();
    }

    if (googleRes.body) {
      const reader = googleRes.body.getReader();
      try {
        while (true) {
          if (clientClosed || abortController.signal.aborted) break;
          const { done, value } = await reader.read();
          if (done) break;
          if (value && value.length > 0 && !res.writableEnded) {
            res.write(value);
          }
        }
      } finally {
        try {
          reader.releaseLock();
        } catch {
          // Ignore release errors
        }
      }
    }

    if (!res.writableEnded) {
      res.end();
    }
  } catch (err: any) {
    if (clientClosed || err?.name === "AbortError") {
      if (!res.writableEnded) {
        res.end();
      }
      return;
    }
    const errMsg = err?.message || String(err || "Lỗi kết nối Fast-Lane Stream.");
    console.error(`[FAST-LANE Stream Exception - ${modelName}]:`, errMsg);
    if (!res.headersSent) {
      res.status(500).json({ error: errMsg });
    } else if (!res.writableEnded) {
      res.end();
    }
  } finally {
    res.off("close", onClientClose);
  }
}

/**
 * Đường truyền Fast-Lane cho request đơn lẻ (:generateContent)
 * - Bỏ qua bước khởi tạo GoogleGenAI mới mỗi lượt và tái sử dụng rawBody + HTTP Keep-Alive pool
 */
export async function handleFastLaneUnaryProxy({
  req,
  res,
  apiPath,
  apiKey,
  modelName,
  rawBody,
  parsedBody,
}: FastLaneProxyParams): Promise<void> {
  const abortController = new AbortController();
  let clientClosed = false;

  const onClientClose = () => {
    if (!res.writableEnded) {
      clientClosed = true;
      abortController.abort();
    }
  };
  res.on("close", onClientClose);

  try {
    const targetUrl = buildTargetGoogleUrl(req.url, apiPath, apiKey, false);
    const requestBody = buildFastLaneBody(modelName, rawBody, parsedBody);

    const googleRes = await fetch(targetUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": apiKey,
        "Accept-Encoding": "identity",
      },
      body: requestBody,
      signal: abortController.signal,
    });

    const responseText = await googleRes.text();
    let parsedJson: any = null;
    try {
      parsedJson = JSON.parse(responseText);
    } catch {
      // Fallback plain text nếu upstream không trả JSON
    }

    if (!googleRes.ok) {
      const errStatus = googleRes.status || 500;
      if (errStatus === 429 || (errStatus >= 400 && errStatus < 500)) {
        console.warn(`[FAST-LANE Generate Warning (${errStatus}) - ${modelName}]:`, responseText);
      } else {
        console.error(`[FAST-LANE Generate Error (${errStatus}) - ${modelName}]:`, responseText);
      }
      if (!res.headersSent) {
        res.status(errStatus).json(parsedJson || { error: responseText || "Lỗi xử lý Fast-Lane Gemini API." });
      }
      return;
    }

    if (!res.headersSent) {
      if (parsedJson !== null) {
        res.status(200).json(parsedJson);
      } else {
        res.status(200).send(responseText);
      }
    }
  } catch (err: any) {
    if (clientClosed || err?.name === "AbortError") {
      if (!res.writableEnded) {
        res.end();
      }
      return;
    }
    const errMsg = err?.message || String(err || "Lỗi kết nối Fast-Lane Unary.");
    console.error(`[FAST-LANE Generate Exception - ${modelName}]:`, errMsg);
    if (!res.headersSent) {
      res.status(500).json({ error: errMsg });
    }
  } finally {
    res.off("close", onClientClose);
  }
}
