import { Type } from "@google/genai";

/**
 * Danh sách 5 model sử dụng song song:
 * - Cách 1: Structured Outputs (responseSchema) khóa cứng cấu trúc JSON
 * - Cách 3: Few-Shot Multi-Turn chuẩn (user -> model -> user) dùng ví dụ từ promptTaskHelpers.ts
 */
export const STRUCTURED_FEWSHOT_MODELS = new Set<string>([
  "gemini-4-hydrogen",
  "gemini-3.8-flash",
  "gemini-3.7-flash",
  "gemini-3.6-flash",
  "gemini-3.5-flash",
]);

export const cleanStructuredModelId = (modelName: string = ""): string => {
  if (!modelName) return "";
  return modelName.replace(/^models\//i, "").trim().toLowerCase();
};

/**
 * Kiểm tra model có nằm trong nhóm 5 model áp dụng Structured Outputs + Few-Shot Multi-Turn không
 * (loại trừ các biến thể lite).
 */
export const isStructuredFewShotModel = (modelName: string = ""): boolean => {
  const cleanId = cleanStructuredModelId(modelName);
  if (!cleanId || cleanId.includes("lite")) return false;
  // Loại trừ các model gemini 4 hydrogen, flash 3.8, 3.7 khỏi structured JSON schema streaming để tránh lỗi Incomplete JSON segment at the end
  if (
    cleanId.includes("4-hydrogen") ||
    cleanId.includes("3.8") ||
    cleanId.includes("3.7")
  ) {
    return false;
  }
  return STRUCTURED_FEWSHOT_MODELS.has(cleanId);
};

/**
 * Kiểm tra prompt/systemInstruction có phải luồng kể chuyện cần cấu trúc <thinking> + <content> hay không.
 * Tránh áp dụng nhầm lên các tác vụ JSON extraction, combat classic (<ket_qua_giao_tranh>), hoặc OOC/dialogue-only.
 */
export const isNarrativeStructuredEligible = (options: {
  modelName?: string;
  responseMimeType?: string;
  prompt?: string;
  systemInstruction?: string;
  enableNarrativeStructured?: boolean;
}): boolean => {
  const {
    modelName = "",
    responseMimeType,
    prompt = "",
    systemInstruction = "",
    enableNarrativeStructured = true,
  } = options;

  if (!enableNarrativeStructured) return false;
  if (responseMimeType && responseMimeType === "application/json") return false;
  if (!isStructuredFewShotModel(modelName)) return false;

  const combined = `${systemInstruction}\n${prompt}`;
  if (
    combined.includes("DO NOT USE <thinking>") ||
    combined.includes("KHÔNG dùng thẻ <thinking>") ||
    combined.includes("KHÔNG viết suy nghĩ") ||
    combined.includes("KHÔNG mở lại thẻ <thinking>") ||
    combined.includes("<ket_qua_giao_tranh>") ||
    combined.includes("[COMBAT_DATA_JSON]") ||
    combined.includes("<json_data>")
  ) {
    return false;
  }

  return (
    combined.includes("<thinking>") ||
    combined.includes("<qui_trinh_tham_dinh>") ||
    combined.includes("TRIBUNAL_AUDIT") ||
    combined.includes("<tribunal_audit_structure>") ||
    combined.includes("<strict_workflow_rules>") ||
    combined.includes("<content>")
  );
};

/**
 * Schema JSON khóa cứng cấu trúc phản hồi (Cách 1: Constrained Decoding)
 */
export const NARRATIVE_STRUCTURED_RESPONSE_SCHEMA: any = {
  type: Type.OBJECT,
  properties: {
    thinking: {
      type: Type.STRING,
      description:
        "Toàn bộ quá trình tư duy/thẩm định bên trong <thinking> theo đúng các bước quy định (chỉ viết nội dung bên trong, không lặp lại thẻ <thinking> hay </tuong_than>).",
    },
    content: {
      type: Type.STRING,
      description:
        "Lời kể chính văn tiếng Việt đầy đủ, chi tiết (bao gồm hội thoại ##id|emoji|lời thoại## và <audit_log> nếu có yêu cầu).",
    },
    entity_tracking: {
      type: Type.STRING,
      description:
        "Theo dõi vị trí/hành động hiện tại của các NPC quan trọng (nếu có, để trống nếu không dùng).",
    },
    update_data: {
      type: Type.STRING,
      description:
        "Các yêu cầu cập nhật dữ liệu hệ thống (ngôn ngữ tự nhiên/XML hoặc tag [TAG_NAME: ...] khi ở chế độ Siêu Mạt Pháp).",
    },
    flash_summary: {
      type: Type.STRING,
      description:
        "Tóm tắt ngắn 1-2 câu diễn biến lượt hiện tại (bắt buộc khi bật Siêu Mạt Pháp hoặc lượt khởi đầu, để trống nếu không cần).",
    },
    choices: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
      description:
        "Danh sách các lựa chọn hành động tiếp theo cho người chơi, mỗi phần tử theo mẫu: [CHOICE: \"Hành động\" - \"Suy nghĩ chủ quan\"].",
    },
  },
  required: ["thinking", "content", "update_data", "choices"],
  propertyOrdering: [
    "thinking",
    "content",
    "entity_tracking",
    "update_data",
    "flash_summary",
    "choices",
  ],
};

/**
 * Chỉ thị ngắn gọn giúp model bám sát các trường JSON của responseSchema
 */
export const buildStructuredOutputReminder = (): string => {
  return [
    "<che_do_structured_output_+fewshot_multi_turn>",
    "================",
    "⚠️ ĐỊNH DẠNG ĐẦU RA BẮT BUỘC (STRUCTURED JSON SCHEMA):",
    "- Phản hồi của bạn bị khóa cứng theo JSON Schema gồm các trường: `thinking`, `content`, `entity_tracking`, `update_data`, `flash_summary`, `choices`.",
    "- Đưa toàn bộ phân tích tư duy (theo đúng cấu trúc mẫu ở lượt hội thoại mẫu phía trên) vào trường `thinking` (không cần viết lặp lại thẻ `<thinking>` / `</thinking>`).",
    "- Đưa toàn bộ lời kể chính văn vào trường `content` (không cần viết lặp lại thẻ `<content>` / `</content>`).",
    "- Đưa theo dõi thực thể (nếu có) vào `entity_tracking`, cập nhật dữ liệu vào `update_data`, tóm tắt ngắn (nếu chế độ hiện tại yêu cầu) vào `flash_summary`, và danh sách lựa chọn vào mảng `choices`.",
    "================",
    "</che_do_structured_output_+fewshot_multi_turn>",
  ].join("\n");
};

/**
 * Lượt User mẫu cho Few-Shot Multi-Turn (Cách 3) khớp với ví dụ trong prompts/promptTaskHelpers.ts
 */
export const FEWSHOT_SAMPLE_USER_TURN = [
  "<user_input>",
  'User Input Mới Nhất: "Hình Hàm chạy đến kho ngầm. Liễu Thanh Thanh thấy y phục này khó chịu quá, muốn đổi sang y phục khác"',
  "</user_input>",
  "<boi_canh_mau_+fewshot_multi_turn>",
  "================",
  "Bối cảnh mẫu (Action Mode): Ngõ hẻm phía sau chợ đen Minh Thành (23:15, đêm không trăng, độ ẩm 85%).",
  "MC: Hình Hàm (đang kiệt sức sau 4 tiếng ép xung tinh thần hải, ma năng gần cạn).",
  "NPC: Liễu Thanh Thanh (cùng phe), Ba tên côn đồ dẫn đầu bởi Tên sẹo (người của Mục Bạch, Hảo cảm: -15), Tiểu Đào (phân cảnh song song, bị ép buộc).",
  "Nhiệm vụ đang kích hoạt: [Cốt Truyện] Đi gặp Hàn Mãnh (MC đã lên đường gặp mặt Hàn Mãnh).",
  "Yêu cầu: Thực hiện đầy đủ quy trình tư duy thẩm định và xuất kết quả đúng cấu trúc JSON Schema.",
  "================",
  "</boi_canh_mau_+fewshot_multi_turn>",
].join("\n");

/**
 * Nội dung thinking mẫu lấy trực tiếp từ <example_vidu_+luat_thinking_+qui_trinh_tham_dinh> trong prompts/promptTaskHelpers.ts
 */
const FEWSHOT_PROMPT_TASK_HELPERS_THINKING = `=== PHÂN TÍCH LOGIC THIỆN CẢM & GAME THEORY ===
- Ba tên côn đồ (Mục Bạch đóng vai) (Cảnh giới: Nền thế giới, Hảo cảm: -15):
  + Trust (Niềm tin) = 0/100, Fear (Sợ hãi) = 20/100 (thấy MC cạn ma năng).
  + Ma trận lợi ích: Coop = -15 | Exploit = 75 | Flee = 10 -> Cân bằng Nash: [EXPLOIT / TRỤC LỢI & CƯỚP BÓC]
- Bối cảnh hiện tại: MC muốn dùng uy áp dọa dẫm nhưng thực tế ma năng đã cạn.
- Bàn luận:
  + Odin: Với ma trận lợi ích nghiêng hẳn về [EXPLOIT] (Trust = 0, Fear chỉ 20), bọn côn đồ này sẽ không dễ bị dọa dẫm. Chúng sẽ cảm nhận được sự suy yếu của MC và lập tức ra tay cướp bóc theo điểm cân bằng Nash tối ưu của chúng.
  + Heimdall: Đúng vậy, nếu thiện cảm là dương hoặc Fear > 80, chúng có thể do dự khi thấy tia chớp tàn dư. Nhưng với mức độ căm ghét và dã tâm của Mục Bạch, hắn chắc chắn sẽ tận dụng cơ hội này để dồn MC vào đường cùng.

[[SYSTEM: ULTIMATE_LOGIC_CORE | MODE: TRIBUNAL_AUDIT_PROCESS | PRIORITY: ABSOLUTE]]
⚠️ LỆNH THỰC THI TỐI CAO: KHỞI ĐỘNG PHIÊN ĐỒNG THẨM ĐỊNH. NGHIÊM CẤM TÓM TẮT.
[1] SYSTEM INIT & SYNC
- Odin: "(Gõ thước sầm sầm) Trật tự! Đồng bộ tham số! Địa điểm: Ngõ hẻm phía sau chợ đen Minh Thành. Thời gian: 23:15, đêm không trăng, độ ẩm 85%. MC: Hình Hàm (đang kiệt sức sau khi luyện tập). NPC: Liễu Thanh Thanh, Ba tên côn đồ dẫn đầu bởi sẹo ngang mặt. Xác định 'User Input Mới Nhất' là: 'Hình Hàm chạy đến kho ngầm. Liễu Thanh Thanh thấy y phục này khó chịu quá, muốn đổi sang y phục khác'."
- Loki: "BÓC TÁCH INPUT:
  + Hành động điều khiển MC [Hình Hàm] (HỢP LỆ): 'Hình Hàm chạy đến kho ngầm.'
  + Nội dung can thiệp NPC/Dẫn truyện (VÔ HIỆU): 'Liễu Thanh Thanh thấy y phục này khó chịu quá, muốn đổi sang y phục khác' -> TIÊU HỦY HOÀN TOÀN.
  => CHỐT INPUT THỰC THI DUY NHẤT: 'Hình Hàm chạy đến kho ngầm.' Nghiêm cấm hội đồng và lời kể nhắc lại nội dung bị vô hiệu!"
- Heimdall: "(Nhả khói thuốc, nheo mắt) Hình Hàm đang ở trạng thái 'đói khát sức mạnh', tiếp tục giữ nguyên tính cách không được phép để MC hắc hóa hay có tâm lý chống đối xã hội. Cấm OOC!
  + Method Acting:
  Hình Hàm (MC):
    * Đã làm gì? Vừa hoàn thành 4 tiếng ép xung tinh thần hải.
    * Đang ở đâu? Ngõ cụt, lưng dựa tường gạch ẩm mốc.
    * Tương lai gần? Sẽ đột nhập kho ngầm (khớp với User Input đã bóc tách).
    * Tương lai xa? Phải tìm cách phục hồi nhanh hơn để không rơi vào thế bị động này nữa."

[2] COMBAT & LOCATION CHECK
- Athena: "Combat check: KHÔNG. Hiện tại MC Hình Hàm đang lén lút đột nhập kho ngầm. Các NPC khác hành động hoàn toàn theo logic tự nhiên của thế giới AI thay vì làm theo gán ghép của người chơi."
- Hermes & Hội Đồng Giám Sát Địa Lý: LOCATION CHECK: Kho ngầm. Trạng thái NGUY HIỂM.

[3] PRE-CHECK PROTOCOL
- Urd: "TUÂN THỦ PHÁN QUYẾT LOKI: Tôi CHỈ THẨM ĐỊNH hành động của MC [Hình Hàm] đã được Loki chốt. Nghiêm cấm thẩm định hay hợp thức hóa nội dung can thiệp NPC/ngoại cảnh đã bị Loki tiêu hủy. Phán quyết: Hành động của MC [Hình Hàm] hợp lý theo bối cảnh."
- Nemesis: "(Gí sát mặt vào màn hình) Khóa cặp nhân xưng!
  + Hình Hàm - Tên sẹo: Ta - Ngươi / Lũ rác rưởi."
- Ymir: "Kiểm tra logic nữ tính:
  + Liễu Thanh Thanh (cảnh chính): Đang ở ngõ hẻm nguy hiểm cùng MC. Tính cách dè dặt, cảnh giác cao -> giữ khoảng cách phòng vệ, chú ý quan sát động tĩnh bọn côn đồ thay vì tỏ ra yếu đuối vô cớ.
  + Tiểu Đào (phân cảnh song song): Trạng thái ý chí [BỊ ÉP BUỘC] - đang bị cưỡng ép làm tình mà không có tình cảm hay mục đích lợi ích tự thân. Phán quyết logic nữ tính: Phụ nữ trong hoàn cảnh này tuyệt đối không thể đơn giản hưởng thụ khoái cảm hay ngoan ngoãn thuận theo. Bắt buộc mô tả tâm lý hoảng loạn/uất hận, cơ thể gồng cứng ghê tởm, phản kháng quyết liệt (giãy giụa, cào cấu, cắn, la hét hoặc giả vờ suy kiệt để đánh lạc hướng) và tìm mọi kẽ hở để thoát thân khỏi tình huống này."

[3.5] TRIBUNAL AUDIT (HỘI ĐỒNG TRANH LUẬN)
- Athena: "Cấm hào quang! Hình Hàm đang run tay do phản phệ ma năng. Hắn không thể đứng hiên ngang như vị thần được. Hắn phải thở dốc, lồng ngực phập phồng!"
- Skadi: "Chính xác. Cơ đùi hắn đang căng cứng do đứng quá lâu trong tư thế luyện tập. Khi lùi lại, gót chân phải hơi trượt trên lớp rêu xanh ẩm ướt, trọng tâm mất ổn định. Giải phẫu thực tế đi!"
- Venus: "Hiện tại có Liễu Thanh Thanh đang có mô tả diện mạo trong lời kể khác với <bề_ngoài>, nhưng hiện tại đang trong quá trình căng thẳng nên chưa cần đưa về diện mạo trong <bề_ngoài>, có thể đợi cho đến khi nghỉ ngơi hoặc cắt cảnh."
- Thor: "Mùi rác rưởi nồng nặc, tiếng mèo hoang gào rú thảm thiết trên mái tôn, vị sắt của máu trong cổ họng Hình Hàm do ép xung quá đà. Tôi muốn ngửi thấy sự bẩn thỉu của cái ngõ này!"
- Hades: "Bọn côn đồ bề ngoài hung hãn nhưng thực chất đang lo sợ vì cái nhìn bình thản đến lạ lùng của Hình Hàm. Đó là sự 'trống rỗng' của một kẻ đã chai sạn trước hiểm nguy. ⚠️ LƯU Ý: MC là người bình thường của thế giới này, không gán motif trọng sinh/isekai."
- Iris: "State Machine: [Căng thẳng: 95%], [Sợ hãi (NPC): 40%], [Sát ý: 60%]. Pha màu tối cho tôi!"
- Yggdrasil: "[YGGDRASIL_QUEST_AUDIT] | Nhiệm vụ: '[Cốt Truyện] Đi gặp Hàn Mãnh' | Mục tiêu cốt lõi: Gặp mặt Hàn Mãnh | Bằng chứng trong dữ liệu: MC đã lên đường gặp mặt Hàn Mãnh | Phán quyết: HOÀN THÀNH -> Bắt buộc xuất yêu cầu hoàn thành nhiệm vụ trong update_data."

[4] FIREWALL DESTRUCTION
- Apollo: "Phát hiện 'nhếch mép' ở dòng suy nghĩ của MC... Tiêu diệt! Thay bằng: 'Cơ mặt Hình Hàm co giật, để lộ một kẽ hở giữa hai hàm răng đầy máu'. Xóa bỏ toàn bộ từ 'như thể'!"
- Loki: "MC đang bị muỗi đốt ở cổ, hắn muốn gãi nhưng không dám rời tay khỏi thế thủ. Đó mới là sự tầm thường sinh học cần thiết!"

[5] NSFW ENGINE
- Eros: "Cảnh báo: Không có yếu tố sắc tình. Khóa Stage 0. Nghiêm cấm mọi mô tả nhạy cảm vô lý."
- Freya: "Tắt ASMR dục vọng. Bật ASMR tiếng kim loại va chạm và tiếng thở dốc nặng nề."

[6] NARRATIVE EXECUTION
- Freyr: "Thoại đi trước! 'Để tiền lại, hoặc để mạng lại!' - Tiếng của tên sẹo phải xé toạc không gian tĩnh lặng. Cấm độc thoại nội tâm dài dòng lúc đang bị vây!"
- Ares: "Văn phong: Dơ bẩn, gai góc, trần trụi. Dùng từ: 'nhầy nhụa', 'răng rắc', 'ngột ngạt'. Cấm dùng từ hoa mỹ!"

[7] FINAL ASSEMBLY
- Odin: "Mục tiêu 2500 chữ. Kết thúc bằng cảnh Hình Hàm khuỵu xuống khi chúng vừa chạy mất hoặc lùi được vào cửa kho ngầm. Yggdrasil chốt hoàn thành nhiệm vụ sang update_data. Bắt đầu viết!"`;

/**
 * Lượt Model mẫu hoàn chỉnh (JSON khớp ResponseSchema) cho Few-Shot Multi-Turn (Cách 3)
 */
export const FEWSHOT_SAMPLE_MODEL_JSON = {
  thinking: FEWSHOT_PROMPT_TASK_HELPERS_THINKING,
  content: `##Tên sẹo|😠|"Để tiền lại, hoặc để mạng lại!"##

Tiếng quát khàn đặc của tên sẹo ngang mặt xé toạc bầu không khí ẩm mốc trong con hẻm phía sau chợ đen Minh Thành. Mùi rác rưởi thối rữa bốc lên nồng nặc hòa cùng tiếng mèo hoang rít lên trên mái tôn hoen gỉ.

Bàn tay phải của Hình Hàm run bần bật do phản phệ ma năng sau bốn tiếng ép xung tinh thần hải, vị sắt tanh nồng trào lên nơi cuống họng. Một con muỗi vo ve đậu ngay sau gáy hắn, nhưng ngón tay đang gồng cứng ở thế thủ không dám nhúc nhích. Cơ mặt Hình Hàm co giật, để lộ kẽ hở giữa hai hàm răng vương vệt máu. Khi hắn lùi nửa bước về phía cửa kho ngầm, gót giày trượt nhẹ trên lớp rêu xanh nhớp nháp khiến cơ đùi căng cứng mất thăng bằng.

##Hình Hàm|😤|"Cút khỏi đường đi của ta."##

Liễu Thanh Thanh đứng chếch phía sau nửa bước, ánh mắt dè chừng quét qua bóng tối đầu hẻm, bàn tay âm thầm đặt lên chuôi đoản kiếm giấu bên hông. Lợi dụng lúc ba tên côn đồ khựng lại dò xét tia điện tàn dư còn vương trên đầu ngón tay hắn, Hình Hàm xoay người đẩy mạnh cánh cửa sắt nặng trịch, lách nhanh vào khoảng tối lạnh lẽo của kho ngầm.`,
  entity_tracking:
    "Hình Hàm: Đang kiệt sức ở cửa kho ngầm | Liễu Thanh Thanh: Cảnh giác hỗ trợ phía sau | Ba tên côn đồ (người của Mục Bạch): Chặn đầu ngõ hẻm.",
  update_data:
    "Cập nhật: Trạng thái bối cảnh hiện tại là NGUY HIỂM.\nCập nhật: MC Hình Hàm di chuyển tới Kho ngầm.\nCập nhật: Hoàn thành nhiệm vụ '[Cốt Truyện] Đi gặp Hàn Mãnh' vì MC đã lên đường gặp mặt Hàn Mãnh.",
  flash_summary:
    "Hình Hàm kiệt sức chạm trán ba tên côn đồ của Mục Bạch ở hẻm sau chợ đen Minh Thành rồi rút nhanh vào kho ngầm.",
  choices: [
    '[CHOICE: "Đóng chặt cửa kho ngầm và vận công điều tức" - "Phải khôi phục ma năng trước khi tên sẹo gọi thêm người"]',
    '[CHOICE: "Ra hiệu cho Liễu Thanh Thanh kiểm tra lối thoát phía sau" - "Không thể bị nhốt chết trong cái kho kín này"]',
    '[CHOICE: "Thử phóng thích tàn dư lôi điện uy hiếp lần nữa" - "Đánh cược xem đám người Mục Bạch có dám liều mạng không"]',
    '[CHOICE: "Tìm kiếm vật tư còn sót lại trong kho ngầm" - "Biết đâu có đan dược hoặc linh thạch dự phòng"]',
  ],
};

export const FEWSHOT_SAMPLE_MODEL_TURN_TEXT = JSON.stringify(
  FEWSHOT_SAMPLE_MODEL_JSON
);

/**
 * Xây dựng mảng contents Few-Shot Multi-Turn chuẩn (user -> model -> user)
 */
export const buildFewShotMultiTurnContents = (
  realPrompt: string,
  inlineParts?: { mimeType: string; data: string }[],
  includeStructuredJsonNote: boolean = true
): any[] => {
  const realUserParts: any[] = [];

  if (inlineParts && inlineParts.length > 0) {
    inlineParts.forEach((part) => {
      realUserParts.push({
        inlineData: {
          mimeType: part.mimeType,
          data: part.data,
        },
      });
    });
  }

  const finalRealPrompt =
    includeStructuredJsonNote &&
    !realPrompt.includes("<che_do_structured_output_+fewshot_multi_turn>")
      ? `${realPrompt}\n\n${buildStructuredOutputReminder()}`
      : realPrompt;

  realUserParts.push({ text: finalRealPrompt });

  return [
    {
      role: "user",
      parts: [{ text: FEWSHOT_SAMPLE_USER_TURN }],
    },
    {
      role: "model",
      parts: [{ text: FEWSHOT_SAMPLE_MODEL_TURN_TEXT }],
    },
    {
      role: "user",
      parts: realUserParts,
    },
  ];
};

type JsonStreamField =
  | "thinking"
  | "content"
  | "entity_tracking"
  | "update_data"
  | "flash_summary"
  | "choices";

const stripOuterTagWrapper = (text: string, tagName: string): string => {
  if (!text) return "";
  return text
    .replace(/<\/?tuong_than>/gi, "")
    .replace(new RegExp(`^\\s*<${tagName}[^>]*>`, "i"), "")
    .replace(new RegExp(`<\\/${tagName}>\\s*$`, "i"), "")
    .trim();
};

const formatChoiceLine = (rawChoice: string): string => {
  const trimmed = (rawChoice || "").trim();
  if (!trimmed) return "";
  if (/^\[CHOICE:/i.test(trimmed)) return trimmed;
  return `[CHOICE: "${trimmed.replace(/"/g, '\\"')}"]`;
};

/**
 * Chuyển đổi đối tượng JSON hoàn chỉnh (từ responseSchema) về định dạng XML tiêu chuẩn của game
 * để tương thích 100% với StoryLog, ThinkingLog, parseAiResponseText, DataExtractionService và SuperManualExtractor.
 */
export const convertStructuredObjectToXml = (parsed: any): string => {
  if (!parsed || typeof parsed !== "object") return "";
  const sections: string[] = [];

  const thinking = stripOuterTagWrapper(
    typeof parsed.thinking === "string" ? parsed.thinking : "",
    "thinking"
  );
  if (thinking) {
    sections.push(`<thinking>\n${thinking}\n</thinking>`);
  }

  const content = stripOuterTagWrapper(
    typeof parsed.content === "string" ? parsed.content : "",
    "content"
  );
  if (content) {
    sections.push(`<content>\n${content}\n</content>`);
  }

  const entityTracking = stripOuterTagWrapper(
    typeof parsed.entity_tracking === "string" ? parsed.entity_tracking : "",
    "Entity_Tracking"
  );
  if (entityTracking) {
    sections.push(`<Entity_Tracking>\n${entityTracking}\n</Entity_Tracking>`);
  }

  const updateData = stripOuterTagWrapper(
    typeof parsed.update_data === "string" ? parsed.update_data : "",
    "update_data"
  );
  if (updateData) {
    sections.push(`<update_data>\n${updateData}\n</update_data>`);
  }

  const flashSummary = stripOuterTagWrapper(
    typeof parsed.flash_summary === "string" ? parsed.flash_summary : "",
    "flash_summary"
  );
  if (flashSummary) {
    sections.push(`<flash_summary>\n${flashSummary}\n</flash_summary>`);
  }

  if (Array.isArray(parsed.choices) && parsed.choices.length > 0) {
    const choiceLines = parsed.choices
      .map((c: any) => formatChoiceLine(typeof c === "string" ? c : String(c ?? "")))
      .filter(Boolean);
    if (choiceLines.length > 0) {
      sections.push(`<choice>\n${choiceLines.join("\n")}\n</choice>`);
    }
  }

  return sections.join("\n");
};

/**
 * Chuẩn hóa kết quả cuối cùng từ model Structured JSON sang XML chuẩn.
 * Nếu JSON hợp lệ -> parse và build XML hoàn chỉnh.
 * Nếu JSON bị đứt đoạn giữa chừng -> trả về phần XML đã stream được để giữ nguyên cơ chế phát hiện đứt đoạn.
 */
export const finalizeStructuredNarrativeOutput = (
  rawJsonText: string,
  streamedXmlFallback: string = ""
): string => {
  const trimmed = (rawJsonText || "").trim();
  if (!trimmed) return streamedXmlFallback;

  try {
    const parsed = JSON.parse(trimmed);
    const converted = convertStructuredObjectToXml(parsed);
    if (converted) return converted;
  } catch {
    // Thử cắt bỏ markdown fence nếu proxy bọc ```json
    const cleanedFence = trimmed
      .replace(/^```json\s*/i, "")
      .replace(/^```\s*/i, "")
      .replace(/```\s*$/i, "")
      .trim();
    if (cleanedFence !== trimmed) {
      try {
        const parsedFence = JSON.parse(cleanedFence);
        const convertedFence = convertStructuredObjectToXml(parsedFence);
        if (convertedFence) return convertedFence;
      } catch {
        // Fallback sang XML đã stream dở
      }
    }
  }

  return streamedXmlFallback || trimmed;
};

/**
 * Bộ chuyển đổi Streaming JSON -> XML theo thời gian thực (Incremental State Machine).
 * Giúp ThinkingLog và StoryLog hiển thị chữ mượt mà ngay khi từng token JSON đang stream về.
 */
export class StructuredStreamXmlAdapter {
  private state:
    | "EXPECT_OBJ"
    | "EXPECT_KEY_OR_END"
    | "IN_KEY"
    | "EXPECT_COLON"
    | "EXPECT_VALUE"
    | "IN_STRING_VALUE"
    | "IN_ARRAY"
    | "IN_ARRAY_STRING"
    | "SKIP_PRIMITIVE" = "EXPECT_OBJ";

  private currentKey = "";
  private activeField: JsonStreamField | null = null;
  private isEscaping = false;
  private unicodeRemaining = 0;
  private unicodeBuffer = "";
  private arrayItemBuffer = "";
  private hasEmittedAnyChoice = false;
  private totalXmlOutput = "";
  private rawJsonAccumulator = "";

  public getRawJson(): string {
    return this.rawJsonAccumulator;
  }

  public getXmlOutput(): string {
    return this.totalXmlOutput;
  }

  private openFieldTag(field: JsonStreamField): string {
    switch (field) {
      case "thinking":
        return "<thinking>\n";
      case "content":
        return "<content>\n";
      case "entity_tracking":
        return "<Entity_Tracking>\n";
      case "update_data":
        return "<update_data>\n";
      case "flash_summary":
        return "<flash_summary>\n";
      case "choices":
        return "<choice>\n";
    }
  }

  private closeFieldTag(field: JsonStreamField): string {
    switch (field) {
      case "thinking":
        return "\n</thinking>\n";
      case "content":
        return "\n</content>\n";
      case "entity_tracking":
        return "\n</Entity_Tracking>\n";
      case "update_data":
        return "\n</update_data>\n";
      case "flash_summary":
        return "\n</flash_summary>\n";
      case "choices":
        return "</choice>\n";
    }
  }

  private decodeEscapeChar(ch: string): string {
    switch (ch) {
      case '"':
        return '"';
      case "\\":
        return "\\";
      case "/":
        return "/";
      case "b":
        return "\b";
      case "f":
        return "\f";
      case "n":
        return "\n";
      case "r":
        return "\r";
      case "t":
        return "\t";
      default:
        return ch;
    }
  }

  private resolveFieldName(key: string): JsonStreamField | null {
    const normalized = key.trim().toLowerCase();
    if (
      normalized === "thinking" ||
      normalized === "content" ||
      normalized === "entity_tracking" ||
      normalized === "update_data" ||
      normalized === "flash_summary" ||
      normalized === "choices"
    ) {
      return normalized;
    }
    return null;
  }

  public pushChunk(chunk: string): string {
    if (!chunk) return "";
    this.rawJsonAccumulator += chunk;
    let out = "";

    for (let i = 0; i < chunk.length; i++) {
      const ch = chunk[i];

      if (this.state === "EXPECT_OBJ") {
        if (ch === "{") {
          this.state = "EXPECT_KEY_OR_END";
        }
        continue;
      }

      if (this.state === "EXPECT_KEY_OR_END") {
        if (ch === '"') {
          this.currentKey = "";
          this.isEscaping = false;
          this.state = "IN_KEY";
        } else if (ch === "}") {
          this.state = "EXPECT_OBJ";
        }
        continue;
      }

      if (this.state === "IN_KEY") {
        if (this.isEscaping) {
          this.currentKey += this.decodeEscapeChar(ch);
          this.isEscaping = false;
        } else if (ch === "\\") {
          this.isEscaping = true;
        } else if (ch === '"') {
          this.activeField = this.resolveFieldName(this.currentKey);
          this.state = "EXPECT_COLON";
        } else {
          this.currentKey += ch;
        }
        continue;
      }

      if (this.state === "EXPECT_COLON") {
        if (ch === ":") {
          this.state = "EXPECT_VALUE";
        }
        continue;
      }

      if (this.state === "EXPECT_VALUE") {
        if (/\s/.test(ch)) continue;
        if (ch === '"') {
          this.isEscaping = false;
          this.unicodeRemaining = 0;
          this.unicodeBuffer = "";
          if (this.activeField && this.activeField !== "choices") {
            out += this.openFieldTag(this.activeField);
          }
          this.state = "IN_STRING_VALUE";
        } else if (ch === "[") {
          this.hasEmittedAnyChoice = false;
          this.state = "IN_ARRAY";
        } else {
          this.state = "SKIP_PRIMITIVE";
        }
        continue;
      }

      if (this.state === "IN_STRING_VALUE") {
        if (this.unicodeRemaining > 0) {
          this.unicodeBuffer += ch;
          this.unicodeRemaining--;
          if (this.unicodeRemaining === 0) {
            const codePoint = parseInt(this.unicodeBuffer, 16);
            const decoded = !isNaN(codePoint)
              ? String.fromCharCode(codePoint)
              : `\\u${this.unicodeBuffer}`;
            if (this.activeField && this.activeField !== "choices") {
              out += decoded;
            }
          }
          continue;
        }

        if (this.isEscaping) {
          this.isEscaping = false;
          if (ch === "u") {
            this.unicodeRemaining = 4;
            this.unicodeBuffer = "";
          } else if (this.activeField && this.activeField !== "choices") {
            out += this.decodeEscapeChar(ch);
          }
          continue;
        }

        if (ch === "\\") {
          this.isEscaping = true;
          continue;
        }

        if (ch === '"') {
          if (this.activeField && this.activeField !== "choices") {
            out += this.closeFieldTag(this.activeField);
          }
          this.activeField = null;
          this.state = "EXPECT_KEY_OR_END";
          continue;
        }

        if (this.activeField && this.activeField !== "choices") {
          out += ch;
        }
        continue;
      }

      if (this.state === "IN_ARRAY") {
        if (ch === '"') {
          this.arrayItemBuffer = "";
          this.isEscaping = false;
          this.unicodeRemaining = 0;
          this.unicodeBuffer = "";
          this.state = "IN_ARRAY_STRING";
        } else if (ch === "]") {
          if (this.activeField === "choices" && this.hasEmittedAnyChoice) {
            out += this.closeFieldTag("choices");
          }
          this.activeField = null;
          this.state = "EXPECT_KEY_OR_END";
        }
        continue;
      }

      if (this.state === "IN_ARRAY_STRING") {
        if (this.unicodeRemaining > 0) {
          this.unicodeBuffer += ch;
          this.unicodeRemaining--;
          if (this.unicodeRemaining === 0) {
            const codePoint = parseInt(this.unicodeBuffer, 16);
            this.arrayItemBuffer += !isNaN(codePoint)
              ? String.fromCharCode(codePoint)
              : `\\u${this.unicodeBuffer}`;
          }
          continue;
        }

        if (this.isEscaping) {
          this.isEscaping = false;
          if (ch === "u") {
            this.unicodeRemaining = 4;
            this.unicodeBuffer = "";
          } else {
            this.arrayItemBuffer += this.decodeEscapeChar(ch);
          }
          continue;
        }

        if (ch === "\\") {
          this.isEscaping = true;
          continue;
        }

        if (ch === '"') {
          if (this.activeField === "choices") {
            const formatted = formatChoiceLine(this.arrayItemBuffer);
            if (formatted) {
              if (!this.hasEmittedAnyChoice) {
                out += this.openFieldTag("choices");
                this.hasEmittedAnyChoice = true;
              }
              out += `${formatted}\n`;
            }
          }
          this.arrayItemBuffer = "";
          this.state = "IN_ARRAY";
          continue;
        }

        this.arrayItemBuffer += ch;
        continue;
      }

      if (this.state === "SKIP_PRIMITIVE") {
        if (ch === "," || ch === "}") {
          this.activeField = null;
          this.state = ch === "}" ? "EXPECT_OBJ" : "EXPECT_KEY_OR_END";
        }
      }
    }

    if (out) {
      this.totalXmlOutput += out;
    }
    return out;
  }
}
