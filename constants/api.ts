import { HarmCategory, HarmBlockThreshold } from "@google/genai";
import { ApiConfig, SafetySetting, AvatarGenerationEngine, OfflineCombatAiConfig, CombatGraphicsConfig } from '../types';

export const API_SETTINGS_STORAGE_KEY = 'daoDoAiApiSettings_v4'; 

export const DEFAULT_MODEL_ID = 'gemini-flash-latest';
export const DEFAULT_FLASH_LITE_MODEL_ID = 'gemini-flash-lite-latest';

export const EXCLUDED_MODELS = [
  "deep-research-pro-preview-12-2025",
  "deep-research-max-preview-04-2026",
  "deep-research-preview-04-2026",
  "antigravity-preview-05-2026",
  "gemini-omni-flash-preview",
  "lyria-3-pro-preview",
  "lyria-3-clip-preview",
  "nano-banana-pro-preview",
  "veo-3.1-fast-generate-preview",
  "veo-3.1-generate-preview",
  "gemini-robotics-er-2-preview",
  "gemini-robotics-er-1.6-preview",
  "gemini-robotics-er-2-streaming-preview"
];

export const AVAILABLE_MODELS = [
  { id: 'gemini-flash-latest', name: 'Gemini Flash Latest' },
  { id: 'gemini-flash-lite-latest', name: 'Gemini Flash-Lite Latest' },
  { id: 'gemini-3.6-flash', name: 'Gemini 3.6 Flash' },
  { id: 'gemini-3.5-flash', name: 'Gemini 3.5 Flash' },
  { id: 'gemini-3.5-flash-lite', name: 'Gemini 3.5 Flash Lite' },
  { id: 'gemini-3.1-pro-preview', name: 'Gemini 3.1 Pro Preview' },
  { id: 'gemini-3.1-flash-lite', name: 'Gemini 3.1 Flash Lite' },
  { id: 'gemini-2.5-pro', name: 'Gemini 2.5 Pro' },
  { id: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash' },
  { id: 'gemini-2.5-flash-lite', name: 'Gemini 2.5 Flash Lite' },
  { id: 'gemini-pro-latest', name: 'Gemini Pro Latest' },
  { id: 'gemini-3.1-pro-preview-customtools', name: 'Gemini 3.1 Pro Preview (Custom Tools)' },
  { id: 'gemini-3.5-live-translate-preview', name: 'Gemini 3.5 Live Translate Preview' },
  { id: 'gemini-3.1-flash-lite-preview', name: 'Gemini 3.1 Flash Lite Preview' },
  { id: 'gemini-3.1-flash-live-preview', name: 'Gemini 3.1 Flash Live Preview' },
  { id: 'gemini-3-flash-preview', name: 'Gemini 3 Flash Preview' },
  { id: 'gemini-2.5-computer-use-preview-10-2025', name: 'Gemini 2.5 Computer Use Preview (10/2025)' },
  { id: 'gemma-4-26b-a4b-it', name: 'Gemma 4 26B A4B IT' },
  { id: 'gemma-4-31b-it', name: 'Gemma 4 31B IT' },
];

export const AI_PROVIDERS = [
  { id: 'google', name: 'Google Chat (Gemini)' },
];

export const PROVIDER_MODELS: Record<string, {id: string, name: string}[]> = {
  google: AVAILABLE_MODELS,
};

export const AVAILABLE_AVATAR_ENGINES: { id: AvatarGenerationEngine; name: string }[] = [
    { id: 'gemini-2.5-flash-image', name: 'Gemini 2.5 Flash Image (Nhanh)' },
    { id: 'imagen-4.0-generate-001', name: 'Imagen 4.0 (Chất lượng cao)' },
];
export const DEFAULT_AVATAR_GENERATION_ENGINE: AvatarGenerationEngine = 'gemini-2.5-flash-image';

export const DEFAULT_EMBEDDING_MODEL_ID = 'gemini-embedding-001';
export const AVAILABLE_EMBEDDING_MODELS = [
  { id: 'gemini-embedding-001', name: 'Gemini Embedding 001 (Ổn định nhất)' },
  { id: 'TaylorAI/bge-micro-v2', name: 'BGE-Micro-V2 (Local - 30MB)' },
];

export const DEFAULT_AUTO_GENERATE_NPC_AVATARS = false;

export const GEMINI_MODEL_TEXT = DEFAULT_MODEL_ID;

export const HARM_CATEGORIES = [
  { id: HarmCategory.HARM_CATEGORY_HARASSMENT, label: "Quấy Rối" },
  { id: HarmCategory.HARM_CATEGORY_HATE_SPEECH, label: "Phát Ngôn Thù Ghét" },
  { id: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, label: "Nội Dung Khiêu Dâm" },
  { id: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, label: "Nội Dung Nguy Hiểm" },
];

export const HARM_BLOCK_THRESHOLDS = [
  { id: HarmBlockThreshold.BLOCK_NONE, label: "Không Chặn (Rủi Ro Cao Nhất)" },
  { id: HarmBlockThreshold.BLOCK_LOW_AND_ABOVE, label: "Chặn Ngưỡng Thấp và Cao Hơn" },
  { id: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE, label: "Chặn Ngưỡng Trung Bình và Cao Hơn" },
  { id: HarmBlockThreshold.BLOCK_ONLY_HIGH, label: "Chặn Chỉ Ngưỡng Cao" },
];

export const DEFAULT_SAFETY_SETTINGS: SafetySetting[] = HARM_CATEGORIES.map(category => ({
  category: category.id,
  threshold: HarmBlockThreshold.BLOCK_NONE,
}));

export const DEFAULT_OFFLINE_COMBAT_AI_CONFIG: OfflineCombatAiConfig = {
    aiLogicMode: 'simple',
    simpleEnemyTargetPriority: 'random',
    simpleAllyTactic: 'balanced',
    advancedEnemyTargetPriority: 'random',
    advancedEnemyActionPriority: 'basic',
    advancedAllyTargetPriority: 'followPlayer',
    advancedAllySupportPriority: 'heal50',
};

export const DEFAULT_COMBAT_GRAPHICS_CONFIG: CombatGraphicsConfig = {
    resolutionScale: 1.0,
    enableVfx: true,
    enableDamageNumbers: true,
    maxUnitsPerSide: 4,
    combatEngineMode: 'tang_dong_realtime',
};

export const DEFAULT_API_CONFIG: ApiConfig = {
  apiKeySource: 'system',
  userApiKeys: [''],
  model: DEFAULT_MODEL_ID,
  economyModel: DEFAULT_FLASH_LITE_MODEL_ID,
  combatModel: DEFAULT_FLASH_LITE_MODEL_ID,
  storyFallback: { mode: 'auto', customList: [], recoveryStrategy: 'sequential' },
  economyFallback: { mode: 'auto', customList: [], recoveryStrategy: 'sequential' },
  combatFallback: { mode: 'auto', customList: [], recoveryStrategy: 'sequential' },
  safetySettings: DEFAULT_SAFETY_SETTINGS,
  autoGenerateNpcAvatars: DEFAULT_AUTO_GENERATE_NPC_AVATARS,
  avatarGenerationEngine: DEFAULT_AVATAR_GENERATION_ENGINE,
  embeddingModel: DEFAULT_EMBEDDING_MODEL_ID,
  ragTopK: 60,
  apiTimeout: 60,
  perspectiveMode: 'thirdPersonOmniscient',
  offlineCombatAiConfig: DEFAULT_OFFLINE_COMBAT_AI_CONFIG,
  combatGraphicsConfig: DEFAULT_COMBAT_GRAPHICS_CONFIG,
  architectureMode: 'standard',
  temperature: 1.0,
  topK: 500,
  topP: 1.0,
  maxOutputTokens: 52000,
  thinkingBudget: 20000,
  jsonBuffer: 5000,
  proxyUrl2: '',
  proxyKey2: '',
  aiProvider: 'google',
  useDeepReasoning: false,
  slowThinking: false,
  matPhapManual: false,
  useExclusiveAccessoryPrompt: false,
  exclusivePromptSections: {
    thinkingProtocol: false,
    nhanCach: false,
    gocNhin: false,
    doDai: false,
    vanPhong: false,
    boTuVung: false,
    truyenNgucTu: false,
    chiThiMC: false,
  },
  useAiOath: true,
};