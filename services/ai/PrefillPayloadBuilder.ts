import { Content } from "@google/genai";
import {
  buildFewShotMultiTurnContents,
  isStructuredFewShotModel,
} from "./StructuredNarrativeHelper";

export interface BuildPayloadOptions {
  prompt: string;
  enablePrefill?: boolean;
  enableUserAnchor?: boolean;
  enableFewShotMultiTurn?: boolean;
  modelName?: string;
  responseMimeType?: string;
  prefillModelText?: string;
  inlineParts?: { mimeType: string; data: string }[];
}

export class PrefillPayloadBuilder {
  public static readonly DEFAULT_PREFILL_TEXT = 
    "</tuong_than>\n<thinking>\n[[SYSTEM: ULTIMATE_LOGIC_CORE | MODE: TRIBUNAL_AUDIT_PROCESS | PRIORITY: ABSOLUTE]]\nBắt đầu suy nghĩ theo qui trình thẩm định..bắt đầu trong 3..2..1..tiến hành!";

  public static readonly DEDUPLICATION_PATTERNS = [
    "</tuong_than>",
    "<tuong_than>",
    "<thinking>",
    "[[SYSTEM: ULTIMATE_LOGIC_CORE",
    "Bắt đầu suy nghĩ theo qui trình thẩm định"
  ];

  public static readonly NO_PREFILL_MODELS = new Set<string>([
    "gemini-4-hydrogen",
    "gemini-3.8-flash",
    "gemini-3.7-flash",
    "gemini-3.6-flash",
    "gemini-3.5-flash",
  ]);

  /**
   * Kiểm tra model có tương thích với cơ chế prefill hay không
   */
  public static isPrefillEligible(modelName: string = '', responseMimeType?: string): boolean {
    if (responseMimeType && responseMimeType === 'application/json') return false;
    if (isStructuredFewShotModel(modelName)) {
      return false;
    }
    const modelLower = modelName.toLowerCase();
    return (
      modelLower.includes('gemini') || 
      modelLower.includes('flash') || 
      modelLower.includes('pro') ||
      modelLower.includes('claude')
    );
  }

  /**
   * Kiểm tra xem model có thuộc 5 model dùng neo tư duy <thinking> bên trong { role: 'user' } hay không
   */
  public static isUserAnchorEligible(
    modelName: string = '',
    responseMimeType?: string,
    prompt: string = ''
  ): boolean {
    if (responseMimeType && responseMimeType === 'application/json') return false;
    if (!isStructuredFewShotModel(modelName)) {
      return false;
    }
    if (!prompt || prompt.includes('<neo_dau_ra_+user_prefill_anchor>')) {
      return false;
    }
    if (
      prompt.includes('DO NOT USE <thinking>') ||
      prompt.includes('KHÔNG dùng thẻ <thinking>') ||
      prompt.includes('KHÔNG viết suy nghĩ')
    ) {
      return false;
    }
    return (
      prompt.includes('<thinking>') ||
      prompt.includes('<qui_trinh_tham_dinh>') ||
      prompt.includes('TRIBUNAL_AUDIT') ||
      prompt.includes('<tuong_than>')
    );
  }

  /**
   * Tạo khối chỉ thị neo đầu ra đặt ở cuối { role: 'user' } giúp AI bám sát khung <thinking>
   */
  public static buildUserPrefillAnchorText(prefillText?: string): string {
    const cleanedAnchor = (prefillText || PrefillPayloadBuilder.DEFAULT_PREFILL_TEXT)
      .replace(/<\/?tuong_than>\s*/gi, '')
      .trim();
    const openingLine =
      cleanedAnchor ||
      '<thinking>\n[[SYSTEM: ULTIMATE_LOGIC_CORE | MODE: TRIBUNAL_AUDIT_PROCESS | PRIORITY: ABSOLUTE]]\nBắt đầu suy nghĩ theo qui trình thẩm định..bắt đầu trong 3..2..1..tiến hành!';

    return [
      '<neo_dau_ra_+user_prefill_anchor>',
      '================',
      '⚠️ CHỈ THỊ NEO ĐẦU RA BẮT BUỘC (BÁM SÁT TƯ DUY <thinking>):',
      '1. KHÔNG viết lời chào hay xác nhận lại yêu cầu. Hãy mở đầu phản hồi NGAY LẬP TỨC bằng đúng đoạn khởi động sau để thực hiện đầy đủ quy trình suy nghĩ/thanh tra trong <thinking>...</thinking>:',
      openingLine,
      '2. Sau khi hoàn tất đầy đủ các bước và đóng thẻ </thinking>, BẮT BUỘC tiếp nối trọn vẹn phần nội dung chính (như <content>...</content>, <update_data>...</update_data>, <choice>...</choice> hoặc định dạng thẻ đã quy định ở trên), tuyệt đối không dừng giữa chừng.',
      '================',
      '</neo_dau_ra_+user_prefill_anchor>',
    ].join('\n');
  }

  /**
   * Xử lý bộ đệm loại bỏ trùng lặp (Deduplication Buffer)
   */
  public static processDeduplicationChunk(
    chunkText: string,
    state: { buffer: string; hasStripped: boolean }
  ): string {
    if (state.hasStripped || !chunkText) {
      return chunkText;
    }

    state.buffer += chunkText;

    let strippedAny = false;
    for (const pattern of PrefillPayloadBuilder.DEDUPLICATION_PATTERNS) {
      if (state.buffer.includes(pattern)) {
        const index = state.buffer.indexOf(pattern);
        state.buffer = state.buffer.substring(index + pattern.length).trimStart();
        strippedAny = true;
      }
    }

    if (!strippedAny && state.buffer.length > 50) {
      const output = state.buffer;
      state.buffer = "";
      state.hasStripped = true;
      return output;
    } else if (strippedAny) {
      const output = state.buffer;
      state.buffer = "";
      state.hasStripped = true;
      return output;
    }

    return "";
  }

  /**
   * Xây dựng mảng contents chuẩn với role: "user" và role: "model"
   */
  public static buildContents(options: BuildPayloadOptions): any[] {
    const { 
      prompt, 
      enablePrefill = true, 
      enableUserAnchor = false,
      enableFewShotMultiTurn = false,
      modelName = '',
      responseMimeType,
      prefillModelText = PrefillPayloadBuilder.DEFAULT_PREFILL_TEXT,
      inlineParts 
    } = options;

    // Cách 3: Dùng Few-Shot Multi-Turn chuẩn (user -> model -> user) thay vì prefill ở lượt cuối
    if (enableFewShotMultiTurn && isStructuredFewShotModel(modelName)) {
      return buildFewShotMultiTurnContents(prompt, inlineParts, true);
    }

    const userParts: any[] = [];
    
    // Đính kèm dữ liệu đa phương tiện nếu có
    if (inlineParts && inlineParts.length > 0) {
      inlineParts.forEach(part => {
        userParts.push({
          inlineData: {
            mimeType: part.mimeType,
            data: part.data
          }
        });
      });
    }

    const shouldInjectUserAnchor =
      !enablePrefill &&
      !!enableUserAnchor &&
      !!modelName &&
      PrefillPayloadBuilder.isUserAnchorEligible(modelName, responseMimeType, prompt);

    const finalUserPrompt = shouldInjectUserAnchor
      ? `${prompt}\n\n${PrefillPayloadBuilder.buildUserPrefillAnchorText(prefillModelText)}`
      : prompt;
    
    userParts.push({ text: finalUserPrompt });

    const contents: any[] = [
      { role: "user", parts: userParts }
    ];

    // Mớm mồi trực tiếp vào role: "model" ở tầng API
    if (enablePrefill && prefillModelText) {
      contents.push({
        role: "model",
        parts: [{ text: prefillModelText }]
      });
    }

    return contents;
  }
}
