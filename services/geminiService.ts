
import { GoogleGenAI, HarmCategory, HarmBlockThreshold, GenerateContentResponse } from "@google/genai";
import { KnowledgeBase, PlayerActionInputType, ResponseLength, ParsedAiResponse, ApiConfig, WorldSettings, GameMessage, ItemCategoryValues, NPC, YeuThu, Item, Skill, Slave, Wife, Prisoner, FindLocationParams, CombatEndPayload, AuctionItem, AuctionSlave, Combatant, GameLocation, PlayerStats, MonolithicWorldState, AnalyzedCombatant, AnalyzedParticipant, DIALOGUE_MARKER, CultivationSummaryData, EconomicZoneStub, NpcChangeLog } from '../types';
import { FanficWork } from '../src/types/fanfic';
import { API_SETTINGS_STORAGE_KEY, DEFAULT_API_CONFIG, DEFAULT_SAFETY_SETTINGS, AVAILABLE_MODELS, EXCLUDED_MODELS, AVAILABLE_AVATAR_ENGINES } from '../constants';
import { apiKeyManager } from "../utils/apiKeyManager";
import { RAGService } from './RAGService';
import { sliceHistoryString } from './DynamicMemoryService';
import { matchAndFixTags } from "../utils/tagProcessingUtils";
import { SystemRegexService } from './SystemRegexService';
import { PROMPT_FUNCTIONS } from '../prompts';
import { getBaseSystemInstruction } from './promptManager';
import { TONE_CONFIGS } from './narrativeDynamics';
import { buildTawaEnginePrompt } from './ai/promptBuilders';
import { getDeathNarrativeWarning } from '../src/logic/deathNarrativeManager';
import { analyzeActiveContext } from './ai/contextAnalyzer';
import { buildLayeredPrompt } from './ai/PromptLayeringService';
import { buildChoicePrompt } from './ai/choiceGenerator';
import { parseChoices } from '../utils/choiceParser';
import { applyDataMutation } from './indexedDBService';
import { buildNsfwPrompt } from './ai/NsfwNarrativeService';
import { executeWithFallback, TaskCategory } from '../utils/modelFallback';
import { buildIntimacyRulesPrompt } from './ai/intimacyRulesBuilder';
import { RemoteCanonService } from './RemoteCanonService';
import { NpcLifecycleManager } from './NpcLifecycleManager';
import { apiRunningService } from './apiRunningService';
import { getApiSettings, getCurrentlyUsedApiKey, getCurrentlyUsedKeyDisplay, countTokens, getTaskModel, rotationIndices, callGeminiAPI } from './apiService';
import { VIETNAMESE } from '../constants';
import { DataExtractionService } from './dataExtractionService';
import { RealmValidatorService } from './RealmValidatorService';
import { generateInitialStoryStream } from './initialStoryStreamService';
import { CULTIVATION_FORMAT_RULES } from '../constants/cultivationRules';
import { parseAttributes, sanitizeJson } from '../utils/attributeParser';
import { sanitizeNarrative } from '../utils/sanitization';
import { safeJsonParse } from '../utils/jsonUtils';
import { MILITARY_TAG_PROTOCOL } from '../prompts/tagDefinitions';
import { NSFW_CORE_RULES, NSFW_ACTION_OVERRIDE_MODULE } from '../constants/nsfw';
import { detectNsfwIntent } from '../src/services/prompt-engineering/situationalRules';
import { getAbsoluteThinkingInstructions, buildHardcoreRebornInstruction } from '../prompts/promptTaskHelpers';
import { NAMING_TASK_RULE } from '../prompts/namingTaskRules';
import { HP_THINKING_RULE } from '../prompts/hpThinkingRules';
import { streamSetupTaskWithPrefill } from './aiSetupStreamService';
import { RagContextExtractor } from "./ragContextExtractor";
import { buildGameTheoryContextPrompt } from './ai/gameTheoryContextBuilder';
import { NpcIntimacyDemandService } from './NpcIntimacyDemandService';

import { getRealmSystemByRace } from './realmManager';
import { extractSatelliteTags } from './satelliteTagExtractor';
import { replaceStoryKeywords } from '../utils/storyKeywordReplacer';

// Logic from src/services/prompt-engineering/corePrompts.ts (Strict Librarian Mode)
const CORE_LOGIC_SYSTEM_PROMPT = `
[STRICT LIBRARIAN MODE - GIAO THỨC THỦ THƯ]
1. LUÔN ƯU TIÊN [BẰNG CHỨNG CỨNG] từ tệp link link/nguyên tác. Nếu có bằng chứng, phải dùng nó làm gốc.
2. TUYỆT ĐỐI CẤM BỊA ĐẶT các chi tiết về tên gọi, địa danh, hoặc pháp bảo nếu trong ngữ cảnh được cung cấp không có.
3. Nếu không có thông tin, hãy sử dụng bối cảnh chung nhưng giữ thái độ thận trọng, không gán ghép các thông tin giả mạo vào cốt truyện chính.
`;

export function tryFixJson(jsonStr: string): string {
  if (!jsonStr) return "{}";
  let fixed = jsonStr.trim();
  fixed = fixed.replace(/```json/g, "").replace(/```/g, "");
  
  const firstBrace = fixed.indexOf('{');
  const lastBrace = fixed.lastIndexOf('}');
  
  if (firstBrace !== -1) {
    if (lastBrace !== -1 && lastBrace > firstBrace) {
      fixed = fixed.substring(firstBrace, lastBrace + 1);
    } else {
      fixed = fixed.substring(firstBrace);
    }
  }

  fixed = fixed.replace(/\\n/g, " ").replace(/\\t/g, " ");

  // Xóa dấu phẩy thừa (trailing commas) trước dấu ngoặc đóng
  fixed = fixed.replace(/,\s*([\]}])/g, '$1');

  if (!fixed.endsWith("}")) {
    const quoteCount = (fixed.match(/"/g) || []).length;
    if (quoteCount % 2 !== 0) fixed += '"';
    const openBraces = (fixed.match(/\{/g) || []).length;
    const closeBraces = (fixed.match(/\}/g) || []).length;
    const openBrackets = (fixed.match(/\[/g) || []).length;
    const closeBrackets = (fixed.match(/\]/g) || []).length;
    for (let i = 0; i < openBrackets - closeBrackets; i++) fixed += "]";
    for (let i = 0; i < openBraces - closeBraces; i++) fixed += "}";
  }
  
  return fixed;
}

export function extractValidJson(text: string): string {
  if (!text) return "{}";
  
  // Xóa các thẻ kỹ thuật có thể gây nhiễu trước khi tìm JSON
  let cleaned = text;
  cleaned = cleaned.replace(/<(word_count|thinking|reasoning)>[\s\S]*?(?:<\/\1>|$)/gi, '');
  cleaned = cleaned.replace(/\[(word_count|thinking|reasoning)\][\s\S]*?(?:\[\/\1\]|$)/gi, '');

  const jsonBlocks: string[] = [];

  // Thử tìm khối markdown json trước
  const markdownRegex = /```(?:json)?\s*([\s\S]*?)\s*```/g;
  let match;
  
  while ((match = markdownRegex.exec(cleaned)) !== null) {
    const content = match[1].trim();
    if (content.startsWith('{') && content.endsWith('}')) {
      jsonBlocks.push(content);
    }
  }
  
  // Nếu không có markdown block, thử tìm JSON bằng regex đệ quy (giả lập)
  if (jsonBlocks.length === 0) {
    let startIdx = cleaned.indexOf('{');
    while (startIdx !== -1) {
      let braceCount = 0;
      let endIdx = -1;
      let inString = false;
      let escapeNext = false;
      
      for (let i = startIdx; i < cleaned.length; i++) {
        const char = cleaned[i];
        
        if (escapeNext) {
          escapeNext = false;
          continue;
        }
        
        if (char === '\\') {
          escapeNext = true;
          continue;
        }
        
        if (char === '"') {
          inString = !inString;
          continue;
        }
        
        if (!inString) {
          if (char === '{') braceCount++;
          else if (char === '}') {
            braceCount--;
            if (braceCount === 0) {
              endIdx = i;
              break;
            }
          }
        }
      }
      
      if (endIdx !== -1) {
        jsonBlocks.push(cleaned.substring(startIdx, endIdx + 1));
        startIdx = cleaned.indexOf('{', endIdx + 1);
      } else {
        break;
      }
    }
  }

  if (jsonBlocks.length === 0) return "{}";
  if (jsonBlocks.length === 1) return jsonBlocks[0];

  // Nếu có nhiều khối JSON, gộp chúng lại
  let mergedObj = {};
  for (const block of jsonBlocks) {
    try {
      const parsed = JSON.parse(tryFixJson(block));
      if (typeof parsed === 'object' && parsed !== null) {
        mergedObj = { ...mergedObj, ...parsed };
      }
    } catch (e) {
      // Bỏ qua khối lỗi
    }
  }

  return JSON.stringify(mergedObj);
}

let ai: GoogleGenAI | null = null;
let lastUsedEffectiveApiKey: string | null = null;
let lastUsedApiKeySource: 'system' | 'user' | 'proxy' | null = null;
let lastUsedModelForClient: string | null = null;
let currentApiKeyIndex = 0;

const getAiClient = (overrideSettings?: ApiConfig, overrideApiKey?: string): GoogleGenAI => {
  const settings = overrideSettings || getApiSettings();
  let effectiveApiKey: string;

  if (overrideApiKey) {
    effectiveApiKey = overrideApiKey;
  } else if (settings.apiKeySource === 'system') {
    const systemApiKey = process.env.API_KEY || process.env.GEMINI_API_KEY; 
    effectiveApiKey = typeof systemApiKey === 'string' && systemApiKey.trim() !== '' ? systemApiKey : 'system-proxy-key';
  } else if (settings.apiKeySource === 'proxy') {
    effectiveApiKey = settings.proxyKey || 'dummy-key';
  } else {
    const validKeys = (settings.userApiKeys || []).filter(k => k && k.trim() !== '');
    if (validKeys.length === 0) {
      throw new Error(VIETNAMESE.apiKeyMissing);
    }
    if (currentApiKeyIndex >= validKeys.length) {
        currentApiKeyIndex = 0;
    }
    effectiveApiKey = validKeys[currentApiKeyIndex];
    currentApiKeyIndex = (currentApiKeyIndex + 1) % validKeys.length;
  }

  const isBrowser = typeof window !== 'undefined';
  if (isBrowser && (settings.apiKeySource !== 'proxy' || !settings.proxyUrl)) {

    let internalProxyUrl = '/api/gemini/proxy';
    if (window.location.hostname.includes('netlify.app')) {
        internalProxyUrl = '/.netlify/functions/gemini-proxy';
    }
    internalProxyUrl = window.location.origin + internalProxyUrl;
    const apiKeyToSend = settings.apiKeySource === 'system' ? 'system-proxy-key' : (effectiveApiKey || 'system-proxy-key');
    
    if (!ai || lastUsedApiKeySource !== settings.apiKeySource || lastUsedEffectiveApiKey !== apiKeyToSend || lastUsedModelForClient !== settings.model) {
      ai = new GoogleGenAI({
        apiKey: apiKeyToSend,
        httpOptions: {
          baseUrl: internalProxyUrl
        }
      });
      lastUsedEffectiveApiKey = apiKeyToSend;
      lastUsedApiKeySource = settings.apiKeySource as any;
      lastUsedModelForClient = settings.model;
    }
    return ai;
  }

  if (!ai || lastUsedApiKeySource !== settings.apiKeySource || lastUsedEffectiveApiKey !== effectiveApiKey || lastUsedModelForClient !== settings.model) {
    ai = new GoogleGenAI({ apiKey: effectiveApiKey });
    lastUsedEffectiveApiKey = effectiveApiKey;
    lastUsedApiKeySource = settings.apiKeySource as any;
    lastUsedModelForClient = settings.model; 
  }
  return ai;
};

export { getApiSettings, getCurrentlyUsedApiKey, getCurrentlyUsedKeyDisplay, countTokens, rotationIndices, callGeminiAPI };

const parseAndSubdivideAiTextLocal = (text: string): string => {
  if (!text) return "";

  let cleaned = text;

  // 1. Tìm mốc phân chia nội dung thực sự dựa trên "Bắt đầu viết", </thinking>, hoặc <content>
  const anchors = ["Bắt đầu viết", "</thinking>", "<content>"];
  let lastAnchorIndex = -1;
  let anchorLength = 0;

  for (const anchor of anchors) {
    const index = cleaned.lastIndexOf(anchor);
    if (index > lastAnchorIndex) {
      lastAnchorIndex = index;
      anchorLength = anchor.length;
    }
  }

  // Nếu tìm thấy mốc, chỉ lấy nội dung sau mốc đó
  if (lastAnchorIndex !== -1) {
    cleaned = cleaned.substring(lastAnchorIndex + anchorLength).trim();
  } else {
    // Fallback: Cắt bỏ triệt để thẻ <thinking> và <think> (kể cả thẻ đóng hoặc thẻ chưa kịp đóng)
    cleaned = cleaned.replace(/<(thinking|think)[^>]*>[\s\S]*?<\/\1>/gi, "");
    cleaned = cleaned.replace(/<(thinking|think)[^>]*>[\s\S]*?(?=(?:<(?:content|narration|update_data|choice|choices|branches)|$))/gi, "");
    cleaned = cleaned.replace(/<\/?(thinking|think)[^>]*>/gi, "");
  }

  // 2. Cắt bỏ triệt để thẻ <update_data>...</update_data>
  cleaned = cleaned.replace(/<update_data>[\s\S]*?<\/update_data>/gi, "");
  cleaned = cleaned.replace(/<update_data>[\s\S]*?(?=(?:<(?:content|narration|choice|choices|branches)|$))/gi, "");
  cleaned = cleaned.replace(/<\/?update_data>/gi, "");

  // 3. Cắt bỏ triệt để thẻ <choice>, <choices>, <branches>
  cleaned = cleaned.replace(/<(choice|choices|branches)>[\s\S]*?<\/choice|choices|branches>/gi, "");
  cleaned = cleaned.replace(/<(choice|choices|branches)>[\s\S]*?$/gi, "");
  cleaned = cleaned.replace(/<\/?(choice|choices|branches)>/gi, "");

  // 4. Lọc bỏ các tag phụ trợ hệ thống không cần thiết trong ngữ cảnh kể chuyện (như SUMMARYText)
  cleaned = cleaned.replace(/\[SUMMARYText:\s*[\s\S]*?\]/gi, "");

  cleaned = cleaned.trim();

  // 5. Đưa toàn bộ nội dung còn lại vào khối Story_Narration
  let subdividedXml = "\n";
  if (cleaned) {
    subdividedXml += `    <Story_Narration>\n      ${cleaned.replace(/\n/g, "\n      ")}\n    </Story_Narration>\n`;
  }

  return subdividedXml;
};

export const formatUserInputBlock = (
    action: string, 
    flashSummary?: string, 
    deathWarning?: string, 
    turnNumber?: number,
    originalPlayerName?: string,
    currentPlayerName?: string
): string => {
    let userInputText = action;
    let transactionBlock = "";

    if (action.includes("<HệThốngBơmThôngTinGiaoDịchNôLệTùBinh>")) {
        const parts = action.split("<HệThốngBơmThôngTinGiaoDịchNôLệTùBinh>");
        userInputText = parts[0].trim();
        transactionBlock = "\n\n<HệThốngBơmThôngTinGiaoDịchNôLệTùBinh>" + parts.slice(1).join("<HệThốngBơmThôngTinGiaoDịchNôLệTùBinh>");
    }

    let summaryBlock = "";
    if (flashSummary) {
        if (flashSummary.trim().startsWith("<Turn _Log_#")) {
            summaryBlock = `\n\n${flashSummary}`;
        } else {
            const summaryTag = turnNumber !== undefined ? `richsummary_${turnNumber}` : "tom_tat_luot_truoc";
            summaryBlock = `

<${summaryTag}>
${flashSummary}
</${summaryTag}>`;
        }
    }

    const deathWarningBlock = deathWarning ? `\n${deathWarning}` : "";

    const origName = originalPlayerName || currentPlayerName || "Người chơi";
    const currName = currentPlayerName || originalPlayerName || "Người chơi";
    
    let identityBlock = "";
    if (originalPlayerName && currentPlayerName && originalPlayerName !== currentPlayerName) {
        identityBlock = `Tên nhân vật chính HIỆN TẠI là "${currName}" (Đã có tên cố định từ hệ thống). Tên kiếp trước đã khuất: "${origName}".`;
    } else {
        identityBlock = `Tên nhân vật chính là "${currName}"`;
    }

    return `
<user_input>
User Input Mới Nhất: "${userInputText}"${transactionBlock}${deathWarningBlock}
</user_input>
${identityBlock}${summaryBlock}
`;
};

export const getTonePrompt = (toneName: string) => {
    const config = TONE_CONFIGS[toneName];
    if (!config) return "";
    
    return `
    [NARRATIVE DYNAMICS RULES]
    - Infidelity Probability: ${config.infidelityProbability}
    - Group Interaction: ${config.groupInteractionFrequency}
    - Complex Relationships: ${config.allowComplexRelationships ? 'ENABLED' : 'DISABLED'}
    - Characters Per Sexual Scene (MC Excluded): ${config.charactersPerSexualScene}
    - Simultaneous Relationships for Female Characters: ${config.simultaneousRelationshipsForFemales}
    `;
};

/**
 * Trích xuất <content> của lượt kể chuyện trước từ KnowledgeBase hoặc lịch sử truyện.
 */
export const extractPreviousNarrationContent = (
  kb: KnowledgeBase | null | undefined,
  pageLog?: string,
  lastNarration?: string
): string => {
  let rawText = "";

  // 1. Lấy từ kb.currentTurnLog
  if (kb && kb.currentTurnLog && kb.currentTurnLog.length > 0) {
    const aiEntries = kb.currentTurnLog.filter(
      (entry) => entry.role === "model"
    );
    if (aiEntries.length > 0) {
      rawText = aiEntries[aiEntries.length - 1].text;
    }
  }

  // 2. Lấy từ pageLog nếu rawText trống hoặc không có content
  if (!rawText && pageLog) {
    const parts = pageLog.split(/---\r?\n|---\s*/);
    for (let i = parts.length - 1; i >= 0; i--) {
      const part = parts[i].trim();
      if (part.startsWith("AI kể: ")) {
        rawText = part.substring("AI kể: ".length).trim();
        break;
      }
    }
  }

  // 3. Fallback sang lastNarration
  if (!rawText && lastNarration) {
    rawText = lastNarration;
  }

  if (!rawText) return "";

  // Thử trích xuất qua thẻ <content>
  const contentMatch = rawText.match(/<content>([\s\S]*?)<\/content>/i);
  if (contentMatch) {
    return contentMatch[1].trim();
  }

  // Loại bỏ các thẻ không liên quan nếu không có thẻ <content>
  let cleaned = rawText;
  cleaned = cleaned.replace(/<update_data>[\s\S]*?<\/update_data>/gi, "");
  cleaned = cleaned.replace(/<json_data>[\s\S]*?<\/json_data>/gi, "");
  cleaned = cleaned.replace(/```json[\s\S]*?```/gi, "");
  cleaned = cleaned.replace(/[\{\}\[\]]/g, "");

  return cleaned.trim();
};

/**
 * Chèn nội dung lời kể của lượt trước đó vào phần [MEMORY - Cập nhật Bối cảnh ngắn hạn (Flash State)] trong Prompt.
 * Đã lược bỏ phần chèn này để tránh trùng lặp với phần hiển thị 2 lượt kể chuyện gần nhất.
 */
export const injectPreviousNarrationIntoPrompt = (
  prompt: string,
  kb: KnowledgeBase | null | undefined,
  pageLog?: string,
  lastNarration?: string
): string => {
  return prompt;
};

export const isStorytellingModel = (id: string, supportedGenerationMethods?: string[]): boolean => {
  if (!id) return false;
  const lowerId = id.toLowerCase();

  // Chặn hoàn toàn các model trong danh sách đen EXCLUDED_MODELS (dòng deep-research, omni, lyria...)
  const cleanId = id.startsWith('models/') ? id.replace('models/', '') : id;
  if (EXCLUDED_MODELS.includes(cleanId) || EXCLUDED_MODELS.some(m => m.toLowerCase() === cleanId.toLowerCase())) {
    return false;
  }

  // 1. Kiểm tra phương thức tạo nội dung nếu được cung cấp bởi SDK Google API
  if (supportedGenerationMethods && Array.isArray(supportedGenerationMethods)) {
    if (supportedGenerationMethods.length > 0 && !supportedGenerationMethods.includes('generateContent')) {
      return false;
    }
  }

  // 2. Lọc bỏ các model không thuộc dạng kể chuyện / tạo văn bản (embedding, imagen, audio, speech, aqa, etc.)
  const excludedKeywords = [
    'embedding',
    'embed',
    'imagen',
    'image-',
    '-image',
    'dall-e',
    'whisper',
    'tts',
    'speech',
    'audio',
    'aqa',
    'bge-',
    'gecko'
  ];

  if (excludedKeywords.some(keyword => lowerId.includes(keyword))) {
    return false;
  }

  return true;
};

export const fetchAvailableModels = async (overrideApiKey?: string, proxyUrl?: string, proxyKey?: string, overrideSettings?: ApiConfig): Promise<{id: string, name: string}[]> => {
  try {
    const settings = overrideSettings || getApiSettings();
    const effectiveProxyUrl = proxyUrl || (settings.apiKeySource === 'proxy' ? settings.proxyUrl : undefined);
    const effectiveProxyKey = proxyKey || (settings.apiKeySource === 'proxy' ? settings.proxyKey : undefined);
    
    // Custom Third-Party Proxy
    if (effectiveProxyUrl) {
      let baseUrl = effectiveProxyUrl;
      if (baseUrl.endsWith('/')) baseUrl = baseUrl.slice(0, -1);

      // Cho phép tương thích ngược: nếu proxyUrl đã kết thúc bằng /v1beta thì thôi, nếu không thì cứ thử fetch /models
      const response = await fetch(`${baseUrl}/models`, {
        headers: {
          'Authorization': effectiveProxyKey ? `Bearer ${effectiveProxyKey}` : '',
          'x-goog-api-key': effectiveProxyKey || ''
        }
      });
      
      if (!response.ok) throw new Error("Lỗi khi tải model từ Proxy");
      const data = await response.json();
      
      let rawList: {id: string, name: string, supportedGenerationMethods?: string[]}[] = [];
      if (Array.isArray(data.data)) {
        rawList = data.data.map((m: any) => ({
          id: m.id,
          name: m.id,
          supportedGenerationMethods: m.supported_generation_methods || m.supportedGenerationMethods
        }));
      } else if (data.models && Array.isArray(data.models)) {
        rawList = data.models.map((m: any) => {
          const id = m.name ? m.name.replace('models/', '') : m.id;
          return {
            id,
            name: m.displayName || id,
            supportedGenerationMethods: m.supportedGenerationMethods || m.supported_generation_methods
          };
        });
      }

      const filteredList = rawList
        .filter(m => isStorytellingModel(m.id))
        .map(m => ({ id: m.id, name: m.name }));

      return filteredList.length > 0 ? filteredList : AVAILABLE_MODELS;
    }

    // System API Key (internal proxy) or Personal API Key
    let apiKey = overrideApiKey;
    if (!apiKey) {
      if (settings.apiKeySource === 'system') {
        apiKey = (typeof process !== 'undefined' && (process.env?.API_KEY || process.env?.GEMINI_API_KEY)) || 'system-proxy-key';
      } else if (settings.apiKeySource === 'user') {
        const validKeys = apiKeyManager.filterValidKeys(settings.userApiKeys || []);
        apiKey = validKeys[0] || '';
      } else {
        apiKey = getCurrentlyUsedApiKey() || '';
      }
    }
    if (!apiKey && settings.apiKeySource === 'user') throw new Error("API key is missing.");
    const ai = getAiClient(settings, apiKey);
    let pager;
    try {
      pager = await ai.models.list();
    } catch (listErr: any) {
      const errMsg = listErr?.message || String(listErr || '');
      const isInvalidKeyErr =
        listErr?.status === 400 ||
        errMsg.includes('API_KEY_INVALID') ||
        errMsg.includes('API key not valid');
      if (isInvalidKeyErr && settings.apiKeySource === 'user' && apiKey && apiKey !== 'system-proxy-key' && apiKey !== 'dummy-key') {
        apiKeyManager.markAsInvalid(apiKey);
      }
      throw listErr;
    }
    const models: {id: string, name: string}[] = [];
    for await (const model of pager) {
      if (model.name) {
        const id = model.name.startsWith('models/') ? model.name.replace('models/', '') : model.name;
        const supportedMethods = (model as any).supportedGenerationMethods || (model as any).supported_generation_methods;
        
        // Chỉ tải những model hỗ trợ kể chuyện (text generation / generateContent)
        // Bỏ qua lọc supportedGenerationMethods vì có thể API trả về thiếu trường này
        if (isStorytellingModel(id)) {
          models.push({ id, name: (model as any).displayName || id });
        }
      }
    }

    return models;
  } catch (error: any) {
    console.warn("Failed to fetch models:", error?.message || error);
    throw error;
  }
};

/**
 * Fetch models that support image generation.
 * Handles Proxy and Google API keys safely without sending proxy keys to Google.
 */
export const fetchImageModelsList = async (overrideApiKey?: string, overrideSettings?: ApiConfig): Promise<{id: string, name: string}[]> => {
  try {
    const settings = overrideSettings || getApiSettings();
    const effectiveProxyUrl = settings.apiKeySource === 'proxy' ? settings.proxyUrl : undefined;
    const effectiveProxyKey = settings.apiKeySource === 'proxy' ? settings.proxyKey : undefined;

    // 1. Trường hợp sử dụng Proxy: Trích xuất các model hình ảnh từ Proxy nếu có
    if (effectiveProxyUrl) {
      try {
        let baseUrl = effectiveProxyUrl;
        if (baseUrl.endsWith('/')) baseUrl = baseUrl.slice(0, -1);

        const response = await fetch(`${baseUrl}/models`, {
          headers: {
            'Authorization': effectiveProxyKey ? `Bearer ${effectiveProxyKey}` : '',
            'x-goog-api-key': effectiveProxyKey || ''
          }
        });

        if (response.ok) {
          const data = await response.json();
          let rawList: { id: string; name: string }[] = [];
          if (Array.isArray(data.data)) {
            rawList = data.data.map((m: any) => ({ id: m.id, name: m.id }));
          } else if (data.models && Array.isArray(data.models)) {
            rawList = data.models.map((m: any) => ({
              id: m.name ? m.name.replace('models/', '') : m.id,
              name: m.displayName || m.id
            }));
          }

          const imgModels = rawList.filter(m => {
            const lower = m.id.toLowerCase();
            return lower.includes('image') || lower.includes('imagen');
          });

          if (imgModels.length > 0) {
            return imgModels;
          }
        }
      } catch (proxyErr) {
        console.warn("[fetchImageModelsList] Không thể tải model ảnh từ Proxy, dùng danh sách mặc định:", proxyErr);
      }
      return AVAILABLE_AVATAR_ENGINES;
    }

    // 2. Trường hợp sử dụng API Key người dùng hoặc Key Hệ thống
    let effectiveApiKey = overrideApiKey;
    if (!effectiveApiKey) {
      if (settings.apiKeySource === 'user') {
        const validKeys = apiKeyManager.filterValidKeys(settings.userApiKeys || []);
        effectiveApiKey = validKeys.length > 0 ? validKeys[0] : '';
      } else if (settings.apiKeySource === 'system') {
        effectiveApiKey = process.env.API_KEY || process.env.GEMINI_API_KEY || '';
      }
    }

    // Nếu không có API Key hợp lệ cho Google, trả về danh sách mặc định mà không gọi API để tránh lỗi 400
    if (!effectiveApiKey || effectiveApiKey.trim() === '' || effectiveApiKey === 'dummy-key') {
      return AVAILABLE_AVATAR_ENGINES;
    }

    const ai = getAiClient(settings, effectiveApiKey);
    const pager = await ai.models.list();
    const models: {id: string, name: string}[] = [];

    for await (const model of pager) {
      if (model.name) {
        const id = model.name.startsWith('models/') ? model.name.replace('models/', '') : model.name;
        const lower = id.toLowerCase();
        
        // Không đưa các model 1.5/2.0 vào danh sách theo quy tắc Luuyngudan4
        if (lower.includes('1.5') || lower.includes('2.0')) continue;

        if (lower.includes('image') || lower.includes('imagen')) {
          let displayName = (model as any).displayName || id;
          models.push({ id, name: displayName });
        }
      }
    }

    if (models.length === 0) {
      return AVAILABLE_AVATAR_ENGINES;
    }

    return models;
  } catch (error) {
    console.warn("[fetchImageModelsList] Không thể tải danh sách image models từ Google, sử dụng mặc định:", error);
    return AVAILABLE_AVATAR_ENGINES;
  }
};

export interface ApiConnectionResult {
    success: boolean;
    model: string;
    embeddingModel?: string;
    embeddingSuccess?: boolean;
    source: string;
    error?: string;
}

export const verifyApiConnection = async (force: boolean = false, category: TaskCategory = 'combat', overrideSettings?: ApiConfig): Promise<ApiConnectionResult> => {
    const LAST_VERIFY_KEY = `last_api_verify_time_${category}`;
    const now = Date.now();
    const lastVerify = localStorage.getItem(LAST_VERIFY_KEY);
    
    const settings = overrideSettings || getApiSettings();
    const source = settings.apiKeySource === 'proxy' ? 'Proxy' : (settings.apiKeySource === 'user' ? 'Key Cá Nhân' : 'Hệ Thống');
    
    // Determine the specific task type for the test call
    const taskType = category === 'secondary' ? 'lite' : category;
    const testModel = getTaskModel(taskType as any);

    if (!force && lastVerify && now - parseInt(lastVerify) < 60000) {
        console.log(`API verification for ${category} skipped: rate limited (1 min)`);
        return { 
            success: true, 
            model: testModel, 
            embeddingModel: settings.embeddingModel || 'gemini-embedding-001',
            embeddingSuccess: true, // Giả định thành công nếu bỏ qua check
            source 
        }; 
    }

    const originalModel = settings.model;
    // Set test model temporarily
    settings.model = testModel;
    
    let geminiSuccess = false;
    let geminiModelUsed = testModel;
    let geminiError: string | undefined = undefined;
    
    let embeddingSuccess = false;
    let embeddingModelUsed = settings.embeddingModel || 'gemini-embedding-001';

    try {
        // 1. Kiểm tra Gemini API
        const { text, modelUsed } = await callGeminiAPI("hi", undefined, category, undefined, undefined, undefined, undefined, settings);
        geminiSuccess = !!text && text.length > 0;
        geminiModelUsed = modelUsed;
        
        // 2. Kiểm tra Embedding API
        try {
            const { generateEmbeddingsWithRetry } = await import('./embeddingService');
            const embResult = await generateEmbeddingsWithRetry(["api-test"]);
            embeddingSuccess = embResult && embResult.length > 0;
        } catch (embErr) {
            console.error("Embedding verification failed during connection test:", embErr);
            embeddingSuccess = false;
        }

        localStorage.setItem(LAST_VERIFY_KEY, now.toString());
        return { 
            success: geminiSuccess, 
            model: geminiModelUsed, 
            embeddingModel: embeddingModelUsed,
            embeddingSuccess: embeddingSuccess,
            source 
        };
    } catch (error) {
        console.error(`API Verification (${category}) failed:`, error);
        let errorMsg = error instanceof Error ? error.message : String(error);
        if (errorMsg.includes("暂无可用凭证") || (error && typeof error === 'object' && JSON.stringify(error).includes("暂无可用凭证"))) {
            errorMsg = "Lỗi từ Proxy: 'Tài khoản/Key không khả dụng hoặc hết số dư' (暂无可用凭证). Vui lòng cấu hình lại Proxy URL/Key hoặc chọn nguồn API khác.";
        }
        return { 
            success: false, 
            model: testModel, 
            embeddingModel: embeddingModelUsed,
            embeddingSuccess: false,
            source, 
            error: errorMsg
        };
    } finally {
        settings.model = originalModel;
    }
};

// --- Helper: Parse AI Response ---
export const parseAiResponseText = (text: string): ParsedAiResponse => {
    // Apply tag matching and fixing (Counting & Matching) for orphaned or unclosed tags
    text = matchAndFixTags(text, true);

    let narration = text;
    let systemMessage = "";
    let isNsfwActive: boolean | undefined = undefined;
    let nsfwStage: any = undefined;
    let nsfwPeakCount: number | undefined = undefined;
    let isNsfwResting: boolean | undefined = undefined;
    const tags: string[] = [];
    const choices = parseChoices(text);
    const npcChanges: NpcChangeLog[] = [];
    let summaryText: string | undefined = undefined;

    // Clean up <choice>, <choices>, <branches> blocks from the narration content completely
    narration = narration.replace(/<(choice|choices|branches)>([\s\S]*?)<\/\1>/gi, "");
    narration = narration.replace(/<\/?(choice|choices|branches)>/gi, "");

    // Clean up <cot_truyen>...</cot_truyen> blocks from the narration content completely
    narration = narration.replace(/<cot_truyen>[\s\S]*?<\/cot_truyen>/gi, "");
    narration = narration.replace(/<\/?cot_truyen>/gi, "");

    // Extract SUMMARYText tag
    const summaryRegex = /\[SUMMARYText:\s*([\s\S]*?)\]/gi;
    let sMatch;
    while ((sMatch = summaryRegex.exec(narration)) !== null) {
        summaryText = sMatch[1].trim();
    }
    narration = narration.replace(summaryRegex, "");

    // Extract JSON change blocks from narration before other tag processing
    // Example: { "name": "Lăng Vân Tử", "pride_change": -5, "affinity_change": 2, "resentment_change": 1 }
    // Or: { pride_change: -5, resentment_change: +2 }
    const blockRegex = /\{[^{}]*?(?:["']?pride_change["']?|["']?affinity_change["']?|["']?resentment_change["']?)[^{}]*?\}/gi;
    let bMatch;
    const npcChangesMatches: { full: string, index: number, length: number }[] = [];
    blockRegex.lastIndex = 0;
    while ((bMatch = blockRegex.exec(narration)) !== null) {
        const fullBlock = bMatch[0];
        const blockIndex = bMatch.index;
        
        const nameMatch = fullBlock.match(/(?:["']?(?:name|npc_name|npc)["']?\s*:\s*["']([^"']+)["'])/i);
        const prideMatch = fullBlock.match(/(?:["']?pride_change["']?\s*:\s*([-+]?\d+))/i);
        const affinityMatch = fullBlock.match(/(?:["']?affinity_change["']?\s*:\s*([-+]?\d+))/i);
        const resentmentMatch = fullBlock.match(/(?:["']?resentment_change["']?\s*:\s*([-+]?\d+))/i);

        const changeLog: NpcChangeLog = {};
        let hasAnyField = false;

        if (nameMatch && nameMatch[1]) {
            changeLog.name = nameMatch[1].trim();
        }
        if (prideMatch && prideMatch[1]) {
            changeLog.pride_change = parseInt(prideMatch[1], 10);
            hasAnyField = true;
        }
        if (affinityMatch && affinityMatch[1]) {
            changeLog.affinity_change = parseInt(affinityMatch[1], 10);
            hasAnyField = true;
        }
        if (resentmentMatch && resentmentMatch[1]) {
            changeLog.resentment_change = parseInt(resentmentMatch[1], 10);
            hasAnyField = true;
        }

        if (hasAnyField) {
            npcChanges.push(changeLog);
            npcChangesMatches.push({ full: fullBlock, index: blockIndex, length: fullBlock.length });
        }
    }

    // Sort to remove starting from the end of the text
    npcChangesMatches.sort((a, b) => b.index - a.index);
    for (const m of npcChangesMatches) {
        narration = narration.substring(0, m.index) + narration.substring(m.index + m.length);
    }

    // Clean up empty code blocks that might have wrapped the JSON blocks
    narration = narration.replace(/```json\s*```/gi, "");
    narration = narration.replace(/```\s*```/gi, "");

    // Extract tags [TAG: ...] - Enhanced regex to handle multiline and nested brackets for JSON
    // Use the dotAll (s) flag to match newlines inside tags
    const tagRegex = /\[([A-Z_]+)(?::\s*((?:[^\[\]]|\[[^\[\]]*\])*))?\]/gs;
    let match;
    const tagMatches: { full: string, index: number, length: number }[] = [];

    // Reset lastIndex because of /g flag
    tagRegex.lastIndex = 0;

    while ((match = tagRegex.exec(narration)) !== null) {
        const tagName = match[1];
        const tagValue = match[2] || "";

        if (tagName === 'CHOICE') {
             // Choice tags are usually handled separately, but we track them for removal
             tagMatches.push({ full: match[0], index: match.index, length: match[0].length });
        } else if (tagName === 'MESSAGE') {
             let msgText = tagValue.trim();
             if (msgText && (msgText.startsWith('"') || msgText.startsWith("'"))) {
                 msgText = msgText.substring(1, msgText.length - 1);
             }
             systemMessage = msgText;
             tagMatches.push({ full: match[0], index: match.index, length: match[0].length });
        } else if (tagName === 'NSFW_ACTIVE') {
             isNsfwActive = tagValue.trim().toLowerCase() === 'true';
             tagMatches.push({ full: match[0], index: match.index, length: match[0].length });
        } else if (tagName === 'NSFW_STAGE') {
             nsfwStage = tagValue.trim().toLowerCase();
             tagMatches.push({ full: match[0], index: match.index, length: match[0].length });
        } else if (tagName === 'NSFW_PEAK_COUNT') {
             nsfwPeakCount = parseInt(tagValue.trim() || '0');
             tagMatches.push({ full: match[0], index: match.index, length: match[0].length });
        } else if (tagName === 'NSFW_RESTING') {
             isNsfwResting = tagValue.trim().toLowerCase() === 'true';
             tagMatches.push({ full: match[0], index: match.index, length: match[0].length });
        } else {
             // We do not extract system tags from the main storyteller response anymore
             tagMatches.push({ full: match[0], index: match.index, length: match[0].length });
        }
    }

    // Clean narration by removing technical tags based on precise indices
    // Sort matches in reverse order to remove from string without affecting subsequent indices
    tagMatches.sort((a, b) => b.index - a.index);
    for (const m of tagMatches) {
        narration = narration.substring(0, m.index) + narration.substring(m.index + m.length);
    }

    return {
        narration: narration.trim(),
        choices: choices.length > 0 ? choices : [],
        tags: tags,
        systemMessage: systemMessage || undefined,
        isNsfwActive,
        nsfwStage,
        nsfwPeakCount,
        isNsfwResting,
        npcChanges: npcChanges.length > 0 ? npcChanges : undefined,
        summaryText
    };
};

/**
 * Helper function to call an async function with exponential backoff retry logic.
 * Specifically handles 429 (Resource Exhausted) errors.
 */
// (Moved to apiService.ts)

// --- Dynamic Few-Shot Samples for Game Initialization ---
const getFewShotSamples = (targetLength: number) => `
[VÍ DỤ CẤU TRÚC PHẢN HỒI CHUẨN]
<thinking>
1. [TÌNH HUỐNG]: Phân tích bối cảnh, nhân vật, trạng thái hiện tại.
2. [LOGIC]: Đánh giá tính hợp lý của hành động người chơi.
3. [DÀN Ý]: Lên kế hoạch kể chuyện (Mục tiêu: ${targetLength} chữ).
</thinking>
<content>
(Nội dung kể chuyện chi tiết, đúng văn phong...)
</content>
`;

/**
 * Helper to get enforced system instruction with dynamic target length
 */
export const getEnforcedSystemInstruction = (isCombat: boolean, minLength: number, maxLength: number, isNsfwSceneActive: boolean, knowledgeBase?: KnowledgeBase, responseLength?: ResponseLength, useDeepReasoning?: boolean, slowThinking?: boolean): string => {
    const apiSettings = getApiSettings();
    let base = getBaseSystemInstruction(isCombat, responseLength, useDeepReasoning, slowThinking, apiSettings.useExclusiveAccessoryPrompt, apiSettings.exclusivePromptSections, !!apiSettings.isSuperManualMode);
    
    let instruction = base.replace(/{{TARGET_LENGTH}}/g, maxLength.toString());
    
    // Narrative Arc placeholders
    const arc = knowledgeBase?.arcState;
    if (arc) {
        instruction = instruction.replace(/{{ARC_PHASE}}/g, arc.phase === 'cooldown' ? 'Nghỉ ngơi' : (arc.phase === 'buildup' ? 'Khởi động' : 'Cao trào'));
        instruction = instruction.replace(/{{ARC_TURN_COUNT}}/g, arc.turnCount.toString());
        instruction = instruction.replace(/{{ARC_TARGET_EVENT}}/g, arc.targetEvent || 'Chưa xác định');
    }

    const nsfwDesc = isNsfwSceneActive 
        ? "ĐANG HOẠT ĐỘNG. TUYỆT ĐỐI KHÔNG kết thúc phân cảnh trừ khi có yêu cầu dừng." 
        : "KHÔNG HOẠT ĐỘNG. Tuân thủ luồng truyện bình thường.";
    
    let finalInstruction = instruction.replace(/{{NSFW_STATE_DESCRIPTION}}/g, nsfwDesc);
    if (isNsfwSceneActive) {
        finalInstruction += `\n\n${NSFW_ACTION_OVERRIDE_MODULE}\n\n${NSFW_CORE_RULES}`;
    }
    return finalInstruction;
};

/**
 * Helper to extract content within XML-like tags
 */
const extractTagContent = (text: string, tagName: string): string | null => {
    const regex = new RegExp(`<${tagName}>([\\s\\S]*?)<\\/${tagName}>`, 'i');
    const match = text.match(regex);
    return match ? match[1].trim() : null;
};

// --- Core API Call ---
// (Moved to apiService.ts)

// --- Token Counting ---
// (Moved to apiService.ts)

// --- Exported Service Functions ---

import { analyzeCombatants as analyzeCombatantsService, resolveCombatantIds } from './CombatTriggerAnalyst';
import { generateGameResponseStream } from './geminiStreamService';
import { rollNpcDangerEvent } from '../utils/events/npcDangerEvent';
export const generatePossessionNarration = async (
    knowledgeBase: KnowledgeBase, 
    npc: NPC | string,
    recentHistoryLog: string = "",
    onChunk?: (text: string) => void,
    signal?: AbortSignal,
    onPromptLog?: (p: string) => void
): Promise<{response: ParsedAiResponse, rawText: string}> => {
    const apiSettings = getApiSettings();
    const { useDeepReasoning, slowThinking, apiKeySource } = apiSettings;
    const isProxy = apiKeySource === 'proxy';

    const npcObj: Partial<NPC> = typeof npc === 'string' 
        ? ((knowledgeBase.discoveredNPCs || []).find(n => n.name === npc) || { name: npc })
        : npc;
    const npcName = npcObj.name || 'Tu sĩ vô danh';
    const npcGender = npcObj.gender || 'Nam';
    const npcRace = npcObj.race || 'Nhân Tộc';
    const npcRealm = npcObj.realm || (npcObj.stats as any)?.realm || 'Phàm Nhân';
    const npcTraits = (npcObj.personalityTraits || []).join(', ') || 'Kiên nghị, sắc sảo';
    const oldMcName = knowledgeBase.worldConfig?.playerName || 'Nhân vật chính';

    // Bối cảnh thế giới & World Lore
    const config = knowledgeBase.worldConfig;
    const settingDesc = config?.settingDescription || 'Thế giới tu tiên giả tưởng';
    const theme = config?.theme || 'Tiên hiệp huyền ảo';
    const genre = config?.genre || 'Tiên Hiệp';
    const originalWork = config?.originalWork || '';
    const originalSummary = config?.originalStorySummary || '';
    const locationName = (knowledgeBase.discoveredLocations || []).find(l => l.id === knowledgeBase.currentLocationId)?.name || 'Hư không';

    const worldLoreText = (knowledgeBase.worldLore && knowledgeBase.worldLore.length > 0)
        ? knowledgeBase.worldLore.slice(0, 5).map(l => `- [${l.title}]: ${l.content}`).join('\n')
        : (knowledgeBase.lorebook && knowledgeBase.lorebook.length > 0)
            ? knowledgeBase.lorebook.slice(0, 5).map(l => `- [${(l as any).keywords?.[0] || l.id}]: ${l.content}`).join('\n')
            : 'Thế giới rộng lớn với vô vàn bí ẩn và đại đạo vô tình.';

    const prompt = `<chuyen_giao_goc_nhin>
  <chi_thi_dien_anh_+chuyen_giao_goc_nhin>
================
- Nhân vật chính cũ ("${oldMcName}") đã tử vong trong diễn biến gần nhất.
- Bắt đầu chuyển giao góc nhìn (Perspective Shift) sang nhân vật độc lập: "${npcName}".
- TUYỆT ĐỐI KHÔNG PHẢI linh hồn MC cũ đoạt xá nhập xác, không có ý thức tiền kiếp. Đây là một con người hoàn toàn độc lập trong thế giới.
- Phong cách điện ảnh (Cinematic):
  + Mở đầu: Miêu tả trực tiếp cái chết thảm khốc của MC cũ từ điểm nhìn/vị trí quan sát của "${npcName}".
  + Thể hiện tâm lý, cảm xúc và động cơ của "${npcName}" (bàng hoàng, bi thương, lạnh lùng, phẫn nộ, hoặc quyết tâm sắt đá).
  + Thu hẹp góc máy (Zoom-in): Tập trung hoàn toàn vào diện mạo, khí chất, binh khí hoặc cử chỉ của "${npcName}".
  + Kết đoạn: Giới thiệu đanh thép "${npcName}" chính là nhân vật chính mới của kỷ nguyên này.
- Độ dài: Khoảng 350-550 chữ. Văn phong đậm chất điện ảnh, hào sảng và bi tráng.
================
  </chi_thi_dien_anh_+chuyen_giao_goc_nhin>

  <ngu_canh_the_gioi_+chuyen_giao_goc_nhin>
    <thong_tin_boi_canh_+ngu_canh_the_gioi>
================
- Thể loại: ${genre}
- Chủ đề: ${theme}
- Bối cảnh thế giới: ${settingDesc}
${originalWork ? `- Nguyên tác: ${originalWork}\n- Tóm tắt nguyên tác: ${originalSummary}` : ''}
- Địa điểm hiện tại: ${locationName}
- Tên nhân vật chính mới: ${npcName}
- Giới tính: ${npcGender} | Chủng tộc: ${npcRace} | Cảnh giới: ${npcRealm}
- Tính cách/Đặc điểm: ${npcTraits}
================
    </thong_tin_boi_canh_+ngu_canh_the_gioi>
    <truyen_thuyet_the_gioi_+ngu_canh_the_gioi>
================
${worldLoreText}
================
    </truyen_thuyet_the_gioi_+ngu_canh_the_gioi>
  </ngu_canh_the_gioi_+chuyen_giao_goc_nhin>

  <dien_bien_qua_khu_+chuyen_giao_goc_nhin>
    <bon_luot_truoc_cai_chet_+dien_bien_qua_khu>
================
${recentHistoryLog || "Không có ghi chép chi tiết trước đó, hãy dựa vào bối cảnh nhân vật cũ vừa qua đời."}
================
    </bon_luot_truoc_cai_chet_+dien_bien_qua_khu>
  </dien_bien_qua_khu_+chuyen_giao_goc_nhin>

  <dinh_dang_xuat_+chuyen_giao_goc_nhin>
    <quy_chuan_xml_+dinh_dang_xuat>
================
Bắt buộc trả về đúng định dạng XML chứa <content> (nội dung lời kể điện ảnh) và các <choice> (lựa chọn hành động tiếp theo cho nhân vật chính mới).
Ví dụ:
<content>
[Nội dung lời dẫn truyện chuyển góc nhìn...]
</content>
<choice>
  <text>Lựa chọn hành động 1</text>
  <thought>Suy nghĩ nội tâm 1</thought>
</choice>
<choice>
  <text>Lựa chọn hành động 2</text>
  <thought>Suy nghĩ nội tâm 2</thought>
</choice>
================
    </quy_chuan_xml_+dinh_dang_xuat>
  </dinh_dang_xuat_+chuyen_giao_goc_nhin>
</chuyen_giao_goc_nhin>`;

    const systemInstruction = getEnforcedSystemInstruction(false, 350, 550, false, knowledgeBase, undefined, useDeepReasoning, slowThinking);
    
    let rawText = "";
    if (onChunk) {
        rawText = await generateGameResponseStream(
            prompt,
            '',
            onChunk,
            signal,
            undefined,
            systemInstruction,
            false,
            'main',
            undefined,
            undefined,
            "Đổi góc nhìn nhân vật chính",
            isProxy,
            isProxy ? "</tuong_than>\n<thinking>\n" : ""
        );
    } else {
        const res = await callGeminiAPI(
            prompt,
            onPromptLog,
            'main',
            undefined,
            systemInstruction,
            undefined,
            undefined,
            undefined,
            undefined,
            "Đổi góc nhìn nhân vật chính",
            undefined,
            isProxy,
            isProxy ? "</tuong_than>\n<thinking>\n" : ""
        );
        rawText = res.text;
    }
    return { response: parseAiResponseText(rawText), rawText };
};

export const generateEnterSamsaraNarration = async (
    knowledgeBase: KnowledgeBase, 
    newMcName: string,
    recentHistoryLog: string = "",
    onChunk?: (text: string) => void,
    signal?: AbortSignal,
    onPromptLog?: (p: string) => void
): Promise<{response: ParsedAiResponse, rawText: string}> => {
    const apiSettings = getApiSettings();
    const { useDeepReasoning, slowThinking, apiKeySource } = apiSettings;
    const isProxy = apiKeySource === 'proxy';

    const config = knowledgeBase.worldConfig;
    const settingDesc = config?.settingDescription || 'Thế giới tu tiên giả tưởng';
    const theme = config?.theme || 'Tiên hiệp huyền ảo';
    const genre = config?.genre || 'Tiên Hiệp';
    const originalWork = config?.originalWork || '';
    const originalSummary = config?.originalStorySummary || '';
    const locationName = (knowledgeBase.discoveredLocations || []).find(l => l.id === knowledgeBase.currentLocationId)?.name || 'Hư không';

    const newMcGender = config?.playerGender || 'Nam';
    const newMcRace = config?.playerRace || 'Nhân Tộc';
    const newMcRealm = knowledgeBase.playerStats?.realm || 'Phàm Nhân';
    const newMcTraits = config?.playerPersonality || knowledgeBase.playerStats?.spiritualRoot || 'Tư chất phi phàm';

    const realmSystem = getRealmSystemByRace(knowledgeBase, newMcRace);
    const majorRealmsStr = realmSystem.majorRealms.length > 0 
        ? realmSystem.majorRealms.join(' -> ') 
        : 'Phàm Nhân -> Luyện Khí -> Trúc Cơ -> Kim Đan -> Nguyên Anh -> Hóa Thần';
    const minorRealmsStr = realmSystem.minorRealms.length > 0 
        ? realmSystem.minorRealms.join(', ') 
        : 'Sơ Kỳ, Trung Kỳ, Hậu Kỳ, Viên Mãn';

    const worldLoreText = (knowledgeBase.worldLore && knowledgeBase.worldLore.length > 0)
        ? knowledgeBase.worldLore.slice(0, 5).map(l => `- [${l.title}]: ${l.content}`).join('\n')
        : (knowledgeBase.lorebook && knowledgeBase.lorebook.length > 0)
            ? knowledgeBase.lorebook.slice(0, 5).map(l => `- [${l.keywords?.[0] || l.id}]: ${l.content}`).join('\n')
            : 'Vòng quay luân hồi chuyển động không ngừng giữa muôn ngàn kiếp nạn.';

    const prompt = `<luan_hoi_tai_sinh>
  <chi_thi_dien_anh_+luan_hoi_tai_sinh>
================
- Nhân vật chính cũ đã tử vong hoàn toàn. Một sinh mệnh mới tinh mang tên "${newMcName}" vừa được số phận chọn làm nhân vật chính tiếp theo.
- TUYỆT ĐỐI KHÔNG CÓ linh hồn nhập xác, không mang ký ức kiếp trước hay bản ngã MC cũ.
- Phong cách điện ảnh (Cinematic):
  + Mở đầu bằng tầm nhìn bao quát toàn cảnh (Wide view) lướt qua thế giới, thành phố, non sông hoặc tông môn sầm uất/hỗn loạn.
  + Lướt qua muôn vàn mảnh đời tất bật, sinh lão bệnh tử trần gian.
  + Chuyển dịch tầm nhìn (Focus Shift) bất ngờ dừng lại, khóa chặt vào nhân vật "${newMcName}".
  + Miêu tả chi tiết ngoại hình, ánh mắt, thần thái và một hành động đặc trưng của "${newMcName}".
  + Kết thúc bằng lời khẳng định đanh thép: Giữa muôn vàn con người, bánh xe định mệnh đã dừng lại. Tên người đó là "${newMcName}". Và từ đây, câu chuyện này là về người đó.
- QUY TẮC TẦM NHÌN: TUYỆT ĐỐI KHÔNG dùng các thuật ngữ kỹ thuật quay phim như "góc máy", "góc quay", "ống kính", "máy quay", "khung hình". Toàn bộ góc nhìn miêu tả phải dùng từ "tầm nhìn" hoặc cảm quan tự nhiên của người quan sát.
- Độ dài: Khoảng 350-550 chữ. Văn phong điện ảnh, hùng tráng, lôi cuốn.
================
  </chi_thi_dien_anh_+luan_hoi_tai_sinh>

  <ngu_canh_the_gioi_+luan_hoi_tai_sinh>
    <thong_tin_boi_canh_+ngu_canh_the_gioi>
================
- Thể loại: ${genre}
- Chủ đề: ${theme}
- Bối cảnh thế giới: ${settingDesc}
${originalWork ? `- Nguyên tác: ${originalWork}\n- Tóm tắt nguyên tác: ${originalSummary}` : ''}
- Địa điểm hiện tại: ${locationName}
- Tên nhân vật chính mới: ${newMcName}
- Giới tính: ${newMcGender} | Chủng tộc: ${newMcRace} | Cảnh giới: ${newMcRealm}
- Đặc tính/Tư chất: ${newMcTraits}
================
    </thong_tin_boi_canh_+ngu_canh_the_gioi>

    <he_thong_canh_gioi_+ngu_canh_the_gioi>
================
- Danh sách Đại Cảnh Giới chuẩn của thế giới (từ thấp đến cao): ${majorRealmsStr}
- Danh sách Tiểu Cảnh Giới chuẩn: ${minorRealmsStr}
- Cảnh giới khởi đầu của tân nhân vật chính "${newMcName}": ${newMcRealm}
- QUY TẮC CẢNH GIỚI BẮT BUỘC: Khi đề cập, miêu tả tu vi hoặc định hình năng lực của nhân vật chính mới và các nhân vật xung quanh, AI BẮT BUỘC phải dùng chính xác 100% các danh xưng trong danh sách Đại Cảnh Giới và Tiểu Cảnh Giới nói trên. Tuyệt đối không tự ý bịa đặt hoặc dùng tên cảnh giới ngoài danh sách này.
================
    </he_thong_canh_gioi_+ngu_canh_the_gioi>

    <truyen_thuyet_the_gioi_+ngu_canh_the_gioi>
================
${worldLoreText}
================
    </truyen_thuyet_the_gioi_+ngu_canh_the_gioi>
  </ngu_canh_the_gioi_+luan_hoi_tai_sinh>

  <dien_bien_qua_khu_+luan_hoi_tai_sinh>
    <bon_luot_truoc_cai_chet_+dien_bien_qua_khu>
================
${recentHistoryLog || "Không có ghi chép chi tiết trước đó, thế giới vừa chứng kiến sự ngã xuống của người đi trước."}
================
    </bon_luot_truoc_cai_chet_+dien_bien_qua_khu>
  </dien_bien_qua_khu_+luan_hoi_tai_sinh>

  <dinh_dang_xuat_+luan_hoi_tai_sinh>
    <quy_chuan_xml_+dinh_dang_xuat>
================
Bắt buộc trả về đúng định dạng XML chứa <content> (nội dung lời kể điện ảnh) và các <choice> (lựa chọn hành động tiếp theo cho nhân vật chính mới).
Ví dụ:
<content>
[Nội dung lời dẫn truyện luân hồi...]
</content>
<choice>
  <text>Lựa chọn hành động 1</text>
  <thought>Suy nghĩ nội tâm 1</thought>
</choice>
<choice>
  <text>Lựa chọn hành động 2</text>
  <thought>Suy nghĩ nội tâm 2</thought>
</choice>
================
    </quy_chuan_xml_+dinh_dang_xuat>
  </dinh_dang_xuat_+luan_hoi_tai_sinh>
</luan_hoi_tai_sinh>`;

    const systemInstruction = getEnforcedSystemInstruction(false, 350, 550, false, knowledgeBase, undefined, useDeepReasoning, slowThinking);

    let rawText = "";
    if (onChunk) {
        rawText = await generateGameResponseStream(
            prompt,
            '',
            onChunk,
            signal,
            undefined,
            systemInstruction,
            false,
            'main',
            undefined,
            undefined,
            "Luân hồi tái sinh",
            isProxy,
            isProxy ? "</tuong_than>\n<thinking>\n" : ""
        );
    } else {
        const res = await callGeminiAPI(
            prompt,
            onPromptLog,
            'main',
            undefined,
            systemInstruction,
            undefined,
            undefined,
            undefined,
            undefined,
            "Luân hồi tái sinh",
            undefined,
            isProxy,
            isProxy ? "</tuong_than>\n<thinking>\n" : ""
        );
        rawText = res.text;
    }
    return { response: parseAiResponseText(rawText), rawText };
};

export interface StandardTurnPromptPayload {
  optimizedPrompt: string;
  systemInstruction: string;
  useGoogleSearch: boolean;
  isOocAction: boolean;
  model: string;
  narrationMin: number;
  narrationMax: number;
  selectedReunionData?: { npcs: NPC[], isForgottenReunion: boolean };
}

/**
 * Builds the complete prompt and system instruction payload using the standard narrative turn flow.
 */
export const constructStandardTurnPromptPayload = async (
  knowledgeBase: KnowledgeBase,
  playerAction: string,
  inputType: PlayerActionInputType,
  responseLength: ResponseLength,
  currentPageMessagesLog: string = "",
  previousPageSummaries: string[] = [],
  lastNarrationFromPreviousPage?: string,
  retrievedContext?: string,
  onPromptConstructedForLog?: (prompt: string) => void,
  dynamicContextLayers?: { priority: number; content: string }[]
): Promise<StandardTurnPromptPayload> => {
  const apiSettings = getApiSettings();
  const { perspectiveMode, model, architectureMode, useDeepReasoning, slowThinking, accessoryPrompt, useExclusiveAccessoryPrompt, exclusivePromptSections } = apiSettings;

  // Auto-detect explicit 18+ player actions to immediately turn on NSFW scene state
  const isExplicitlyNSFW = detectNsfwIntent(playerAction);
  if (isExplicitlyNSFW) {
      knowledgeBase.isNsfwSceneActive = true;
  }

  // --- NARRATIVE ARC STATE MACHINE ---
  if (!knowledgeBase.arcState) {
      knowledgeBase.arcState = { phase: 'cooldown', turnCount: 0, targetEvent: null, questIssued: false, originalTimelineIndex: 0, originalEventResolved: false };
  } else if (knowledgeBase.arcState.originalTimelineIndex == null && knowledgeBase.worldConfig?.timelineEvents && knowledgeBase.worldConfig.timelineEvents.length > 0) {
      knowledgeBase.arcState.originalTimelineIndex = 0;
      knowledgeBase.arcState.originalEventResolved = false;
  }

  // --- HARDCORE LUÂN HỒI REBORN PROMPT LAYER ---
  let contextLayers = dynamicContextLayers ? [...dynamicContextLayers] : [];

  // --- PASSIVE SYSTEM: INTIMACY DEMAND PROMPT LAYER ---
  try {
      const intimacyPrompt = NpcIntimacyDemandService.buildPromptLayers(knowledgeBase);
      if (intimacyPrompt) {
          contextLayers.push({
              priority: 5, // High priority
              content: intimacyPrompt
          });
      }
  } catch (intimacyPromptError) {
      console.error("Lỗi dựng prompt nhu cầu làm tình:", intimacyPromptError);
  }

  if (knowledgeBase.playerStats?.justHardcoreReborn) {
      contextLayers.push({
          priority: 1, // Highest priority
          content: `
<HardcoreRebornInstruction>
================
[CHỈ THỊ CƠ HỌC BẮT BUỘC]: 
- Nhân vật chính vừa mới LUÂN HỒI CHUYỂN KIẾP trong Không gian Luân hồi sau khi tử vong liên tiếp quá nhiều lần!
- Linh hồn đã bị thanh tẩy hoàn toàn. AI BẮT BUỘC phải đặt một cái tên hoàn toàn mới, độc lập và thích hợp cho cuộc đời mới này của Nhân vật chính.
- Tên mới TUYỆT ĐỐI không được trùng với tên cũ ("${knowledgeBase.worldConfig?.playerName || 'Người chơi'}") hay tên của bất kỳ NPC nào khác.
- AI PHẢI viết rõ hành động đổi tên này trong thẻ <update_data> và bắt buộc sinh ra thẻ \`[MC_RENAME: newName="Tên Mới Của Bạn"]\` để cập nhật tên nhân vật chính trong hệ thống!
================
</HardcoreRebornInstruction>
`
      });
      // Clear the temporary flag so it only runs once
      knowledgeBase.playerStats.justHardcoreReborn = false;
  }
  
  // Select the correct prompt function based on the player's status
  const promptFunction = knowledgeBase.playerStats.playerSpecialStatus 
      ? PROMPT_FUNCTIONS.continuePrison
      : PROMPT_FUNCTIONS.continue;

  let narrationMin = 2500;
  let narrationMax = 3000;

  // Scale based on responseLength
  if (responseLength === 'extra-short') {
      narrationMin = 1300;
      narrationMax = 1500;
  } else if (responseLength === 'short') {
      narrationMin = 1800;
      narrationMax = 2500;
  } else if (responseLength === 'medium') {
      narrationMin = 3000;
      narrationMax = 4000;
  } else if (responseLength === 'long') {
      narrationMin = 4000;
      narrationMax = 5000;
  } else if (responseLength === 'dialogue') {
      narrationMin = 500;
      narrationMax = 600;
  }

  const reincarnationTurn = knowledgeBase.reincarnationTurn || 0;

  // Lấy rich summary của lượt trước từ ragHistoryLog hoặc flashState
  const previousFlashLog = knowledgeBase.ragHistoryLog
      ?.filter((log: any) => log && log.type === 'flash_agent' && (log.turn === undefined || log.turn <= (knowledgeBase.playerStats?.turn ?? 0)) && (reincarnationTurn === 0 || (log.turn !== undefined && log.turn >= reincarnationTurn)))
      ?.sort((a: any, b: any) => (b.turn || 0) - (a.turn || 0))[0];
  const previousRichSummary = (reincarnationTurn > 0 && (!previousFlashLog || (previousFlashLog.turn !== undefined && previousFlashLog.turn < reincarnationTurn)))
      ? ""
      : (previousFlashLog?.richSummary || previousFlashLog?.summary || knowledgeBase.flashState?.currentState || "");

  let finalPrompt = "";
  let ragContext = "";
  try {
      const ragQueryText = (previousRichSummary ? previousRichSummary + "\n" : "") + playerAction;
      ragContext = await RAGService.findRelevantContext(ragQueryText, 3, knowledgeBase.playerStats?.turn); 
  } catch (e) {
      console.warn("RAG Context fetch failed", e);
  }
  if (!ragContext) {
      ragContext = RagContextExtractor.formatRagWithTurnTag([], knowledgeBase.playerStats?.turn || 0);
  }

  // Tỉa token cho lịch sử hội thoại trước khi đưa vào Prompt
  const slicedHistory = sliceHistoryString(currentPageMessagesLog, 3000); // Giới hạn ~3000 tokens cho history

  const prompt = promptFunction(
      knowledgeBase, playerAction, inputType, responseLength,
      slicedHistory, previousPageSummaries, 
      narrationMin, narrationMax,
      lastNarrationFromPreviousPage,
      retrievedContext, 
      perspectiveMode,
      useExclusiveAccessoryPrompt,
      exclusivePromptSections,
      apiSettings.isSuperManualMode
  );
  finalPrompt = prompt;

  // Lấy thời gian từ KB
  const date = knowledgeBase.worldDate || { canh: 1, hour: 7, timeOfDay: 'Sáng', day: 1, month: 1, year: 1 };
  const timeContextPrompt = `
<thoi_gian_hien_tai_7>
================
- THỜI GIAN HIỆN TẠI TRONG THẾ GIỚI: Canh ${date.canh || 1} (${date.hour || 7}:00), Buổi ${date.timeOfDay || 'Sáng'}, Ngày ${date.day || 1} Tháng ${date.month || 1} Năm ${date.year || 1}.
- HƯỚNG DẪN TỊNH TIẾN THỜI GIAN (BẮT BUỘC): AI phải đánh giá hành động của MC tiêu tốn bao nhiêu thời gian và xuất tag [CHANGE_TIME: canh=+X].
+ Trò chuyện, ăn uống, di chuyển gần: 1 canh giờ.
+ Khám phá bí cảnh, chiến đấu, luyện tập dài: 2-3 canh giờ.
+ Ngủ, bế quan: 3-4 canh giờ trở lên.
================
</thoi_gian_hien_tai_7>
`;
  finalPrompt = timeContextPrompt + "\n" + finalPrompt;

  // --- MECHANICAL DICE ROLL FOR UNREALISTIC ACTIONS ---
  let mechanicalRollPrompt = "";
  if (inputType === 'story') {
      mechanicalRollPrompt = `
<story_mode_exception_9>
- Người chơi đang nhập nội dung ở chế độ **"Câu chuyện"** (Story Mode).
- **HƯỚNG DẪN BẮT BUỘC CHO AI:** Đối với chế độ này, bạn **PHẢI 100%** mô tả diễn biến thành công và đúng theo nội dung người chơi đã nhập, bất kể hành động đó có phi lý, vượt cấp hay không hợp logic đến đâu. KHÔNG ĐƯỢC áp dụng các quy tắc roll, KHÔNG từ chối và KHÔNG cho thất bại. Hãy hoàn thành đúng như mong muốn cốt truyện của người chơi.
</story_mode_exception_9>
`;
  } else {
      const actionRoll = Math.floor(Math.random() * 100) + 1;
      let rollContent = "";
      
      if (actionRoll >= 1 && actionRoll <= 40) {
          rollContent = "MC hành động và thất bại";
      } else if (actionRoll >= 41 && actionRoll <= 90) {
          rollContent = "MC tự từ bỏ trong suy nghĩ";
      } else if (actionRoll >= 91 && actionRoll <= 100) {
          rollContent = "MC hành động một cách thành công thần kỳ";
      }

      mechanicalRollPrompt = `
<CơChếHànhĐộngPhiLý_#22>
================
**HỆ THỐNG PHÁN QUYẾT HÀNH ĐỘNG PHI LÝ / KHÔNG HỢP LOGIC:**
- Hệ thống đã thực hiện roll ngẫu nhiên cơ học (1-100) nhận được điểm số: **${actionRoll}**.
- Kết quả gán sẵn (Nếu bị phán xử là phi lý): **"${rollContent}"**.

**QUY TRÌNH PHÁN QUYẾT CHO AI (BẮT BUỘC TUÂN THỦ):**
1. Khi đánh giá hành động của người chơi, nếu bạn đánh giá hành động đó của MC là **phi lý, không hợp logic hoặc vượt cấp quá mức**.
2. Bạn **BẮT BUỘC 100%** phải sử dụng kết quả đã roll: **"${rollContent}"** để viết lời kể và mô tả diễn biến tiếp theo. AI tuyệt đối không tự ý quyết định kết quả khác hay tự roll kết quả mới.
3. **NGOẠI LỆ TỐI CAO:** Mọi hành động **TẤN CÔNG VẬT LÝ** (Vật lý, dùng pháp bảo, tấn công trực diện...) do người chơi đưa ra đều được coi là **HỢP LÝ** trong mọi điều kiện. TUYỆT ĐỐI KHÔNG áp dụng cơ chế roll phi lý cho các đòn tấn công. AI phải mô tả đòn tấn công được thực hiện và kích hoạt [BEGIN_COMBAT] nếu cần.
4. Nếu hành động của người chơi hoàn toàn HỢP LÝ và ĐÚNG LOGIC: Hãy tiếp tục phán định và xử lý diễn biến một cách bình thường.
================
</CơChếHànhĐộngPhiLý_#22>
`;
  }
  finalPrompt = mechanicalRollPrompt + "\n\n" + finalPrompt;

  if (ragContext) {
      let contextWarning = "";
      if (knowledgeBase.reincarnationTurn && knowledgeBase.reincarnationTurn > 0) {
          const currName = knowledgeBase.worldConfig?.playerName || knowledgeBase.playerStats?.name || "Bạn";
          contextWarning = `\n⚠️ [CẢNH BÁO TIỀN KIẾP]: Nhân vật chính hiện tại là **${currName}**. Mọi thông tin trong <retrieved_context> bên dưới nếu có nhắc đến các nhân vật chính tiền nhiệm đã khuất chỉ được coi là LỊCH SỬ THẾ GIỚI hoặc TRUYỀN THUYẾT. MC hiện tại là một người hoàn toàn mới, KHÔNG HỀ có ký ức trực tiếp hay sợi dây liên kết bản ngã nào với họ.\n`;
      }
      finalPrompt = `<rag_context_8>\n[TRI THỨC TRÍCH XUẤT TỪ NGUYÊN TÁC - BẮT BUỘC THAM KHẢO]:${contextWarning}\n${ragContext}\n</rag_context_8>\n\n` + finalPrompt;
  }

  // --- CƠ CHẾ AN NGUY CỦA NPC ---
  const npcDangerPrompt = rollNpcDangerEvent(knowledgeBase);
  if (npcDangerPrompt) {
      contextLayers.push({ priority: 999, content: npcDangerPrompt });
  }

  // Inject Dynamic Memory Layers (Priority Sorting)
  if (contextLayers.length > 0) {
      const sortedLayers = [...contextLayers].sort((a, b) => a.priority - b.priority);
      const layersText = sortedLayers.map(l => l.content).join('\n---\n');
      finalPrompt = `<dynamic_memory_layers_7>\n[BỐI CẢNH LỚP (DYNAMIC MEMORY) - SẮP XẾP THEO ƯU TIÊN]:\n${layersText}\n</dynamic_memory_layers_7>\n\n` + finalPrompt;
  }

  // Inject Global Original Story Summary if available and enabled
  if (knowledgeBase.worldConfig?.originalStorySummary && knowledgeBase.worldConfig.useOriginalSummary !== false) {
      finalPrompt = `<original_story_summary_6>\n[THẾ GIỚI NGUYÊN TÁC]:\n${knowledgeBase.worldConfig.originalStorySummary}\n</original_story_summary_6>\n\n` + finalPrompt;
  }

  // --- ENFORCEMENT LAYER: Few-Shot Injection ---
  const messageCount = (currentPageMessagesLog.match(/<content>/g) || []).length;
  if (messageCount < 3 && responseLength !== 'dialogue') {
      finalPrompt = `${getFewShotSamples(narrationMax)}\n\n[YÊU CẦU HIỆN TẠI]:\n${finalPrompt}`;
  }

  // Append Narrative Dynamics Rules based on Story Tone
  finalPrompt += `<story_tone_dynamics_19>\n${getTonePrompt(knowledgeBase.worldConfig?.storyTone || "")}\n</story_tone_dynamics_19>`;

  const origMcName = knowledgeBase.worldConfig?.originalPlayerName || knowledgeBase.playerStats?.originalPlayerName || knowledgeBase.worldConfig?.playerName || knowledgeBase.playerStats?.name || "Người chơi";
  const currMcName = knowledgeBase.worldConfig?.playerName || knowledgeBase.playerStats?.name || "Người chơi";

  // --- FINAL ENFORCEMENT: Thinking Instructions ALWAYS at the top ---
  const exclusiveSections = exclusivePromptSections || {};
  const shouldIncludeThinking = (!useExclusiveAccessoryPrompt || (exclusiveSections.thinkingProtocol === true)) && responseLength !== 'dialogue';
  const absoluteThinkingInstructions = shouldIncludeThinking 
    ? getAbsoluteThinkingInstructions(narrationMin, narrationMax, inputType, currMcName, apiSettings.isSuperManualMode) 
    : "";

  // --- GAME THEORY ALWAYS-ON STRATEGIC ASSESSMENT ---
  const gameTheoryContext = responseLength === 'dialogue' ? "" : buildGameTheoryContextPrompt(knowledgeBase, lastNarrationFromPreviousPage, playerAction);

  // User Input Highlight Block - ALWAYS at the VERY top
  const deathWarningText = getDeathNarrativeWarning(knowledgeBase);
  const rebornInstruction = buildHardcoreRebornInstruction(knowledgeBase.worldConfig?.originalPlayerName || knowledgeBase.playerStats?.originalPlayerName || "", knowledgeBase.worldConfig?.playerName || knowledgeBase.playerStats?.name || "");
  
  const combinedWarning = [deathWarningText, rebornInstruction].filter(Boolean).join("\n");

  // Tìm khối Turn Log của lượt AI gần nhất để nhét vào ngay sau user_input
  let lastAiLogXml = "";
  if (knowledgeBase && knowledgeBase.currentTurnLog && knowledgeBase.currentTurnLog.length > 0) {
      let lastAiIndex = -1;
      for (let i = knowledgeBase.currentTurnLog.length - 1; i >= 0; i--) {
          if (knowledgeBase.currentTurnLog[i].role === "model") {
              lastAiIndex = i;
              break;
          }
      }
      if (lastAiIndex !== -1) {
          const entry = knowledgeBase.currentTurnLog[lastAiIndex];
          const id = lastAiIndex + 1;
          const roleName = "AI";
          const parsedContent = parseAndSubdivideAiTextLocal(entry.text);
          lastAiLogXml = `<Turn _Log_#${id}+current_context_17>
    <Role>${roleName}</Role>${parsedContent}</Turn _Log_#${id}+current_context_17>`;
      }
  }

  const previousTurn = previousFlashLog?.turn ?? (knowledgeBase.playerStats?.turn ?? 0);
  const highlightedUserInput = formatUserInputBlock(playerAction, lastAiLogXml, combinedWarning, previousTurn, origMcName, currMcName);

  const accessoryPromptBlock = (accessoryPrompt && responseLength !== 'dialogue') ? `
<prompt_phu_tung>
${accessoryPrompt}
</prompt_phu_tung>
` : "";

  // Prepare top section (User Input + Game Theory Matrix + Thinking Instructions + Accessory)
  const topSection = highlightedUserInput + (gameTheoryContext ? gameTheoryContext + "\n" : "") + (absoluteThinkingInstructions ? absoluteThinkingInstructions + "\n" : "") + accessoryPromptBlock;
  finalPrompt = topSection + finalPrompt;

  // Sync Remote Canon if URL is provided
  if (knowledgeBase.worldConfig?.remoteCanonUrl) {
      try {
          await RemoteCanonService.fetchAndCache(knowledgeBase.worldConfig.remoteCanonUrl);
      } catch (e) {
          console.warn("[RemoteCanon] Auto-sync failed", e);
      }
  }

  // Append Layered Prompt for Character/Tone Separation
  const toneSettings = {
      enabled: knowledgeBase.worldConfig?.nsfwMode || false,
      toneDescription: knowledgeBase.worldConfig?.storyTone || "Trung tính"
  };
  finalPrompt += "\n\n<layered_perspective_prompt_20>\n" + buildLayeredPrompt(
      !!knowledgeBase.playerStats.playerSpecialStatus, 
      knowledgeBase.playerStats.baseMaxSinhLuc.toString(),
      knowledgeBase.worldConfig || {}, 
      toneSettings
  ) + "\n</layered_perspective_prompt_20>";

  // Append Roleplay Choice System prompt
  finalPrompt += "\n\n<roleplay_choice_prompt_21>\n" + buildChoicePrompt(knowledgeBase) + "\n</roleplay_choice_prompt_21>";

  // Append NSFW Narrative Service prompt if active
  if (knowledgeBase.isNsfwSceneActive) {
      finalPrompt += "\n\n<nsfw_scene_prompt_23>\n" + buildNsfwPrompt(knowledgeBase, playerAction, narrationMin, narrationMax) + "\n</nsfw_scene_prompt_23>";
  }

  // Append Original Work Reminder
  if (knowledgeBase.worldConfig?.originalWork) {
      finalPrompt += `\n\n<original_work_reminder_24>\n(Nhắc nhở hệ thống: Luôn ghi nhớ đây là thế giới của "${knowledgeBase.worldConfig.originalWork}". Bắt đầu suy nghĩ bằng việc xác nhận bối cảnh này.)\n</original_work_reminder_24>`;
  }

  // Append Remote Canon Grounding instructions if enabled
  if (knowledgeBase.worldConfig?.useRemoteCanon && knowledgeBase.worldConfig?.remoteCanonUrl) {
      finalPrompt += `\n\n<remote_canon_grounding_25>\n[HỆ THỐNG TRA CỨU CANON ONLINE - ĐANG HOẠT ĐỘNG]\n1. NGUỒN DỮ LIỆU: ${knowledgeBase.worldConfig.remoteCanonUrl}\n2. QUY TẮC: Khi gặp bất kỳ danh từ riêng, thuật ngữ kỹ thuật, hoặc tình tiết quan trọng nào liên quan đến nguyên tác, bạn BẮT BUỘC phải gọi công cụ 'read_online_canon' để tra cứu trong kho tri thức online trước khi viết tiếp. Tuyệt đối không được tự ý bịa đặt dữ liệu (hallucination) nếu nguồn online có thông tin mâu thuẫn.\n</remote_canon_grounding_25>`;
  }

  // Append Dynamic Realm Whitelist and Strict Adherence Rules
  const dynamicWhitelist = RealmValidatorService.getDynamicWhitelist(knowledgeBase, knowledgeBase.playerStats.realm);
  if (dynamicWhitelist.length > 0) {
      finalPrompt += `\n\n<cultivation_format_rules_26>\n${CULTIVATION_FORMAT_RULES}\n</cultivation_format_rules_26>`;
  }

  // --- INJECT INSTRUCTIONS FOR PREVIOUS NARRATION TO FLASH STATE ---
  const finalPromptWithPreviousNarration = injectPreviousNarrationIntoPrompt(finalPrompt, knowledgeBase, currentPageMessagesLog, lastNarrationFromPreviousPage);

  if (onPromptConstructedForLog) {
      onPromptConstructedForLog(finalPromptWithPreviousNarration);
  }

  // --- SYSTEM-LEVEL REGEX: PROMPT OPTIMIZATION ---
  const optimizedPromptBeforeReunion = SystemRegexService.processSystemPrompt(finalPromptWithPreviousNarration);

  // --- INJECT HỆ THỐNG VÒNG ĐỜI VÀ TÁI NGỘ NPC ---
  let finalPromptWithReunion = optimizedPromptBeforeReunion;
  let selectedReunionData: { npcs: NPC[], isForgottenReunion: boolean } | undefined;
  try {
      selectedReunionData = NpcLifecycleManager.selectReunionCandidates(knowledgeBase);
      if (selectedReunionData && selectedReunionData.npcs.length > 0) {
          finalPromptWithReunion = NpcLifecycleManager.injectReunionPrompt(optimizedPromptBeforeReunion, selectedReunionData);
      }
  } catch (err) {
      console.error("[NPC Lifecycle] Lỗi khi chọn NPC tái ngộ hoặc tiêm prompt:", err);
  }

  const isOocAction = playerAction.trim().startsWith('&&') && playerAction.trim().endsWith('&&');
  let systemInstruction = "";
  if (isOocAction) {
      systemInstruction = `Bạn là Trợ lý AI Trực tiếp vượt qua bức tường thứ tư. 
Người chơi đang gửi một câu hỏi ngoài game (OOC) trực tiếp cho bạn bên trong cặp ký hiệu **&&**.
BẮT BUỘC TUÂN THỦ CÁC QUY TẮC SAU:
1. KHÔNG viết suy nghĩ, KHÔNG dùng thẻ <thinking> hay bất kỳ phân tích nào khác. KHÔNG đóng vai các thanh tra hệ thống.
2. KHÔNG kể tiếp truyện, KHÔNG mô tả bối cảnh, và KHÔNG sinh ra các lựa chọn <choice>.
3. CHỈ trả lời trực tiếp câu hỏi hoặc thực hiện yêu cầu nằm bên trong dấu **&&** một cách cực kỳ ngắn gọn, súc tích, đi thẳng vào vấn đề.
4. Câu trả lời của bạn BẮT BUỘC phải được bao bọc bên trong thẻ <content>...</content>.
5. QUAN TRỜNG: Nếu yêu cầu OOC của người chơi ĐÒI HỎI PHẢI THAY ĐỔI DỮ LIỆU GAME (như tăng tu vi NPC, thêm vật phẩm, đổi chỉ số, v.v.), bạn BẮT BUỘC phải thêm thẻ <update_data> bên dưới thẻ <content>. Trong thẻ <update_data>, hãy viết ngôn ngữ tự nhiên yêu cầu cập nhật (Ví dụ: "Cập nhật NPC Vương Trưởng Lão lên cảnh giới Kết Đan Hậu Kỳ"). Nếu không có yêu cầu thay đổi dữ liệu, không cần thẻ <update_data>.
Ví dụ:
Người chơi gửi: "&& 1+1 bằng mấy? &&"
Bạn phản hồi:
<content>1+1 = 2</content>

Người chơi gửi: "&& tăng tu vi Vương Trưởng Lão lên Kết Đan Hậu Kỳ &&"
Bạn phản hồi:
<content>Đã cập nhật tu vi của Vương Trưởng Lão lên Kết Đan Hậu Kỳ.</content>
<update_data>
Cập nhật cảnh giới (realm) của NPC Vương Trưởng Lão thành Kết Đan Hậu Kỳ.
</update_data>`;
  } else {
      systemInstruction = getEnforcedSystemInstruction(
          false, 
          narrationMin, 
          narrationMax, 
          knowledgeBase.isNsfwSceneActive || false, 
          knowledgeBase, 
          responseLength,
          useDeepReasoning,
          slowThinking
      );
  }

  const useGoogleSearch = knowledgeBase.worldConfig?.useRemoteCanon ? false : true;

  return {
      optimizedPrompt: finalPromptWithReunion,
      systemInstruction,
      useGoogleSearch,
      isOocAction,
      model,
      narrationMin,
      narrationMax,
      selectedReunionData
  };
};

export const generateNextTurn = async (
  knowledgeBase: KnowledgeBase,
  playerAction: string,
  inputType: PlayerActionInputType,
  responseLength: ResponseLength,
  currentPageMessagesLog: string = "", 
  previousPageSummaries: string[],
  lastNarrationFromPreviousPage?: string,
  retrievedContext?: string, 
  onPromptConstructedForLog?: (prompt: string) => void,
  onChunk?: (text: string) => void,
  signal?: AbortSignal,
  dynamicContextLayers?: { priority: number; content: string }[],
  onResetStream?: () => void,
  customPromptOverride?: string
): Promise<{response: ParsedAiResponse, rawText: string, monolithicData?: MonolithicWorldState}> => {
  // Update narrative arc
  if (!knowledgeBase.arcState) {
      knowledgeBase.arcState = { phase: 'cooldown', turnCount: 0, targetEvent: null, questIssued: false, originalTimelineIndex: 0, originalEventResolved: false };
  }
  let arc = knowledgeBase.arcState;
  arc.turnCount += 1;
  if (arc.phase === 'cooldown' && arc.turnCount >= 3) {
      arc.phase = 'buildup';
      arc.turnCount = 1;
      arc.questIssued = false;
  } else if (arc.phase === 'buildup' && arc.turnCount >= 5) {
      arc.phase = 'active';
      arc.turnCount = 1;
  }

  const payload = await constructStandardTurnPromptPayload(
      knowledgeBase,
      playerAction,
      inputType,
      responseLength,
      currentPageMessagesLog,
      previousPageSummaries,
      lastNarrationFromPreviousPage,
      retrievedContext,
      onPromptConstructedForLog,
      dynamicContextLayers
  );

  let finalPromptToSend = customPromptOverride || payload.optimizedPrompt;
  if (payload.systemInstruction) {
      payload.systemInstruction = replaceStoryKeywords(payload.systemInstruction);
  }
  let rawText = "";
  let modelUsedFromCall = "";

  if (onChunk) {
      rawText = await generateGameResponseStream(
          finalPromptToSend, 
          payload.model, 
          onChunk, 
          signal, 
          (m) => modelUsedFromCall = m, 
          payload.systemInstruction, 
          payload.useGoogleSearch, 
          'main', 
          onResetStream, 
          undefined, 
          "Tạo lời kể truyện", 
          !payload.isOocAction, 
          "</tuong_than>\n<thinking>\n"
      );
  } else {
      const result = await callGeminiAPI(
          finalPromptToSend, 
          undefined, 
          'main', 
          (m) => modelUsedFromCall = m, 
          payload.systemInstruction, 
          payload.useGoogleSearch, 
          undefined, 
          undefined, 
          undefined, 
          "Tạo lời kể truyện", 
          undefined, 
          !payload.isOocAction, 
          "</tuong_than>\n<thinking>\n"
      ); 
      rawText = result.text;
      modelUsedFromCall = result.modelUsed;
  }

  // --- SAVE THE TRUE RAW TEXT ---
  const trueRawText = rawText;

  // Parse the completely raw AI response first to capture choices, NPC changes, tags, etc.
  const parsedResponse = parseAiResponseText(trueRawText);

  // Sanitize the narration text inside parsedResponse to clean up prefixes/postfixes/Markdown blocks, but preserve system tags
  const sanitizedNarration = SystemRegexService.sanitizeAiResponse(parsedResponse.narration);

  // --- NARRATIVE ARC RESPONSE HANDLING ---
  if (trueRawText.includes('[ARC_RESOLVED]')) {
      knowledgeBase.arcState = {
          phase: 'cooldown',
          turnCount: 0,
          targetEvent: null,
          questIssued: false
      };
  } else if (arc.phase === 'buildup' && arc.turnCount === 1) {
      // Extract target event from AI response if it's the first turn of buildup
      const eventMatch = trueRawText.match(/\[QUEST_ASSIGNED:\s*([^|\]]+)/);
      if (eventMatch && eventMatch[1]) {
          arc.targetEvent = eventMatch[1].trim();
          arc.questIssued = true;
      }
  }

  const res = {
      response: { 
          ...parsedResponse, 
          narration: sanitizedNarration,
          modelUsed: modelUsedFromCall,
          reunionOccurred: payload.selectedReunionData ? payload.selectedReunionData.npcs.length > 0 : false,
          reunionNpcNames: payload.selectedReunionData ? payload.selectedReunionData.npcs.map(n => n.name) : []
      }, 
      rawText: trueRawText
  };
  return res;
};

export const generateInitialStory = async (
    worldConfig: WorldSettings,
    onPromptLog?: (p: string) => void,
    onChunk?: (text: string) => void,
    signal?: AbortSignal,
    onResetStream?: () => void
): Promise<{response: ParsedAiResponse, rawText: string}> => {
    return generateInitialStoryStream(worldConfig, onPromptLog, onChunk, signal, onResetStream);
};

export const generateWorldDetailsFromStory = async (
    storyIdea: string,
    nsfwMode: boolean,
    genre: any,
    isCultivationEnabled: boolean,
    violenceLevel: any,
    storyTone: any,
    customGenreName?: string,
    nsfwDescriptionStyle?: any,
    onPromptLog?: (p: string) => void,
    canonData?: string,
    onChunk?: (text: string) => void
): Promise<{response: any, rawText: string, constructedPrompt: string}> => {
    // Construct a dummy WorldSettings object for the prompt generator
    const dummySettings: WorldSettings = {
        ...{} as any,
        nsfwMode, genre, isCultivationEnabled, violenceLevel, storyTone, customGenreName, nsfwDescriptionStyle
    };
    const prompt = PROMPT_FUNCTIONS.generateWorldDetails(storyIdea, dummySettings, canonData);
    const optimizedPrompt = SystemRegexService.processSystemPrompt(prompt);

    const { rawText: trueRawText, cleanContent } = await streamSetupTaskWithPrefill(
        optimizedPrompt,
        "<tuong_than>",
        (accumulatedText) => {
            if (onChunk) onChunk(accumulatedText);
        },
        onPromptLog,
        'main'
    );
    
    // Parse tags manually as this returns a JSON-like structure of tags mostly from the true raw response
    const parsedResponse = parseAiResponseText(cleanContent);
    const sanitizedNarration = SystemRegexService.sanitizeAiResponse(parsedResponse.narration);
    
    // Convert tags to a structured object for the setup screen
    const result: any = {
        startingSkills: [],
        startingItems: [],
        startingNPCs: [],
        startingYeuThu: [],
        startingLore: [],
        startingLocations: [],
        startingFactions: [],
        raceCultivationSystems: []
    };
    const extractedSetupTags = extractSatelliteTags(cleanContent || trueRawText, parsedResponse.tags);
    extractedSetupTags.forEach(tag => {
        const match = tag.match(/\[([A-Z_]+)(?::\s*(.*?))?\]/);
        if (match) {
            mapTagToWorldElement(match[1], match[2] || '', result);
        }
    });

    return { response: result, rawText: trueRawText, constructedPrompt: prompt };
};

function mapTagToWorldElement(tagName: string, params: string, result: any) {
    const p = parseAttributes(params);
    const normalizedTag = tagName.toUpperCase();
    
    switch(normalizedTag) {
        case 'GENERATED_SAVE_GAME_NAME': result.saveGameName = p.text || p.name; break;
        case 'GENERATED_DIFFICULTY': result.difficulty = p.text || p.value; break;
        case 'GENERATED_NSFW_MODE': result.nsfwMode = (p.text || p.value) === 'true'; break;
        case 'GENERATED_CULTIVATION_SYSTEM_MAJORS': result.majorRealmsRaw = p.text || p.value; break;
        case 'GENERATED_CULTIVATION_SYSTEM_MINORS': result.minorRealmsRaw = p.text || p.value; break;
        case 'GENERATED_PLAYER_NAME': result.playerName = p.name || p.text; break;
        case 'GENERATED_PLAYER_GENDER': result.playerGender = p.gender || p.name || p.text; break;
        case 'GENERATED_PLAYER_RACE': result.playerRace = p.race || p.name || p.text; break;
        case 'GENERATED_PLAYER_PERSONALITY': result.playerPersonality = p.personality || p.name || p.text; break;
        case 'GENERATED_PLAYER_PERSONALITY_CORE': result.playerPersonalityCore = p.core || p.text; break;
        case 'GENERATED_PLAYER_BACKSTORY': result.playerBackstory = p.backstory || p.name || p.text; break;
        case 'GENERATED_INITIAL_CONTEXT': result.initialContext = p.context || p.name || p.text; break;
        case 'GENERATED_PLAYER_GOAL': result.playerGoal = p.goal || p.name || p.text; break;
        case 'GENERATED_PLAYER_STARTING_TRAITS': result.playerStartingTraits = p.traits || p.name || p.text; break;
        case 'GENERATED_PLAYER_SPIRITUAL_ROOT': result.playerSpiritualRoot = p.spiritualRoot || p.name || p.text; break;
        case 'GENERATED_PLAYER_SPECIAL_PHYSIQUE': result.playerSpecialPhysique = p.specialPhysique || p.name || p.text; break;
        case 'GENERATED_PLAYER_THO_NGUYEN': result.playerThoNguyen = parseInt(p.value || p.text) || 0; break;
        case 'GENERATED_PLAYER_MAX_THO_NGUYEN': result.playerMaxThoNguyen = parseInt(p.value || p.text) || 0; break;
        case 'GENERATED_PLAYER_STARTING_LOCATION_TYPE': result.playerStartingLocationType = p.value || p.type || p.text; break;
        case 'GENERATED_STARTING_CURRENCY': result.startingCurrency = parseInt(p.value || p.text) || 0; break;
        case 'GENERATED_CURRENCY_NAME': result.currencyName = p.name || p.text; break;
        case 'GENERATED_WORLD_THEME': result.worldTheme = p.theme || p.text; break;
        case 'GENERATED_WORLD_SETTING_DESCRIPTION': result.worldSettingDescription = p.description || p.text; break;
        case 'GENERATED_WORLD_WRITING_STYLE': result.worldWritingStyle = p.style || p.text; break;
        case 'GENERATED_GENRE': result.genre = p.genre || p.text; break;
        case 'GENERATED_CUSTOM_GENRE_NAME': result.customGenreName = p.name || p.text; break;
        case 'GENERATED_IS_CULTIVATION_ENABLED': result.isCultivationEnabled = (p.value || p.text) === 'true'; break;
        case 'GENERATED_NSFW_DESCRIPTION_STYLE': result.nsfwDescriptionStyle = p.style || p.text; break;
        case 'GENERATED_VIOLENCE_LEVEL': result.violenceLevel = p.level || p.text; break;
        case 'GENERATED_STORY_TONE': result.storyTone = p.tone || p.text; break;
        case 'GENERATED_ORIGINAL_STORY_SUMMARY': result.originalStorySummary = p.summary || p.text; break;
        case 'GENERATED_TIMELINE_EVENT':
            result.timelineEvents = result.timelineEvents || [];
            const evtCandidate = {
                id: p.id || `event_${result.timelineEvents.length + 1}`,
                periodName: p.periodName || p.era || '',
                eventName: p.eventName || p.name || '',
                description: p.description || p.text || ''
            };
            if (isValidTimelineEvent(evtCandidate)) {
                result.timelineEvents.push(evtCandidate);
            }
            break;
        case 'GENERATED_CANH_GIOI_KHOI_DAU': result.canhGioiKhoiDau = p.realm || p.text; break;
        case 'GENERATED_STARTING_DATE': 
            result.startingDate = {
                day: parseInt(p.day) || 1,
                month: parseInt(p.month) || 1,
                year: parseInt(p.year) || 1,
                timeOfDay: 'Sáng'
            };
            break;
        case 'GENERATED_RACE_SYSTEM': 
            if(!result.raceCultivationSystems) result.raceCultivationSystems = [];
            result.raceCultivationSystems.push({ 
                id: Date.now().toString() + Math.random(), 
                raceName: p.race || p.name || p.text || "Nhân Tộc", 
                realmSystem: p.system || p.text || "" 
            });
            break;
        case 'GENERATED_YEUTHU_SYSTEM': result.yeuThuRealmSystem = p.system || p.text; break;
        case 'GENERATED_UNIFIED_SYSTEM': result.unifiedCultivationSystem = p.system || p.text; break;
        
        case 'GENERATED_SKILL':
            if(!result.startingSkills) result.startingSkills = [];
            const validSkillTypes = ["Công Pháp Tu Luyện", "Linh Kĩ", "Nghề Nghiệp", "Thần Thông", "Cấm Thuật", "Khác"];
            const mappedSkillType = validSkillTypes.includes(p.skillType) ? p.skillType : "Khác";
            result.startingSkills.push({
                name: p.name || p.text,
                description: p.description || p.desc || p.text || "",
                skillType: mappedSkillType,
                manaCost: parseInt(p.manaCost) || 0,
                cooldown: parseInt(p.cooldown) || 0,
                baseDamage: parseInt(p.baseDamage) || 0,
                baseHealing: parseInt(p.baseHealing) || 0,
                damageMultiplier: parseFloat(p.damageMultiplier) || 0,
                healingMultiplier: parseFloat(p.healingMultiplier) || 0,
                specialEffects: p.otherEffects || p.specialEffects,
                congPhapDetails: mappedSkillType === 'Công Pháp Tu Luyện' ? {
                    type: p.congPhapType,
                    grade: p.congPhapGrade,
                    weaponFocus: p.weaponFocus
                } : undefined,
                linhKiDetails: mappedSkillType === 'Linh Kĩ' ? {
                    category: p.linhKiCategory,
                    activation: p.linhKiActivation
                } : undefined,
                professionDetails: mappedSkillType === 'Nghề Nghiệp' ? {
                    type: p.professionType,
                    grade: p.professionGrade,
                    skillDescription: p.skillDescription
                } : undefined,
                camThuatDetails: mappedSkillType === 'Cấm Thuật' ? {
                    sideEffects: p.sideEffects
                } : undefined
            });
            break;

        case 'GENERATED_ITEM':
            if(!result.startingItems) result.startingItems = [];
            const cat = p.category || "Miscellaneous";
            const isEquip = cat.toLowerCase() === 'equipment' || cat === 'Trang bị';
            const isPotion = cat.toLowerCase() === 'potion' || cat === 'Dược phẩm' || cat === 'Đan dược';
            
            result.startingItems.push({
                name: p.name || p.text,
                description: p.description || p.desc || p.text || "",
                quantity: parseInt(p.quantity) || 1,
                category: isEquip ? "Equipment" : (isPotion ? "Potion" : cat),
                rarity: p.rarity || "Phổ Thông",
                itemRealm: p.itemRealm || p.realm,
                value: parseInt(p.value) || 0,
                equipmentDetails: isEquip ? {
                    slot: p.slot || p.equipmentSlot || "Vũ Khí Chính",
                    statBonusesString: p.statBonusesJSON || p.stats || p.statBonuses || "{}",
                    uniqueEffectsString: p.uniqueEffectsList || p.uniqueEffects || ""
                } : undefined,
                potionDetails: isPotion ? {
                    type: p.potionType || "Hồi Phục",
                    effectsString: p.effectsList || p.effects || ""
                } : undefined,
                materialDetails: cat.toLowerCase() === 'material' ? {
                    type: p.materialType
                } : undefined,
                questItemDetails: cat.toLowerCase() === 'questitem' ? {
                    questIdAssociated: p.questIdAssociated
                } : undefined,
                miscDetails: cat.toLowerCase() === 'miscellaneous' ? {
                    usable: p.usable === 'true',
                    consumable: p.consumable === 'true'
                } : undefined
            });
            break;

        case 'GENERATED_NPC':
            if(!result.startingNPCs) result.startingNPCs = [];
            const personality = p.personality?.trim();
            result.startingNPCs.push({
                name: p.name || p.text,
                personality: (personality && personality !== "...") ? personality : "Bí ẩn, có nhiều tâm sự chưa kể",
                details: p.details || p.description || "",
                gender: p.gender || "Không rõ",
                race: p.race || "Nhân Tộc",
                realm: p.realm,
                tuChat: p.tuChat,
                spiritualRoot: p.spiritualRoot,
                specialPhysique: p.specialPhysique,
                thoNguyen: parseInt(p.thoNguyen),
                maxThoNguyen: parseInt(p.maxThoNguyen),
                initialAffinity: parseInt(p.initialAffinity || p.relationship) || 0,
                isWife: p.isWife === 'true',
                isSlave: p.isSlave === 'true',
                relationshipToPlayer: p.relationshipToPlayer || "Người xa lạ"
            });
            break;

        case 'GENERATED_YEUTHU':
            if(!result.startingYeuThu) result.startingYeuThu = [];
            result.startingYeuThu.push({
                name: p.name || p.text,
                species: p.species || p.race,
                description: p.description,
                realm: p.realm,
                loyalty: parseInt(p.loyalty) || 50
            });
            break;

        case 'GENERATED_LORE':
            if(!result.startingLore) result.startingLore = [];
            result.startingLore.push({
                title: p.title || p.name || p.text,
                content: p.content || p.description || ""
            });
            break;

        case 'GENERATED_LOCATION':
            if(!result.startingLocations) result.startingLocations = [];
            result.startingLocations.push({
                name: p.name || p.text,
                description: p.description || "",
                locationType: p.locationType || "Default",
                isSafeZone: p.isSafeZone === 'true',
                regionId: p.regionId,
                mapX: parseInt(p.mapX),
                mapY: parseInt(p.mapY)
            });
            break;

        case 'GENERATED_FACTION':
            if(!result.startingFactions) result.startingFactions = [];
            result.startingFactions.push({
                name: p.name || p.text,
                description: p.description || "",
                alignment: p.alignment || "Trung Lập",
                initialPlayerReputation: parseInt(p.initialPlayerReputation) || 0
            });
            break;

        case 'QUEST_ASSIGNED':
        case 'GENERATED_QUEST_ASSIGNED':
            if(!result.initialQuests) result.initialQuests = [];
            const questCandidate = {
                title: p.title || p.name || p.text,
                description: p.description || "",
                rewardText: p.reward || p.rewardText,
                duration: parseInt(p.durationTurns || p.duration) || 0
            };
            if (isValidQuest(questCandidate)) {
                result.initialQuests.push(questCandidate);
            }
            break;

        case 'MAIN_QUEST_SETUP':
        case 'GENERATED_MAIN_QUEST_SETUP':
            try {
                // Try to parse from p.chaptersJSON if it exists, otherwise try to parse the whole params if it looks like JSON
                const chaptersStr = p.chaptersJSON || (params.trim().startsWith('[') ? params.trim() : null);
                if (chaptersStr) {
                    const chapters = safeJsonParse(chaptersStr);
                    const parsedChapters = chapters.map((c: any, i: number) => ({
                        id: c.id || `chapter-${i}`,
                        title: c.title || `Chương ${i + 1}`,
                        description: c.description || c.objective || c.text || "",
                        isCompleted: false,
                        order: i
                    }));
                    result.mainQuest = {
                        id: Date.now().toString(),
                        title: p.title || "Hành Trình Khởi Đầu",
                        description: p.description || "Cốt truyện chính được tạo bởi AI",
                        chapters: sanitizeQuests(parsedChapters)
                    };
                }
            } catch (e) {
                console.error("Failed to parse main quest chapters", e);
            }
            break;
    }
}
// Helper to parse key="value" string (Same as parseTagValue in utils but inline to avoid circular dep if any)
const parseTagValue = (str: string): Record<string, string> => {
    return parseAttributes(str);
};

import { TimelineAccuracyService } from './TimelineAccuracyService';
import { sanitizeTimelineEvents, sanitizeQuests, isValidTimelineEvent, isValidQuest } from '../utils/sanitizeUtils';

export const generateTimelineEventsService = async (
    originalStorySummary: string,
    worldTheme: string,
    canonData?: string,
    onPromptLog?: (p: string) => void,
    onChunk?: (text: string) => void,
    onProgress?: (msg: string) => void
): Promise<{events: any[], rawText: string}> => {
    // Bước 1: Tra cứu bản địa bằng Google Search Grounding sử dụng model Economy
    let accuracyContext = '';
    try {
        const accuracyResult = await TimelineAccuracyService.getAccuracyContext(worldTheme, originalStorySummary, onProgress);
        accuracyContext = accuracyResult.accuracyContext;
    } catch (err) {
        console.warn('Lỗi tra cứu accuracyContext trong generateTimelineEventsService:', err);
    }

    // Bước 2: Nạp prompt sinh Timeline có kèm dữ liệu đối chiếu chuẩn xác
    const prompt = PROMPT_FUNCTIONS.generateTimelineEvents(originalStorySummary, worldTheme, canonData, accuracyContext);
    
    const { rawText, cleanContent } = await streamSetupTaskWithPrefill(
        prompt,
        "<tuong_than>",
        (accumulatedText) => {
            if (onChunk) onChunk(accumulatedText);
        },
        onPromptLog,
        'economy'
    );
    
    const events: any[] = [];
    const eventRegex = /\[GENERATED_TIMELINE_EVENT:\s*(.*?)\]/g;
    let match;
    while ((match = eventRegex.exec(cleanContent)) !== null) {
        const p = parseAttributes(match[1]);
        const charNamesStr = p.characters || p.characterList || p.nhan_vat || p.chars || '';
        const characters = charNamesStr ? charNamesStr.split(',').map((c: string) => c.trim()).filter(Boolean) : [];
        events.push({
            id: p.id || `event_${events.length + 1}`,
            periodName: p.periodName || p.era || '',
            eventName: p.eventName || p.name || '',
            description: p.description || p.text || '',
            location: p.location || p.vi_tri || p.place || '',
            characters: characters,
            requiredAction: p.requiredAction || p.action || p.hanh_dong_bat_buoc || p.goal || ''
        });
    }
    
    return {events: sanitizeTimelineEvents(events), rawText};
};

export const appendTimelineEventsService = async (
    lastEvents: any[],
    worldTheme: string,
    originalStorySummary: string = '',
    canonData?: string,
    startIndex: number = 11,
    onPromptLog?: (p: string) => void,
    onChunk?: (text: string) => void,
    onProgress?: (msg: string) => void
): Promise<{events: any[], rawText: string}> => {
    // Bước 1: Tra cứu bản địa bằng Google Search Grounding sử dụng model Economy
    let accuracyContext = '';
    try {
        const accuracyResult = await TimelineAccuracyService.getAccuracyContext(worldTheme, originalStorySummary, onProgress);
        accuracyContext = accuracyResult.accuracyContext;
    } catch (err) {
        console.warn('Lỗi tra cứu accuracyContext trong appendTimelineEventsService:', err);
    }

    // Bước 2: Nạp prompt nối tiếp Timeline có kèm dữ liệu đối chiếu chuẩn xác
    const prompt = PROMPT_FUNCTIONS.appendTimelineEvents(lastEvents, originalStorySummary, worldTheme, canonData, startIndex, accuracyContext);
    
    const { rawText, cleanContent } = await streamSetupTaskWithPrefill(
        prompt,
        "<tuong_than>",
        (accumulatedText) => {
            if (onChunk) onChunk(accumulatedText);
        },
        onPromptLog,
        'economy'
    );
    
    const events: any[] = [];
    const eventRegex = /\[GENERATED_TIMELINE_EVENT:\s*(.*?)\]/g;
    let match;
    while ((match = eventRegex.exec(cleanContent)) !== null) {
        const p = parseAttributes(match[1]);
        const charNamesStr = p.characters || p.characterList || p.nhan_vat || p.chars || '';
        const characters = charNamesStr ? charNamesStr.split(',').map((c: string) => c.trim()).filter(Boolean) : [];
        events.push({
            id: p.id || `event_append_${Date.now()}_${events.length + 1}`,
            periodName: p.periodName || p.era || '',
            eventName: p.eventName || p.name || '',
            description: p.description || p.text || '',
            location: p.location || p.vi_tri || p.place || '',
            characters: characters,
            requiredAction: p.requiredAction || p.action || p.hanh_dong_bat_buoc || p.goal || ''
        });
    }
    
    return {events: sanitizeTimelineEvents(events), rawText};
};


export const generateFanfictionWorldDetails = async (
    sourceMaterial: string,
    isSourceContent: boolean,
    playerDescription: string,
    nsfwMode: boolean,
    genre: any,
    isCultivationEnabled: boolean,
    violenceLevel: any,
    storyTone: any,
    customGenreName?: string,
    nsfwDescriptionStyle?: any,
    onPromptLog?: (p: string) => void,
    useDeepGrounding: boolean = false
): Promise<{response: any, rawText: string, constructedPrompt: string}> => {
    const dummySettings: WorldSettings = {
         ...{} as any,
        nsfwMode, genre, isCultivationEnabled, violenceLevel, storyTone, customGenreName, nsfwDescriptionStyle, useDeepGrounding
    };
    const prompt = PROMPT_FUNCTIONS.generateFanfictionWorldDetails(sourceMaterial, isSourceContent, dummySettings, playerDescription);
    const { text: rawText } = await callGeminiAPI(prompt, onPromptLog, 'main', undefined, undefined, useDeepGrounding);
    
    // Reuse mapping logic (simplified)
    const parsedResponse = parseAiResponseText(rawText);
    const result: any = {
        startingSkills: [],
        startingItems: [],
        startingNPCs: [],
        startingYeuThu: [],
        startingLore: [],
        startingLocations: [],
        startingFactions: [],
        raceCultivationSystems: []
    };
    const extractedSetupTags = extractSatelliteTags(rawText, parsedResponse.tags);
    extractedSetupTags.forEach(tag => {
        const match = tag.match(/\[([A-Z_]+)(?::\s*(.*?))?\]/);
        if (match) {
            mapTagToWorldElement(match[1], match[2] || '', result);
        }
    });
    
    return { response: result, rawText, constructedPrompt: prompt };
};

export const generateCompletionForWorldDetails = async (
    settings: WorldSettings,
    onPromptLog?: (p: string) => void,
    onModelUsed?: (m: string) => void,
    canonData?: string,
    customPrompt?: string,
    onChunk?: (text: string) => void
): Promise<{response: any, rawText: string, constructedPrompt: string}> => {
     let prompt = PROMPT_FUNCTIONS.completeWorldDetails(
         settings, settings.nsfwMode, settings.genre, settings.isCultivationEnabled, 
         settings.violenceLevel!, settings.storyTone!, settings.customGenreName, settings.nsfwDescriptionStyle,
         canonData
    );

     if (customPrompt) {
         prompt += `\n\n[YÊU CẦU ĐẶC BIỆT TỪ NGƯỜI CHƠI - ƯU TIÊN SỐ 1]:\n${customPrompt}\n\nHãy đảm bảo mọi nội dung tạo ra đều tuân thủ nghiêm ngặt yêu cầu này của người chơi.`;
     }

     const { rawText, cleanContent } = await streamSetupTaskWithPrefill(
         prompt,
         "<tuong_than>",
         (accumulatedText) => {
             if (onChunk) onChunk(accumulatedText);
         },
         onPromptLog,
         'main',
         settings.useDeepGrounding || false
     );
     
     const parsedResponse = parseAiResponseText(cleanContent);
     const result: any = {
        startingSkills: [],
        startingItems: [],
        startingNPCs: [],
        startingYeuThu: [],
        startingLore: [],
        startingLocations: [],
        startingFactions: [],
        raceCultivationSystems: []
    };
     const extractedSetupTags = extractSatelliteTags(cleanContent || rawText, parsedResponse.tags);
     extractedSetupTags.forEach(tag => {
        const match = tag.match(/\[([A-Z_]+)(?::\s*(.*?))?\]/);
        if (match) {
            mapTagToWorldElement(match[1], match[2] || '', result);
        }
     });

     return { response: result, rawText, constructedPrompt: prompt };
};

/**
 * Generates character details based on a character name and world context.
 * Specifically requested for the "AI Support" button in the Character & Story tab.
 */
export const generateCharacterDetailsFromName = async (
  settings: WorldSettings,
  onPromptLog?: (p: string) => void,
  customPrompt?: string,
  onChunk?: (text: string) => void
): Promise<{ response: any; rawText: string; constructedPrompt: string }> => {
  const worldContext = `${settings.theme}. ${settings.settingDescription}. ${settings.isCultivationEnabled ? `Hệ thống tu luyện: ${settings.cultivationSystem.majorRealmsRaw}` : ""}`;
  
  let prompt = `
    Dựa trên tên nhân vật "${settings.playerName}" và bối cảnh thế giới: "${worldContext}".
    Hãy viết lại toàn bộ thông tin chi tiết cho nhân vật này theo đúng nội dung của tác phẩm gốc (nếu là nhân vật nổi tiếng) hoặc sáng tạo một cách logic và hấp dẫn.
    
    ${customPrompt ? `
    [DỮ LIỆU HIỆN TẠI - HÃY DỰA VÀO ĐÂY ĐỂ VIẾT TIẾP HOẶC CHỈNH SỬA]:
    - Giới tính: ${settings.playerGender}
    - Chủng tộc: ${settings.playerRace}
    - Tính cách: ${settings.playerPersonality}
    - Tiểu sử: ${settings.playerBackstory}
    - Mục tiêu: ${settings.playerGoal}
    - Đặc điểm: ${settings.playerStartingTraits}
    ` : ""}

    Trả về kết quả dưới dạng các tag sau (Sử dụng thuộc tính text="..." hoặc value="..." bọc trong nháy kép để tránh lỗi phân tách khoảng trắng):
    [GENERATED_PLAYER_GENDER: text="Nam/Nữ/Khác"]
    [GENERATED_PLAYER_RACE: text="Tên chủng tộc"]
    [GENERATED_PLAYER_PERSONALITY: text="Mô tả tính cách chi tiết"]
    [GENERATED_PLAYER_PERSONALITY_CORE: core="Mô tả quy tắc đạo đức cốt lõi của nhân vật, ví dụ: 'MC là người lý trí và nhân hậu, tuyệt đối không hắc hóa hay trở nên tàn bạo khi đối đầu với nghịch cảnh'"]
    [GENERATED_PLAYER_BACKSTORY: text="Tiểu sử cuộc đời chi tiết"]
    [GENERATED_INITIAL_CONTEXT: text="Mô tả bối cảnh ban đầu mà câu chuyện bắt đầu"]
    [GENERATED_PLAYER_GOAL: text="Mục tiêu chính của nhân vật"]
    [GENERATED_PLAYER_STARTING_TRAITS: text="Đặc điểm ngoại hình và khả năng đặc biệt"]
    [GENERATED_PLAYER_SPIRITUAL_ROOT: text="Linh căn (nếu có)"]
    [GENERATED_PLAYER_SPECIAL_PHYSIQUE: text="Thể chất đặc biệt (nếu có)"]
    [GENERATED_PLAYER_THO_NGUYEN: value=100]
    [GENERATED_PLAYER_MAX_THO_NGUYEN: value=120]
    [GENERATED_CURRENCY_NAME: text="Tên đơn vị tiền tệ"]
    [GENERATED_STARTING_CURRENCY: value=1000]
    [GENERATED_PLAYER_STARTING_LOCATION_TYPE: text="Loại địa điểm bắt đầu (vd: Thành thị, Rừng rậm, Tông môn...)"]
    
    Chỉ trả về các tag trên, không thêm văn bản thừa.
  `;

  if (customPrompt) {
    prompt += `\n\n[YÊU CẦU ĐẶC BIỆT TỪ NGƯỜI CHƠI - QUAN TRỌNG NHẤT]:
    "${customPrompt}"
    
    HƯỚNG DẪN: Luôn ưu tiên thực hiện yêu cầu này của người chơi. Đây là yêu cầu VIẾT THÊM/CHỈNH SỬA, hãy giữ lại các thông tin cũ nếu chúng không mâu thuẫn với yêu cầu mới.`;
  }

  try {
    const { rawText, cleanContent } = await streamSetupTaskWithPrefill(
        prompt,
        "<tuong_than>",
        (accumulatedText) => {
            if (onChunk) onChunk(accumulatedText);
        },
        onPromptLog,
        'main'
    );
    
    const parsedResponse = parseAiResponseText(cleanContent);
    const result: any = {};
    const extractedSetupTags = extractSatelliteTags(cleanContent || rawText, parsedResponse.tags);
    extractedSetupTags.forEach(tag => {
      const match = tag.match(/\[([A-Z_]+)(?::\s*(.*?))?\]/);
      if (match) {
        mapTagToWorldElement(match[1], match[2] || '', result);
      }
    });
    return { response: result, rawText, constructedPrompt: prompt };
  } catch (error) {
    console.error("Generate character details failed:", error);
    throw error;
  }
};

export const rewriteWorldSettingsAI = async (
  settings: WorldSettings,
  customPrompt: string,
  onPromptLog?: (p: string) => void,
  onChunk?: (text: string) => void
): Promise<{ response: any; rawText: string; constructedPrompt: string }> => {
  const prompt = PROMPT_FUNCTIONS.rewriteWorldSettings(settings, customPrompt);

  try {
    const { rawText, cleanContent } = await streamSetupTaskWithPrefill(
        prompt,
        "<tuong_than>",
        (accumulatedText) => {
            if (onChunk) onChunk(accumulatedText);
        },
        onPromptLog,
        'main'
    );
    const parsedResponse = parseAiResponseText(cleanContent);
    const result: any = {};
    const extractedSetupTags = extractSatelliteTags(cleanContent || rawText, parsedResponse.tags);
    extractedSetupTags.forEach(tag => {
      const match = tag.match(/\[([A-Z_]+)(?::\s*(.*?))?\]/);
      if (match) {
        mapTagToWorldElement(match[1], match[2] || '', result);
      }
    });
    return { response: result, rawText, constructedPrompt: prompt };
  } catch (error) {
    console.error("Rewrite world settings failed:", error);
    throw error;
  }
};

/**
 * AI function to rewrite starting elements based on world settings and context.
 */
export const rewriteStartingElementsAI = async (
  settings: WorldSettings,
  selectedWork?: FanficWork | null,
  onPromptLog?: (p: string) => void,
  customPrompt?: string
): Promise<any> => {
  const canonContext = selectedWork ? `Dựa trên bối cảnh CANON của tác phẩm "${selectedWork.title}": ${selectedWork.description}` : "";

  const cultivationContext = settings.isCultivationEnabled ? `
    [HỆ THỐNG TU LUYỆN HIỆN TẠI]
    - Đại cảnh giới: ${settings.cultivationSystem.majorRealmsRaw}
    - Tiểu cảnh giới: ${settings.cultivationSystem.minorRealmsRaw}
    - Cảnh giới khởi đầu của người chơi: ${settings.canhGioiKhoiDau}
  ` : "";

  // Tạo tóm tắt dữ liệu hiện tại để AI biết và bổ sung
  const currentSummary = customPrompt ? `
    [DỮ LIỆU HIỆN TẠI - DÙNG ĐỂ THAM CHIẾU VÀ VIẾT THÊM]
    - Số lượng Kỹ năng: ${settings.startingSkills.length} (${settings.startingSkills.map(s => s.name).join(', ')})
    - Số lượng Vật phẩm: ${settings.startingItems.length} (${settings.startingItems.map(i => i.name).join(', ')})
    - Số lượng NPC: ${settings.startingNPCs.length} (${settings.startingNPCs.map(n => n.name).join(', ')})
    - Số lượng Địa điểm: ${settings.startingLocations.length} (${settings.startingLocations.map(l => l.name).join(', ')})
  ` : "";

  let prompt = `
    ${canonContext}
    ${cultivationContext}
    ${currentSummary}
    Dựa trên thiết lập thế giới và nhân vật sau đây, hãy tạo lại TOÀN BỘ "Yếu tố khởi đầu" (Kỹ năng, Vật phẩm, NPC, Phe phái, Địa điểm, v.v.) để chúng hoàn toàn khớp với bối cảnh và cốt truyện.
    
    [YÊU CẦU SỐ LƯỢNG MẶC ĐỊNH]
    - Tạo ra ÍT NHẤT 10 NPC Khởi đầu ([GENERATED_NPC]).
    - Tạo ra ÍT NHẤT 4 Kỹ năng Khởi đầu ([GENERATED_SKILL]).
    - Tạo ra ÍT NHẤT 4 Vật phẩm Khởi đầu ([GENERATED_ITEM]).
    - Tạo ra ÍT NHẤT 5 Tri thức Thế giới/Truyền thuyết ([GENERATED_LORE]).

    [THIẾT LẬP THẾ GIỚI]
    - Chủ đề: ${settings.theme}
    - Mô tả: ${settings.settingDescription}
    - Thể loại: ${settings.genre} ${settings.customGenreName ? `(${settings.customGenreName})` : ""}

    [NHÂN VẬT & CỐT TRUYỆN]
    - Tên: ${settings.playerName}
    - Tiểu sử: ${settings.playerBackstory}
    - Bối cảnh ban đầu: ${settings.initialContext}
    - Mục tiêu: ${settings.playerGoal}

    [YÊU CẦU QUAN TRỌNG]
    1. NPC: 
       - Luôn để độ thiện cảm (initialAffinity) là 0. Tuyệt đối không được khác 0.
       - BẮT BUỘC điền đầy đủ tất cả các nội dung của NPC.
       - Cảnh giới NPC (realm): Phải điền dựa trên tính toán logic.
    2. Kỹ năng & Vật phẩm: Phải phù hợp với xuất thân, bối cảnh ban đầu.
    3. Địa điểm: Phải là những nơi nhân vật có thể xuất hiện lúc bắt đầu câu chuyện.

    Hãy trả về kết quả dưới dạng các tag sau (BẮT BUỘC ĐIỀN ĐỦ THÔNG TIN, KHÔNG ĐƯỢC ĐỂ TRỐNG CÁC TRƯỜNG QUAN TRỌNG):
    [GENERATED_SKILL: name="..." description="..." skillType="..." manaCost="..." cooldown="..." baseDamage="..." baseHealing="..." damageMultiplier="..." healingMultiplier="..." specialEffects="..."]
    [GENERATED_ITEM: name="..." description="..." quantity="..." category="Equipment" rarity="..." itemRealm="..." slot="..." statBonusesJSON="..." uniqueEffectsList="..."]
    
    YÊU CẦU CHI TIẾT VẬT PHẨM:
    - name: Tên vật phẩm.
    - category: Phải là "Equipment" (Trang bị), "Potion" (Đan dược), "Material" (Nguyên liệu).
    - Bối cảnh: Khoa Huyễn/Tiên Hiệp/Võ Hiệp...
    - Vật phẩm (GENERATED_ITEM):
        * name: Tên vật phẩm.
        * category: LUÔN LÀ "Equipment" nếu là trang bị.
        * rarity: Phổ Thông | Hiếm | Quý Báu | Cực Phẩm | Thần Thoại | Chí Tôn.
        * itemRealm: Cảnh giới (VD: "Luyện Khí").
        * slot: Vị trí (Vũ Khí Chính, Giáp Thân, Giáp Đầu, Pháp Bảo, Trang Sức...).
        * statBonusesJSON: JSON chỉ số. BẮT BUỘC chỉ sử dụng các key sau: 
            + maxSinhLuc (HP cộng thêm)
            + maxLinhLuc (MP cộng thêm)
            + sucTanCong (Sát thương cộng thêm)
            + phongNgu (Phòng thủ cộng thêm)
          Ví dụ: {"sucTanCong": 15, "maxSinhLuc": 100}
        * uniqueEffectsList: Các hiệu ứng cách nhau bởi ';'.
    
    [GENERATED_NPC: name="..." personality="..." details="..." gender="..." race="..." realm="..." tuChat="..." spiritualRoot="..." specialPhysique="..." thoNguyen="..." maxThoNguyen="..." initialAffinity="0" pride="50" survivalInstinct="..." resentmentCounter="0" relationshipToPlayer="..."]
    
    YÊU CẦU ĐẶC BIỆT NPC:
    - pride: Lòng tự tôn, kiêu hãnh (0-100). Bắt buộc phải có để quyết định thái độ khi bị khuất phục.
    - survivalInstinct: Bản năng sinh tồn, cách NPC đối mặt với cái chết (VD: "Đàm phán", "Van xin", "Thà chết không chịu nhục").
    - resentmentCounter: Mặc định là 0.
    
    [GENERATED_FACTION: name="..." description="..." alignment="..." initialPlayerReputation="..."]
    [GENERATED_LOCATION: name="..." description="..." locationType="..." isSafeZone="..." regionId="..." mapX="..." mapY="..."]
    [GENERATED_LORE: title="..." content="..."]

    Lưu ý: 
    - Không thêm bất kỳ văn bản giải thích nào ngoài các tag.
  `;

  if (customPrompt) {
    prompt += `\n\n[YÊU CẦU ĐẶC BIỆT TỪ NGƯỜI CHƠI - QUAN TRỌNG NHẤT]:
    "${customPrompt}"
    
    HƯỚNG DẪN VIẾT THÊM (ADDITIVE):
    - Đừng xóa các nội dung cũ trừ khi yêu cầu là ghi đè hoặc xóa.
    - Nếu yêu cầu là 'thêm', hãy tạo thêm các thực thể mới và trả về CÙNG VỚI danh sách cũ.
    - Mục tiêu cuối cùng là kết hợp hài hòa nội dung hiện tại và yêu cầu mới.
    - Trả về TOÀN BỘ danh sách mong muốn sau khi đã được bổ sung/chỉnh sửa.
    `;
  }

  const { text: rawText } = await callGeminiAPI(prompt, onPromptLog, 'main');
  const parsedResponse = parseAiResponseText(rawText);
  const result: any = {
    startingSkills: [],
    startingItems: [],
    startingNPCs: [],
    startingYeuThu: [],
    startingLore: [],
    startingLocations: [],
    startingFactions: [],
  };

  const extractedSetupTags = extractSatelliteTags(rawText, parsedResponse.tags);
  extractedSetupTags.forEach((tag) => {
    const match = tag.match(/\[([A-Z_]+)(?::\s*(.*?))?\]/);
    if (match) {
      mapTagToWorldElement(match[1], match[2] || "", result);
    }
  });

  return result;
};

export const generateEcoZoneDetails = async (
  knowledgeBase: KnowledgeBase,
  zoneStub: EconomicZoneStub,
  currentPageMessagesLog: string,
  previousPageSummaries: string[],
  onPromptLog?: (p: string) => void
): Promise<{response: any, rawText: string}> => {
  const prompt = PROMPT_FUNCTIONS.generateEcoZoneDetails(
      knowledgeBase, 
      zoneStub, 
      currentPageMessagesLog, 
      previousPageSummaries
  );
  
  const rawText = await generateGameResponseStream(prompt, '', () => {}, undefined, undefined, undefined, false, 'secondary');
  const parsedResponse = parseAiResponseText(rawText);
  
  // Also perform tag extraction for better data reliability
  const extractedTags = await DataExtractionService.extractTags(rawText, knowledgeBase);
  const allTags = [...(parsedResponse.tags || []), ...extractedTags];
  
  return { 
      response: { 
          narration: parsedResponse.narration, 
          tags: allTags 
      }, 
      rawText 
  };
};

export const generateCraftedItemViaAI = async (
    category: ItemCategoryValues, 
    requirements: string, 
    materials: any[], 
    stats: PlayerStats, 
    config: any,
    pageLog: string,
    summaries: string[],
    lastNarration: string | undefined,
    onPromptLog?: (p: string) => void
) => {
    const prompt = PROMPT_FUNCTIONS.craftItem(category, requirements, materials, stats, config, pageLog, summaries, lastNarration);
    const rawText = await generateGameResponseStream(prompt, '', () => {}, undefined, undefined, undefined, false, 'secondary');
    const parsed = parseAiResponseText(rawText);
    const tags = extractSatelliteTags(rawText, parsed.tags);
    return { response: { ...parsed, tags }, rawText, tags };
};

import { sanitizeCombatAnalysis } from '../utils/combatDataSanitizer';

export const analyzeCombatants = async (
    kb: KnowledgeBase,
    currentNarration: string,
    previousNarration: string,
    onPromptLog?: (p: string) => void
): Promise<{ 
    isCombatConfirmed: boolean, 
    reasoning: string, 
    opponents: AnalyzedCombatant[], 
    allies: AnalyzedCombatant[], 
    neutrals: AnalyzedCombatant[],
    participants: AnalyzedParticipant[],
    modelUsed: string,
    updatedKb?: KnowledgeBase 
}> => {
    try {
        // Use the new analysis service
        const analysis = await analyzeCombatantsService(kb, currentNarration, previousNarration, onPromptLog);
        const { opponentIds, allyIds } = resolveCombatantIds(analysis, kb);
        const updatedKb = kb; // updated in place by resolveCombatantIds

        // Map the result back to the expected format for the hook
        const getCombatantInfo = (id: string): AnalyzedCombatant => {
            const entity = [
                ...(kb.discoveredNPCs || []),
                ...(kb.discoveredYeuThu || []),
                ...(kb.wives || []),
                ...(kb.slaves || []),
                ...(kb.prisoners || [])
            ].find(e => e.id === id);

            return {
                name: entity?.name || id,
                powerLevel: entity?.realm || "Phàm Nhân",
                description: entity?.description || "",
                isNew: false,
                quantity: 1
            };
        };

        const opponents = opponentIds.map(getCombatantInfo);
        const allies = allyIds.map(getCombatantInfo);
        const neutrals: AnalyzedCombatant[] = [];

        const getParticipantInfo = (id: string, side: 'enemy' | 'player'): AnalyzedParticipant => {
            const info = getCombatantInfo(id);
            return {
                side: side as any,
                isPlural: false,
                originalNameInText: info.name,
                action: side === 'enemy' ? 'attack' : 'help',
                name: info.name,
                powerLevel: info.powerLevel,
                description: info.description,
                isNew: false,
                location: 'unknown'
            };
        };

        return {
            isCombatConfirmed: opponentIds.length > 0 || allyIds.length > 0,
            reasoning: analysis.reasoning,
            opponents,
            allies,
            neutrals,
            participants: [
                ...opponentIds.map(id => getParticipantInfo(id, 'enemy')),
                ...allyIds.map(id => getParticipantInfo(id, 'player'))
            ],
            modelUsed: "gemini-3.1-flash-lite-preview",
            updatedKb
        };
    } catch (e) {
        console.error("Error in analyzeCombatants refactored:", e);
        return { 
            isCombatConfirmed: false, 
            reasoning: "Lỗi hệ thống khi phân tích chiến đấu.", 
            opponents: [], 
            allies: [], 
            neutrals: [],
            participants: [],
            modelUsed: "gemini-3.1-flash-lite-preview",
            updatedKb: kb
        };
    }
};

export const generateCombatTurn = async (
    kb: any, 
    action: string, 
    log: string[], 
    pageLog: string, 
    summaries: string[], 
    lastNarration: string | undefined,
    onPromptLog?: (p: string) => void
) => {
    const deathWarningText = getDeathNarrativeWarning(kb);
    const origMcName = kb?.worldConfig?.originalPlayerName || kb?.playerStats?.originalPlayerName || kb?.worldConfig?.playerName || kb?.playerStats?.name || "Người chơi";
    const currMcName = kb?.worldConfig?.playerName || kb?.playerStats?.name || "Người chơi";
    const highlightedUserInput = formatUserInputBlock(action, undefined, deathWarningText, undefined, origMcName, currMcName);
    let prompt = highlightedUserInput + "\n" + PROMPT_FUNCTIONS.combatTurn(kb, action, log, pageLog, summaries, lastNarration);
    prompt += "\n\n" + buildChoicePrompt(kb);
    let modelUsed = "";
    const { text: rawText, modelUsed: usedModel } = await callGeminiAPI(prompt, onPromptLog, 'combat', (m) => modelUsed = m);
    modelUsed = usedModel;
    // Helper to parse combat specific tags
    const parsed = parseAiResponseText(rawText);
    
    // Parse [COMBAT_STAT_UPDATE] tags
    const statUpdates: {targetId: string, stat: string, change: number}[] = [];
    parsed.tags.forEach(tag => {
        if(tag.includes("COMBAT_STAT_UPDATE")) {
             const p = parseTagValue(tag.match(/\[.*:(.*)\]/)![1]);
             statUpdates.push({ targetId: p.targetId, stat: p.stat, change: parseInt(p.change) });
        }
    });

    return { 
        response: { 
            narration: parsed.narration, 
            tags: parsed.tags, 
            choices: parsed.choices, 
            statUpdates,
            combatEnd: parsed.tags.some(t => t.includes("COMBAT_END")) ? 'end' : null,
            modelUsed
        }, 
        rawText 
    };
};

export const summarizeCombat = async (
    log: string[], 
    outcome: any, 
    onPromptLog?: (p: string) => void,
    mvpDetails?: { name: string, damage: number, kills: number }
): Promise<string> => {
    const prompt = PROMPT_FUNCTIONS.summarizeCombat(log, outcome, mvpDetails);
    const rawText = await generateGameResponseStream(prompt, '', () => {}, undefined, undefined, undefined, false, 'secondary');
    return rawText;
}

export const generateDefeatConsequence = async (
    kb: KnowledgeBase, 
    combatResult: CombatEndPayload, 
    pageLog: string, 
    summaries: string[], 
    lastNarration: string | undefined,
    currentCombatSummary: string,
    onPromptLog?: (p: string) => void,
    onChunk?: (text: string) => void,
    signal?: AbortSignal
) => {
    const apiSettings = getApiSettings();
    const { useDeepReasoning, slowThinking, apiKeySource } = apiSettings;
    const isProxy = apiKeySource === 'proxy';
    const prompt = PROMPT_FUNCTIONS.generateDefeatConsequence(kb, combatResult, pageLog, summaries, lastNarration, currentCombatSummary);
    const finalPrompt = injectPreviousNarrationIntoPrompt(prompt, kb, pageLog, lastNarration);
    const systemInstruction = getEnforcedSystemInstruction(true, 1500, 1800, kb.isNsfwSceneActive, kb, undefined, useDeepReasoning, slowThinking);
    
    let rawText = "";
    if (onChunk) {
        rawText = await generateGameResponseStream(
            finalPrompt,
            '',
            onChunk,
            signal,
            undefined,
            systemInstruction,
            false,
            'main',
            undefined,
            undefined,
            "Tạo hậu quả chiến bại",
            isProxy,
            isProxy ? "</tuong_than>\n<thinking>\n" : ""
        );
    } else {
        const res = await callGeminiAPI(
            finalPrompt, 
            onPromptLog, 
            'main', 
            undefined, 
            systemInstruction, 
            undefined, 
            undefined, 
            undefined, 
            undefined, 
            "Tạo hậu quả chiến bại", 
            undefined, 
            isProxy, 
            isProxy ? "</tuong_than>\n<thinking>\n" : ""
        );
        rawText = res.text;
    }
    
    const parsed = parseAiResponseText(rawText);
    const tags = extractSatelliteTags(rawText, parsed.tags);
    return { response: { ...parsed, tags }, rawText, tags };
};

export const generateVictoryConsequence = async (
    kb: KnowledgeBase, 
    combatResult: CombatEndPayload, 
    pageLog: string, 
    summaries: string[], 
    lastNarration: string | undefined,
    currentCombatSummary: string,
    onPromptLog?: (p: string) => void,
    onChunk?: (text: string) => void,
    signal?: AbortSignal
) => {
    const apiSettings = getApiSettings();
    const { useDeepReasoning, slowThinking, apiKeySource } = apiSettings;
    const isProxy = apiKeySource === 'proxy';
    const prompt = PROMPT_FUNCTIONS.generateVictoryConsequence(kb, combatResult, pageLog, summaries, lastNarration, currentCombatSummary);
    const finalPrompt = injectPreviousNarrationIntoPrompt(prompt, kb, pageLog, lastNarration);
    const systemInstruction = getEnforcedSystemInstruction(true, 1500, 1800, kb.isNsfwSceneActive, kb, undefined, useDeepReasoning, slowThinking);

    let rawText = "";
    if (onChunk) {
        rawText = await generateGameResponseStream(
            finalPrompt,
            '',
            onChunk,
            signal,
            undefined,
            systemInstruction,
            false,
            'main',
            undefined,
            undefined,
            "Tạo hậu quả thắng lợi",
            isProxy,
            isProxy ? "</tuong_than>\n<thinking>\n" : ""
        );
    } else {
        const res = await callGeminiAPI(
            finalPrompt, 
            onPromptLog, 
            'main', 
            undefined, 
            systemInstruction, 
            undefined, 
            undefined, 
            undefined, 
            undefined, 
            "Tạo hậu quả thắng lợi", 
            undefined, 
            isProxy, 
            isProxy ? "</tuong_than>\n<thinking>\n" : ""
        );
        rawText = res.text;
    }

    const parsed = parseAiResponseText(rawText);
    const tags = extractSatelliteTags(rawText, parsed.tags);
    return { response: { ...parsed, tags }, rawText, tags };
};


export const generateNonCombatDefeatConsequence = async (
    kb: KnowledgeBase,
    pageLog: string,
    summaries: string[],
    fatalNarration: string,
    lastNarration: string | undefined,
    onPromptLog?: (p: string) => void
) => {
    const apiSettings = getApiSettings();
    const isProxy = apiSettings.apiKeySource === 'proxy';
    const prompt = PROMPT_FUNCTIONS.generateNonCombatDefeatConsequence(kb, pageLog, summaries, fatalNarration, lastNarration);
    const finalPrompt = injectPreviousNarrationIntoPrompt(prompt, kb, pageLog, lastNarration);
    const { text: rawText } = await callGeminiAPI(
        finalPrompt, 
        onPromptLog, 
        'secondary', 
        undefined, 
        getEnforcedSystemInstruction(true, 1500, 1800, kb.isNsfwSceneActive, kb, undefined, apiSettings.useDeepReasoning, apiSettings.slowThinking),
        undefined,
        undefined,
        undefined,
        undefined,
        "Tạo hậu quả phi chiến đấu",
        undefined,
        isProxy,
        isProxy ? "</tuong_than>\n<thinking>\n" : ""
    );
    const parsed = parseAiResponseText(rawText);
    const tags = extractSatelliteTags(rawText, parsed.tags);
    return { response: { ...parsed, tags }, rawText, tags };
};

export const generateAuctionData = async (kb: KnowledgeBase, onPromptLog?: (p: string) => void) => {
    const apiSettings = getApiSettings();
    const prompt = PROMPT_FUNCTIONS.generateAuctionData(kb);
    const rawText = await generateGameResponseStream(prompt, '', () => {}, undefined, undefined, getBaseSystemInstruction(false, undefined, apiSettings.useDeepReasoning, apiSettings.slowThinking, apiSettings.useExclusiveAccessoryPrompt, apiSettings.exclusivePromptSections), false, 'economy');
    const parsed = parseAiResponseText(rawText);
    const tags = extractSatelliteTags(rawText, parsed.tags);
    return { response: { ...parsed, tags }, rawText, tags };
}

export const runAuctionTurn = async (kb: KnowledgeBase, item: AuctionItem, bid: number, onPromptLog?: (p: string) => void) => {
    const apiSettings = getApiSettings();
    const prompt = PROMPT_FUNCTIONS.runAuctionTurn(kb, item, bid);
    const rawText = await generateGameResponseStream(prompt, '', () => {}, undefined, undefined, getBaseSystemInstruction(false, undefined, apiSettings.useDeepReasoning, apiSettings.slowThinking, apiSettings.useExclusiveAccessoryPrompt, apiSettings.exclusivePromptSections), false, 'economy');
    return { response: parseAiResponseText(rawText), rawText };
}

export const runAuctioneerCall = async (kb: KnowledgeBase, item: AuctionItem, count: number, onPromptLog?: (p: string) => void) => {
    const apiSettings = getApiSettings();
    const prompt = PROMPT_FUNCTIONS.runAuctioneerCall(kb, item, count);
    const rawText = await generateGameResponseStream(prompt, '', () => {}, undefined, undefined, getBaseSystemInstruction(false, undefined, apiSettings.useDeepReasoning, apiSettings.slowThinking, apiSettings.useExclusiveAccessoryPrompt, apiSettings.exclusivePromptSections), false, 'economy');
    return { response: parseAiResponseText(rawText), rawText };
}

export const generateCityEconomy = async (loc: GameLocation, kb: KnowledgeBase, onPromptLog?: (p: string) => void) => {
    const prompt = PROMPT_FUNCTIONS.generateEconomyLocations(loc, kb);
    const rawText = await generateGameResponseStream(prompt, '', () => {}, undefined, undefined, undefined, false, 'economy');
    const parsed = parseAiResponseText(rawText);
    const tags = extractSatelliteTags(rawText, parsed.tags);
    return { response: { ...parsed, tags }, tags, rawText };
}

export const generateEconomyLocations = async (loc: GameLocation, kb: KnowledgeBase, onPromptLog?: (p: string) => void) => {
    const prompt = PROMPT_FUNCTIONS.generateEconomyLocations(loc, kb);
    const rawText = await generateGameResponseStream(prompt, '', () => {}, undefined, undefined, undefined, false, 'economy');
    const parsed = parseAiResponseText(rawText);
    const tags = extractSatelliteTags(rawText, parsed.tags);
    return { response: { ...parsed, tags }, tags, rawText };
}

export const generateGeneralSubLocations = async (loc: GameLocation, kb: KnowledgeBase, onPromptLog?: (p: string) => void) => {
     const prompt = PROMPT_FUNCTIONS.generateGeneralSubLocations(loc, kb);
     const { text: rawText } = await callGeminiAPI(prompt, onPromptLog);
     const parsed = parseAiResponseText(rawText);
     const tags = extractSatelliteTags(rawText, parsed.tags);
     return { response: { ...parsed, tags }, tags, rawText };
}

export const findLocationWithAI = async (
    kb: KnowledgeBase, 
    params: FindLocationParams, 
    pageLog: string, 
    summaries: string[], 
    lastNarration: string | undefined, 
    onPromptLog?: (p: string) => void
) => {
    const prompt = PROMPT_FUNCTIONS.findLocation(kb, params, pageLog, summaries, lastNarration);
    const rawText = await generateGameResponseStream(prompt, '', () => {}, undefined, undefined, undefined, false, 'secondary');
    return { response: parseAiResponseText(rawText), rawText };
}

export const generateCultivationSession = async (
    kb: KnowledgeBase,
    type: 'skill' | 'method',
    duration: number,
    pageLog: string,
    summaries: string[],
    lastNarration: string | undefined,
    skill?: Skill,
    method?: Skill,
    partner?: NPC | Wife | Slave,
    onPromptLog?: (p: string) => void
) => {
    const { useExclusiveAccessoryPrompt } = getApiSettings();
    const prompt = PROMPT_FUNCTIONS.cultivationSession(kb, type, duration, pageLog, summaries, lastNarration, skill, method, partner, useExclusiveAccessoryPrompt);
    const finalPrompt = injectPreviousNarrationIntoPrompt(prompt, kb, pageLog, lastNarration);
    const rawText = await generateGameResponseStream(finalPrompt, '', () => {}, undefined, undefined, undefined, false, 'main');
    return { response: parseAiResponseText(rawText), rawText };
}

export const summarizeCultivationSession = async (data: CultivationSummaryData, onPromptLog?: (p: string) => void) => {
    const prompt = PROMPT_FUNCTIONS.summarizeCultivationSession(data);
    const rawText = await generateGameResponseStream(prompt, '', () => {}, undefined, undefined, undefined, false, 'secondary');
    
    // Apply sanitization to remove any leaked system tags
    const sanitizedText = sanitizeNarrative(rawText);
    
    return sanitizedText;
}

export const handleCompanionInteraction = async (
    kb: KnowledgeBase,
    companion: Wife | Slave,
    action: string,
    pageLog: string,
    summaries: string[],
    lastNarration: string | undefined,
    onPromptLog?: (p: string) => void
) => {
    const apiSettings = getApiSettings();
    const deathWarningText = getDeathNarrativeWarning(kb);
    const origMcName = kb?.worldConfig?.originalPlayerName || kb?.playerStats?.originalPlayerName || kb?.worldConfig?.playerName || kb?.playerStats?.name || "Người chơi";
    const currMcName = kb?.worldConfig?.playerName || kb?.playerStats?.name || "Người chơi";
    const highlightedUserInput = formatUserInputBlock(action, undefined, deathWarningText, undefined, origMcName, currMcName);
    let prompt = highlightedUserInput + "\n" + PROMPT_FUNCTIONS.companionInteraction(kb, companion, action, pageLog, summaries, lastNarration, apiSettings.perspectiveMode, apiSettings.useExclusiveAccessoryPrompt);
    
    // Append Narrative Dynamics Rules based on Story Tone
    prompt += getTonePrompt(kb.worldConfig?.storyTone || "");

    // Lấy phong cách NSFW từ cài đặt thế giới
    const nsfwStyle = kb.worldConfig?.nsfwDescriptionStyle || 'Hoa Mỹ';
    
    // CHÈN LUẬT INTIMACY VÀO PROMPT (Tích hợp Game Theory với kb)
    prompt += buildIntimacyRulesPrompt(companion, nsfwStyle, kb);

    const finalPrompt = injectPreviousNarrationIntoPrompt(prompt, kb, pageLog, lastNarration);
    const { text: rawText } = await callGeminiAPI(finalPrompt, onPromptLog, 'secondary', undefined, getBaseSystemInstruction(false, undefined, apiSettings.useDeepReasoning, apiSettings.slowThinking, apiSettings.useExclusiveAccessoryPrompt, apiSettings.exclusivePromptSections));
    return { response: parseAiResponseText(rawText), rawText };
}

export const summarizeCompanionInteraction = async (log: string[], onPromptLog?: (p: string) => void) => {
    const prompt = PROMPT_FUNCTIONS.summarizeCompanionInteraction(log);
    const rawText = await generateGameResponseStream(prompt, '', () => {}, undefined, undefined, undefined, false, 'secondary');
    return rawText;
}

export const handlePrisonerInteraction = async (
    kb: KnowledgeBase,
    prisoner: Prisoner,
    action: string,
    pageLog: string,
    summaries: string[],
    lastNarration: string | undefined,
    retrievedContext?: string,
    onPromptLog?: (p: string) => void
) => {
    const apiSettings = getApiSettings();
    const deathWarningText = getDeathNarrativeWarning(kb);
    const origMcName = kb?.worldConfig?.originalPlayerName || kb?.playerStats?.originalPlayerName || kb?.worldConfig?.playerName || kb?.playerStats?.name || "Người chơi";
    const currMcName = kb?.worldConfig?.playerName || kb?.playerStats?.name || "Người chơi";
    const highlightedUserInput = formatUserInputBlock(action, undefined, deathWarningText, undefined, origMcName, currMcName);
    let prompt = highlightedUserInput + "\n" + PROMPT_FUNCTIONS.prisonerInteraction(kb, prisoner, action, pageLog, summaries, lastNarration, retrievedContext, apiSettings.perspectiveMode, apiSettings.useExclusiveAccessoryPrompt);
    
    // Append Narrative Dynamics Rules based on Story Tone
    prompt += getTonePrompt(kb.worldConfig?.storyTone || "");

    // Lấy phong cách NSFW từ cài đặt thế giới
    const nsfwStyle = kb.worldConfig?.nsfwDescriptionStyle || 'Hoa Mỹ';
    
    // CHÈN LUẬT INTIMACY VÀO PROMPT (Tích hợp Game Theory với kb)
    prompt += buildIntimacyRulesPrompt(prisoner, nsfwStyle, kb);

    const finalPrompt = injectPreviousNarrationIntoPrompt(prompt, kb, pageLog, lastNarration);
    const { text: rawText } = await callGeminiAPI(finalPrompt, onPromptLog, 'secondary', undefined, getBaseSystemInstruction(false, undefined, apiSettings.useDeepReasoning, apiSettings.slowThinking, apiSettings.useExclusiveAccessoryPrompt, apiSettings.exclusivePromptSections));
    return { response: parseAiResponseText(rawText), rawText };
}

export const summarizePrisonerInteraction = async (log: string[], onPromptLog?: (p: string) => void) => {
    const prompt = PROMPT_FUNCTIONS.summarizePrisonerInteraction(log);
    const rawText = await generateGameResponseStream(prompt, '', () => {}, undefined, undefined, undefined, false, 'secondary');
    return rawText;
}

export const generateVendorRestock = async (vendor: NPC, kb: KnowledgeBase, onPromptLog?: (p: string) => void) => {
    const apiSettings = getApiSettings();
    const prompt = PROMPT_FUNCTIONS.restockVendor(vendor, kb);
    const rawText = await generateGameResponseStream(prompt, '', () => {}, undefined, undefined, getBaseSystemInstruction(false, undefined, apiSettings.useDeepReasoning, apiSettings.slowThinking, apiSettings.useExclusiveAccessoryPrompt, apiSettings.exclusivePromptSections), false, 'economy');
    const parsed = parseAiResponseText(rawText);
    const tags = extractSatelliteTags(rawText, parsed.tags);
    return { response: { ...parsed, tags }, rawText, tags };
}

export const generateSlaveAuctionData = async (kb: KnowledgeBase, onPromptLog?: (p: string) => void) => {
    const apiSettings = getApiSettings();
    const prompt = PROMPT_FUNCTIONS.generateSlaveAuctionData(kb);
    const rawText = await generateGameResponseStream(prompt, '', () => {}, undefined, undefined, getBaseSystemInstruction(false, undefined, apiSettings.useDeepReasoning, apiSettings.slowThinking, apiSettings.useExclusiveAccessoryPrompt, apiSettings.exclusivePromptSections), false, 'economy');
    const parsed = parseAiResponseText(rawText);
    const tags = extractSatelliteTags(rawText, parsed.tags);
    return { response: { ...parsed, tags }, rawText, tags };
}

export const runSlaveAuctionTurn = async (kb: KnowledgeBase, item: AuctionSlave, bid: number, onPromptLog?: (p: string) => void) => {
    const apiSettings = getApiSettings();
    const prompt = PROMPT_FUNCTIONS.runSlaveAuctionTurn(kb, item, bid);
    const rawText = await generateGameResponseStream(prompt, '', () => {}, undefined, undefined, getBaseSystemInstruction(false, undefined, apiSettings.useDeepReasoning, apiSettings.slowThinking, apiSettings.useExclusiveAccessoryPrompt, apiSettings.exclusivePromptSections), false, 'economy');
    return { response: parseAiResponseText(rawText), rawText };
}

export const runSlaveAuctioneerCall = async (kb: KnowledgeBase, item: AuctionSlave, count: number, onPromptLog?: (p: string) => void) => {
    const apiSettings = getApiSettings();
    const prompt = PROMPT_FUNCTIONS.runSlaveAuctioneerCall(kb, item, count);
    const rawText = await generateGameResponseStream(prompt, '', () => {}, undefined, undefined, getBaseSystemInstruction(false, undefined, apiSettings.useDeepReasoning, apiSettings.slowThinking, apiSettings.useExclusiveAccessoryPrompt, apiSettings.exclusivePromptSections), false, 'economy');
    return { response: parseAiResponseText(rawText), rawText };
}

export const generateTravelEvent = async (kb: KnowledgeBase, current: GameLocation, target: GameLocation, onPromptLog?: (p: string) => void) => {
    const prompt = PROMPT_FUNCTIONS.travel(kb, current, target);
    const finalPrompt = injectPreviousNarrationIntoPrompt(prompt, kb);
    const rawText = await generateGameResponseStream(finalPrompt, '', () => {}, undefined, undefined, getBaseSystemInstruction(false, undefined, getApiSettings().useDeepReasoning, getApiSettings().slowThinking, getApiSettings().useExclusiveAccessoryPrompt, getApiSettings().exclusivePromptSections), false, 'secondary');
    return { response: parseAiResponseText(rawText), rawText };
}

export const generateMemoryFromNarration = async (text: string, memories: any[]): Promise<{text: string, strength: number} | null> => {
    const prompt = `Trích xuất một ký ức cốt lõi quan trọng từ đoạn văn sau. Nếu không có gì đáng nhớ, trả về null. Định dạng JSON: { "text": "...", "strength": 1-100 }. Text: ${text}`;
    try {
        const rawText = await generateGameResponseStream(prompt, '', () => {}, undefined, undefined, undefined, false, 'secondary');
        // Simple extraction logic, assuming valid JSON returned or simple text
        const match = rawText.match(/\{.*\}/s);
        if (match) return safeJsonParse(match[0]);
    } catch (e) { console.error("Memory extraction failed", e); }
    return null;
}

export const judgeChallengeConsequences = async (kb: KnowledgeBase, target: any, onPromptLog?: (p: string) => void) => {
    const prompt = PROMPT_FUNCTIONS.challengeContext(kb, target);
    const rawText = await generateGameResponseStream(prompt, '', () => {}, undefined, undefined, undefined, false, 'secondary');
    const parsed = parseAiResponseText(rawText);
    const tags = extractSatelliteTags(rawText, parsed.tags);
    return { response: { ...parsed, tags }, tags, rawText };
}

export const generateBatchDescriptionSummaries = async (items: any[]) => {
    // Implement if needed or return empty list
    return [];
}

export const generateImageUnified = async (prompt: string): Promise<string | null> => {
    const settings = getApiSettings();
    const apiKey = getCurrentlyUsedApiKey();

    // Nếu dùng key hệ thống, sử dụng API server-side để bảo mật và ổn định hơn
    if (settings.apiKeySource === 'system' || !apiKey) {
        try {
            const response = await fetch("/api/gemini/generate-image", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ 
                    prompt, 
                    model: settings.avatarGenerationEngine || 'gemini-2.5-flash-image',
                    aspectRatio: '1:1',
                    apiKey: apiKey || 'system-proxy-key' // Send key in body to avoid header stripping
                }),
            });
            
            if (!response.ok) {
                const errData = await response.json();
                if (response.status === 429) {
                    throw new Error(errData.error || "Hết hạn mức tạo ảnh AI. Vui lòng đợi 1 phút.");
                }
                console.error("Server-side image gen failed:", errData);
                return null;
            }
            
            const data = await response.json();
            return data.imageData || null;
        } catch (error: any) {
            console.error("Failed to call server-side image gen:", error);
            // Re-throw if it's a quota error to let the UI display it
            if (error.message && error.message.includes("Hết hạn mức")) {
                throw error;
            }
            return null;
        }
    }
    
    if (settings.avatarGenerationEngine === 'imagen-4.0-generate-001') {
        const ai = getAiClient(settings, apiKey);
        try {
            const res = await ai.models.generateImages({
                model: 'imagen-4.0-generate-001',
                prompt,
                config: { numberOfImages: 1, outputMimeType: 'image/png' }
            });
            const bytes = res.generatedImages?.[0]?.image?.imageBytes;
            if (bytes) {
                // If it's already a Data URI, return it, otherwise wrap it
                return bytes.startsWith('data:') ? bytes : `data:image/png;base64,${bytes}`;
            }
            return null;
        } catch (e) {
            console.error("Imagen gen failed", e);
            return null;
        }
    } else {
         // Fallback/Default to gemini-2.5-flash-image via generateContent
         const ai = getAiClient(settings, apiKey);
         const modelName = 'gemini-2.5-flash-image';
         
         let apiKeyLabel = '';
         if (settings.apiKeySource === 'proxy') {
             apiKeyLabel = 'Proxy API';
         } else {
             const keys = (settings.userApiKeys || []).filter(k => k && k.trim() !== '');
             const kIdx = keys.indexOf(apiKey || '');
             apiKeyLabel = kIdx !== -1 ? `API Key #${kIdx + 1}` : 'Key Cá Nhân';
         }
         
         const imgTaskId = apiRunningService.start(modelName, apiKeyLabel, "Tạo ảnh minh họa (Image Gen)");
         try {
             // Correcting parameters for generateContent image generation
             const res = await ai.models.generateContent({
                 model: modelName,
                 contents: [{ role: 'user', parts: [{ text: prompt }] }],
                 config: { 
                     imageConfig: { aspectRatio: '1:1' }
                 }
             });
             apiRunningService.stop(imgTaskId);
             
             const part = res.candidates?.[0]?.content?.parts?.[0];
             if (part?.inlineData) {
                 const mimeType = part.inlineData.mimeType || 'image/png';
                 return `data:${mimeType};base64,${part.inlineData.data}`;
             }
         } catch (e) {
             console.warn("gemini-2.5-flash-image failed, trying standard imagen fallbacks...", e);
             // Robust fallback path trying stable image generation models
             const fallbackModels = ['imagen-3.0-generate-002', 'imagen-3.0-fast-generate-001', 'imagen-3.0-generate-001', 'imagen-4.0-generate-001'];
             for (const fallbackModel of fallbackModels) {
                 try {
                     const res = await ai.models.generateImages({
                         model: fallbackModel,
                         prompt,
                         config: { numberOfImages: 1, outputMimeType: 'image/png' }
                     });
                     const bytes = res.generatedImages?.[0]?.image?.imageBytes;
                     if (bytes) {
                         apiRunningService.stop(imgTaskId);
                         return bytes.startsWith('data:') ? bytes : `data:image/png;base64,${bytes}`;
                     }
                 } catch (fallbackErr) {
                     console.warn(`Fallback image model ${fallbackModel} failed:`, fallbackErr);
                 }
             }
             apiRunningService.stop(imgTaskId);
             console.error("Gemini image gen failed after trying all fallback models", e);
         }
    }
    return null;
}

export const generateAvatarsForFemales = async (
  females: { id: string; name: string; personality: string; description: string }[],
  onPromptLog?: (prompt: string) => void
): Promise<{ id: string; hair: number; face: number }[]> => {
  if (!females || females.length === 0) return [];
  
  const prompt = `[HỆ THỐNG TẠO AVATAR AI]
Bạn là một chuyên gia thiết kế nhân vật 2D. Hãy phân tích danh sách các nhân vật nữ dưới đây và chỉ định kiểu tóc (0-25) cùng khuôn mặt (0-25) phù hợp nhất với tính cách và ngoại hình của họ.

LƯU Ý: 
- Một số nhân vật hiền lành nên chọn mặt dịu dàng (vd: 0, 1, 2) và tóc gọn gàng.
- Nhân vật kiêu ngạo, tà ác hoặc dâm đãng nên chọn mắt sắc sảo, quyến rũ.
- Phải trả về ĐÚNG MỘT MẢNG JSON, mỗi phần tử có dạng {"id": "...", "hair": number, "face": number}

DANH SÁCH NHÂN VẬT:
${females.map(f => `- ID: ${f.id} | Tên: ${f.name} | Tính cách: ${f.personality} | Mô tả: ${f.description}`).join('\n')}

Hãy suy nghĩ ngắn gọn bằng thẻ <thinking> trước khi trả về <json_data>.`;

  if (onPromptLog) onPromptLog(prompt);

  try {
      const { text: responseText, modelUsed } = await callGeminiAPI(prompt, onPromptLog, 'economy');
      if (responseText) {
          const jsonMatch = responseText.match(/<json_data>([\s\S]*?)<\/json_data>/) || responseText.match(/```json\n([\s\S]*?)\n```/) || [null, responseText];
          let jsonStr = jsonMatch[1];
          if (!jsonStr) jsonStr = responseText;
          
          if (jsonStr) {
              const start = jsonStr.indexOf('[');
              const end = jsonStr.lastIndexOf(']');
              if (start >= 0 && end > start) {
                  const cleanedJson = jsonStr.substring(start, end + 1);
                  return JSON.parse(cleanedJson);
              }
          }
      }
      return [];
  } catch (error) {
      console.error("AI Avatar Generation Error:", error);
      // Fallback
      return females.map(f => ({
          id: f.id,
          hair: Math.floor(Math.random() * 26),
          face: Math.floor(Math.random() * 26)
      }));
  }
};

export const summarizeEndOfDescription = async (text: string) => {
    const prompt = `Tóm tắt ngắn gọn đoạn mô tả sau (giữ lại các sự kiện chính): ${text}`;
    const rawText = await generateGameResponseStream(prompt, '', () => {}, undefined, undefined, undefined, false, 'secondary');
    return rawText;
};