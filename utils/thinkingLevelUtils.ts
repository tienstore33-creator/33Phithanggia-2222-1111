import { ThinkingLevel } from "@google/genai";
import { ApiConfig, FallbackSettings } from "../types";

export type ThinkingLevelValue = 'auto' | 'minimal' | 'low' | 'medium' | 'high' | 'xhigh';
export type SupportedThinkingLevel = Exclude<ThinkingLevelValue, 'auto'>;

export const THINKING_LEVEL_LABELS: Record<SupportedThinkingLevel, string> = {
  minimal: "MINIMAL (Tối thiểu - Phản hồi nhanh)",
  low: "LOW (Thấp - Tiết kiệm & Nhanh)",
  medium: "MEDIUM (Trung bình - Cân bằng)",
  high: "HIGH (Cao - Suy luận sâu)",
  xhigh: "XHIGH (Cực cao - Phân tích toàn diện)",
};

export const THINKING_LEVEL_SHORT_LABELS: Record<ThinkingLevelValue, string> = {
  auto: "Auto",
  minimal: "MINIMAL",
  low: "LOW",
  medium: "MEDIUM",
  high: "HIGH",
  xhigh: "XHIGH",
};

const THINKING_BUDGET_MAP_25: Record<SupportedThinkingLevel, number> = {
  minimal: 0,
  low: 2048,
  medium: 8192,
  high: 24576,
  xhigh: 32768,
};

export const cleanThinkingModelId = (modelId: string): string => {
  if (!modelId) return '';
  return modelId.replace(/^models\//, '').trim();
};

/**
 * Kiểm tra khả năng hỗ trợ Thinking Level của từng model Gemini.
 * Trả về mảng các mức suy luận hợp lệ, hoặc mảng rỗng [] nếu model không hỗ trợ thinking.
 */
export function getSupportedThinkingLevels(modelId: string): SupportedThinkingLevel[] {
  const cleanId = cleanThinkingModelId(modelId).toLowerCase();
  if (!cleanId) return [];

  // Loại bỏ các dòng model không hỗ trợ thinking hoặc không phải text generation
  const unsupportedKeywords = [
    'gemma',
    'embedding',
    'embed',
    'imagen',
    'image',
    'tts',
    'transcribe',
    'live',
    'audio',
    'computer-use',
    'robotics',
    'veo',
    'lyria',
    'genie',
    'decision',
    '1.5',
    '2.0',
    'lite',
  ];
  if (unsupportedKeywords.some((kw) => cleanId.includes(kw))) {
    return [];
  }

  if (!cleanId.includes('gemini')) {
    return [];
  }

  // Gemini 4 Series
  if (cleanId.includes('gemini-4')) {
    if (cleanId.includes('neon') || cleanId.includes('hydrogen')) {
      return ['low', 'medium', 'high', 'xhigh'];
    }
    // gemini-4-argon, gemini-4-carbon và các biến thể Gemini 4 khác
    return ['low', 'medium', 'high'];
  }

  // Gemini 3 Series
  if (cleanId.includes('gemini-3')) {
    if (cleanId.includes('pro')) {
      return ['low', 'medium', 'high'];
    }
    return ['minimal', 'low', 'medium', 'high'];
  }

  // Gemini 2.5 Series
  if (cleanId.includes('gemini-2.5')) {
    return ['low', 'medium', 'high'];
  }

  // Alias *-latest
  if (cleanId.includes('gemini-flash-latest') || cleanId.includes('gemini-flash-lite-latest')) {
    return ['minimal', 'low', 'medium', 'high'];
  }
  if (cleanId.includes('gemini-pro-latest')) {
    return ['low', 'medium', 'high'];
  }

  return [];
}

export interface ConfigurableThinkingModelItem {
  id: string;
  name: string;
  supportedLevels: SupportedThinkingLevel[];
  roles: string[];
}

export function getThinkingConfigurableModels(params: {
  selectedModel: string;
  selectedEconomyModel: string;
  selectedCombatModel: string;
  storyFallback?: FallbackSettings;
  economyFallback?: FallbackSettings;
  combatFallback?: FallbackSettings;
  availableModels: { id: string; name: string }[];
  secondaryModels?: { id: string; name: string }[];
}): ConfigurableThinkingModelItem[] {
  const {
    selectedModel,
    selectedEconomyModel,
    selectedCombatModel,
    storyFallback,
    economyFallback,
    combatFallback,
    availableModels,
    secondaryModels = [],
  } = params;

  const allKnownModels = [...availableModels, ...secondaryModels];
  const resolveName = (id: string): string => {
    const clean = cleanThinkingModelId(id);
    const found = allKnownModels.find(
      (m) => cleanThinkingModelId(m.id) === clean
    );
    return found?.name || clean;
  };

  const map = new Map<string, ConfigurableThinkingModelItem>();

  const registerModel = (rawId: string | undefined, role: string) => {
    if (!rawId) return;
    const cleanId = cleanThinkingModelId(rawId);
    if (!cleanId) return;

    const supportedLevels = getSupportedThinkingLevels(cleanId);
    if (supportedLevels.length === 0) return;

    const existing = map.get(cleanId);
    if (existing) {
      if (!existing.roles.includes(role)) {
        existing.roles.push(role);
      }
    } else {
      map.set(cleanId, {
        id: cleanId,
        name: resolveName(cleanId),
        supportedLevels,
        roles: [role],
      });
    }
  };

  registerModel(selectedModel, 'Cốt truyện');
  registerModel(selectedEconomyModel, 'Kinh tế');
  registerModel(selectedCombatModel, 'Chiến đấu');

  (storyFallback?.customList || []).forEach((id) => registerModel(id, 'Dự phòng'));
  (economyFallback?.customList || []).forEach((id) => registerModel(id, 'Dự phòng'));
  (combatFallback?.customList || []).forEach((id) => registerModel(id, 'Dự phòng'));

  return Array.from(map.values());
}

/**
 * Áp dụng cấu hình thinkingConfig (thinkingLevel / thinkingBudget) vào payload gọi API Gemini.
 */
export function applyThinkingConfig(
  modelId: string,
  config: Record<string, any> = {},
  settings?: ApiConfig
): Record<string, any> {
  const cleanId = cleanThinkingModelId(modelId);
  const lowerId = cleanId.toLowerCase();
  const nextConfig = { ...config };

  // Gemini 4 không hỗ trợ temperature, topP, topK, candidateCount
  if (lowerId.includes('gemini-4')) {
    delete nextConfig.temperature;
    delete nextConfig.topP;
    delete nextConfig.topK;
    delete nextConfig.candidateCount;
  }

  const supported = getSupportedThinkingLevels(cleanId);
  if (supported.length === 0) {
    return nextConfig;
  }

  const rawSelected =
    settings?.modelThinkingLevels?.[cleanId] ??
    settings?.modelThinkingLevels?.[modelId];
  const selectedLevel = rawSelected ? rawSelected.toLowerCase() : 'auto';

  if (
    selectedLevel &&
    selectedLevel !== 'auto' &&
    supported.includes(selectedLevel as SupportedThinkingLevel)
  ) {
    const typedLevel = selectedLevel as SupportedThinkingLevel;

    if (lowerId.includes('gemini-2.5')) {
      nextConfig.thinkingConfig = {
        thinkingBudget: THINKING_BUDGET_MAP_25[typedLevel],
      };
    } else {
      nextConfig.thinkingConfig = {
        thinkingLevel: typedLevel.toUpperCase() as ThinkingLevel,
      };
    }
    return nextConfig;
  }

  // Chế độ Mặc định ('auto')
  if (lowerId.includes('gemini-4')) {
    // Tuyệt đối không gửi thinkingBudget cho dòng Gemini 4
    delete nextConfig.thinkingConfig;
    return nextConfig;
  }

  const isFlashLite = lowerId.includes('flash-lite');
  if (
    !isFlashLite &&
    lowerId.includes('gemini-2.5') &&
    settings?.thinkingBudget !== undefined &&
    settings.thinkingBudget > 0
  ) {
    nextConfig.thinkingConfig = {
      thinkingBudget: settings.thinkingBudget,
    };
  }

  return nextConfig;
}
