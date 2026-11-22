import React, { useState, useEffect, ChangeEvent, useRef } from 'react';
import { GameScreen, ApiConfig, SafetySetting, AvatarGenerationEngine, KnowledgeBase, OfflineCombatAiConfig, FallbackSettings, CombatGraphicsConfig } from '../types'; 
import Button from './ui/Button';
import InputField from './ui/InputField';
import Modal from './ui/Modal';
import { PresetManager } from './PresetManager';
import { RefreshCw, Settings, Sparkles, ChevronUp, ChevronDown, X, Check, Lock, Unlock, Search } from 'lucide-react';
import { 
  VIETNAMESE, 
  API_SETTINGS_STORAGE_KEY, 
  AVAILABLE_MODELS, 
  HARM_CATEGORIES,      
  HARM_BLOCK_THRESHOLDS, 
  DEFAULT_API_CONFIG,
  DEFAULT_COMBAT_GRAPHICS_CONFIG,
  AVAILABLE_AVATAR_ENGINES, 
  DEFAULT_AVATAR_GENERATION_ENGINE,
  DEFAULT_FLASH_LITE_MODEL_ID,
  AVAILABLE_EMBEDDING_MODELS,
  DEFAULT_EMBEDDING_MODEL_ID,
  AI_PROVIDERS,
  PROVIDER_MODELS
} from '../constants';
import { GuideMarker, GuideOverlay, GuideToggleButton } from './guide/GuideSystem';
import { getApiSettings, verifyApiConnection, fetchImageModelsList } from '../services/geminiService'; 
import { saveApiSettings } from '../services/apiService';
import { PROMPT_XML_SECTIONS } from '../src/config/promptTagsConfig'; 
import { ApiWatchdogService } from '../services/ApiWatchdogService';
import { HarmCategory, HarmBlockThreshold } from '@google/genai'; 
import { audioService } from '../src/services/AudioService';
import { initLocalEmbeddingModel } from '../services/embeddingService';
import { sortModelObjects } from '../utils/modelSorter';
import { ModelPingTester } from './ModelPingTester';
import { ThinkingLevelControl, ThinkingLevelAccordion, FallbackThinkingSelect } from './ThinkingLevelControls';
import { cleanThinkingModelId, getThinkingConfigurableModels } from '../utils/thinkingLevelUtils';

const getAIWritingStyleDescription = (temp: number, tk: number, tp: number): string => {
  if (temp >= 1.2 && tk >= 500 && tp >= 1.0) {
    return "Văn phong phong phú, nhiều từ vựng lạ, diễn biến bất ngờ.";
  }

  let tempDesc = "";
  if (temp <= 0.4) {
    tempDesc = "Văn phong chuẩn xác, cấu trúc chặt chẽ, diễn biến có tổ chức và ít ngẫu nhiên.";
  } else if (temp <= 0.8) {
    tempDesc = "Văn phong tự nhiên, mạch lạc, diễn biến ổn định.";
  } else if (temp <= 1.3) {
    tempDesc = "Văn phong phong phú, nhiều từ vựng lạ, diễn biến phát triển linh hoạt.";
  } else {
    tempDesc = "Văn phong phóng khoáng, siêu tưởng, bay bổng vượt Logic tự nhiên.";
  }

  let topKDesc = "";
  if (tk <= 40) {
    topKDesc = "tập trung cao độ vào những từ ngữ tinh hoa chọn lọc,";
  } else if (tk <= 150) {
    topKDesc = "sử dụng độ đa dạng từ vựng ở mức ổn định,";
  } else {
    topKDesc = "khai thác kho tàng từ vựng tối đa phong phú,";
  }

  let topPDesc = "";
  if (tp <= 0.4) {
    topPDesc = "và khống chế khắt khe để tránh lan man.";
  } else if (tp <= 0.85) {
    topPDesc = "và giữ nhịp đối thoại tự nhiên, mượt mà.";
  } else {
    topPDesc = "và giải phóng sự sáng tạo lực lượng bay bổng mang đậm màu sắc tu tiên.";
  }

  return `${tempDesc} AI sẽ ${topKDesc} ${topPDesc}`;
};

interface ApiSettingsScreenProps {
  setCurrentScreen: (screen: GameScreen) => void;
  onSettingsSavedNotification: () => void;
  apiSettingsReturnScreen: GameScreen;
  knowledgeBase: KnowledgeBase | null;
  setKnowledgeBase: React.Dispatch<React.SetStateAction<KnowledgeBase>>;
}

export const ApiSettingsScreen: React.FC<ApiSettingsScreenProps> = ({ 
  setCurrentScreen, 
  onSettingsSavedNotification, 
  apiSettingsReturnScreen,
  knowledgeBase,
  setKnowledgeBase
}) => {
  const [userApiKeys, setUserApiKeys] = useState<string[]>(['']);
  const [apiKeySource, setApiKeySource] = useState<'system' | 'user' | 'proxy'>(DEFAULT_API_CONFIG.apiKeySource || 'system');
  const [proxyUrl, setProxyUrl] = useState<string>('');
  const [proxyKey, setProxyKey] = useState<string>('');
  const [proxyUrl2, setProxyUrl2] = useState<string>('');
  const [proxyKey2, setProxyKey2] = useState<string>('');
  const [showSecondaryProxy, setShowSecondaryProxy] = useState<boolean>(false);
  const [proxyModel, setProxyModel] = useState<string>('');
  const [proxyModels, setProxyModels] = useState<string[]>([]);
  const [selectedModel, setSelectedModel] = useState<string>(DEFAULT_API_CONFIG.model);
  const [selectedEconomyModel, setSelectedEconomyModel] = useState<string>(DEFAULT_API_CONFIG.model);
  const [selectedCombatModel, setSelectedCombatModel] = useState<string>(DEFAULT_API_CONFIG.model);
  const [storyFallback, setStoryFallback] = useState<FallbackSettings>(DEFAULT_API_CONFIG.storyFallback || { mode: 'auto', customList: [], recoveryStrategy: 'sequential' });
  const [economyFallback, setEconomyFallback] = useState<FallbackSettings>(DEFAULT_API_CONFIG.economyFallback || { mode: 'auto', customList: [], recoveryStrategy: 'sequential' });
  const [combatFallback, setCombatFallback] = useState<FallbackSettings>(DEFAULT_API_CONFIG.combatFallback || { mode: 'auto', customList: [], recoveryStrategy: 'sequential' });
  const [fallbackModalTarget, setFallbackModalTarget] = useState<'story' | 'economy' | 'combat' | null>(null);
  const [safetySettings, setSafetySettings] = useState<SafetySetting[]>(DEFAULT_API_CONFIG.safetySettings);
  const [autoGenerateNpcAvatars, setAutoGenerateNpcAvatars] = useState<boolean>(DEFAULT_API_CONFIG.autoGenerateNpcAvatars);
  const [selectedAvatarEngine, setSelectedAvatarEngine] = useState<AvatarGenerationEngine>(DEFAULT_AVATAR_GENERATION_ENGINE);
  const [selectedEmbeddingModel, setSelectedEmbeddingModel] = useState<string>(DEFAULT_EMBEDDING_MODEL_ID);
  const [ragTopK, setRagTopK] = useState<number>(DEFAULT_API_CONFIG.ragTopK || 60);
  const [apiTimeout, setApiTimeout] = useState<number>(DEFAULT_API_CONFIG.apiTimeout || 60);
  const [perspectiveMode, setPerspectiveMode] = useState<'firstPerson' | 'thirdPersonOmniscient'>('thirdPersonOmniscient');
  const [offlineAiConfig, setOfflineAiConfig] = useState<OfflineCombatAiConfig>(DEFAULT_API_CONFIG.offlineCombatAiConfig);
  const [combatGraphicsConfig, setCombatGraphicsConfig] = useState<CombatGraphicsConfig>(DEFAULT_API_CONFIG.combatGraphicsConfig || DEFAULT_COMBAT_GRAPHICS_CONFIG);
  const [architectureMode, setArchitectureMode] = useState<'standard' | 'monolithic'>('standard');
  const [temperature, setTemperature] = useState<number>(DEFAULT_API_CONFIG.temperature || 1.2);
  const [topK, setTopK] = useState<number>(DEFAULT_API_CONFIG.topK || 500);
  const [topP, setTopP] = useState<number>(DEFAULT_API_CONFIG.topP || 1.0);
  const [maxOutputTokens, setMaxOutputTokens] = useState<number>(DEFAULT_API_CONFIG.maxOutputTokens || 52000);
  const [thinkingBudget, setThinkingBudget] = useState<number>(DEFAULT_API_CONFIG.thinkingBudget || 20000);
  const [modelThinkingLevels, setModelThinkingLevels] = useState<Record<string, string>>(DEFAULT_API_CONFIG.modelThinkingLevels || {});
  const [jsonBuffer, setJsonBuffer] = useState<number>(DEFAULT_API_CONFIG.jsonBuffer || 5000);
  const [useDeepReasoning, setUseDeepReasoning] = useState<boolean>(DEFAULT_API_CONFIG.useDeepReasoning || false);
  const [slowThinking, setSlowThinking] = useState<boolean>(DEFAULT_API_CONFIG.slowThinking || false);
  const [isSuperManualMode, setIsSuperManualMode] = useState<boolean>(DEFAULT_API_CONFIG.isSuperManualMode || false);
  const [matPhapManual, setMatPhapManual] = useState<boolean>(DEFAULT_API_CONFIG.matPhapManual || false);
  const [useAiOath, setUseAiOath] = useState<boolean>(DEFAULT_API_CONFIG.useAiOath ?? true);
  const [availableModels, setAvailableModels] = useState<{id: string, name: string}[]>(AVAILABLE_MODELS);
  const [imageModelsList, setImageModelsList] = useState<{id: string, name: string}[]>(AVAILABLE_AVATAR_ENGINES);
  const [selectedProvider, setSelectedProvider] = useState<string>(DEFAULT_API_CONFIG.aiProvider || 'google');
  const [accessoryPrompt, setAccessoryPrompt] = useState<string>(DEFAULT_API_CONFIG.accessoryPrompt || '');
  const [useExclusiveAccessoryPrompt, setUseExclusiveAccessoryPrompt] = useState<boolean>(DEFAULT_API_CONFIG.useExclusiveAccessoryPrompt || false);
  const [exclusivePromptSections, setExclusivePromptSections] = useState<ApiConfig['exclusivePromptSections']>(DEFAULT_API_CONFIG.exclusivePromptSections || {});
  const [presetRefreshKey, setPresetRefreshKey] = useState<number>(0);
  const [isPerformanceLocked, setIsPerformanceLocked] = useState<boolean>(true);
  const [presetCount, setPresetCount] = useState<number>(() => {
    try {
      const saved = localStorage.getItem('accessory_preset_files');
      return saved ? JSON.parse(saved).length : 0;
    } catch (e) {
      return 0;
    }
  });
  const [isLoadingModels, setIsLoadingModels] = useState(false);
  const [secondaryModels, setSecondaryModels] = useState<{id: string, name: string}[]>([]);
  const [loadModelStatus, setLoadModelStatus] = useState<string>('');
  const [isExportModalOpen, setIsExportModalOpen] = useState<boolean>(false);
  const [exportFileName, setExportFileName] = useState<string>('');
  
  // States for checking authorized models of an API key
  const [checkedModelsList, setCheckedModelsList] = useState<{id: string, name: string}[]>([]);
  const [isModelListModalOpen, setIsModelListModalOpen] = useState(false);
  const [checkingKeyIndex, setCheckingKeyIndex] = useState<number | null>(null);
  const [isCheckingKeyModels, setIsCheckingKeyModels] = useState(false);
  
  // Guide system states
  const [activeGuideId, setActiveGuideId] = useState<string | null>(null);
  const [isGuideOverlayActive, setIsGuideOverlayActive] = useState(false);
  
  // Local model installation states
  const [showLocalModelConfirm, setShowLocalModelConfirm] = useState(false);
  const [pendingEmbeddingModel, setPendingEmbeddingModel] = useState('');
  const [isInstallingLocalModel, setIsInstallingLocalModel] = useState(false);
  const [installProgress, setInstallProgress] = useState(0);
  const [installStatus, setInstallStatus] = useState('');
  const [downloadedBytes, setDownloadedBytes] = useState(0);

  // Removed descriptionStrategy state
  const [error, setError] = useState<string>('');
  const [successMessage, setSuccessMessage] = useState<string>('');
  const importFileRef = useRef<HTMLInputElement>(null);
  const importAllRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const isMusicEnabled = localStorage.getItem('music_enabled') !== 'false';

    if (isMusicEnabled) {
      audioService.play('./background2.mp3', true);
    } else {
      audioService.stop();
    }

    return () => {
      audioService.stop();
    };
  }, []);

  const getProspectiveSettings = (overrideSource?: string): ApiConfig => {
    const settingsToSave: ApiConfig = { 
      apiKeySource: (overrideSource as any) || apiKeySource,
      userApiKeys: userApiKeys.filter(k => k.trim() !== ''),
      proxyUrl: proxyUrl.trim(),
      proxyKey: proxyKey.trim(),
      proxyUrl2: proxyUrl2.trim(),
      proxyKey2: proxyKey2.trim(),
      proxyModel,
      proxyModels,
      model: selectedModel,
      economyModel: selectedEconomyModel,
      combatModel: selectedCombatModel,
      storyFallback,
      economyFallback,
      combatFallback,
      safetySettings,
      autoGenerateNpcAvatars,
      avatarGenerationEngine: selectedAvatarEngine,
      embeddingModel: selectedEmbeddingModel,
      ragTopK,
      apiTimeout,
      perspectiveMode,
      offlineCombatAiConfig: offlineAiConfig,
      architectureMode,
      temperature,
      topK,
      topP,
      maxOutputTokens,
      thinkingBudget,
      modelThinkingLevels,
      jsonBuffer,
      useDeepReasoning,
      slowThinking,
      isSuperManualMode,
      matPhapManual,
      aiProvider: selectedProvider,
      accessoryPrompt,
      useExclusiveAccessoryPrompt,
      exclusivePromptSections,
      useAiOath,
      accessoryPresetFiles: JSON.parse(localStorage.getItem('accessory_preset_files') || '[]'),
    };
    return settingsToSave;
  };

  useEffect(() => {
    const loadedSettings = getApiSettings();
    setUserApiKeys(loadedSettings.userApiKeys.length > 0 ? loadedSettings.userApiKeys : ['']);
    setApiKeySource(loadedSettings.apiKeySource || 'system');
    setProxyUrl(loadedSettings.proxyUrl || '');
    setProxyKey(loadedSettings.proxyKey || '');
    setProxyUrl2(loadedSettings.proxyUrl2 || '');
    setProxyKey2(loadedSettings.proxyKey2 || '');
    if (loadedSettings.proxyUrl2) {
      setShowSecondaryProxy(true);
    }
    setProxyModel(loadedSettings.proxyModel || '');
    setProxyModels(loadedSettings.proxyModels || []);
    setSelectedModel(loadedSettings.model);
    setSelectedEconomyModel(loadedSettings.economyModel || loadedSettings.model || DEFAULT_API_CONFIG.model);
    setSelectedCombatModel(loadedSettings.combatModel || loadedSettings.model || DEFAULT_API_CONFIG.model);
    setStoryFallback(loadedSettings.storyFallback || { mode: 'auto', customList: [], recoveryStrategy: 'sequential' });
    setEconomyFallback(loadedSettings.economyFallback || { mode: 'auto', customList: [], recoveryStrategy: 'sequential' });
    setCombatFallback(loadedSettings.combatFallback || { mode: 'auto', customList: [], recoveryStrategy: 'sequential' });
    setSafetySettings(loadedSettings.safetySettings);
    setAutoGenerateNpcAvatars(loadedSettings.autoGenerateNpcAvatars);
    setSelectedAvatarEngine(loadedSettings.avatarGenerationEngine || DEFAULT_AVATAR_GENERATION_ENGINE);
    setSelectedEmbeddingModel(loadedSettings.embeddingModel || DEFAULT_EMBEDDING_MODEL_ID);
    setRagTopK(loadedSettings.ragTopK ?? (DEFAULT_API_CONFIG.ragTopK || 60));
    setApiTimeout(loadedSettings.apiTimeout ?? (DEFAULT_API_CONFIG.apiTimeout || 60));
    setPerspectiveMode(loadedSettings.perspectiveMode || 'firstPerson');
    setOfflineAiConfig(loadedSettings.offlineCombatAiConfig || DEFAULT_API_CONFIG.offlineCombatAiConfig);
    setCombatGraphicsConfig(loadedSettings.combatGraphicsConfig || DEFAULT_API_CONFIG.combatGraphicsConfig || DEFAULT_COMBAT_GRAPHICS_CONFIG);
    setArchitectureMode(loadedSettings.architectureMode || DEFAULT_API_CONFIG.architectureMode || 'standard');
    setTemperature(loadedSettings.temperature ?? (DEFAULT_API_CONFIG.temperature || 1.2));
    setTopK(loadedSettings.topK ?? (DEFAULT_API_CONFIG.topK || 500));
    setTopP(loadedSettings.topP ?? (DEFAULT_API_CONFIG.topP || 1.0));
    setMaxOutputTokens(loadedSettings.maxOutputTokens ?? (DEFAULT_API_CONFIG.maxOutputTokens || 52000));
    setThinkingBudget(loadedSettings.thinkingBudget ?? (DEFAULT_API_CONFIG.thinkingBudget || 20000));
    setModelThinkingLevels(loadedSettings.modelThinkingLevels || {});
    setJsonBuffer(loadedSettings.jsonBuffer ?? (DEFAULT_API_CONFIG.jsonBuffer || 5000));
    setUseDeepReasoning(loadedSettings.useDeepReasoning || false);
    setSlowThinking(loadedSettings.slowThinking || false);
    setIsSuperManualMode(loadedSettings.isSuperManualMode || false);
    setMatPhapManual(loadedSettings.matPhapManual || false);
    setUseAiOath(loadedSettings.useAiOath ?? DEFAULT_API_CONFIG.useAiOath);
    setSelectedProvider(loadedSettings.aiProvider || 'google');
    setAccessoryPrompt(loadedSettings.accessoryPrompt || '');
    setUseExclusiveAccessoryPrompt(loadedSettings.useExclusiveAccessoryPrompt || false);
    setExclusivePromptSections(loadedSettings.exclusivePromptSections || DEFAULT_API_CONFIG.exclusivePromptSections || {
      thinkingProtocol: false,
      nhanCach: false,
      gocNhin: false,
      doDai: false,
      vanPhong: false,
      boTuVung: false,
      truyenNgucTu: false,
      quyTacHeThong: false,
      chiThiMC: false,
      docTrangThai: false,
    });
    
    // Load models with the settings we just loaded
    loadModels(false, {
      source: loadedSettings.apiKeySource || 'system',
      url: loadedSettings.proxyUrl || '',
      key: loadedSettings.proxyKey || '',
      userKeys: loadedSettings.userApiKeys || [''],
      savedModel: loadedSettings.model,
      savedEconomyModel: loadedSettings.economyModel || loadedSettings.model,
      savedCombatModel: loadedSettings.combatModel || loadedSettings.model,
      provider: loadedSettings.aiProvider || 'google',
      proxyUrl2: loadedSettings.proxyUrl2 || '',
      proxyKey2: loadedSettings.proxyKey2 || ''
    });

    // API WATCHDOG RECOVERY REMOVED
  }, []);

  const loadModels = async (isManual = false, overrideParams?: { 
    source: string, 
    url: string, 
    key: string, 
    userKeys: string[],
    savedModel?: string,
    savedEconomyModel?: string,
    savedCombatModel?: string,
    provider?: string,
    proxyUrl2?: string,
    proxyKey2?: string
  }) => {
    if (isManual) {
      setIsLoadingModels(true);
    }
    try {
      const { fetchAvailableModels } = await import('../services/geminiService');
      
      let models: {id: string, name: string}[] = [];
      let userSuccessKeyIndex = -1;
      let userTotalKeysCount = 0;
      
      const currentSource = overrideParams ? overrideParams.source : apiKeySource;
      const currentUrl = overrideParams ? overrideParams.url : proxyUrl;
      const currentKey = overrideParams ? overrideParams.key : proxyKey;
      const currentUserKeys = overrideParams ? overrideParams.userKeys : userApiKeys;
      const currentProvider = overrideParams?.provider || selectedProvider;
      const currentProxyUrl2 = overrideParams && ('proxyUrl2' in overrideParams) ? overrideParams.proxyUrl2 : proxyUrl2;
      const currentProxyKey2 = overrideParams && ('proxyKey2' in overrideParams) ? overrideParams.proxyKey2 : proxyKey2;

      if (isManual) {
        setLoadModelStatus('Đang cập nhật danh sách Model...');
      }

      const prospectiveSettings = getProspectiveSettings(currentSource);

      // Fetch story models
      const fetchModelsWithTimeout = async (apiKey?: string, url?: string, key?: string, settings?: any) => {
        const fetchPromise = fetchAvailableModels(apiKey, url, key, settings);
        const timeoutPromise = new Promise<{id: string, name: string}[]>((_, reject) => 
          setTimeout(() => reject(new Error('fetching_timeout')), 10000)
        );
        
        try {
          return await Promise.race([fetchPromise, timeoutPromise]);
        } catch (error: any) {
          if (error.message === 'fetching_timeout') {
            console.warn("Tải danh sách model quá 10s, sử dụng model dự phòng.");
            return [{ id: 'gemini-flash-latest', name: 'Gemini Flash Latest' }];
          }
          throw error;
        }
      };

      if (currentSource === 'proxy') {
        if (!currentUrl) {
            if (isManual) setError("Vui lòng nhập URL Proxy.");
            return;
        }
        
        if (currentProvider !== 'google') {
           // Try to load from proxy first, if it fails use predefined
           if (isManual) {
             setLoadModelStatus('Đang tải model từ Proxy...');
             try {
                models = await fetchModelsWithTimeout(undefined, currentUrl, currentKey, prospectiveSettings);
             } catch (e) {
                console.warn("Proxy listing failed, using predefined list for", currentProvider);
                models = PROVIDER_MODELS[currentProvider] || AVAILABLE_MODELS;
             }
           } else {
              models = PROVIDER_MODELS[currentProvider] || AVAILABLE_MODELS;
           }
        } else {
           if (isManual) setLoadModelStatus('Đang tải model từ Proxy...');
           try {
             models = await fetchModelsWithTimeout(undefined, currentUrl, currentKey, prospectiveSettings);
           } catch (err: any) {
             console.warn("Proxy model listing failed, using default models:", err?.message || err);
             if (isManual) {
               setError(`Không thể tải danh sách model từ Proxy: ${err?.message || String(err)}`);
             }
             models = AVAILABLE_MODELS;
           }
        }
      } else {
        if (currentProvider === 'google') {
          if (currentSource === 'system') {
            if (isManual) setLoadModelStatus('Đang tải model từ Google AI...');
            const overrideKey = (typeof process !== 'undefined' && (process.env?.API_KEY || process.env?.GEMINI_API_KEY)) || 'system-proxy-key';
            try {
              models = await fetchModelsWithTimeout(overrideKey, undefined, undefined, prospectiveSettings);
            } catch (err) {
              console.warn("System key failed to fetch models:", err);
              models = AVAILABLE_MODELS;
            }
          } else if (currentSource === 'user') {
            const validKeys = currentUserKeys.map(k => k.trim()).filter(k => k !== '');
            userTotalKeysCount = validKeys.length;
            if (validKeys.length === 0) {
              if (isManual) setError("Chưa nhập API Key cá nhân nào.");
              return;
            }

            let fetchedModels: {id: string, name: string}[] = [];
            for (let i = 0; i < validKeys.length; i++) {
              const currentKey = validKeys[i];
              if (isManual) setLoadModelStatus(`Đang kiểm tra Key cá nhân #${i + 1}/${validKeys.length}...`);
              try {
                const res = await fetchModelsWithTimeout(currentKey, undefined, undefined, prospectiveSettings);
                if (Array.isArray(res) && res.length > 0) {
                  fetchedModels = res;
                  userSuccessKeyIndex = i + 1;
                  break;
                }
              } catch (err) {
                console.warn(`API Key cá nhân #${i + 1} tải danh sách model thất bại:`, err);
              }
            }

            if (fetchedModels.length === 0) {
              if (isManual) {
                setError(`Tất cả ${validKeys.length} API Key cá nhân đều không thể tải danh sách model (Lỗi hoặc danh sách rỗng).`);
              }
              models = AVAILABLE_MODELS;
            } else {
              models = fetchedModels;
            }
          }
        } else {
          models = PROVIDER_MODELS[currentProvider] || AVAILABLE_MODELS;
        }
      }

      const sortedModels = sortModelObjects(models);
      setAvailableModels(sortedModels);

      // Fetch Image Models (NPC Avatar)
      try {
        const validImgUserKeys = currentUserKeys.map(k => k.trim()).filter(k => k !== '');
        const imgKey = currentSource === 'user' 
          ? (userSuccessKeyIndex > 0 ? validImgUserKeys[userSuccessKeyIndex - 1] : validImgUserKeys[0]) 
          : undefined;
        const imgModels = await fetchImageModelsList(imgKey, prospectiveSettings);
        setImageModelsList(imgModels);
      } catch (imgErr) {
        console.warn("Error loading image models:", imgErr);
        setImageModelsList(AVAILABLE_AVATAR_ENGINES);
      }
      
      let activeSecondaryModels = sortedModels;

      // Only load Proxy 2 if selected source is 'proxy' and we have proxy 2 configured
      if (currentSource === 'proxy' && currentProxyUrl2 && currentProxyUrl2.trim() !== '') {
        if (isManual) {
          const mainSourceName = currentSource === 'system' 
            ? 'Key Hệ Thống' 
            : currentSource === 'user' 
              ? 'Key Cá Nhân' 
              : 'Proxy 1';
          setLoadModelStatus(`Đã xong ${mainSourceName}. Chờ 1s...`);
          await new Promise(resolve => setTimeout(resolve, 1000));
          setLoadModelStatus('Đang tải Proxy 2...');
        }
        try {
          const p2Models = await fetchModelsWithTimeout(undefined, currentProxyUrl2, currentProxyKey2, prospectiveSettings);
          const sortedP2Models = sortModelObjects(p2Models);
          setSecondaryModels(sortedP2Models);
          if (sortedP2Models.length > 0) {
            activeSecondaryModels = sortedP2Models;
          }
        } catch (err: any) {
          console.error("Failed to load models for Proxy 2", err);
          if (isManual) {
            setError(`Đã tải Proxy 1, nhưng lỗi tải Proxy 2: ${err.message || String(err)}`);
          }
        }
      } else {
        setSecondaryModels([]);
      }

      // Only set defaults if current selections are invalid or empty
      const hasDefaultModel = sortedModels.some(m => m.id === DEFAULT_API_CONFIG.model);
      const hasFlashLite = sortedModels.some(m => m.id === DEFAULT_FLASH_LITE_MODEL_ID);
      const defaultModel = hasDefaultModel ? DEFAULT_API_CONFIG.model : (hasFlashLite ? DEFAULT_FLASH_LITE_MODEL_ID : (sortedModels.length > 0 ? sortedModels[0].id : ''));
      
      const effectiveSelectedModel = overrideParams?.savedModel || selectedModel;
      const effectiveEconomyModel = overrideParams?.savedEconomyModel || selectedEconomyModel;
      const effectiveCombatModel = overrideParams?.savedCombatModel || selectedCombatModel;

      if (defaultModel) {
        if (!effectiveSelectedModel || !sortedModels.some(m => m.id === effectiveSelectedModel)) {
          setSelectedModel(defaultModel);
        } else if (overrideParams?.savedModel) {
          setSelectedModel(overrideParams.savedModel);
        }

        const defaultEconomyModel = activeSecondaryModels.some(m => m.id === DEFAULT_API_CONFIG.model) 
          ? DEFAULT_API_CONFIG.model 
          : (activeSecondaryModels.length > 0 ? activeSecondaryModels[0].id : defaultModel);

        if (!effectiveEconomyModel || !activeSecondaryModels.some(m => m.id === effectiveEconomyModel)) {
          setSelectedEconomyModel(defaultEconomyModel);
        } else if (overrideParams?.savedEconomyModel) {
          setSelectedEconomyModel(overrideParams.savedEconomyModel);
        }

        const defaultCombatModel = activeSecondaryModels.some(m => m.id === DEFAULT_API_CONFIG.model) 
          ? DEFAULT_API_CONFIG.model 
          : (activeSecondaryModels.length > 0 ? activeSecondaryModels[0].id : defaultModel);

        if (!effectiveCombatModel || !activeSecondaryModels.some(m => m.id === effectiveCombatModel)) {
          setSelectedCombatModel(defaultCombatModel);
        } else if (overrideParams?.savedCombatModel) {
          setSelectedCombatModel(overrideParams.savedCombatModel);
        }
      }

      if (isManual) {
        // Tự động lưu nguồn API (Proxy / Key Hệ Thống / Key Cá Nhân) vào localStorage
        try {
          const existingSettings = getApiSettings();
          const updatedSettings: ApiConfig = {
            ...existingSettings,
            apiKeySource: currentSource as any,
            availableModels: models.length > 0 ? models.map(m => m.id) : (existingSettings.availableModels || [])
          };

          if (currentSource === 'proxy') {
            updatedSettings.proxyUrl = currentUrl;
            updatedSettings.proxyKey = currentKey;
            if (currentProxyUrl2 !== undefined) updatedSettings.proxyUrl2 = currentProxyUrl2;
            if (currentProxyKey2 !== undefined) updatedSettings.proxyKey2 = currentProxyKey2;
          } else if (currentSource === 'user') {
            const validKeys = currentUserKeys.map(k => k.trim()).filter(k => k !== '');
            if (validKeys.length > 0) {
              updatedSettings.userApiKeys = validKeys;
            }
          }

          saveApiSettings(updatedSettings);
        } catch (saveErr) {
          console.warn("Không thể tự động lưu nguồn API vào localStorage:", saveErr);
        }

        if (currentSource === 'proxy') {
          if (currentProxyUrl2 && currentProxyUrl2.trim() !== '') {
            setSuccessMessage("Đã cập nhật danh sách model từ Proxy 1, Proxy 2 & tự động lưu nguồn API là Proxy thành công.");
          } else {
            setSuccessMessage("Đã cập nhật danh sách model & tự động lưu nguồn API là Proxy thành công.");
          }
          setError('');
        } else if (currentSource === 'user') {
          if (userSuccessKeyIndex > 0) {
            setSuccessMessage(`Đã lấy thành công ${models.length} model từ API Key cá nhân #${userSuccessKeyIndex} (Tổng số ${userTotalKeysCount} Key) & tự động lưu nguồn API là Key Cá Nhân thành công.`);
            setError('');
          } else {
            setError(`Tất cả ${userTotalKeysCount} API Key cá nhân đều không thể tải danh sách model.`);
          }
        } else {
          setSuccessMessage("Đã cập nhật danh sách model & tự động lưu nguồn API là Key Hệ Thống thành công.");
          setError('');
        }
      }
    } catch (e) {
      console.warn("Failed to load models dynamically", e);
      if (isManual) {
        setError("Không thể tải danh sách model. Vui lòng kiểm tra API Key hoặc Proxy.");
      }
    } finally {
      if (isManual) {
        setIsLoadingModels(false);
        setLoadModelStatus('');
      }
    }
  };

  const handleVerifyConnection = async () => {
    setIsLoadingModels(true);
    setError('');
    setSuccessMessage('Đang kiểm tra kết nối API...');
    
    try {
      const result = await verifyApiConnection(true, 'combat', getProspectiveSettings());
      
      if (result.success) {
        setSuccessMessage(`Kết nối thành công! Model: ${result.model} (${result.source})`);
        // Tải lại danh sách model sau khi verify thành công
        loadModels(true);
      } else {
        setError(`Kết nối thất bại: ${result.error || 'Lỗi không xác định'}`);
        setSuccessMessage('');
      }
    } catch (e) {
      setError(`Lỗi hệ thống khi kiểm tra: ${e instanceof Error ? e.message : String(e)}`);
      setSuccessMessage('');
    } finally {
      setIsLoadingModels(false);
    }
  };

  const handleReloadModels = () => {
    handleVerifyConnection();
  };

  const checkKeyAuthorizedModels = async (key: string, index: number) => {
    if (!key.trim()) {
      setError("Vui lòng điền API Key trước khi kiểm tra model khả dụng.");
      return;
    }
    setIsCheckingKeyModels(true);
    setError('');
    setSuccessMessage('');
    try {
      const { fetchAvailableModels } = await import('../services/geminiService');
      const res = await fetchAvailableModels(key.trim(), undefined, undefined, getProspectiveSettings());
      setCheckedModelsList(res || []);
      setCheckingKeyIndex(index);
      setIsModelListModalOpen(true);
    } catch (err: any) {
      setError(`Lỗi: Khóa API này không hợp lệ hoặc không có quyền truy cập model nào. Chi tiết: ${err?.message || String(err)}`);
    } finally {
      setIsCheckingKeyModels(false);
    }
  };

  const handleOfflineAiConfigChange = (e: ChangeEvent<HTMLSelectElement>) => {
    const { name, value } = e.target;
    setOfflineAiConfig(prev => ({
        ...prev,
        [name]: value
    }));
    if (successMessage) setSuccessMessage('');
  };

  const handleCombatGraphicsConfigChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target as HTMLInputElement;
    const checked = (e.target as HTMLInputElement).checked;
    setCombatGraphicsConfig(prev => ({
        ...prev,
        [name]: type === 'checkbox' ? checked : (name === 'combatEngineMode' ? value : parseFloat(value))
    }));
    if (successMessage) setSuccessMessage('');
  };

  const handleUserApiKeyChange = (index: number, value: string) => {
    const newKeys = [...userApiKeys];
    newKeys[index] = value;
    setUserApiKeys(newKeys);
    if (error) setError('');
    if (successMessage) setSuccessMessage('');
  };

  const handleAddApiKey = () => {
    setUserApiKeys([...userApiKeys, '']);
  };

  const handleRemoveApiKey = (index: number) => {
    if (userApiKeys.length > 1) {
      const newKeys = userApiKeys.filter((_, i) => i !== index);
      setUserApiKeys(newKeys);
    } else {
      setUserApiKeys(['']);
    }
  };

  const handleModelChange = (e: ChangeEvent<HTMLSelectElement>) => {
    setSelectedModel(e.target.value);
    if (successMessage) setSuccessMessage('');
  };

  const handleThinkingLevelChange = (modelId: string, level: string) => {
    const cleanId = cleanThinkingModelId(modelId);
    setModelThinkingLevels(prev => {
      const next = { ...prev };
      if (!level || level === 'auto') {
        delete next[cleanId];
      } else {
        next[cleanId] = level;
      }
      return next;
    });
    if (successMessage) setSuccessMessage('');
  };

  const handleAvatarEngineChange = (e: ChangeEvent<HTMLSelectElement>) => {
    setSelectedAvatarEngine(e.target.value as AvatarGenerationEngine);
    if (successMessage) setSuccessMessage('');
  };

  const handleEmbeddingModelChange = (e: ChangeEvent<HTMLSelectElement>) => {
    const newModel = e.target.value;
    if (newModel.startsWith('TaylorAI/')) {
        const isInstalled = localStorage.getItem(`installed_${newModel}`) === 'true';
        if (!isInstalled) {
            setPendingEmbeddingModel(newModel);
            setShowLocalModelConfirm(true);
        } else {
            // Already installed, just initialize (it will be fast as it's in cache)
            setSelectedEmbeddingModel(newModel);
            initLocalEmbeddingModel(newModel).catch(err => {
                console.error("Delayed local model init failed:", err);
            });
        }
    } else {
        setSelectedEmbeddingModel(newModel);
    }
    if (successMessage) setSuccessMessage('');
  };

  const handleInstallLocalModel = async () => {
    setShowLocalModelConfirm(false);
    
    // Small delay to ensure the confirmation modal closes and progress modal can render
    await new Promise(resolve => setTimeout(resolve, 300));
    
    setIsInstallingLocalModel(true);
    setInstallProgress(0);
    setDownloadedBytes(0);
    setInstallStatus('Đang chuẩn bị tải về...');
    setError('');

    try {
        await initLocalEmbeddingModel(pendingEmbeddingModel, (progress) => {
            if (progress.status === 'progress') {
                setInstallProgress(progress.progress || 0);
                if (progress.loaded) setDownloadedBytes(progress.loaded);
                setInstallStatus(`Đang tải file model...`);
            } else if (progress.status === 'initiate') {
                setInstallStatus(`Đang khởi tạo tải: ${progress.file}`);
            } else if (progress.status === 'done') {
                setInstallStatus(`Tải xong file: ${progress.file}`);
            }
        });
        
        localStorage.setItem(`installed_${pendingEmbeddingModel}`, 'true');
        setSelectedEmbeddingModel(pendingEmbeddingModel);
        setSuccessMessage(`Đã cài đặt model ${pendingEmbeddingModel} thành công!`);
    } catch (err) {
        console.error("Local model install error:", err);
        setError(`Lỗi khi cài đặt model nội bộ: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
        setIsInstallingLocalModel(false);
    }
  };


  const handleEconomyModelChange = (e: ChangeEvent<HTMLSelectElement>) => {
    setSelectedEconomyModel(e.target.value);
    if (successMessage) setSuccessMessage('');
  };

  const handleCombatModelChange = (e: ChangeEvent<HTMLSelectElement>) => {
    setSelectedCombatModel(e.target.value);
    if (successMessage) setSuccessMessage('');
  };

  const handleSafetySettingChange = (category: HarmCategory, newThresholdValue: string) => {
    const newThreshold = newThresholdValue as HarmBlockThreshold;
    setSafetySettings(prevSettings =>
      prevSettings.map(setting =>
        setting.category === category ? { ...setting, threshold: newThreshold } : setting
      )
    );
    if (successMessage) setSuccessMessage('');
  };

  const handleAutoGenerateNpcAvatarsChange = (e: ChangeEvent<HTMLInputElement>) => {
    setAutoGenerateNpcAvatars(e.target.checked);
    if (successMessage) setSuccessMessage('');
  };
  
  const handleExportKeys = () => {
    const validKeys = userApiKeys.filter(k => k && k.trim() !== '');
    if (validKeys.length === 0) {
        setError("Không có API key nào để xuất.");
        return;
    }
    const fileContent = validKeys.join('\n');
    const blob = new Blob([fileContent], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'gemini_api_keys.txt';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    setSuccessMessage(`Đã xuất ${validKeys.length} key thành công.`);
  };

  const handleImportFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (file.type !== 'text/plain') {
        setError("Vui lòng chọn một file .txt hợp lệ.");
        return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
        try {
            const content = e.target?.result as string;
            const keysFromFile = content
                .split('\n')
                .map(k => k.trim())
                .filter(k => k !== '');

            if (keysFromFile.length > 0) {
                setUserApiKeys(keysFromFile);
                setSuccessMessage(`Đã nhập ${keysFromFile.length} key thành công. Nhấn 'Lưu Thiết Lập' để áp dụng.`);
                setError('');
            } else {
                setError("File không chứa API key hợp lệ nào.");
            }
        } catch (error) {
            setError("Lỗi khi đọc file. Vui lòng kiểm tra lại file.");
            console.error("Error reading API key file:", error);
        }
    };
    reader.onerror = () => {
        setError("Lỗi khi đọc file.");
    };
    reader.readAsText(file);
    if (event.target) event.target.value = "";
  };

  const handleExportAllApiSettings = () => {
    const defaultName = `gemini_all_settings_${new Date().toISOString().split('T')[0]}`;
    setExportFileName(defaultName);
    setIsExportModalOpen(true);
  };

  const handleConfirmExport = () => {
    try {
      const allSettings = getProspectiveSettings();
      const fileContent = JSON.stringify(allSettings, null, 2);
      const blob = new Blob([fileContent], { type: 'text/plain;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      
      let finalName = exportFileName.trim();
      if (!finalName) {
        finalName = `gemini_all_settings_${new Date().toISOString().split('T')[0]}`;
      }
      if (!finalName.endsWith('.txt')) {
        finalName += '.txt';
      }
      
      link.download = finalName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      
      setSuccessMessage(`Đã tải về cấu hình API thành công với tên file: "${finalName}"`);
      setError('');
      setIsExportModalOpen(false);
    } catch (err: any) {
      setError(`Lỗi khi xuất cấu hình: ${err?.message || String(err)}`);
    }
  };

  const handleImportAllApiSettingsChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const content = e.target?.result as string;
        const loadedSettings = JSON.parse(content) as ApiConfig;
        
        if (loadedSettings && (loadedSettings.model || loadedSettings.apiKeySource)) {
          setUserApiKeys(loadedSettings.userApiKeys?.length > 0 ? loadedSettings.userApiKeys : ['']);
          setApiKeySource(loadedSettings.apiKeySource || 'system');
          setProxyUrl(loadedSettings.proxyUrl || '');
          setProxyKey(loadedSettings.proxyKey || '');
          setProxyUrl2(loadedSettings.proxyUrl2 || '');
          setProxyKey2(loadedSettings.proxyKey2 || '');
          setShowSecondaryProxy(!!loadedSettings.proxyUrl2);
          setProxyModel(loadedSettings.proxyModel || '');
          setProxyModels(loadedSettings.proxyModels || []);
          setSelectedModel(loadedSettings.model);
          setSelectedEconomyModel(loadedSettings.economyModel || loadedSettings.model || DEFAULT_API_CONFIG.model);
          setSelectedCombatModel(loadedSettings.combatModel || loadedSettings.model || DEFAULT_API_CONFIG.model);
          setStoryFallback(loadedSettings.storyFallback || { mode: 'auto', customList: [], recoveryStrategy: 'sequential' });
          setEconomyFallback(loadedSettings.economyFallback || { mode: 'auto', customList: [], recoveryStrategy: 'sequential' });
          setCombatFallback(loadedSettings.combatFallback || { mode: 'auto', customList: [], recoveryStrategy: 'sequential' });
          setSafetySettings(loadedSettings.safetySettings || DEFAULT_API_CONFIG.safetySettings);
          setAutoGenerateNpcAvatars(!!loadedSettings.autoGenerateNpcAvatars);
          setSelectedAvatarEngine(loadedSettings.avatarGenerationEngine || DEFAULT_AVATAR_GENERATION_ENGINE);
          setSelectedEmbeddingModel(loadedSettings.embeddingModel || DEFAULT_EMBEDDING_MODEL_ID);
          setRagTopK(loadedSettings.ragTopK ?? (DEFAULT_API_CONFIG.ragTopK || 60));
          setPerspectiveMode(loadedSettings.perspectiveMode || 'thirdPersonOmniscient');
          setOfflineAiConfig(loadedSettings.offlineCombatAiConfig || DEFAULT_API_CONFIG.offlineCombatAiConfig);
          setCombatGraphicsConfig(loadedSettings.combatGraphicsConfig || DEFAULT_API_CONFIG.combatGraphicsConfig || DEFAULT_COMBAT_GRAPHICS_CONFIG);
          setArchitectureMode(loadedSettings.architectureMode || 'standard');
          setTemperature(loadedSettings.temperature ?? (DEFAULT_API_CONFIG.temperature || 1.2));
          setTopK(loadedSettings.topK ?? (DEFAULT_API_CONFIG.topK || 500));
          setTopP(loadedSettings.topP ?? (DEFAULT_API_CONFIG.topP || 1.0));
          setMaxOutputTokens(loadedSettings.maxOutputTokens ?? (DEFAULT_API_CONFIG.maxOutputTokens || 52000));
          setThinkingBudget(loadedSettings.thinkingBudget ?? (DEFAULT_API_CONFIG.thinkingBudget || 20000));
          setModelThinkingLevels(loadedSettings.modelThinkingLevels || {});
          setJsonBuffer(loadedSettings.jsonBuffer ?? (DEFAULT_API_CONFIG.jsonBuffer || 5000));
          setUseDeepReasoning(!!loadedSettings.useDeepReasoning);
          setSlowThinking(!!loadedSettings.slowThinking);
          setIsSuperManualMode(!!loadedSettings.isSuperManualMode);
          setMatPhapManual(!!loadedSettings.matPhapManual);
          setUseAiOath(!!loadedSettings.useAiOath);
          setApiTimeout(loadedSettings.apiTimeout ?? (DEFAULT_API_CONFIG.apiTimeout || 60));
          setUseExclusiveAccessoryPrompt(!!loadedSettings.useExclusiveAccessoryPrompt);
          setExclusivePromptSections(loadedSettings.exclusivePromptSections || DEFAULT_API_CONFIG.exclusivePromptSections || {});
          setSelectedProvider(loadedSettings.aiProvider || 'google');

          if (loadedSettings.accessoryPresetFiles) {
            localStorage.setItem('accessory_preset_files', JSON.stringify(loadedSettings.accessoryPresetFiles));
            setPresetRefreshKey(prev => prev + 1);
          }

          setSuccessMessage("Đã nhập toàn bộ cấu hình thành công. Vui lòng kiểm tra và nhấn 'Lưu Thiết Lập'.");
          setError('');
        } else {
          setError("File không chứa cấu hình API hợp lệ.");
        }
      } catch (err: any) {
        setError(`Lỗi khi đọc file cấu hình: ${err?.message || "Định dạng không hợp lệ"}`);
      }
    };
    reader.readAsText(file);
    if (event.target) event.target.value = "";
  };

  const handleProviderChange = (e: ChangeEvent<HTMLSelectElement>) => {
    const newProvider = e.target.value;
    setSelectedProvider(newProvider);
    // Auto load models for the new provider
    const models = PROVIDER_MODELS[newProvider] || AVAILABLE_MODELS;
    const sortedModels = sortModelObjects(models);
    setAvailableModels(sortedModels);
    
    // Reset selections if they are not in the new list
    if (sortedModels.length > 0) {
      if (!sortedModels.some(m => m.id === selectedModel)) setSelectedModel(sortedModels[0].id);
      if (!sortedModels.some(m => m.id === selectedEconomyModel)) setSelectedEconomyModel(sortedModels[0].id);
      if (!sortedModels.some(m => m.id === selectedCombatModel)) setSelectedCombatModel(sortedModels[0].id);
    }
  };

  const handleSaveSettings = async () => {
    const validKeys = userApiKeys.map(k => k.trim()).filter(k => k !== '');

    if (apiKeySource === 'user' && validKeys.length === 0) {
      setError(VIETNAMESE.apiKeyRequiredError);
      return;
    }
    setError('');

    // Filter fallback lists to only include models currently available in this source
    const filterAvailable = (list: string[]) => {
      if (availableModels.length === 0) return list;
      return list.filter(id => availableModels.some(m => m.id === id));
    };
    
    const settingsToSave: ApiConfig = { 
      apiKeySource: apiKeySource,
      userApiKeys: validKeys.length > 0 ? validKeys : [''],
      model: selectedModel,
      economyModel: selectedEconomyModel,
      combatModel: selectedCombatModel,
      storyFallback: { ...storyFallback, customList: filterAvailable(storyFallback.customList) },
      economyFallback: { ...economyFallback, customList: filterAvailable(economyFallback.customList) },
      combatFallback: { ...combatFallback, customList: filterAvailable(combatFallback.customList) },
      safetySettings: safetySettings,
      autoGenerateNpcAvatars: autoGenerateNpcAvatars,
      avatarGenerationEngine: selectedAvatarEngine,
      embeddingModel: selectedEmbeddingModel,
      ragTopK: ragTopK,
      apiTimeout: apiTimeout,
      perspectiveMode: perspectiveMode,
      offlineCombatAiConfig: offlineAiConfig,
      combatGraphicsConfig: combatGraphicsConfig,
      architectureMode: architectureMode,
      temperature: temperature,
      topK: topK,
      topP: topP,
      maxOutputTokens: maxOutputTokens,
      thinkingBudget: thinkingBudget,
      modelThinkingLevels: modelThinkingLevels,
      jsonBuffer: jsonBuffer,
      availableModels: availableModels.map(m => m.id),
      proxyUrl: proxyUrl,
      proxyKey: proxyKey,
      proxyUrl2: proxyUrl2,
      proxyKey2: proxyKey2,
      proxyModel: proxyModel,
      proxyModels: proxyModels,
      useDeepReasoning: useDeepReasoning,
      slowThinking: slowThinking,
      isSuperManualMode: isSuperManualMode,
      matPhapManual: matPhapManual,
      useAiOath: useAiOath,
      aiProvider: selectedProvider,
      accessoryPrompt: accessoryPrompt,
      useExclusiveAccessoryPrompt: useExclusiveAccessoryPrompt,
      exclusivePromptSections: exclusivePromptSections,
      accessoryPresetFiles: JSON.parse(localStorage.getItem('accessory_preset_files') || '[]'),
    };
    localStorage.setItem(API_SETTINGS_STORAGE_KEY, JSON.stringify(settingsToSave));
    
    setSuccessMessage(VIETNAMESE.settingsSavedMessage);
    onSettingsSavedNotification(); 
  };
  
  const handleGameplaySettingChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    if (!knowledgeBase || !setKnowledgeBase) return;

    setKnowledgeBase(prevKb => {
        if (!prevKb.worldConfig) return prevKb;
        
        const newKb = JSON.parse(JSON.stringify(prevKb));
        
        if (type === 'checkbox') {
            const checked = (e.target as HTMLInputElement).checked;
            (newKb.worldConfig as any)[name] = checked;
        } else {
            const numValue = parseInt(value, 10);
            (newKb.worldConfig as any)[name] = isNaN(numValue) ? value : numValue;
        }
        return newKb;
    });
  };


  const handleFallbackModeChange = (target: 'story' | 'economy' | 'combat', mode: 'auto' | 'custom') => {
    const updateState = (prev: FallbackSettings) => {
      let newList = [...prev.customList];
      // If switching to custom and list is empty, pre-populate with current selection + some defaults
      if (mode === 'custom' && newList.length === 0) {
        const currentModel = target === 'story' ? selectedModel : target === 'economy' ? selectedEconomyModel : selectedCombatModel;
        newList = [currentModel];
        
        // Add some sensible defaults from available models if they exist
        const defaults = target === 'story' 
          ? ['gemini-pro-latest', 'gemini-flash-latest', 'gemini-flash-lite-latest'] 
          : ['gemini-flash-latest', 'gemini-flash-lite-latest'];
          
        defaults.forEach(d => {
          if (availableModels.some(m => m.id === d) && !newList.includes(d)) {
            newList.push(d);
          }
        });
      }
      return { ...prev, mode, customList: newList };
    };

    switch (target) {
      case 'story': setStoryFallback(prev => updateState(prev)); break;
      case 'economy': setEconomyFallback(prev => updateState(prev)); break;
      case 'combat': setCombatFallback(prev => updateState(prev)); break;
    }
  };

  const handleFallbackModelToggle = (target: 'story' | 'economy' | 'combat', modelId: string, checked: boolean) => {
    const setState = target === 'story' ? setStoryFallback : target === 'economy' ? setEconomyFallback : setCombatFallback;
    setState(prev => {
      let newList = [...prev.customList];
      if (checked && !newList.includes(modelId)) {
        newList.push(modelId);
      } else if (!checked) {
        newList = newList.filter(m => m !== modelId);
      }
      return { ...prev, mode: 'custom', customList: newList };
    });
  };

  const handleFallbackMove = (target: 'story' | 'economy' | 'combat', index: number, direction: 'up' | 'down') => {
    const setState = target === 'story' ? setStoryFallback : target === 'economy' ? setEconomyFallback : setCombatFallback;
    setState(prev => {
      const newList = [...prev.customList];
      const targetIndex = direction === 'up' ? index - 1 : index + 1;
      if (targetIndex >= 0 && targetIndex < newList.length) {
        [newList[index], newList[targetIndex]] = [newList[targetIndex], newList[index]];
      }
      return { ...prev, customList: newList };
    });
  };

  const handleClearAllFallbacks = (target: 'story' | 'economy' | 'combat') => {
    const setState = target === 'story' ? setStoryFallback : target === 'economy' ? setEconomyFallback : setCombatFallback;
    setState(prev => ({ ...prev, customList: [] }));
  };

  const handleToggleRecoveryStrategy = (target: 'story' | 'economy' | 'combat') => {
    const setState = target === 'story' ? setStoryFallback : target === 'economy' ? setEconomyFallback : setCombatFallback;
    setState(prev => ({
      ...prev,
      recoveryStrategy: prev.recoveryStrategy === 'last_successful' ? 'sequential' : 'last_successful'
    }));
  };

  const handleApplyWorkingModelsToFallback = (workingModelIds: string[]) => {
    if (workingModelIds.length === 0) return;

    // Giữ nguyên chế độ fallback hiện tại của từng mục, chỉ thay thế customList
    setStoryFallback(prev => ({ ...prev, customList: workingModelIds }));
    setEconomyFallback(prev => ({ ...prev, customList: workingModelIds }));
    setCombatFallback(prev => ({ ...prev, customList: workingModelIds }));

    // Tự động lưu vào localStorage để có hiệu lực ngay
    try {
      const existing = getApiSettings();
      const updated: ApiConfig = {
        ...existing,
        storyFallback: { ...existing.storyFallback, customList: workingModelIds },
        economyFallback: { ...existing.economyFallback, customList: workingModelIds },
        combatFallback: { ...existing.combatFallback, customList: workingModelIds },
      };
      saveApiSettings(updated);
    } catch (err) {
      console.warn("Lỗi khi tự động lưu cấu hình Fallback:", err);
    }

    setSuccessMessage(`Đã đưa ${workingModelIds.length} model hoạt động vào danh sách Fallback (Cốt truyện, Kinh tế, Chiến đấu) & tự động lưu cấu hình.`);
    setError('');
  };

  const renderFallbackModal = () => {
    if (!fallbackModalTarget) return null;
    
    const currentFallbackData = fallbackModalTarget === 'story' ? storyFallback : fallbackModalTarget === 'economy' ? economyFallback : combatFallback;
    const targetTitle = fallbackModalTarget === 'story' ? "(CỐT TRUYỆN CHÍNH)" : fallbackModalTarget === 'economy' ? "(KINH TẾ & ĐẤU GIÁ)" : "(XỬ LÝ CHIẾN ĐẤU)";

    return (
      <Modal 
        isOpen={true} 
        onClose={() => setFallbackModalTarget(null)} 
        title={`CẤU HÌNH MODEL DỰ PHÒNG (FALLBACK)`}
        maxWidth="max-w-5xl"
      >
        <div className="space-y-4 text-sm text-gray-200 p-1">
           <div className="border-b border-gray-700 pb-2">
             <h4 className="text-indigo-400 font-bold text-xs mb-0.5 uppercase tracking-wider">{targetTitle}</h4>
             <p className="text-gray-400 text-[10px]">Thiết lập danh sách các model thay thế tự động nếu gặp lỗi đường truyền hoặc quá tải.</p>
           </div>
           
           {/* Chế độ khôi phục - Compacted */}
           <div className="bg-gray-800/40 border border-gray-700 rounded-lg p-3 mb-4">
              <div className="flex items-center justify-between gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-0.5">
                    <h5 className="font-bold text-gray-200 uppercase text-[10px] tracking-widest">CHẾ ĐỘ KHÔI PHỤC:</h5>
                    <span className="text-rose-500 lowercase font-mono bg-rose-500/10 px-1.5 py-0.2 rounded text-[10px]">
                      {currentFallbackData.recoveryStrategy === 'last_successful' ? 'chạy gần nhất' : 'chạy lần lượt'}
                    </span>
                  </div>
                  <p className="text-[9px] text-gray-400 leading-tight">
                    {currentFallbackData.recoveryStrategy === 'last_successful' 
                      ? "Chạy từ model thành công gần nhất, nếu lỗi sẽ xoay vòng tiếp danh sách dự phòng."
                      : "Luôn thử từ model chính, nếu hỏng mới thử danh sách dự bị."}
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-[9px] font-bold text-gray-500 uppercase tracking-tighter">CHẠY LẦN LƯỢT</span>
                  <button 
                    onClick={() => handleToggleRecoveryStrategy(fallbackModalTarget)}
                    className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none ${currentFallbackData.recoveryStrategy === 'sequential' ? 'bg-indigo-600' : 'bg-gray-600'}`}
                  >
                    <span className={`inline-block h-3 w-3 transform rounded-full bg-white transition-transform ${currentFallbackData.recoveryStrategy === 'sequential' ? 'translate-x-5' : 'translate-x-1'}`} />
                  </button>
                </div>
              </div>
           </div>

           <div className="grid grid-cols-1 md:grid-cols-2 gap-4 h-[60vh]">
              {/* Bên trái: Danh sách đã chọn */}
              <div className="flex flex-col h-full bg-black/20 rounded-lg border border-gray-700 overflow-hidden">
                <div className="p-2 border-b border-gray-700 bg-gray-800/50 flex justify-between items-center">
                  <span className="text-[10px] font-bold text-rose-500 uppercase tracking-widest">DANH SÁCH DỰ PHÒNG ({currentFallbackData.customList.length})</span>
                  <button 
                    onClick={() => handleClearAllFallbacks(fallbackModalTarget)}
                    className="text-[9px] text-gray-400 hover:text-white underline transition-colors"
                  >
                    Xóa tất cả
                  </button>
                </div>
                
                <div className="flex-1 overflow-y-auto p-2 space-y-1.5 custom-scrollbar">
                  {currentFallbackData.customList.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-gray-500 italic text-center p-4">
                      <p className="text-[10px] font-bold text-gray-400">Chưa có model dự phòng nào.</p>
                      <p className="text-[9px] text-rose-400/85 mt-2 bg-rose-500/5 px-2 py-1 rounded border border-rose-500/10 max-w-[240px] leading-relaxed">
                        ⚠️ ĐÃ TẮT FALLBACK: Hệ thống sẽ chạy duy nhất mô hình được chọn ở bên ngoài.
                      </p>
                    </div>
                  ) : (
                    currentFallbackData.customList.map((modelId, idx) => {
                      const modelInfo = availableModels.find(m => m.id === modelId) || { name: modelId, id: modelId };
                      return (
                        <div key={modelId} className="flex items-center gap-2 p-2 bg-gray-800/40 rounded border border-gray-700 group hover:border-indigo-500/50 transition-all">
                          <span className="text-rose-500 font-mono font-bold text-[10px] w-4">#{idx + 1}</span>
                          <span className="flex-grow text-[11px] font-medium truncate text-gray-300">{modelInfo.name}</span>
                          <FallbackThinkingSelect
                            modelId={modelId}
                            modelThinkingLevels={modelThinkingLevels}
                            onChange={handleThinkingLevelChange}
                          />
                          <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button 
                              onClick={() => handleFallbackMove(fallbackModalTarget, idx, 'up')}
                              disabled={idx === 0}
                              className="p-1 hover:bg-gray-700 rounded text-gray-400 disabled:opacity-20"
                            >
                              <ChevronUp size={12} />
                            </button>
                            <button 
                              onClick={() => handleFallbackMove(fallbackModalTarget, idx, 'down')}
                              disabled={idx === currentFallbackData.customList.length - 1}
                              className="p-1 hover:bg-gray-700 rounded text-gray-400 disabled:opacity-20"
                            >
                              <ChevronDown size={12} />
                            </button>
                            <button 
                              onClick={() => handleFallbackModelToggle(fallbackModalTarget, modelId, false)}
                              className="p-1 hover:bg-red-900/50 rounded text-red-400"
                            >
                              <X size={12} />
                            </button>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
                <div className="p-1.5 bg-gray-800/20 border-t border-gray-700">
                  <p className="text-[8px] text-gray-500 italic leading-none">Thứ tự giảm dần (#1 ưu tiên cao nhất).</p>
                </div>
              </div>

              {/* Bên phải: Danh sách khả dụng */}
              <div className="flex flex-col h-full bg-black/20 rounded-lg border border-gray-700 overflow-hidden">
                <div className="p-2 border-b border-gray-700 bg-gray-800/50">
                  <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">MÔ HÌNH CÓ SẴN</span>
                </div>
                <div className="flex-1 overflow-y-auto p-2 space-y-1 custom-scrollbar">
                  {availableModels.map((m) => {
                    const isSelected = currentFallbackData.customList.includes(m.id);
                    return (
                      <button
                        key={m.id}
                        disabled={isSelected}
                        onClick={() => handleFallbackModelToggle(fallbackModalTarget, m.id, true)}
                        className={`w-full text-left p-2 rounded border transition-all flex items-center justify-between group ${
                          isSelected 
                            ? 'bg-indigo-900/5 border-indigo-500/20 opacity-40 cursor-not-allowed' 
                            : 'bg-gray-800/30 border-gray-700/50 hover:border-indigo-500/50 hover:bg-gray-700/50'
                        }`}
                      >
                        <span className={`text-[11px] font-medium ${isSelected ? 'text-indigo-300' : 'text-gray-400'}`}>{m.name}</span>
                        {isSelected && (
                          <span className="flex items-center gap-0.5 text-[8px] font-bold text-indigo-400 bg-indigo-400/10 px-1.5 py-0.2 rounded">
                            <Check size={8} /> Đã chọn
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
           </div>
           
           <div className="mt-4 flex justify-end gap-2 pt-3 border-t border-gray-700">
             <Button type="button" variant="ghost" size="sm" onClick={() => setFallbackModalTarget(null)}>Hủy</Button>
             <Button 
               type="button" 
               variant="primary" 
               size="sm"
               onClick={async () => {
                 await handleSaveSettings();
                 setFallbackModalTarget(null);
               }}
               className="bg-indigo-600 hover:bg-indigo-500 text-white px-6"
             >
               Lưu thiết lập
             </Button>
           </div>
        </div>
      </Modal>
    );
  };

  const apiInfoText = VIETNAMESE.apiInfoUser;
  const cloudinaryInfoText = VIETNAMESE.cloudinaryInfo;
  const isGameLoaded = !!knowledgeBase?.worldConfig;

  const economyModelsToUse = (apiKeySource === 'proxy' && proxyUrl2 && proxyUrl2.trim() !== '' && secondaryModels.length > 0) ? secondaryModels : availableModels;
  const combatModelsToUse = (apiKeySource === 'proxy' && proxyUrl2 && proxyUrl2.trim() !== '' && secondaryModels.length > 0) ? secondaryModels : availableModels;

  return (
    <div className="h-screen w-full bg-gray-800 py-8 px-4 sm:px-6 overflow-y-auto">
      {renderFallbackModal()}

      {/* Local Model Confirmation Modal */}
      <Modal 
        isOpen={showLocalModelConfirm} 
        onClose={() => setShowLocalModelConfirm(false)}
        title="Xác nhận tải Model Embedding Nội Bộ"
      >
        <div className="p-4 space-y-4">
            <p className="text-gray-200 text-sm">
                Bạn đã chọn model <span className="text-indigo-400 font-bold">{pendingEmbeddingModel}</span>. 
                Đây là model chạy trực tiếp trong trình duyệt của bạn (Local Embedding).
            </p>
            <div className="bg-amber-900/30 border border-amber-700/50 p-3 rounded-md">
                <p className="text-amber-300 text-xs flex items-center gap-2">
                    <Sparkles size={14} className="shrink-0" />
                    <span>Cảnh báo: Hệ thống sẽ tải về khoảng <span className="font-bold">30MB</span> dữ liệu model và lưu vào bộ nhớ đệm trình duyệt. Việc này chỉ thực hiện một lần duy nhất.</span>
                </p>
            </div>
            <div className="flex justify-end gap-3 pt-2">
                <Button variant="ghost" onClick={() => setShowLocalModelConfirm(false)}>Hủy bỏ</Button>
                <Button variant="primary" onClick={handleInstallLocalModel}>Đồng ý & Tải về</Button>
            </div>
        </div>
      </Modal>

      {/* Local Model Installation Progress Modal */}
      <Modal 
        isOpen={isInstallingLocalModel} 
        onClose={() => { if (error) setIsInstallingLocalModel(false); }}
        title="Đang tải Model Embedding"
      >
        <div className="p-6 space-y-6 text-center">
            <div className="flex justify-center">
                <RefreshCw className="animate-spin text-indigo-500 mb-2" size={48} />
            </div>
            <div className="space-y-2">
                <p className="text-gray-200 font-medium">{installStatus}</p>
                <div className="w-full bg-gray-700 rounded-full h-4 overflow-hidden shadow-inner border border-gray-600">
                    <div 
                        className="bg-gradient-to-r from-indigo-600 to-sky-500 h-full transition-all duration-300 ease-out flex items-center justify-center text-[10px] font-bold text-white"
                        style={{ width: `${installProgress}%` }}
                    >
                        {installProgress > 10 && `${Math.round(installProgress)}%`}
                    </div>
                </div>
                <div className="flex justify-between text-[10px] text-gray-400 font-mono">
                    <span>{Math.round(installProgress)}% COMPLETED</span>
                    <span>{(downloadedBytes / (1024 * 1024)).toFixed(2)} MB</span>
                </div>
            </div>
            <p className="text-[10px] text-gray-500 italic">Vui lòng không đóng cửa sổ trình duyệt cho đến khi quá trình hoàn tất...</p>
        </div>
      </Modal>

      {/* Authorized Models Modal */}
      <Modal 
        isOpen={isModelListModalOpen} 
        onClose={() => setIsModelListModalOpen(false)}
        title={`Danh sách Model Khả Dụng (API Key #${(checkingKeyIndex !== null ? checkingKeyIndex + 1 : '')})`}
      >
        <div className="p-4 space-y-4">
          <p className="text-gray-300 text-sm">
            Dưới đây là danh sách các mô hình của Google được khóa API này cấp quyền truy cập. Bạn có thể sử dụng các mô hình này cho game:
          </p>
          
          <div className="bg-gray-900 border border-gray-700 rounded-lg max-h-[40vh] overflow-y-auto custom-scrollbar p-3 space-y-2">
            {checkedModelsList.length === 0 ? (
              <p className="text-amber-400 text-xs text-center py-4">Không tìm thấy model nào khả dụng hoặc danh sách rỗng.</p>
            ) : (
              checkedModelsList.map(m => (
                <div key={m.id} className="flex items-center justify-between p-2 bg-gray-800/40 hover:bg-gray-800/80 rounded border border-gray-700/50 transition-colors">
                  <div className="flex flex-col">
                    <span className="text-sm font-semibold text-gray-100">{m.name || m.id}</span>
                    <span className="text-xs text-gray-400">{m.id}</span>
                  </div>
                  <span className="text-green-400 bg-green-950/40 border border-green-800 px-2 py-0.5 rounded text-xs flex items-center gap-1 font-bold">
                    <Check size={12} /> Khả dụng
                  </span>
                </div>
              ))
            )}
          </div>
          
          <div className="bg-gray-800/50 border border-gray-700 p-3 rounded-md text-xs text-gray-400">
            <span className="text-amber-300 font-bold">Lưu ý:</span> Nếu một model bạn muốn dùng (ví dụ: <span className="text-gray-300">gemini-3-flash-preview</span>) không xuất hiện trong danh sách trên, chứng tỏ khóa API của bạn hiện chưa được Google AI Studio cấp quyền hoặc khu vực quốc gia của bạn đang bị chặn truy cập đối với model đó.
          </div>
          
          <div className="flex justify-end pt-2">
            <Button variant="primary" onClick={() => setIsModelListModalOpen(false)}>Đóng</Button>
          </div>
        </div>
      </Modal>

      <div className="w-full max-w-lg mx-auto bg-gray-900 shadow-2xl rounded-xl p-6 sm:p-8 relative">
        <div className="flex items-center justify-center mb-8 relative">
          <h2 className="text-3xl font-bold text-center text-transparent bg-clip-text bg-gradient-to-r from-sky-400 via-cyan-500 to-indigo-600">
            {VIETNAMESE.apiSettingsTitle}
          </h2>
          <div className="absolute right-0 top-1/2 -translate-y-1/2">
             <GuideToggleButton isActive={isGuideOverlayActive} onClick={() => setIsGuideOverlayActive(!isGuideOverlayActive)} />
          </div>
        </div>

        <GuideOverlay isActive={isGuideOverlayActive} onClose={() => setIsGuideOverlayActive(false)} />

        {error && (
          <div className="mb-4 p-3 bg-red-500 bg-opacity-30 border border-red-700 text-red-300 rounded-md text-sm">
            {error}
          </div>
        )}
        {successMessage && (
          <div className="mb-4 p-3 bg-green-500 bg-opacity-30 border border-green-700 text-green-300 rounded-md text-sm">
            {successMessage}
          </div>
        )}

        <div className="space-y-6">
          
           {/* Description Strategy Removed from here */}

          {/* AI Oath Settings */}
           <div className="pt-4 border-t border-gray-700">
             <h3 className="text-lg font-semibold text-gray-200 mb-1 flex items-center gap-2">
               <span>📜 Lời Thề Của AI</span>
             </h3>
             <p className="text-xs text-gray-400 mb-3">Định hướng mô hình AI tư duy chuyên sâu trước khi bắt đầu kể chuyện.</p>
             <label className="flex items-start p-3 rounded-md bg-gray-800/50 hover:bg-gray-700/50 border border-gray-700 cursor-pointer">
               <input
                 type="checkbox"
                 checked={useAiOath}
                 onChange={(e) => setUseAiOath(e.target.checked)}
                 className="mt-1 h-4 w-4 text-indigo-600 border-gray-500 rounded focus:ring-indigo-500"
               />
               <div className="ml-3 text-sm">
                 <span className="font-medium text-gray-200">Kích hoạt "Lời thề của AI" (Prefill Thinking)</span>
                 <p className="text-gray-400 text-xs mt-1">
                   Khi bật, hệ thống sẽ chèn trước thẻ <code className="text-amber-300 font-mono bg-gray-800 px-1 rounded">&lt;/tuong_than&gt;\n&lt;thinking&gt;\n</code> giúp AI tư duy sâu sắc hơn. (Mặc định: TẮT ở tất cả chế độ để tránh trôi dòng lời kể).
                 </p>
               </div>
             </label>
           </div>

           {/* Narrative Settings */}
           <div className="pt-4 border-t border-gray-700">
            <h3 className="text-lg font-semibold text-gray-200 mb-2">Cài Đặt Tường Thuật</h3>
             <p className="text-xs text-gray-400 mb-3">Thay đổi góc nhìn kể chuyện của AI bất cứ lúc nào.</p>
              <div className="space-y-2">
                <label className="flex items-start p-3 rounded-md bg-gray-800/50 hover:bg-gray-700/50 border border-gray-700 cursor-pointer">
                  <input type="radio" name="perspectiveMode" value="firstPerson" checked={perspectiveMode === 'firstPerson'} onChange={() => setPerspectiveMode('firstPerson')} className="mt-1 h-4 w-4 text-indigo-600 border-gray-500 focus:ring-indigo-500"/>
                  <div className="ml-3 text-sm">
                    <span className="font-medium text-gray-200">Góc Nhìn Thứ Nhất</span>
                    <p className="text-gray-400 text-xs mt-1">Trải nghiệm nhập vai truyền thống. AI chỉ kể những gì nhân vật của bạn biết.</p>
                  </div>
                </label>
                <label className="flex items-start p-3 rounded-md bg-gray-800/50 hover:bg-gray-700/50 border border-gray-700 cursor-pointer">
                  <input type="radio" name="perspectiveMode" value="thirdPersonOmniscient" checked={perspectiveMode === 'thirdPersonOmniscient'} onChange={() => setPerspectiveMode('thirdPersonOmniscient')} className="mt-1 h-4 w-4 text-indigo-600 border-gray-500 focus:ring-indigo-500"/>
                  <div className="ml-3 text-sm">
                    <span className="font-medium text-gray-200">Góc Nhìn Thứ Ba Toàn Tri (Mặc định)</span>
                    <p className="text-gray-400 text-xs mt-1">AI sẽ đóng vai người kể chuyện biết tuốt, có thể mô tả suy nghĩ của NPC và các sự kiện xảy ra ở nơi khác.</p>
                  </div>
                </label>
              </div>
          </div>
          
          {/* AI Performance Settings */}
          <div className="pt-4 border-t border-gray-700 relative">
            {isGuideOverlayActive && (
              <GuideMarker id="api-advanced-settings" index={5} text="Bước 5: Tinh chỉnh 'độ điên' của AI. Thấp thì AI kể thật thà, cao thì AI sẽ bay bổng và sáng tạo hơn." position="top" activeId={activeGuideId} onToggle={setActiveGuideId} />
            )}
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-200">Cài đặt Hiệu suất AI</h3>
              <button
                type="button"
                onClick={() => setIsPerformanceLocked(!isPerformanceLocked)}
                className={`flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-semibold border transition-all duration-200 ${
                  isPerformanceLocked
                    ? 'bg-red-950/40 border-red-800/60 text-red-400 hover:bg-red-900/30'
                    : 'bg-green-950/40 border-green-800/60 text-green-400 hover:bg-green-900/30'
                }`}
              >
                {isPerformanceLocked ? (
                  <>
                    <Lock size={13} className="shrink-0" />
                    <span>Đang khóa (Bấm để Mở)</span>
                  </>
                ) : (
                  <>
                    <Unlock size={13} className="shrink-0" />
                    <span>Đang mở (Bấm để Khóa)</span>
                  </>
                )}
              </button>
            </div>
            
            <div className="space-y-6">
              <div>
                <div className="flex justify-between items-center mb-2">
                  <label className="block text-sm font-medium text-gray-300">Độ Sáng Tạo (Temperature)</label>
                  <input
                    type="number"
                    value={temperature}
                    onChange={(e) => setTemperature(parseFloat(e.target.value))}
                    disabled={isPerformanceLocked}
                    className={`w-24 bg-gray-700 border border-gray-600 rounded-md px-2 py-1 text-sm text-center text-white transition-all duration-200 ${isPerformanceLocked ? 'opacity-40 cursor-not-allowed pointer-events-none' : ''}`}
                    min="0.1" max="2.0" step="0.1"
                  />
                </div>
                <input
                  type="range"
                  value={temperature}
                  onChange={(e) => setTemperature(parseFloat(e.target.value))}
                  disabled={isPerformanceLocked}
                  className={`w-full h-2 bg-gray-600 rounded-lg appearance-none cursor-pointer accent-indigo-500 transition-all duration-200 ${isPerformanceLocked ? 'opacity-30 cursor-not-allowed pointer-events-none' : ''}`}
                  min="0.1" max="2.0" step="0.1"
                />
              </div>

              <div>
                <div className="flex justify-between items-center mb-2">
                  <label className="block text-sm font-medium text-gray-300">Độ rộng từ vựng (Top K)</label>
                  <input
                    type="number"
                    value={topK}
                    onChange={(e) => setTopK(parseInt(e.target.value))}
                    disabled={isPerformanceLocked}
                    className={`w-24 bg-gray-700 border border-gray-600 rounded-md px-2 py-1 text-sm text-center text-white transition-all duration-200 ${isPerformanceLocked ? 'opacity-40 cursor-not-allowed pointer-events-none' : ''}`}
                    min="1" max="1000" step="1"
                  />
                </div>
                <input
                  type="range"
                  value={topK}
                  onChange={(e) => setTopK(parseInt(e.target.value))}
                  disabled={isPerformanceLocked}
                  className={`w-full h-2 bg-gray-600 rounded-lg appearance-none cursor-pointer accent-indigo-500 transition-all duration-200 ${isPerformanceLocked ? 'opacity-30 cursor-not-allowed pointer-events-none' : ''}`}
                  min="1" max="1000" step="1"
                />
              </div>

              <div>
                <div className="flex justify-between items-center mb-2">
                  <label className="block text-sm font-medium text-gray-300">Độ chọn lọc từ vựng (Top P)</label>
                  <input
                    type="number"
                    value={topP}
                    onChange={(e) => setTopP(parseFloat(e.target.value))}
                    disabled={isPerformanceLocked}
                    className={`w-24 bg-gray-700 border border-gray-600 rounded-md px-2 py-1 text-sm text-center text-white transition-all duration-200 ${isPerformanceLocked ? 'opacity-40 cursor-not-allowed pointer-events-none' : ''}`}
                    min="0.0" max="1.0" step="0.05"
                  />
                </div>
                <input
                  type="range"
                  value={topP}
                  onChange={(e) => setTopP(parseFloat(e.target.value))}
                  disabled={isPerformanceLocked}
                  className={`w-full h-2 bg-gray-600 rounded-lg appearance-none cursor-pointer accent-indigo-500 transition-all duration-200 ${isPerformanceLocked ? 'opacity-30 cursor-not-allowed pointer-events-none' : ''}`}
                  min="0.0" max="1.0" step="0.05"
                />
              <div className="p-3 bg-gray-850/40 rounded-lg border border-gray-700/65">
                <div className="flex items-center gap-1.5 text-xs font-semibold text-indigo-400 mb-1">
                  <Sparkles size={14} className="shrink-0 animate-pulse text-indigo-400" />
                  <span>Ảnh hưởng văn phong AI:</span>
                </div>
                <p className="text-sm text-gray-300 leading-relaxed italic">
                  "{getAIWritingStyleDescription(temperature, topK, topP)}"
                </p>
              </div>

              <div className="flex flex-col gap-4 p-4 bg-gray-850/40 rounded-xl border border-gray-700/50">
                <div className="flex items-center justify-between">
                  <div>
                    <label className="block text-sm font-semibold text-indigo-300">Chế độ Tư duy Sâu (Deep Reasoning)</label>
                    <p className="text-xs text-gray-400">Yêu cầu AI phân tích kỹ lưỡng bối cảnh và logic trước khi trả lời.</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => { if (!isPerformanceLocked) setUseDeepReasoning(!useDeepReasoning); }}
                    disabled={isPerformanceLocked}
                    className={`relative inline-flex h-6 w-12 items-center rounded-full transition-all duration-300 focus:outline-none shadow-inner ${useDeepReasoning ? 'bg-indigo-600 shadow-indigo-900/20' : 'bg-gray-700'} ${isPerformanceLocked ? 'opacity-40 cursor-not-allowed pointer-events-none' : ''}`}
                  >
                    <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-sm transition-transform duration-300 ${useDeepReasoning ? 'translate-x-7' : 'translate-x-1'}`} />
                  </button>
                </div>

                <div className="flex items-center justify-between border-t border-gray-700/30 pt-4">
                  <div>
                    <label className="block text-sm font-semibold text-emerald-300">Tư duy Chậm (Nâng cao chất lượng)</label>
                    <p className="text-xs text-gray-400">Cho phép AI gia hạn thời gian xử lý để tránh "loãng ngữ cảnh" và tăng độ sâu của cốt truyện.</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => { if (!isPerformanceLocked) setSlowThinking(!slowThinking); }}
                    disabled={isPerformanceLocked}
                    className={`relative inline-flex h-6 w-12 items-center rounded-full transition-all duration-300 focus:outline-none shadow-inner ${slowThinking ? 'bg-emerald-600 shadow-emerald-900/20' : 'bg-gray-700'} ${isPerformanceLocked ? 'opacity-40 cursor-not-allowed pointer-events-none' : ''}`}
                  >
                    <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-sm transition-transform duration-300 ${slowThinking ? 'translate-x-7' : 'translate-x-1'}`} />
                  </button>
                </div>

                <div className="flex items-center justify-between border-t border-gray-700/30 pt-4">
                  <div>
                    <label className="block text-sm font-semibold text-red-400 flex items-center gap-2">
                      Siêu mạt pháp (Super Manual Mode)
                      <span className="px-1.5 py-0.5 text-[8px] font-bold bg-red-900/30 text-red-400 rounded-md border border-red-500/20 uppercase tracking-wider">Mới</span>
                    </label>
                    <p className="text-xs text-gray-400 italic">Bỏ qua các AI phụ (Fast Agent, Pre-combat...). AI chính tự xuất Tag & Tóm tắt vào thẻ &lt;update_data&gt; & &lt;flash_summary&gt;.</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => { if (!isPerformanceLocked) setIsSuperManualMode(!isSuperManualMode); }}
                    disabled={isPerformanceLocked}
                    className={`relative inline-flex h-6 w-12 items-center rounded-full transition-all duration-300 focus:outline-none shadow-inner ${isSuperManualMode ? 'bg-red-600 shadow-red-900/20' : 'bg-gray-700'} ${isPerformanceLocked ? 'opacity-40 cursor-not-allowed pointer-events-none' : ''}`}
                  >
                    <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-sm transition-transform duration-300 ${isSuperManualMode ? 'translate-x-7' : 'translate-x-1'}`} />
                  </button>
                </div>

                <div className="flex items-center justify-between border-t border-gray-700/30 pt-4">
                  <div>
                    <label className="block text-sm font-semibold text-purple-300">Mạt Pháp-không tự động</label>
                    <p className="text-xs text-gray-400">Sau khi hoàn thành lượt xử lý chính và hiển thị hết lời kể, các tác vụ API hậu kỳ tiếp theo sẽ không tự động chạy mà cần phải bấm nút "Chạy tiếp" thủ công.</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => { if (!isPerformanceLocked) setMatPhapManual(!matPhapManual); }}
                    disabled={isPerformanceLocked}
                    className={`relative inline-flex h-6 w-12 items-center rounded-full transition-all duration-300 focus:outline-none shadow-inner ${matPhapManual ? 'bg-purple-600 shadow-purple-900/20' : 'bg-gray-700'} ${isPerformanceLocked ? 'opacity-40 cursor-not-allowed pointer-events-none' : ''}`}
                  >
                    <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-sm transition-transform duration-300 ${matPhapManual ? 'translate-x-7' : 'translate-x-1'}`} />
                  </button>
                </div>
              </div>
              </div>

              <div>
                <div className="flex justify-between items-center mb-2">
                  <label className="block text-sm font-medium text-gray-300">Độ dài Phản hồi Tối đa</label>
                  <input
                    type="number"
                    value={maxOutputTokens}
                    onChange={(e) => setMaxOutputTokens(parseInt(e.target.value))}
                    disabled={isPerformanceLocked}
                    className={`w-24 bg-gray-700 border border-gray-600 rounded-md px-2 py-1 text-sm text-center text-white transition-all duration-200 ${isPerformanceLocked ? 'opacity-40 cursor-not-allowed pointer-events-none' : ''}`}
                    min="1024" max="200000" step="256"
                  />
                </div>
                <input
                  type="range"
                  value={maxOutputTokens}
                  onChange={(e) => setMaxOutputTokens(parseInt(e.target.value))}
                  disabled={isPerformanceLocked}
                  className={`w-full h-2 bg-gray-600 rounded-lg appearance-none cursor-pointer accent-indigo-500 transition-all duration-200 ${isPerformanceLocked ? 'opacity-30 cursor-not-allowed pointer-events-none' : ''}`}
                  min="1024" max="200000" step="256"
                />
              </div>

              <div>
                <div className="flex justify-between items-center mb-2">
                  <label className="block text-sm font-medium text-gray-300">Thinking Budget</label>
                  <input
                    type="number"
                    value={thinkingBudget}
                    onChange={(e) => setThinkingBudget(parseInt(e.target.value))}
                    disabled={isPerformanceLocked}
                    className={`w-24 bg-gray-700 border border-gray-600 rounded-md px-2 py-1 text-sm text-center text-white transition-all duration-200 ${isPerformanceLocked ? 'opacity-40 cursor-not-allowed pointer-events-none' : ''}`}
                    min="0" max="32768" step="100"
                  />
                </div>
                <input
                  type="range"
                  value={thinkingBudget}
                  onChange={(e) => setThinkingBudget(parseInt(e.target.value))}
                  disabled={isPerformanceLocked}
                  className={`w-full h-2 bg-gray-600 rounded-lg appearance-none cursor-pointer accent-indigo-500 transition-all duration-200 ${isPerformanceLocked ? 'opacity-30 cursor-not-allowed pointer-events-none' : ''}`}
                  min="0" max="32768" step="100"
                />
              </div>

              <div>
                <div className="flex justify-between items-center mb-2">
                  <label className="block text-sm font-medium text-gray-300">JSON Buffer</label>
                  <input
                    type="number"
                    value={jsonBuffer}
                    onChange={(e) => setJsonBuffer(parseInt(e.target.value))}
                    disabled={isPerformanceLocked}
                    className={`w-24 bg-gray-700 border border-gray-600 rounded-md px-2 py-1 text-sm text-center text-white transition-all duration-200 ${isPerformanceLocked ? 'opacity-40 cursor-not-allowed pointer-events-none' : ''}`}
                    min="0" max="8192" step="128"
                  />
                </div>
                <input
                  type="range"
                  value={jsonBuffer}
                  onChange={(e) => setJsonBuffer(parseInt(e.target.value))}
                  disabled={isPerformanceLocked}
                  className={`w-full h-2 bg-gray-600 rounded-lg appearance-none cursor-pointer accent-indigo-500 transition-all duration-200 ${isPerformanceLocked ? 'opacity-30 cursor-not-allowed pointer-events-none' : ''}`}
                  min="0" max="8192" step="128"
                />
              </div>

            </div>
          </div>

          {/* Combat Graphics Config */}
          <div className="pt-4 border-t border-gray-700">
            <h3 className="text-lg font-semibold text-gray-200 mb-2">Thiết Lập Đồ Hoạ Chiến Đấu (Realtime)</h3>
            <div className="p-3 border border-gray-700 rounded-md mt-2 space-y-4">
                {/* NÚT GẠT CHỌN CƠ CHẾ CHIẾN ĐẤU */}
                <div className="flex flex-col gap-2 bg-gray-900/60 p-3 rounded-lg border border-indigo-500/30">
                  <label className="text-sm font-semibold text-indigo-300">Cơ chế giao diện chiến đấu</label>
                  
                  <div className="flex items-center justify-between gap-3 bg-gray-950 p-2.5 rounded-xl border border-gray-800 select-none">
                    {/* Nhãn bên trái: Neon (dùng mõm: cũ) */}
                    <span 
                      onClick={() => handleCombatGraphicsConfigChange({
                        target: { name: 'combatEngineMode', value: 'neon_classic', type: 'button' }
                      } as any)}
                      className={`text-xs font-semibold cursor-pointer text-right flex-1 transition-colors ${
                        (combatGraphicsConfig.combatEngineMode || 'tang_dong_realtime') === 'neon_classic'
                          ? 'text-cyan-400 font-bold'
                          : 'text-gray-500 hover:text-gray-300'
                      }`}
                    >
                      Cơ chế Neon (dùng mõm : cũ)
                    </span>

                    {/* Cần gạt công tắc (Toggle Switch Gạt Trái/Phải) */}
                    <div 
                      onClick={() => {
                        const nextMode = (combatGraphicsConfig.combatEngineMode || 'tang_dong_realtime') === 'neon_classic' 
                          ? 'tang_dong_realtime' 
                          : 'neon_classic';
                        handleCombatGraphicsConfigChange({
                          target: { name: 'combatEngineMode', value: nextMode, type: 'button' }
                        } as any);
                      }}
                      className={`relative w-16 h-8 flex items-center rounded-full p-1 cursor-pointer transition-colors duration-300 flex-shrink-0 ${
                        (combatGraphicsConfig.combatEngineMode || 'tang_dong_realtime') === 'tang_dong_realtime'
                          ? 'bg-indigo-600 border border-indigo-400'
                          : 'bg-cyan-900/80 border border-cyan-500'
                      }`}
                    >
                      <div 
                        className={`w-6 h-6 rounded-full shadow-md transform transition-transform duration-300 flex items-center justify-center text-[10px] ${
                          (combatGraphicsConfig.combatEngineMode || 'tang_dong_realtime') === 'tang_dong_realtime'
                            ? 'translate-x-8 bg-indigo-100 text-indigo-900'
                            : 'translate-x-0 bg-cyan-100 text-cyan-900'
                        }`}
                      >
                        {(combatGraphicsConfig.combatEngineMode || 'tang_dong_realtime') === 'tang_dong_realtime' ? '⚡' : '💬'}
                      </div>
                    </div>

                    {/* Nhãn bên phải: Tăng Động (bắn bắn chém chém: mới) */}
                    <span 
                      onClick={() => handleCombatGraphicsConfigChange({
                        target: { name: 'combatEngineMode', value: 'tang_dong_realtime', type: 'button' }
                      } as any)}
                      className={`text-xs font-semibold cursor-pointer text-left flex-1 transition-colors ${
                        (combatGraphicsConfig.combatEngineMode || 'tang_dong_realtime') === 'tang_dong_realtime'
                          ? 'text-indigo-400 font-bold'
                          : 'text-gray-500 hover:text-gray-300'
                      }`}
                    >
                      Cơ chế Tăng Động (bắn bắn chém chém : mới)
                    </span>
                  </div>

                  <div className="text-[11px] text-gray-400 text-center italic mt-0.5">
                    {(combatGraphicsConfig.combatEngineMode || 'tang_dong_realtime') === 'neon_classic'
                      ? 'Trận đánh qua thoại AI & lượt chọn kỹ năng văn bản'
                      : 'Trận đánh Realtime Canvas 2D, VFX & Sprite chuyển động'}
                  </div>
                </div>

                <div className="flex flex-col gap-2">
                  <label className="text-sm font-medium text-gray-300">Độ phân giải render (Mờ / Nét)</label>
                  <div className="flex items-center gap-4">
                      <span className="text-xs text-gray-400">Giảm (Mờ)</span>
                      <input
                          type="range"
                          name="resolutionScale"
                          min="0.1"
                          max="2.0"
                          step="0.1"
                          value={combatGraphicsConfig.resolutionScale}
                          onChange={handleCombatGraphicsConfigChange}
                          className="flex-1 h-2 bg-gray-600 rounded-lg appearance-none cursor-pointer accent-indigo-500"
                      />
                      <span className="text-xs text-gray-400">Tăng (Nét)</span>
                  </div>
                  <div className="text-right text-xs text-indigo-400">{combatGraphicsConfig.resolutionScale.toFixed(1)}x</div>
                </div>

                <div className="flex items-center gap-2">
                    <input
                        type="checkbox"
                        id="enableVfx"
                        name="enableVfx"
                        checked={combatGraphicsConfig.enableVfx}
                        onChange={handleCombatGraphicsConfigChange}
                        className="w-4 h-4 text-indigo-600 bg-gray-700 border-gray-600 rounded focus:ring-indigo-500 focus:ring-2"
                    />
                    <label htmlFor="enableVfx" className="text-sm font-medium text-gray-300">Bật hiệu ứng hình ảnh (VFX)</label>
                </div>

                <div className="flex items-center gap-2">
                    <input
                        type="checkbox"
                        id="enableDamageNumbers"
                        name="enableDamageNumbers"
                        checked={combatGraphicsConfig.enableDamageNumbers}
                        onChange={handleCombatGraphicsConfigChange}
                        className="w-4 h-4 text-indigo-600 bg-gray-700 border-gray-600 rounded focus:ring-indigo-500 focus:ring-2"
                    />
                    <label htmlFor="enableDamageNumbers" className="text-sm font-medium text-gray-300">Hiển thị sát thương (Damage Numbers)</label>
                </div>

                <div className="flex flex-col gap-2">
                    <label className="text-sm font-medium text-gray-300">Số lượng tối đa mỗi phe</label>
                    <div className="flex items-center gap-4">
                        <span className="text-xs text-gray-400">3</span>
                        <input
                            type="range"
                            name="maxUnitsPerSide"
                            min="3"
                            max="6"
                            step="1"
                            value={combatGraphicsConfig.maxUnitsPerSide}
                            onChange={handleCombatGraphicsConfigChange}
                            className="flex-1 h-2 bg-gray-600 rounded-lg appearance-none cursor-pointer accent-indigo-500"
                        />
                        <span className="text-xs text-gray-400">6</span>
                    </div>
                    <div className="text-right text-xs text-indigo-400">{combatGraphicsConfig.maxUnitsPerSide}</div>
                </div>
            </div>
          </div>
          
          {/* API Key Settings */}
          <div className="pt-4 border-t border-gray-700 relative">
            <div className="mb-4 p-3 bg-indigo-950/40 border border-indigo-500/40 rounded-lg flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 relative">
              {isGuideOverlayActive && (
                <GuideMarker id="api-load-models" index={3} text="Bước 3: Nhấn nút này để làm mới danh sách các dòng trí tuệ nhân tạo (Model) đang khả dụng từ máy chủ." position="top" activeId={activeGuideId} onToggle={setActiveGuideId} />
              )}
              <div>
                <div className="text-sm font-bold text-indigo-300 flex items-center gap-2">
                  🌐 NỀN TẢNG AI: GOOGLE GEMINI (CỐ ĐỊNH & TỐI ƯU HẠ TẦNG)
                </div>
                <div className="text-xs text-indigo-400/80 mt-1">
                  ⚡ Kết nối trực tiếp: Google AI Studio Gateway (generativelanguage.googleapis.com)
                </div>
              </div>
              <Button 
                type="button" 
                variant="secondary" 
                onClick={() => loadModels(true)} 
                isLoading={isLoadingModels}
                loadingText={loadModelStatus || "Đang tải..."}
                className="shrink-0"
              >
                <RefreshCw size={16} className={isLoadingModels ? 'animate-spin' : ''} />
                Tải danh sách
              </Button>
            </div>

            <div className="flex items-center justify-between mb-2 relative">
              <label className="block text-lg font-semibold text-gray-200">
                Nguồn API Key
              </label>
              {isGuideOverlayActive && (
                <GuideMarker id="api-source" index={1} text="Bước 1: Bắt đầu từ đây! Chọn nguồn cung cấp năng lượng cho AI. Khuyên dùng Key Cá Nhân hoặc Proxy để ổn định nhất." position="bottom" activeId={activeGuideId} onToggle={setActiveGuideId} />
              )}
              <div className="flex gap-2">
                <Button 
                  type="button" 
                  variant="ghost" 
                  size="sm" 
                  onClick={handleReloadModels}
                  isLoading={isLoadingModels}
                  loadingText={loadModelStatus || "Đang tải..."}
                  className="text-xs py-1 px-2 h-auto flex items-center gap-1"
                >
                  {!isLoadingModels && <RefreshCw size={14} />}
                  Tải lại danh sách model
                </Button>
              </div>
            </div>
            <div className="flex gap-4 mb-4">
              <label className="flex items-center cursor-pointer">
                <input
                  type="radio"
                  name="apiKeySource"
                  value="system"
                  checked={apiKeySource === 'system'}
                  onChange={() => setApiKeySource('system')}
                  className="w-4 h-4 text-indigo-600 bg-gray-700 border-gray-600 focus:ring-indigo-500"
                />
                <span className="ml-2 text-sm text-gray-300">Key Hệ Thống (Mặc định)</span>
              </label>
              <label className="flex items-center cursor-pointer">
                <input
                  type="radio"
                  name="apiKeySource"
                  value="user"
                  checked={apiKeySource === 'user'}
                  onChange={() => setApiKeySource('user')}
                  className="w-4 h-4 text-indigo-600 bg-gray-700 border-gray-600 focus:ring-indigo-500"
                />
                <span className="ml-2 text-sm text-gray-300">Key Cá Nhân</span>
              </label>
              <label className="flex items-center cursor-pointer">
                <input
                  type="radio"
                  name="apiKeySource"
                  value="proxy"
                  checked={apiKeySource === 'proxy'}
                  onChange={() => setApiKeySource('proxy')}
                  className="w-4 h-4 text-indigo-600 bg-gray-700 border-gray-600 focus:ring-indigo-500"
                />
                <span className="ml-2 text-sm text-gray-300">Proxy</span>
              </label>
            </div>

            {apiKeySource === 'proxy' && (
              <div className="mt-4 p-4 bg-gray-800/50 rounded-lg border border-gray-700 space-y-3">
                <div className="flex justify-between items-center">
                  <label className="block text-sm font-medium text-gray-300">Cấu hình Reverse Proxy</label>
                  <button
                    type="button"
                    onClick={() => setShowSecondaryProxy(prev => !prev)}
                    className="flex items-center justify-center w-6 h-6 rounded-full bg-indigo-600 hover:bg-indigo-700 text-white transition-colors duration-150 text-base font-bold shadow-sm"
                    title={showSecondaryProxy ? "Ẩn cấu hình proxy thứ 2" : "Thêm cấu hình proxy thứ 2 (Combat & Kinh tế)"}
                    id="toggle-secondary-proxy-btn"
                  >
                    {showSecondaryProxy ? "–" : "+"}
                  </button>
                </div>
                <input 
                  type="text" 
                  placeholder="URL Proxy..." 
                  value={proxyUrl} 
                  onChange={(e) => setProxyUrl(e.target.value)}
                  className="w-full bg-gray-900 border border-gray-600 rounded px-3 py-2 text-sm text-white"
                />
                <input 
                  type="password" 
                  placeholder="Password / API Key của Proxy" 
                  value={proxyKey} 
                  onChange={(e) => setProxyKey(e.target.value)}
                  className="w-full bg-gray-900 border border-gray-600 rounded px-3 py-2 text-sm text-white"
                />

                {showSecondaryProxy && (
                  <div className="pt-2.5 border-t border-gray-700 space-y-3 animate-in fade-in duration-200" id="secondary-proxy-container">
                    <div className="flex justify-between items-center">
                      <span className="text-xs font-semibold text-indigo-400 uppercase tracking-wider">Proxy Thứ 2 (Cho Chiến Đấu & Kinh Tế)</span>
                    </div>
                    <input 
                      type="text" 
                      placeholder="URL Proxy Phụ (vd: https://backup.gcli.ggchan.dev/)" 
                      value={proxyUrl2} 
                      onChange={(e) => setProxyUrl2(e.target.value)}
                      className="w-full bg-gray-900 border border-gray-600 rounded px-3 py-2 text-sm text-white"
                    />
                    <input 
                      type="password" 
                      placeholder="Password / API Key của Proxy Phụ" 
                      value={proxyKey2} 
                      onChange={(e) => setProxyKey2(e.target.value)}
                      className="w-full bg-gray-900 border border-gray-600 rounded px-3 py-2 text-sm text-white"
                    />
                    <p className="text-[11px] text-gray-400 leading-relaxed font-mono">
                      * Nếu được điền, proxy phụ này sẽ tự động thay thế proxy chính cho các tác vụ: <strong className="text-indigo-300">Client chiến đấu</strong> và <strong className="text-indigo-300">Kinh tế & Đấu giá</strong>.
                    </p>
                  </div>
                )}

                <div className="flex gap-2">
                  <Button type="button" onClick={() => loadModels(true)} isLoading={isLoadingModels} loadingText={loadModelStatus || "Đang tải..."} className="w-full">
                    Tải Model
                  </Button>
                </div>
              </div>
            )}

            {apiKeySource === 'user' && (
              <div className="mt-4 p-4 bg-gray-800/50 rounded-lg border border-gray-700 relative">
                {isGuideOverlayActive && (
                  <GuideMarker id="api-key-input" index={2} text="Bước 2: Nhập chìa khóa (API Key) bạn lấy từ Google vào đây. Hệ thống sẽ tự động xoay vòng nếu bạn nhập nhiều key." position="bottom" activeId={activeGuideId} onToggle={setActiveGuideId} />
                )}
                <label className="block text-sm font-medium text-gray-300 mb-1">
                  {VIETNAMESE.geminiUserApiKeyLabel} (Hỗ trợ xoay tua nhiều key)
                </label>
                <p className="text-xs text-gray-400 mb-3">
                  API Key cá nhân của bạn sẽ được lưu trữ cục bộ trong trình duyệt và chỉ được sử dụng để gửi yêu cầu trực tiếp đến Google AI.
                </p>

            <div className="flex flex-wrap gap-2 my-3 items-center">
                <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => importFileRef.current?.click()}
                >
                    Nhập từ file .txt
                </Button>
                <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={handleExportKeys}
                >
                    Xuất ra file .txt
                </Button>
                <span className="text-xs text-gray-400 ml-auto sm:ml-2">
                    (Hiện có: {userApiKeys.filter(k => k.trim() !== '').length} key)
                </span>
            </div>
            <input
                type="file"
                ref={importFileRef}
                onChange={handleImportFileChange}
                accept=".txt,text/plain"
                className="hidden"
            />

            <div className="space-y-4 max-h-[50vh] overflow-y-auto custom-scrollbar p-2 bg-gray-800/50 rounded-lg border border-gray-700">
              {userApiKeys.map((key, index) => (
                <div key={index} className="p-3 border border-gray-700 rounded-lg bg-gray-800/50">
                  <label htmlFor={`gemini-api-key-${index}`} className="block text-sm font-medium text-gray-300 mb-2">
                    {`API Key #${index + 1}`}
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      id={`gemini-api-key-${index}`}
                      type="password"
                      value={key}
                      onChange={(e) => handleUserApiKeyChange(index, e.target.value)}
                      placeholder={`Dán khóa API của bạn vào đây`}
                      className="flex-grow p-3 bg-gray-900 border border-gray-600 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 text-gray-100 placeholder-gray-400 transition-colors"
                      aria-label={`Gemini API Key #${index + 1}`}
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => checkKeyAuthorizedModels(key, index)}
                      className="!p-2 flex-shrink-0 flex items-center justify-center text-indigo-400 hover:text-indigo-300 bg-gray-850 hover:bg-gray-700"
                      title="Xem danh sách model khả dụng của Key này"
                      disabled={isCheckingKeyModels && checkingKeyIndex === index}
                    >
                      {isCheckingKeyModels && checkingKeyIndex === index ? (
                        <RefreshCw size={18} className="animate-spin" />
                      ) : (
                        <Search size={18} />
                      )}
                    </Button>
                    <Button
                      type="button"
                      variant="danger"
                      size="sm"
                      onClick={() => handleRemoveApiKey(index)}
                      className="!p-2 flex-shrink-0"
                      aria-label={`Xóa API Key #${index + 1}`}
                    >
                      &times;
                    </Button>
                  </div>
                </div>
              ))}
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={handleAddApiKey}
                className="w-full mt-2 border-dashed"
              >
                + Thêm API Key
              </Button>
            </div>
            {error && <p id="api-key-error" className="mt-1 text-xs text-red-400">{error}</p>}
            </div>
            )}
          </div>

          <div className="relative">
            {isGuideOverlayActive && (
              <GuideMarker id="api-assign-models" index={4} text="Bước 4: Gắn các bộ não AI cho từng nhiệm vụ. Model 'Cốt Truyện' cần thông minh, Model 'Kinh Tế/Chiến Đấu' cần tốc độ." position="top" activeId={activeGuideId} onToggle={setActiveGuideId} />
            )}
            <label htmlFor="geminiModel" className="block text-sm font-medium text-gray-300 mb-1">
              {VIETNAMESE.geminiModelLabel} (Cho Cốt Truyện Chính)
            </label>
            <div className="flex gap-2">
              <select
                id="geminiModel"
                value={selectedModel}
                onChange={handleModelChange}
                className="w-full p-3 bg-gray-700 border border-gray-600 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 text-gray-100 transition-colors duration-150"
              >
                {availableModels.map(model => (
                  <option key={model.id} value={model.id}>
                    {model.name}
                  </option>
                ))}
              </select>
              <Button type="button" variant="secondary" onClick={() => setFallbackModalTarget('story')} className="flex items-center gap-1 min-w-fit" aria-label="Cài đặt Fallback">
                <Settings size={18} /> Fallback
              </Button>
            </div>
            <ThinkingLevelControl
              modelId={selectedModel}
              modelThinkingLevels={modelThinkingLevels}
              onChange={handleThinkingLevelChange}
            />
          </div>
          
           <div>
            <label htmlFor="economyModel" className="block text-sm font-medium text-gray-300 mb-1">
              {VIETNAMESE.economyModelLabel}
            </label>
            <div className="flex gap-2">
              <select
                id="economyModel"
                value={selectedEconomyModel}
                onChange={handleEconomyModelChange}
                className="w-full p-3 bg-gray-700 border border-gray-600 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 text-gray-100 transition-colors duration-150"
              >
                {economyModelsToUse.map(model => (
                  <option key={model.id} value={model.id}>
                    {model.name}
                  </option>
                ))}
              </select>
              <Button type="button" variant="secondary" onClick={() => setFallbackModalTarget('economy')} className="flex items-center gap-1 min-w-fit" aria-label="Cài đặt Fallback">
                <Settings size={18} /> Fallback
              </Button>
            </div>
            <p className="text-xs text-gray-400 mt-1">Model này sẽ được dùng cho các tính năng cần phản hồi nhanh như tạo chợ, đấu giá.</p>
            <ThinkingLevelControl
              modelId={selectedEconomyModel}
              modelThinkingLevels={modelThinkingLevels}
              onChange={handleThinkingLevelChange}
            />
          </div>

          <div>
            <label htmlFor="combatModel" className="block text-sm font-medium text-gray-300 mb-1">
              Model Cho Xử Lý Chiến Đấu (Client chiến đấu)
            </label>
            <div className="flex gap-2">
              <select
                id="combatModel"
                value={selectedCombatModel}
                onChange={handleCombatModelChange}
                className="w-full p-3 bg-gray-700 border border-gray-600 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 text-gray-100 transition-colors duration-150"
              >
                {combatModelsToUse.map(model => (
                  <option key={model.id} value={model.id}>
                    {model.name}
                  </option>
                ))}
              </select>
              <Button type="button" variant="secondary" onClick={() => setFallbackModalTarget('combat')} className="flex items-center gap-1 min-w-fit" aria-label="Cài đặt Fallback">
                <Settings size={18} /> Fallback
              </Button>
            </div>
            <p className="text-xs text-gray-400 mt-1">Model này sẽ được dùng cho các lượt đánh trong client chiến đấu để tối ưu tốc độ.</p>
            <ThinkingLevelControl
              modelId={selectedCombatModel}
              modelThinkingLevels={modelThinkingLevels}
              onChange={handleThinkingLevelChange}
            />
          </div>

          <ThinkingLevelAccordion
            models={getThinkingConfigurableModels({
              selectedModel,
              selectedEconomyModel,
              selectedCombatModel,
              storyFallback,
              economyFallback,
              combatFallback,
              availableModels,
              secondaryModels,
            })}
            modelThinkingLevels={modelThinkingLevels}
            onChange={handleThinkingLevelChange}
          />

          {/* Model Ping / Testing Component */}
          <ModelPingTester 
            availableModels={availableModels} 
            onApplyWorkingModelsToFallback={handleApplyWorkingModelsToFallback}
            className="mt-6 mb-6" 
          />

          <div className="mb-4">
            <label htmlFor="ragTopK" className="block text-sm font-medium text-gray-300 mb-1">
              Số Lượng Thông Tin Ngữ Cảnh (RAG) <span className="text-gray-400 font-normal">({ragTopK} mục)</span>
            </label>
            <input
              type="range"
              id="ragTopK"
              min="0"
              max="100"
              value={ragTopK}
              onChange={(e) => setRagTopK(parseInt(e.target.value, 10))}
              className="w-full h-2 bg-gray-600 rounded-lg appearance-none cursor-pointer mb-1"
            />
            <p className="text-xs text-gray-400 mb-4">Điều chỉnh lượng thông tin "trí nhớ" của AI. Số lớn hơn giúp AI nhớ tốt hơn nhưng có thể tốn nhiều token hơn và chậm hơn. 0 để tắt.</p>

            <label htmlFor="apiTimeout" className="block text-sm font-medium text-gray-300 mb-1">
              Thời gian chờ AI xử lý <span className="text-gray-400 font-normal">({apiTimeout}s)</span>
            </label>
            <input
              type="range"
              id="apiTimeout"
              min="10"
              max="500"
              step="5"
              value={apiTimeout}
              onChange={(e) => setApiTimeout(parseInt(e.target.value, 10))}
              className="w-full h-2 bg-gray-600 rounded-lg appearance-none cursor-pointer mb-1"
            />
            <p className="text-xs text-gray-400">Nếu quá thời gian này mà không nhận được dữ liệu, hệ thống sẽ phán định lỗi và tự động chuyển sang fallback chain.</p>
          </div>


          <div>
            <label htmlFor="avatarGenerationEngine" className="block text-sm font-medium text-gray-300 mb-1">
                Cơ Chế Tạo Ảnh Avatar NPC
            </label>
            <select
                id="avatarGenerationEngine"
                value={selectedAvatarEngine}
                onChange={handleAvatarEngineChange}
                className="w-full p-3 bg-gray-700 border border-gray-600 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 text-gray-100 transition-colors duration-150"
            >
                {imageModelsList.map(model => (
                <option key={model.id} value={model.id}>
                    {model.name}
                </option>
                ))}
            </select>
            <p className="text-xs text-gray-400 mt-1">Chọn model để tạo ảnh đại diện cho NPC khi tùy chọn "Tự động tạo ảnh NPC" được bật.</p>
          </div>

          <div>
            <label htmlFor="embeddingModel" className="block text-sm font-medium text-gray-300 mb-1">
                Model Text Embedding
            </label>
            <select
                id="embeddingModel"
                value={selectedEmbeddingModel}
                onChange={handleEmbeddingModelChange}
                className="w-full p-3 bg-gray-700 border border-gray-600 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 text-gray-100 transition-colors duration-150"
            >
                {AVAILABLE_EMBEDDING_MODELS.map(model => (
                <option key={model.id} value={model.id}>
                    {model.name}{model.id.startsWith('TaylorAI/') && localStorage.getItem(`installed_${model.id}`) === 'true' ? ' (Đã cài)' : ''}
                </option>
                ))}
            </select>
            <p className="text-xs text-gray-400 mt-1">Chọn model để chuyển đổi văn bản thành vector (Embedding) phục vụ cho cơ chế Trí nhớ (RAG).</p>
          </div>

          <PresetManager 
            key={`presets-${presetRefreshKey}`}
            value={accessoryPrompt}
            onChange={setAccessoryPrompt}
            onPresetCountChange={setPresetCount}
            mainModel={selectedModel}
            isGuideOverlayActive={isGuideOverlayActive}
            activeGuideId={activeGuideId}
            setActiveGuideId={setActiveGuideId}
          />

          {presetCount > 0 && (
            <div className="mt-4 p-4 border border-gray-700 bg-gray-800/50 rounded flex items-center justify-between transition-all duration-300 animate-in fade-in slide-in-from-top-2">
              <div>
                <h4 className="text-sm font-medium text-gray-200">Bật chế độ thay thế hoàn toàn</h4>
                <p className="text-xs text-gray-400 mt-1">Khi bật, AI sẽ vô hiệu hoá các luật lệ kể chuyện/nhân cách gốc và chỉ dùng thiết lập từ file phụ tùng này.</p>
              </div>
              <button 
                onClick={() => setUseExclusiveAccessoryPrompt(!useExclusiveAccessoryPrompt)}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 focus:ring-offset-gray-800 ${useExclusiveAccessoryPrompt ? 'bg-indigo-600' : 'bg-gray-600'}`}
              >
                <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${useExclusiveAccessoryPrompt ? 'translate-x-6' : 'translate-x-1'}`} />
              </button>
            </div>
          )}

          {presetCount > 0 && useExclusiveAccessoryPrompt && (
            <div className="mt-4 p-4 border border-gray-700 bg-gray-800/30 rounded-lg transition-all duration-300 animate-in fade-in slide-in-from-top-2">
              <div className="flex items-center gap-2 pb-3 mb-3 border-b border-gray-700">
                <span className="text-xs text-indigo-400 font-bold uppercase tracking-wider">
                  [ CÀI ĐẶT BỘ LỌC PROMPT GỐC (KHI THAY THẾ TỔNG) ]
                </span>
              </div>
              <p className="text-xs text-gray-400 mb-4">
                Tích chọn các phần dưới đây để tiếp tục gửi prompt gốc tương ứng đến AI, giữ lại các cơ chế quan trọng của game kết hợp với preset của bạn.
              </p>
              
              <div className="space-y-3">
                {PROMPT_XML_SECTIONS.map((item) => {
                  const isChecked = exclusivePromptSections?.[item.key] !== false; // Mặc định là bật nếu chưa tắt
                  return (
                    <div 
                      key={item.key} 
                      className="p-2.5 rounded border border-gray-700/50 bg-gray-900/20 hover:bg-gray-800/40 transition-colors flex items-start gap-3 cursor-pointer"
                      onClick={() => {
                        setExclusivePromptSections(prev => ({
                          ...prev,
                          [item.key]: prev?.[item.key] === false ? true : false
                        }));
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => {}} // Handled by div onClick
                        className="mt-1 h-4 w-4 rounded border-gray-600 bg-gray-700 text-indigo-600 focus:ring-indigo-500 focus:ring-offset-gray-900 cursor-pointer"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="text-sm font-medium text-gray-200">{item.label}</span>
                          <span className="text-xs font-mono text-indigo-400 bg-indigo-950/40 px-1.5 py-0.5 rounded border border-indigo-900/30">
                            {item.tag}
                          </span>
                        </div>
                        <p className="text-xs text-gray-400 mt-1">{item.desc}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
          
          <div className="pt-4 border-t border-gray-700">
            <h3 className="text-lg font-semibold text-gray-200 mb-2">Cài Đặt Cloudinary (Lưu Ảnh)</h3>
            <label htmlFor="autoGenerateNpcAvatars" className="flex items-center cursor-pointer mb-2">
              <div className="relative">
                <input
                  type="checkbox"
                  id="autoGenerateNpcAvatars"
                  className="sr-only" 
                  checked={autoGenerateNpcAvatars}
                  onChange={handleAutoGenerateNpcAvatarsChange}
                />
                <div className={`block w-10 h-6 rounded-full transition-colors ${autoGenerateNpcAvatars ? 'bg-indigo-600' : 'bg-gray-600'}`}></div>
                <div className={`dot absolute left-1 top-1 bg-white w-4 h-4 rounded-full transition-transform ${autoGenerateNpcAvatars ? 'transform translate-x-full' : ''}`}></div>
              </div>
              <span className="ml-3 text-sm font-medium text-gray-300">{VIETNAMESE.autoGenerateNpcAvatarsLabel}</span>
            </label>
            <p className="text-xs text-gray-400 mt-1 ml-10 mb-3">{VIETNAMESE.autoGenerateNpcAvatarsInfo}</p>
             <p className="text-xs text-gray-400 mt-1 ml-10">{cloudinaryInfoText}</p>
          </div>


          <div className="relative">
            {isGuideOverlayActive && (
              <GuideMarker id="api-safety" index={7} text="Bước 7: Tắt các bộ lọc nếu bạn muốn trải nghiệm những tình tiết 'đen tối' hoặc bạo lực mà không bị AI từ chối." position="top" activeId={activeGuideId} onToggle={setActiveGuideId} />
            )}
            <h3 className="text-xl font-semibold text-gray-200 mb-3 pt-4 border-t border-gray-700 mt-6">
              {VIETNAMESE.safetySettingsLabel}
            </h3>
            {safetySettings.map((setting) => {
              const categoryInfo = HARM_CATEGORIES.find(cat => cat.id === setting.category);
              return (
                <div key={setting.category} className="mb-4">
                  <label htmlFor={`safety-${setting.category}`} className="block text-sm font-medium text-gray-300 mb-1">
                    {categoryInfo?.label || setting.category}
                  </label>
                  <select
                    id={`safety-${setting.category}`}
                    value={setting.threshold}
                    onChange={(e) => handleSafetySettingChange(setting.category, e.target.value)}
                    className="w-full p-3 bg-gray-700 border border-gray-600 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 text-gray-100 transition-colors duration-150"
                  >
                    {HARM_BLOCK_THRESHOLDS.map(threshold => (
                      <option key={threshold.id} value={threshold.id}>
                        {threshold.label}
                      </option>
                    ))}
                  </select>
                </div>
              );
            })}
          </div>
        </div>

        <div className="flex flex-col sm:flex-row justify-between items-center pt-6 space-y-3 sm:space-y-0 sm:space-x-4 mt-6 border-t border-gray-700">
          <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
            <Button 
              type="button" 
              variant="ghost" 
              onClick={() => setCurrentScreen(apiSettingsReturnScreen || GameScreen.Initial)}
              className="w-full sm:w-auto"
            >
              {VIETNAMESE.goBackButton}
            </Button>
            <Button 
              type="button" 
              variant="secondary" 
              onClick={handleExportAllApiSettings}
              className="w-full sm:w-auto text-xs"
            >
              {VIETNAMESE.exportAllApiSettingsButton}
            </Button>
            <Button 
              type="button" 
              variant="secondary" 
              onClick={() => importAllRef.current?.click()}
              className="w-full sm:w-auto text-xs"
            >
              {VIETNAMESE.importAllApiSettingsButton}
            </Button>
            <input type="file" ref={importAllRef} onChange={handleImportAllApiSettingsChange} accept=".txt" className="hidden" />
          </div>
          <div className="relative w-full sm:w-auto">
            {isGuideOverlayActive && (
              <GuideMarker id="api-save" index={8} text="Bước 8: Quan trọng nhất! Đừng quên nhấn Lưu để mọi thiết lập trên có hiệu lực trong cuộc phiêu lưu của bạn." position="top" activeId={activeGuideId} onToggle={setActiveGuideId} />
            )}
            <Button 
              type="button" 
              variant="primary" 
              size="lg" 
              onClick={handleSaveSettings}
              className="w-full sm:w-auto shadow-lg shadow-indigo-500/20"
            >
              {VIETNAMESE.saveSettingsButton}
            </Button>
          </div>
        </div>
      </div>
       <p className="mt-8 text-xs text-gray-500 text-center max-w-md px-2">
        {apiInfoText}
      </p>

      {isExportModalOpen && (
        <Modal
          isOpen={isExportModalOpen}
          onClose={() => setIsExportModalOpen(false)}
          title="Đặt Tên File Sao Lưu"
          maxWidth="max-w-md"
        >
          <div className="space-y-4 p-1 text-sm text-gray-200">
            <p className="text-gray-400 text-xs">
              Nhập tên tệp tin bạn muốn lưu trữ. Định dạng tệp tin sẽ tự động được gán đuôi <span className="text-amber-400">.txt</span>.
            </p>
            <div>
              <input
                type="text"
                value={exportFileName}
                onChange={(e) => setExportFileName(e.target.value)}
                placeholder="Nhập tên file..."
                className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-gray-100 focus:outline-none focus:border-amber-500 text-sm transition-all"
              />
            </div>
            <p className="text-gray-500 text-[10px] leading-relaxed">
              ⚠️ Lưu ý: Đảm bảo tên file không chứa ký tự đặc biệt nguy hiểm.
            </p>
            <div className="flex justify-end gap-2 pt-2 border-t border-gray-700">
              <Button 
                type="button" 
                variant="ghost" 
                onClick={() => setIsExportModalOpen(false)}
                className="text-xs"
              >
                Hủy Bỏ
              </Button>
              <Button 
                type="button" 
                variant="primary" 
                onClick={handleConfirmExport}
                className="text-xs font-bold"
              >
                Xác Nhận Tải Về
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};
