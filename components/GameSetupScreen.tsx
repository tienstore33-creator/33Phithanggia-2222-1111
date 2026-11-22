// FIX: Add React import to resolve JSX namespace error
import React, { useState, useCallback, ChangeEvent, useRef, useEffect } from 'react';
// FIX: Add GeneratedWorldElements to the type import to resolve its usage.
import { Loader2, Bug, Volume2, VolumeX } from 'lucide-react';
import { GameScreen, WorldSettings, StartingSkill, StartingItem, StartingNPC, StartingLore, StartingLocation, StartingFaction, PlayerStats, GenreType, WorldDate, StartingYeuThu, RaceCultivationSystem, GeneratedWorldElements } from '../types'; 
import Button from './ui/Button';
import Modal from './ui/Modal';
import { VIETNAMESE, DEFAULT_WORLD_SETTINGS, CUSTOM_GENRE_VALUE, MAX_TOKENS_FANFIC, DEFAULT_VIOLENCE_LEVEL, DEFAULT_STORY_TONE, DEFAULT_NSFW_DESCRIPTION_STYLE } from '../constants';
import { generateWorldDetailsFromStory, generateFanfictionWorldDetails, countTokens, generateCompletionForWorldDetails, generateCharacterDetailsFromName, generateTimelineEventsService, appendTimelineEventsService } from '../services/geminiService';
import { StrictLibrarianService } from '../src/services/StrictLibrarianService';
import { GeminiService } from '../src/services/geminiService';
import { runWorldGenStressTest, StressTestResult } from '../services/stressTestService';
import { FanficSourceService } from '../src/services/fanficSourceService';
import { GameplayService } from '../src/services/GameplayService';
import { WorldInitializationService } from '../src/services/WorldInitializationService';
import { fetchRawCanonData } from '../utils/rawFetcher';
import * as GameTemplates from '../templates';
import { audioService } from '../src/services/AudioService';
import { useGame } from '../hooks/useGame';
import { parseRealmString } from '../utils/realmParser';

// Import tab components
import AIAssistTab from './gameSetup/tabs/AIAssistTab';
import CharacterStoryTab from './gameSetup/tabs/CharacterStoryTab';
import WorldSettingsTab from './gameSetup/tabs/WorldSettingsTab';
import StartingElementsTab from './gameSetup/tabs/StartingElementsTab';
import WorkSelectionModal from './gameSetup/WorkSelectionModal';
import { StreamingConsole } from './gameSetup/StreamingConsole';
import { FanficWork } from '../src/types/fanfic';
import { useCultivationSystemActions } from '../hooks/actions/useCultivationSystemActions';
import { useStartingElementsActions } from '../hooks/actions/useStartingElementsActions';
import { sanitizeTimelineEvents, sanitizeQuests } from '../utils/sanitizeUtils';
import { GuideMarker, GuideOverlay, GuideToggleButton } from './guide/GuideSystem';
const validateAndFixRealm = (val: string, majors: string[], minors: any, fallback: string): string => {
  if (!val) return fallback;
  const exists = majors.some(m => m.toLowerCase() === val.toLowerCase());
  if (exists) return val;
  return majors[0] || val || fallback;
};

import { autoEnrichItem, processStartingItems } from '../services/ItemStatService';

interface GameSetupScreenProps {
  setCurrentScreen: (screen: GameScreen) => void;
  onSetupComplete: (settings: WorldSettings, uploadedAvatarData?: string | null) => void;
}

type SetupTab = 'aiAssist' | 'characterStory' | 'worldSettings' | 'startingElements';

const activeTabStyle = "whitespace-nowrap py-3 px-3 sm:px-4 border-b-2 font-medium text-xs sm:text-sm border-indigo-500 text-indigo-400 focus:outline-none";
const inactiveTabStyle = "whitespace-nowrap py-3 px-3 sm:px-4 border-b-2 font-medium text-xs sm:text-sm border-transparent text-gray-400 hover:text-gray-200 hover:border-gray-500 focus:outline-none";

// FIX: Changed component signature to use React.FC to resolve JSX namespace error and for consistency.
const GameSetupScreen: React.FC<GameSetupScreenProps> = ({ setCurrentScreen, onSetupComplete }) => {
  const [settings, setSettings] = useState<WorldSettings>({
    ...DEFAULT_WORLD_SETTINGS,
    saveGameName: DEFAULT_WORLD_SETTINGS.saveGameName || '',
    genre: DEFAULT_WORLD_SETTINGS.genre,
    customGenreName: DEFAULT_WORLD_SETTINGS.customGenreName || '',
    isCultivationEnabled: DEFAULT_WORLD_SETTINGS.isCultivationEnabled,
    startingSkills: [...(DEFAULT_WORLD_SETTINGS.startingSkills || [])],
    startingItems: (DEFAULT_WORLD_SETTINGS.startingItems || []).map(item => ({
        ...item, 
        category: item.category || GameTemplates.ItemCategory.MISCELLANEOUS, 
        quantity: item.quantity || 1
    })),
    startingNPCs: [...(DEFAULT_WORLD_SETTINGS.startingNPCs || [])],
    startingYeuThu: [...(DEFAULT_WORLD_SETTINGS.startingYeuThu || [])], // New
    startingLore: [...(DEFAULT_WORLD_SETTINGS.startingLore || [])],
    startingLocations: [...(DEFAULT_WORLD_SETTINGS.startingLocations || [])],
    startingFactions: [...(DEFAULT_WORLD_SETTINGS.startingFactions || [])],
    originalStorySummary: DEFAULT_WORLD_SETTINGS.originalStorySummary || "",
    raceCultivationSystems: [...(DEFAULT_WORLD_SETTINGS.raceCultivationSystems || [])], // NEW
    yeuThuRealmSystem: DEFAULT_WORLD_SETTINGS.yeuThuRealmSystem, // NEW
    canhGioiKhoiDau: DEFAULT_WORLD_SETTINGS.canhGioiKhoiDau,
    playerAvatarUrl: DEFAULT_WORLD_SETTINGS.playerAvatarUrl,
    playerSpiritualRoot: DEFAULT_WORLD_SETTINGS.playerSpiritualRoot, // Added
    playerSpecialPhysique: DEFAULT_WORLD_SETTINGS.playerSpecialPhysique, // Added
    playerPersonalityCore: DEFAULT_WORLD_SETTINGS.playerPersonalityCore || '',
    nsfwMode: DEFAULT_WORLD_SETTINGS.nsfwMode || false,
    nsfwDescriptionStyle: DEFAULT_WORLD_SETTINGS.nsfwDescriptionStyle || DEFAULT_NSFW_DESCRIPTION_STYLE,
    violenceLevel: DEFAULT_WORLD_SETTINGS.violenceLevel || DEFAULT_VIOLENCE_LEVEL,
    storyTone: DEFAULT_WORLD_SETTINGS.storyTone || DEFAULT_STORY_TONE,
    startingDate: DEFAULT_WORLD_SETTINGS.startingDate,
    startingCurrency: DEFAULT_WORLD_SETTINGS.startingCurrency,
  });

  const [activeTab, setActiveTab] = useState<SetupTab>('aiAssist');

  // Player Avatar states
  const [playerAvatarPreviewUrl, setPlayerAvatarPreviewUrl] = useState<string | null>(null);
  const [playerUploadedAvatarData, setPlayerUploadedAvatarData] = useState<string | null>(null);


  // State related to AI Assist Tab
  const [storyIdea, setStoryIdea] = useState('');
  // isOriginalStoryIdeaNsfw removed, use settings.nsfwMode
  const [fanficSourceType, setFanficSourceType] = useState<'name' | 'file'>('name');
  const [fanficStoryName, setFanficStoryName] = useState('');
  const [fanficFile, setFanficFile] = useState<File | null>(null);
  const [fanficFileContent, setFanficFileContent] = useState<string | null>(null);
  const [fanficTokenCount, setFanficTokenCount] = useState<number | null>(null);
  
  const [isGuideOverlayActive, setIsGuideOverlayActive] = useState(false);
  const [activeGuideId, setActiveGuideId] = useState<string | null>(null);

  const [volume, setVolumeState] = useState(() => Math.round(audioService.getVolume() * 100));

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newVol = parseInt(e.target.value, 10);
    setVolumeState(newVol);
    audioService.setVolume(newVol / 100);
  };

  const toggleMute = () => {
    if (volume > 0) {
      localStorage.setItem('app_bg_volume_before_mute', (volume / 100).toString());
      setVolumeState(0);
      audioService.setVolume(0);
    } else {
      const saved = localStorage.getItem('app_bg_volume_before_mute');
      const prevVol = saved ? parseFloat(saved) : 1.0;
      const restored = Math.round(prevVol * 100) || 100;
      setVolumeState(restored);
      audioService.setVolume(restored / 100);
    }
  };
  const [fanficPlayerDescription, setFanficPlayerDescription] = useState('');
  // isFanficIdeaNsfw removed, use settings.nsfwMode
  const [originalStorySummary, setOriginalStorySummary] = useState<string>(settings.originalStorySummary || '');
  const [showOriginalStorySummaryInput, setShowOriginalStorySummaryInput] = useState<boolean>(!!settings.originalStorySummary);
  const fanficFileInputRef = useRef<HTMLInputElement>(null);


  // General state for screen
  const [isGeneratingDetails, setIsGeneratingDetails] = useState(false);
  const [generatorMessage, setGeneratorMessage] = useState<{ text: string; type: 'success' | 'error' | 'info' } | null>(null);
  const [isAnalyzingWork, setIsAnalyzingWork] = useState(false);
  const [isStressTesting, setIsStressTesting] = useState(false);
  const [isRewritingStartingElements, setIsRewritingStartingElements] = useState(false);
  const [isRewritingWorldSettings, setIsRewritingWorldSettings] = useState(false);
  const [stressTestResults, setStressTestResults] = useState<StressTestResult[]>([]);
  const [stressTestProgress, setStressTestProgress] = useState({ current: 0, total: 0 });
  const [isGeneratingCompletion, setIsGeneratingCompletion] = useState(false);
  const [isGeneratingTimeline, setIsGeneratingTimeline] = useState(false);
  const [isGeneratingCharacter, setIsGeneratingCharacter] = useState(false);
  const [rawCanonData, setRawCanonData] = useState<string | null>(null);

  const [isLoadingTokens, setIsLoadingTokens] = useState(false);
  const [isWorkSelectionModalOpen, setIsWorkSelectionModalOpen] = useState(false);
  const [allWorks, setAllWorks] = useState<FanficWork[]>([]);
  const [selectedWork, setSelectedWork] = useState<FanficWork | null>(null);

  const { applyCultivationSystem } = useCultivationSystemActions(setSettings);
  const { rewriteStartingElements } = useStartingElementsActions(settings, setSettings, selectedWork, rawCanonData);

  const handleRewriteStartingElements = async (customPrompt?: string) => {
    setIsRewritingStartingElements(true);
    try {
      await rewriteStartingElements(customPrompt);
      setGeneratorMessage({ text: "Đã thiết lập lại các yếu tố khởi đầu thành công!", type: 'success' });
    } catch (error) {
      setGeneratorMessage({ text: "Lỗi khi thiết lập lại các yếu tố khởi đầu.", type: 'error' });
    } finally {
      setIsRewritingStartingElements(false);
    }
  };

  const handleRewriteWorldSettings = async (customPrompt: string) => {
    setIsRewritingWorldSettings(true);
    setStreamingText('');
    setIsStreamingActive(true);
    try {
      // Import rewriteWorldSettingsAI here if not imported globally
      const { rewriteWorldSettingsAI } = await import('../services/geminiService');
      const { response, rawText, constructedPrompt } = await rewriteWorldSettingsAI(
        settings, 
        customPrompt,
        (p) => setGeneratorMessage({ text: `AI đang thiết lập thế giới...`, type: 'info' }),
        (text) => setStreamingText(text)
      );

      setRawApiResponseText(rawText);
      setSentWorldGenPrompt(constructedPrompt);

      if (response) {
        setSettings(prev => {
          let updated = { ...prev };
          if (response.saveGameName) updated.saveGameName = response.saveGameName;
          if (response.worldTheme) updated.theme = response.worldTheme;
          if (response.genre) updated.genre = response.genre;
          if (response.customGenreName !== undefined) updated.customGenreName = response.customGenreName;
          if (response.worldSettingDescription) updated.settingDescription = response.worldSettingDescription;
          if (response.worldWritingStyle) updated.writingStyle = response.worldWritingStyle;
          if (response.difficulty) updated.difficulty = response.difficulty;
          if (response.startingDate) updated.startingDate = response.startingDate;
          if (response.originalStorySummary) updated.originalStorySummary = response.originalStorySummary;
          if (response.nsfwMode !== undefined) updated.nsfwMode = response.nsfwMode;
          if (response.nsfwDescriptionStyle) updated.nsfwDescriptionStyle = response.nsfwDescriptionStyle;
          if (response.violenceLevel) updated.violenceLevel = response.violenceLevel;
          if (response.storyTone) updated.storyTone = response.storyTone;
          
          if (response.majorRealmsRaw || response.minorRealmsRaw) {
            updated.cultivationSystem = {
              ...updated.cultivationSystem,
              majorRealmsRaw: response.majorRealmsRaw || updated.cultivationSystem.majorRealmsRaw,
              minorRealmsRaw: response.minorRealmsRaw || updated.cultivationSystem.minorRealmsRaw,
            };
          }
          if (response.canhGioiKhoiDau) updated.canhGioiKhoiDau = response.canhGioiKhoiDau;
          if (response.timelineEvents) updated.timelineEvents = sanitizeTimelineEvents(response.timelineEvents);

          return updated;
        });

        // If cultivation system changed, we might need to re-apply it to update parsed lists
        if (response.majorRealmsRaw || response.minorRealmsRaw) {
           const majors = response.majorRealmsRaw || settings.cultivationSystem.majorRealmsRaw;
           const minors = response.minorRealmsRaw || settings.cultivationSystem.minorRealmsRaw;
           applyCultivationSystem(majors, minors);
        }

        setGeneratorMessage({ text: "Đã thiết lập lại bối cảnh thế giới thành công!", type: 'success' });
      }
    } catch (error) {
      setGeneratorMessage({ text: "Lỗi khi thiết lập lại bối cảnh thế giới.", type: 'error' });
    } finally {
      setIsRewritingWorldSettings(false);
      setIsStreamingActive(false);
    }
  };

  const { isApiVerified } = useGame();
  const importSettingsFileRef = useRef<HTMLInputElement>(null);
  const [rawApiResponseText, setRawApiResponseText] = useState<string | null>(null);
  const [streamingText, setStreamingText] = useState<string>('');
  const [isStreamingActive, setIsStreamingActive] = useState<boolean>(false);
  const [showRawResponseModal, setShowRawResponseModal] = useState(false);
  const [sentWorldGenPrompt, setSentWorldGenPrompt] = useState<string | null>(null);
  const [showSentPromptModal, setShowSentPromptModal] = useState(false);
  const [generationTimer, setGenerationTimer] = useState(0);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const startTimer = () => {
    setGenerationTimer(0);
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      setGenerationTimer(prev => prev + 1);
    }, 1000);
  };

  const stopTimer = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  };
  
  // State for StartingElementsTab collapsible sections
  const [isSkillsSectionOpen, setIsSkillsSectionOpen] = useState(false);
  const [isItemsSectionOpen, setIsItemsSectionOpen] = useState(false);
  const [isNpcsSectionOpen, setIsNpcsSectionOpen] = useState(false);
  const [isYeuThuSectionOpen, setIsYeuThuSectionOpen] = useState(false); // New
  const [isLoreSectionOpen, setIsLoreSectionOpen] = useState(false);
  const [isLocationsSectionOpen, setIsLocationsSectionOpen] = useState(false);
  const [isFactionsSectionOpen, setIsFactionsSectionOpen] = useState(false);

  // Background Music for Setup Screen using SoundCloud Playlist
  // Removed old local file playback

  const processItemDetails = (items: StartingItem[]): StartingItem[] => {
    const majorRealms = settings.cultivationSystem.majorRealmsRaw.split('\n').map(r => r.split('|')[0].trim()).filter(Boolean);
    return processStartingItems(items, majorRealms);
  };

  const processSkillDetails = (skills: StartingSkill[]): StartingSkill[] => {
    if (!skills) return [];
    return skills.map(skill => {
        const newSkill = { ...skill };
        if (!newSkill.description || newSkill.description.trim() === "") {
            newSkill.description = `Một kỹ năng đặc biệt giúp người chơi vượt qua các thử thách.`;
        }
        return newSkill;
    });
  };

  // Effect 1: When raw avatar data changes (e.g., user uploads, AI generates base64, user types URL that is passed via onPlayerAvatarDataChange in CharacterStoryTab)
  // This data is the "source of truth" for the current user interaction for preview.
  useEffect(() => {
    if (playerUploadedAvatarData && (playerUploadedAvatarData.startsWith('http') || playerUploadedAvatarData.startsWith('data:'))) {
      setPlayerAvatarPreviewUrl(playerUploadedAvatarData);
    } else if (!playerUploadedAvatarData) {
      setPlayerAvatarPreviewUrl(null);
    }
    // If playerUploadedAvatarData is some placeholder like "uploaded_via_file", this effect won't set a preview from it.
    // The preview would only be set if actual base64 or URL data is in playerUploadedAvatarData.
  }, [playerUploadedAvatarData]);

  // Effect 2: When settings.playerAvatarUrl changes (e.g., due to import, or AI assist directly modifying settings)
  // This needs to synchronize playerUploadedAvatarData and playerAvatarPreviewUrl
  useEffect(() => {
    if (settings.playerAvatarUrl) {
      if (settings.playerAvatarUrl.startsWith('http') || settings.playerAvatarUrl.startsWith('data:')) {
        // If settings.playerAvatarUrl is a direct URL/Data URI, it becomes the source of truth
        setPlayerUploadedAvatarData(settings.playerAvatarUrl);
        // playerAvatarPreviewUrl will be updated by Effect 1 reacting to playerUploadedAvatarData change.
      } else if (settings.playerAvatarUrl === 'uploaded_via_file' || settings.playerAvatarUrl === 'upload_pending_after_ai_gen_cloudinary_fail') {
        // These are placeholders. It means the actual data *should* be in playerUploadedAvatarData if the state is consistent
        // from a previous user action or save/load that preserves playerUploadedAvatarData.
        // If playerUploadedAvatarData is NOT already set with base64 for these placeholders, clear the preview.
        if (!playerUploadedAvatarData || !playerUploadedAvatarData.startsWith('data:')) {
           setPlayerAvatarPreviewUrl(null); 
        } else {
           setPlayerAvatarPreviewUrl(playerUploadedAvatarData); // Ensure preview shows if base64 is there
        }
      }
    } else { // settings.playerAvatarUrl is undefined/null/empty
      setPlayerUploadedAvatarData(null); // This will trigger Effect 1 to clear playerAvatarPreviewUrl
    }
  }, [settings.playerAvatarUrl]); // Removed playerUploadedAvatarData from deps here to prevent potential loops.


  useEffect(() => {
    setAllWorks(FanficSourceService.getAllWorks());
  }, []);

  useEffect(() => {
    if (fanficStoryName) {
      const work = FanficSourceService.findWorkByTitle(fanficStoryName);
      if (work) {
        const summary = `Tên tác phẩm: ${work.title}\n\nMô tả: ${work.description}\n\nCốt truyện: ${work.plot}\n\nBối cảnh thế giới: ${work.worldSetting}`;
        setOriginalStorySummary(summary);
        setSettings(prev => ({ ...prev, originalStorySummary: summary }));
      }
    }
  }, [fanficStoryName]);

  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;

    if (name.startsWith('startingDate.')) {
        const field = name.split('.')[1] as keyof WorldDate;
        const numValue = parseInt(value, 10);
        setSettings(prev => ({
            ...prev,
            startingDate: {
                ...prev.startingDate,
                [field]: isNaN(numValue) ? 1 : numValue,
            },
        }));
        return; // Exit after handling nested object
    }
    
    if (type === 'checkbox') {
        const checked = (e.target as HTMLInputElement).checked;
        setSettings(prev => {
            const newSettings = { ...prev, [name]: checked };
            if (name === 'isCultivationEnabled' && !checked) {
                // When cultivation is disabled, clear related fields
                newSettings.raceCultivationSystems = [{ id: 'default-human-1', raceName: 'Nhân Tộc', realmSystem: VIETNAMESE.noCultivationSystem }];
                newSettings.yeuThuRealmSystem = VIETNAMESE.noCultivationSystem;
                newSettings.canhGioiKhoiDau = VIETNAMESE.mortalRealmName;
            } else if (name === 'isCultivationEnabled' && checked) {
                // Restore defaults if they were cleared
                if (prev.raceCultivationSystems.length === 0 || prev.raceCultivationSystems.every(s => s.realmSystem === VIETNAMESE.noCultivationSystem)) {
                    newSettings.raceCultivationSystems = DEFAULT_WORLD_SETTINGS.raceCultivationSystems;
                }
                 if (!prev.yeuThuRealmSystem || prev.yeuThuRealmSystem === VIETNAMESE.noCultivationSystem) {
                    newSettings.yeuThuRealmSystem = DEFAULT_WORLD_SETTINGS.yeuThuRealmSystem;
                }
                if (prev.canhGioiKhoiDau === VIETNAMESE.mortalRealmName || !prev.canhGioiKhoiDau) {
                    newSettings.canhGioiKhoiDau = DEFAULT_WORLD_SETTINGS.canhGioiKhoiDau;
                }
            }
            return newSettings;
        });
    } else {
      setSettings(prev => ({ ...prev, [name]: value }));
    }
    if (name === 'playerName' && !settings.saveGameName) {
        setSettings(prev => ({ ...prev, saveGameName: VIETNAMESE.saveGameNamePlaceholder.replace("[Tên Nhân Vật]", value) }))
    }
    if (name === 'genre' && value !== CUSTOM_GENRE_VALUE) { 
        setSettings(prev => ({ ...prev, customGenreName: "" }));
    }
    if (generatorMessage) setGeneratorMessage(null);
    if (rawApiResponseText) setRawApiResponseText(null);
    if (sentWorldGenPrompt) setSentWorldGenPrompt(null);
  }, [generatorMessage, rawApiResponseText, sentWorldGenPrompt, settings.saveGameName]);

  const handleOriginalStorySummaryChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newSummary = e.target.value;
    setOriginalStorySummary(newSummary);
    // Also update settings directly if needed, or rely on handleSubmit to consolidate
    setSettings(prev => ({ ...prev, originalStorySummary: newSummary }));
    if (rawApiResponseText) setRawApiResponseText(null);
    if (sentWorldGenPrompt) setSentWorldGenPrompt(null);
  };
  
  // Handlers for Race Cultivation Systems
  const handleRaceSystemChange = useCallback((index: number, field: keyof Omit<RaceCultivationSystem, 'id'>, value: string) => {
    setSettings(prev => {
        const newSystems = [...prev.raceCultivationSystems];
        newSystems[index] = { ...newSystems[index], [field]: value };
        return { ...prev, raceCultivationSystems: newSystems };
    });
  }, []);

  const addRaceSystem = useCallback(() => {
    setSettings(prev => ({
        ...prev,
        raceCultivationSystems: [
            ...prev.raceCultivationSystems,
            { id: `sys-${Date.now()}`, raceName: '', realmSystem: '' }
        ]
    }));
  }, []);

  const removeRaceSystem = useCallback((idToRemove: string) => {
    setSettings(prev => ({
        ...prev,
        raceCultivationSystems: prev.raceCultivationSystems.filter(sys => sys.id !== idToRemove)
    }));
  }, []);


  // Handlers for Starting Elements
  const handleStartingSkillChange = (index: number, field: string, value: any) => {
    setSettings(prev => {
      const newSkills = [...(prev.startingSkills || [])];
      let skillToUpdate = { ...(newSkills[index] || {}) } as StartingSkill;
  
      const fieldParts = field.split('.');
      if (fieldParts.length > 1) {
        // It's a nested property
        let currentLevel: any = skillToUpdate;
        for (let i = 0; i < fieldParts.length - 1; i++) {
          if (currentLevel[fieldParts[i]] === undefined) {
            currentLevel[fieldParts[i]] = {}; // Create nested object if it doesn't exist
          }
          currentLevel = currentLevel[fieldParts[i]];
        }
        currentLevel[fieldParts[fieldParts.length - 1]] = value;
      } else {
        // It's a direct property
        (skillToUpdate as any)[field] = value;
      }
      
      // When skillType changes, clear out details of other types to avoid inconsistent state
      if (field === 'skillType') {
        if (value !== GameTemplates.SkillType.CONG_PHAP_TU_LUYEN) delete skillToUpdate.congPhapDetails;
        if (value !== GameTemplates.SkillType.LINH_KI) delete skillToUpdate.linhKiDetails;
        if (value !== GameTemplates.SkillType.NGHE_NGHIEP) delete skillToUpdate.professionDetails;
        if (value !== GameTemplates.SkillType.CAM_THUAT) delete skillToUpdate.camThuatDetails;
        if (value !== GameTemplates.SkillType.THAN_THONG) delete skillToUpdate.thanThongDetails;
      }
  
      newSkills[index] = skillToUpdate;
      return { ...prev, startingSkills: newSkills };
    });
  };
  const addStartingSkill = (type: GameTemplates.SkillTypeValues) => {
    setSettings(prev => ({
      ...prev,
      startingSkills: [
        ...(prev.startingSkills || []),
        { name: '', description: '', skillType: type }
      ]
    }));
  };
  const removeStartingSkill = (index: number) => setSettings(prev => ({ ...prev, startingSkills: (prev.startingSkills || []).filter((_, i) => i !== index) }));

  const handleStartingItemChange = (
    index: number,
    field: keyof StartingItem | `equipmentDetails.${string}` | `potionDetails.${keyof NonNullable<StartingItem['potionDetails']>}` | `materialDetails.${keyof NonNullable<StartingItem['materialDetails']>}` | `questItemDetails.${keyof NonNullable<StartingItem['questItemDetails']>}` | `miscDetails.${keyof NonNullable<StartingItem['miscDetails']>}`,
    value: any
  ) => {
      setSettings(prev => {
          const newItems = [...(prev.startingItems || [])];
          const itemToUpdate = { ...(newItems[index] || {}) } as StartingItem;

          // Ensure detail objects exist
          if (!itemToUpdate.equipmentDetails) itemToUpdate.equipmentDetails = {};
          if (!itemToUpdate.potionDetails) itemToUpdate.potionDetails = {};
          if (!itemToUpdate.materialDetails) itemToUpdate.materialDetails = {};
          if (!itemToUpdate.questItemDetails) itemToUpdate.questItemDetails = {};
          if (!itemToUpdate.miscDetails) itemToUpdate.miscDetails = {};

          if (String(field).startsWith('equipmentDetails.')) {
              const subField = String(field).substring('equipmentDetails.'.length);

              if (subField === 'statBonuses') {
                  // This value comes from the interactive UI and is an object.
                  if (typeof value === 'object' && value !== null) {
                      itemToUpdate.equipmentDetails!.statBonuses = value;
                      try {
                          itemToUpdate.equipmentDetails!.statBonusesString = JSON.stringify(value);
                      } catch {
                          itemToUpdate.equipmentDetails!.statBonusesString = '{}';
                      }
                  }
              } else if (subField === 'uniqueEffects') {
                  // This value comes from the interactive UI and is an array of strings.
                  if (Array.isArray(value)) {
                      itemToUpdate.equipmentDetails!.uniqueEffects = value;
                      itemToUpdate.equipmentDetails!.uniqueEffectsString = value.join(';');
                  }
              } else {
                  // Handle other equipment details like 'type', 'slot'
                  (itemToUpdate.equipmentDetails as any)[subField] = value;
              }
          } else if (String(field).startsWith('potionDetails.')) {
              const subField = String(field).substring('potionDetails.'.length) as keyof NonNullable<StartingItem['potionDetails']>;
              (itemToUpdate.potionDetails as any)[subField] = value;
          } else if (String(field).startsWith('materialDetails.')) {
              const subField = String(field).substring('materialDetails.'.length) as keyof NonNullable<StartingItem['materialDetails']>;
              (itemToUpdate.materialDetails as any)[subField] = value;
          } else if (String(field).startsWith('questItemDetails.')) {
              const subField = String(field).substring('questItemDetails.'.length) as keyof NonNullable<StartingItem['questItemDetails']>;
              (itemToUpdate.questItemDetails as any)[subField] = value;
          } else if (String(field).startsWith('miscDetails.')) {
              const subField = String(field).substring('miscDetails.'.length) as keyof NonNullable<StartingItem['miscDetails']>;
              (itemToUpdate.miscDetails as any)[subField] = (typeof value === 'string' && (value === 'true' || value === 'false')) ? value === 'true' : value;
          } else {
              const directField = field as keyof StartingItem;
              if (directField === 'quantity' || directField === 'value') {
                  (itemToUpdate as any)[directField] = parseInt(value as string, 10) || 0;
              } else {
                  (itemToUpdate as any)[directField] = value;
              }
          }
          
          if (field === 'category') {
              const newCategory = value as GameTemplates.ItemCategoryValues;
              if (newCategory !== GameTemplates.ItemCategory.EQUIPMENT) itemToUpdate.equipmentDetails = {};
              if (newCategory !== GameTemplates.ItemCategory.POTION) itemToUpdate.potionDetails = {};
              if (newCategory !== GameTemplates.ItemCategory.MATERIAL) itemToUpdate.materialDetails = {};
              if (newCategory !== GameTemplates.ItemCategory.QUEST_ITEM) itemToUpdate.questItemDetails = {};
              if (newCategory !== GameTemplates.ItemCategory.MISCELLANEOUS) itemToUpdate.miscDetails = {};
          }

          newItems[index] = itemToUpdate;
          return { ...prev, startingItems: newItems };
      });
  };
  const addStartingItem = () => setSettings(prev => ({ ...prev, startingItems: [...(prev.startingItems || []), { name: '', description: '', quantity: 1, category: GameTemplates.ItemCategory.MISCELLANEOUS, rarity: GameTemplates.ItemRarity.PHO_THONG, value: 0, equipmentDetails: {}, potionDetails: {}, materialDetails: {}, questItemDetails: {}, miscDetails: {} }] }));
  const removeStartingItem = (index: number) => setSettings(prev => ({ ...prev, startingItems: (prev.startingItems || []).filter((_, i) => i !== index) }));

  // FIX: Type 'string | number | symbol' is not assignable to type 'string | number | bigint | boolean'. This is a common issue with computed properties on union types. Casting the key to 'any' is a safe and standard way to resolve this.
  const handleStartingNPCChange = (index: number, field: keyof StartingNPC, value: string | number) => {
    setSettings(prev => {
      const newNPCs = [...(prev.startingNPCs || [])];
      // FIX: Cast `field` to `any` to allow its use as a computed property key, resolving the TypeScript error.
      newNPCs[index] = { ...newNPCs[index], [field as any]: value };
      return { ...prev, startingNPCs: newNPCs };
    });
  };
  const addStartingNPC = () => setSettings(prev => ({ ...prev, startingNPCs: [...(prev.startingNPCs || []), { name: '', personality: '', initialAffinity: 0, details: '', gender: 'Không rõ', race: 'Nhân Tộc', realm: '', tuChat: 'Trung Phẩm', thoNguyen: 120, maxThoNguyen: 120 }] }));
  const removeStartingNPC = (index: number) => setSettings(prev => ({ ...prev, startingNPCs: (prev.startingNPCs || []).filter((_, i) => i !== index) }));

  const batchUpdateNPCs = useCallback((realmMap: Record<string, string>) => {
    setSettings(prev => {
      const newNPCs = (prev.startingNPCs || []).map(npc => {
        if (realmMap[npc.name]) {
          return { ...npc, realm: realmMap[npc.name] };
        }
        return npc;
      });
      return { ...prev, startingNPCs: newNPCs };
    });
  }, []);

  // FIX: Type 'string | number | symbol' is not assignable to type 'string | number | bigint | boolean'. This is a common issue with computed properties on union types. Casting the key to 'any' is a safe and standard way to resolve this.
  const handleStartingYeuThuChange = (index: number, field: keyof StartingYeuThu, value: string | boolean) => {
    setSettings(prev => {
        const newYeuThu = [...(prev.startingYeuThu || [])];
        // FIX: Cast `field` to `any` to allow its use as a computed property key, resolving the TypeScript error.
        newYeuThu[index] = { ...newYeuThu[index], [field as any]: value };
        return { ...prev, startingYeuThu: newYeuThu };
    });
  };
  const addStartingYeuThu = () => setSettings(prev => ({ ...prev, startingYeuThu: [...(prev.startingYeuThu || []), { name: '', species: '', description: '', isHostile: true }] }));
  const removeStartingYeuThu = (index: number) => setSettings(prev => ({ ...prev, startingYeuThu: (prev.startingYeuThu || []).filter((_, i) => i !== index) }));


  // FIX: Type 'string | number | symbol' is not assignable to type 'string | number | bigint | boolean'. This is a common issue with computed properties on union types. Casting the key to 'any' is a safe and standard way to resolve this.
  const handleStartingLoreChange = (index: number, field: keyof StartingLore, value: string) => {
    setSettings(prev => {
      const newLore = [...(prev.startingLore || [])];
      // FIX: Cast `field` to `any` to allow its use as a computed property key, resolving the TypeScript error.
      newLore[index] = { ...newLore[index], [field as any]: value };
      return { ...prev, startingLore: newLore };
    });
  };
  const addStartingLore = () => setSettings(prev => ({ ...prev, startingLore: [...(prev.startingLore || []), { title: '', content: '' }] }));
  const removeStartingLore = (index: number) => setSettings(prev => ({ ...prev, startingLore: (prev.startingLore || []).filter((_, i) => i !== index) }));

  // FIX: Type 'string | number | symbol' is not assignable to type 'string | number | bigint | boolean'. Refactored to use the same safe update pattern as other handlers to resolve this.
  const handleStartingLocationChange = (index: number, field: keyof StartingLocation, value: string | boolean) => {
    setSettings(prev => {
      const newLocations = [...(prev.startingLocations || [])];
      const locToUpdate = { ...newLocations[index] };
      
      let valueToSet: string | boolean | number | undefined = value;
      if (field === 'mapX' || field === 'mapY') {
        const numValue = parseInt(value as string, 10);
        valueToSet = isNaN(numValue) ? undefined : numValue;
      }
      
      // Use a temporary object and cast field to any to satisfy TypeScript
      (locToUpdate as any)[field] = valueToSet;
      
      newLocations[index] = locToUpdate;
      return { ...prev, startingLocations: newLocations };
    });
  };
  const addStartingLocation = () => setSettings(prev => ({ ...prev, startingLocations: [...(prev.startingLocations || []), { name: '', description: '', isSafeZone: false, regionId: '', mapX: undefined, mapY: undefined, locationType: GameTemplates.LocationType.DEFAULT }] }));
  const removeStartingLocation = (index: number) => setSettings(prev => ({ ...prev, startingLocations: (prev.startingLocations || []).filter((_, i) => i !== index) }));

  // FIX: Type 'string | number | symbol' is not assignable to type 'string | number | bigint | boolean'. This is a common issue with computed properties on union types. Casting the key to 'any' is a safe and standard way to resolve this.
  const handleStartingFactionChange = (index: number, field: keyof StartingFaction, value: string | number) => {
    setSettings(prev => {
      const newFactions = [...(prev.startingFactions || [])];
      // FIX: Cast `field` to `any` to allow its use as a computed property key, resolving the TypeScript error.
      newFactions[index] = { ...newFactions[index], [field as any]: value };
      return { ...prev, startingFactions: newFactions };
    });
  };
  const addStartingFaction = () => setSettings(prev => ({ ...prev, startingFactions: [...(prev.startingFactions || []), { name: '', description: '', alignment: GameTemplates.FactionAlignment.TRUNG_LAP, initialPlayerReputation: 0 }] }));
  const removeStartingFaction = (index: number) => setSettings(prev => ({ ...prev, startingFactions: (prev.startingFactions || []).filter((_, i) => i !== index) }));

  const updateSettingsFromAI = (response: GeneratedWorldElements) => {
    const processedItems = processItemDetails(response.startingItems || []);
    const validatedStartingItems = processedItems.map(item => {
        if (item.category === GameTemplates.ItemCategory.MATERIAL) {
            if (!item.materialDetails) {
                item.materialDetails = { type: GameTemplates.MaterialType.KHAC };
            } else if (!item.materialDetails.type || !Object.values(GameTemplates.MaterialType).includes(item.materialDetails.type as GameTemplates.MaterialTypeValues)) {
                item.materialDetails.type = GameTemplates.MaterialType.KHAC;
            }
        }
        return item;
    });

    setSettings(prev => ({
        ...prev,
        theme: response.worldTheme || prev.theme,
        settingDescription: response.worldSettingDescription || prev.settingDescription,
        writingStyle: response.worldWritingStyle || prev.writingStyle,
        currencyName: response.currencyName || prev.currencyName,
        playerName: response.playerName || prev.playerName,
        playerGender: response.playerGender || prev.playerGender,
        playerRace: response.playerRace || prev.playerRace,
        playerPersonality: response.playerPersonality || prev.playerPersonality,
        playerPersonalityCore: response.playerPersonalityCore || prev.playerPersonalityCore,
        playerBackstory: response.playerBackstory || prev.playerBackstory,
        playerGoal: response.playerGoal || prev.playerGoal,
        playerStartingTraits: response.playerStartingTraits || prev.playerStartingTraits,
        startingSkills: response.startingSkills && response.startingSkills.length > 0 ? response.startingSkills : prev.startingSkills,
        startingItems: validatedStartingItems.length > 0 ? validatedStartingItems : prev.startingItems,
        startingNPCs: response.startingNPCs && response.startingNPCs.length > 0 ? response.startingNPCs.map(npc => ({ ...npc, gender: npc.gender || 'Không rõ' })) : prev.startingNPCs,
        startingYeuThu: response.startingYeuThu && response.startingYeuThu.length > 0 ? response.startingYeuThu : prev.startingYeuThu,
        startingLore: response.startingLore && response.startingLore.length > 0 ? response.startingLore : prev.startingLore,
        startingLocations: response.startingLocations && response.startingLocations.length > 0 ? response.startingLocations : prev.startingLocations,
        startingFactions: response.startingFactions && response.startingFactions.length > 0 ? response.startingFactions : prev.startingFactions,
        originalStorySummary: response.originalStorySummary || prev.originalStorySummary,
        raceCultivationSystems: response.raceCultivationSystems && response.raceCultivationSystems.length > 0 ? response.raceCultivationSystems : prev.raceCultivationSystems,
        yeuThuRealmSystem: response.yeuThuRealmSystem || prev.yeuThuRealmSystem,
        canhGioiKhoiDau: response.isCultivationEnabled && response.canhGioiKhoiDau 
            ? validateAndFixRealm(
                response.canhGioiKhoiDau, 
                prev.cultivationSystem.parsedMajors.map(m => m.name), 
                prev.cultivationSystem.parsedMinors, 
                prev.canhGioiKhoiDau
            ) 
            : (response.canhGioiKhoiDau || prev.canhGioiKhoiDau),
        genre: response.genre || prev.genre,
        customGenreName: response.genre === CUSTOM_GENRE_VALUE && response.customGenreName ? response.customGenreName : (response.genre === CUSTOM_GENRE_VALUE ? prev.customGenreName : ""),
        isCultivationEnabled: response.isCultivationEnabled !== undefined ? response.isCultivationEnabled : prev.isCultivationEnabled,
        nsfwDescriptionStyle: settings.nsfwMode && response.nsfwDescriptionStyle ? response.nsfwDescriptionStyle : prev.nsfwDescriptionStyle,
        violenceLevel: settings.nsfwMode && response.violenceLevel ? response.violenceLevel : prev.violenceLevel,
        storyTone: settings.nsfwMode && response.storyTone ? response.storyTone : prev.storyTone,
        startingDate: response.startingDate || prev.startingDate,
        playerSpiritualRoot: response.playerSpiritualRoot || prev.playerSpiritualRoot,
        playerSpecialPhysique: response.playerSpecialPhysique || prev.playerSpecialPhysique,
        playerThoNguyen: response.playerThoNguyen || prev.playerThoNguyen,
        playerMaxThoNguyen: response.playerMaxThoNguyen || prev.playerMaxThoNguyen,
        startingCurrency: response.startingCurrency !== undefined ? response.startingCurrency : prev.startingCurrency,
    }));

    if (response.playerAvatarUrl && response.playerAvatarUrl.startsWith('http')) {
        setPlayerUploadedAvatarData(response.playerAvatarUrl);
    }
    if (response.originalStorySummary) {
        setOriginalStorySummary(response.originalStorySummary);
        setShowOriginalStorySummaryInput(true);
    }
  };

  // AI Assist Generation Handlers
  const handleGenerateFromStoryIdea = async () => {
    if (!storyIdea.trim()) { setGeneratorMessage({ text: 'Vui lòng nhập ý tưởng cốt truyện.', type: 'error' }); return; }
    setIsGeneratingDetails(true); setGeneratorMessage(null); setRawApiResponseText(null); setSentWorldGenPrompt(null);
    setStreamingText(''); setIsStreamingActive(true);
    try {
      let canonData: string | undefined = rawCanonData || undefined;
      if (settings.isStrictGrounding && settings.remoteCanonUrl && !canonData) {
          setGeneratorMessage({ text: "Đang tải dữ liệu gốc từ URL...", type: 'info' });
          const fetched = await fetchRawCanonData(settings.remoteCanonUrl);
          if (fetched) {
            canonData = fetched;
            setRawCanonData(fetched);
          }
      }

      const {response, rawText, constructedPrompt} = await generateWorldDetailsFromStory(
        storyIdea, 
        settings.nsfwMode || false, 
        settings.genre, 
        settings.isCultivationEnabled,
        settings.violenceLevel || DEFAULT_VIOLENCE_LEVEL,
        settings.storyTone || DEFAULT_STORY_TONE,
        settings.genre === CUSTOM_GENRE_VALUE ? settings.customGenreName : undefined,
        settings.nsfwDescriptionStyle || DEFAULT_NSFW_DESCRIPTION_STYLE,
        (prompt) => setGeneratorMessage({ text: `Đang gửi prompt (dài ${prompt.length} ký tự)...`, type: 'info'}),
        canonData,
        (text) => setStreamingText(text)
      );
      setRawApiResponseText(rawText); setSentWorldGenPrompt(constructedPrompt);
      updateSettingsFromAI(response);
      setGeneratorMessage({ text: VIETNAMESE.worldDetailsGeneratedSuccess, type: 'success' });
    } catch (e) { const errorMsg = e instanceof Error ? e.message : String(e); setGeneratorMessage({ text: `${VIETNAMESE.errorGeneratingWorldDetails} ${errorMsg}`, type: 'error' });
    } finally { setIsGeneratingDetails(false); setIsStreamingActive(false); }
  };

  const handleFanficFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    setGeneratorMessage(null); setRawApiResponseText(null); setSentWorldGenPrompt(null);
    const file = e.target.files?.[0];
    if (file) {
      setFanficFile(file); setFanficFileContent(null); setFanficTokenCount(null); setIsLoadingTokens(true); setGeneratorMessage({ text: `Đang đọc file "${file.name}"...`, type: 'info' });
      try {
        const content = await file.text(); setFanficFileContent(content); setGeneratorMessage({ text: `Đang tính token cho file "${file.name}"...`, type: 'info' });
        const tokens = await countTokens(content); setFanficTokenCount(tokens);
        if (tokens > MAX_TOKENS_FANFIC) setGeneratorMessage({ text: VIETNAMESE.tokenCountExceededError(MAX_TOKENS_FANFIC), type: 'error' });
        else setGeneratorMessage({ text: `File "${file.name}" đã sẵn sàng. Ước tính ${tokens} token.`, type: 'success' });
      } catch (err) { const errorMsg = err instanceof Error ? err.message : String(err); setGeneratorMessage({ text: `Lỗi xử lý file: ${errorMsg}`, type: 'error' });
      } finally { setIsLoadingTokens(false); }
    } else { setFanficFile(null); setFanficFileContent(null); setFanficTokenCount(null); }
  };

  useEffect(() => {
    if (fanficStoryName && fanficStoryName !== "-- Chọn tác phẩm --") {
      const officialWork = FanficSourceService.findWorkByTitle(fanficStoryName);
      if (officialWork) {
        setOriginalStorySummary(officialWork.plot);
        setShowOriginalStorySummaryInput(true);
      }
    }
  }, [fanficStoryName]);

  const handleStressTest = async () => {
      setIsStressTesting(true);
      setStressTestResults([]);
      setStressTestProgress({ current: 0, total: 200 });
      
      try {
        const results = await runWorldGenStressTest(settings, 200, (current, total, lastResult) => {
          setStressTestProgress({ current, total });
          setStressTestResults(prev => [lastResult, ...prev]);
        });
        console.log("Stress Test Results:", results);
      } catch (e) {
        console.error("Stress test failed", e);
      } finally {
        setIsStressTesting(false);
      }
  };

  const handleAnalyzeWork = async (workTitle: string) => {
    const isNoWork = !workTitle || workTitle === "-- Chọn tác phẩm --";
    const hasIdea = fanficPlayerDescription && fanficPlayerDescription.trim() !== "";

    if (isNoWork && !hasIdea) {
      setGeneratorMessage({ text: "Vui lòng chọn tác phẩm hoặc nhập ý tưởng đồng nhân để bắt đầu.", type: 'error' });
      return;
    }
    
    setIsAnalyzingWork(true);
    setStreamingText('');
    setIsStreamingActive(true);
    startTimer();
    setGeneratorMessage({ text: isNoWork ? "Đang khởi tạo thế giới từ ý tưởng của bạn..." : `Đang phân tích tác phẩm "${workTitle}"...`, type: 'info' });
    
    try {
      let baseResponse: GeneratedWorldElements;
      let rawContent: string | undefined = rawCanonData || undefined;

      if (settings.isStrictGrounding && settings.remoteCanonUrl && !rawContent) {
          setGeneratorMessage({ text: "Đang tải dữ liệu gốc từ URL...", type: 'info' });
          rawContent = await fetchRawCanonData(settings.remoteCanonUrl) || undefined;
          if (rawContent) setRawCanonData(rawContent);
      }
      
      if (isNoWork) {
        // Skip analysis, use defaults or minimal info
        baseResponse = {
            worldTheme: "Thế giới mới",
            worldSettingDescription: fanficPlayerDescription,
            playerName: settings.playerName || "Người chơi",
            playerGender: settings.playerGender || "Nam",
            playerRace: settings.playerRace || "Nhân Tộc",
            genre: settings.genre,
            customGenreName: settings.customGenreName,
            isCultivationEnabled: settings.isCultivationEnabled,
            startingNPCs: [],
            startingLocations: [],
            startingFactions: [],
            startingSkills: [],
            startingItems: [],
            startingYeuThu: [],
            startingLore: [],
            raceCultivationSystems: []
        };
      } else {
        // Step 1: Get base data from WorldInitializationService
        const setupData = await WorldInitializationService.initializeWorld(workTitle, (state) => {
            setGeneratorMessage({ text: state, type: 'info' });
        }, rawContent, (text) => setStreamingText(text), settings.useDeepGrounding || false);
        
        // Detect genre and cultivation status
        const detected = (() => {
            const topic = setupData?.topic || '';
            const desc = setupData?.worldDescription || '';
            const text = (topic + " " + desc).toLowerCase();
            if (text.includes("tu tiên") || text.includes("tiên hiệp") || text.includes("linh khí")) return { genre: "Tu Tiên (Mặc định)" as GenreType, isCultivation: true };
            if (text.includes("kiếm hiệp") || text.includes("võ hiệp") || text.includes("giang hồ")) return { genre: "Kiếm Hiệp" as GenreType, isCultivation: true };
            if (text.includes("huyền huyễn")) return { genre: "Huyền Huyễn" as GenreType, isCultivation: true };
            if (text.includes("cyberpunk") || text.includes("khoa huyễn") || text.includes("tương lai")) return { genre: "Khoa Huyễn" as GenreType, isCultivation: true };
            if (text.includes("fantasy") || text.includes("ma pháp") || text.includes("phù thủy")) return { genre: "Phương Tây Fantasy" as GenreType, isCultivation: true };
            if (text.includes("mạt thế") || text.includes("zombie")) return { genre: "Mạt Thế" as GenreType, isCultivation: true };
            if (text.includes("đô thị")) return { genre: "Đô Thị" as GenreType, isCultivation: false };
            return { genre: CUSTOM_GENRE_VALUE as GenreType, isCultivation: true };
        })();

        const cp = (setupData as any).charPlotData || {};

        // Convert to GeneratedWorldElements
        baseResponse = {
          worldTheme: setupData.topic,
          worldSettingDescription: setupData.worldDescription,
          worldWritingStyle: setupData.writingStyle,
          originalStorySummary: setupData.mainPlot,
          playerName: cp.mainCharacterName || settings.playerName,
          playerGender: (cp.mainCharacterGender === "Nam" || cp.mainCharacterGender === "Nữ" || cp.mainCharacterGender === "Khác") ? cp.mainCharacterGender : "Nam",
          playerRace: cp.mainCharacterRace || "Nhân Tộc",
          playerPersonality: cp.mainCharacterPersonality || "",
          playerBackstory: cp.mainCharacterBiography || "",
          playerGoal: cp.goal || "",
          playerStartingTraits: cp.generalStartingTraits || "",
          currencyName: cp.currencyName || "Linh Thạch",
          startingCurrency: Number(cp.startingMoneyAmount) || 0,
          playerSpiritualRoot: cp.spiritualRoot || "",
          playerSpecialPhysique: cp.specialPhysique || "",
          playerThoNguyen: Number(cp.remainingLifespan) || 100,
          playerMaxThoNguyen: Number(cp.maxLifespan) || 100,
          genre: CUSTOM_GENRE_VALUE,
          customGenreName: workTitle || setupData.topic || "",
          isCultivationEnabled: detected.isCultivation,
          startingNPCs: setupData.characters.map(c => ({
            name: c.name,
            gender: (c.gender === "Nam" || c.gender === "Nữ" || c.gender === "Khác") ? c.gender : "Không rõ",
            details: c.background,
            personality: c.personality,
            initialAffinity: 50,
            isOfficial: c.isOfficial,
            race: "Nhân Tộc",
            realm: "Phàm Nhân",
            tuChat: "Trung Phẩm",
            thoNguyen: 100,
            maxThoNguyen: 100
          })),
          startingLocations: setupData.locations.map(l => ({
            name: l.name,
            description: l.description,
            isOfficial: l.isOfficial
          })),
          startingFactions: setupData.factions.map(f => ({
            name: f.name,
            description: f.description,
            alignment: GameTemplates.FactionAlignment.TRUNG_LAP,
            initialPlayerReputation: 0,
            isOfficial: f.isOfficial
          })),
          startingSkills: setupData.skills || [],
          startingItems: setupData.items || [],
          startingYeuThu: setupData.yeuThu || [],
          startingLore: setupData.lore || [],
          raceCultivationSystems: []
        };
      }

      // Update local state with base data first
      updateSettingsFromAI(baseResponse);
      if (baseResponse.originalStorySummary) {
          setOriginalStorySummary(baseResponse.originalStorySummary);
          setShowOriginalStorySummaryInput(true);
      }

      setGeneratorMessage({ text: `Đang kết nối API...`, type: 'info' });

      // Step 2: Build context for AI Completion
      const contextSettings: WorldSettings = { 
          ...settings,
          genre: baseResponse.genre || settings.genre,
          customGenreName: baseResponse.customGenreName || settings.customGenreName,
          isCultivationEnabled: baseResponse.isCultivationEnabled !== undefined ? baseResponse.isCultivationEnabled : settings.isCultivationEnabled,
          theme: baseResponse.worldTheme || workTitle,
          settingDescription: baseResponse.worldSettingDescription || settings.settingDescription,
          originalStorySummary: baseResponse.originalStorySummary || originalStorySummary,
          playerName: baseResponse.playerName || settings.playerName,
          playerGender: baseResponse.playerGender || settings.playerGender,
          playerPersonality: baseResponse.playerPersonality || settings.playerPersonality,
          playerBackstory: baseResponse.playerBackstory || settings.playerBackstory,
          playerGoal: baseResponse.playerGoal || settings.playerGoal,
          startingNPCs: baseResponse.startingNPCs || settings.startingNPCs,
          startingLocations: baseResponse.startingLocations || settings.startingLocations,
          startingFactions: baseResponse.startingFactions || settings.startingFactions
      };

      // Add player's fanfic description to setting description for context
      if (fanficPlayerDescription && fanficPlayerDescription.trim() !== "") {
          contextSettings.settingDescription = (contextSettings.settingDescription || "") + `\n\n**Ý TƯỞNG ĐỒNG NHÂN CỦA NGƯỜI CHƠI:**\n${fanficPlayerDescription}`;
      }

      // Step 3: Call AI Completion with timeout
      const playerNameForMessage = baseResponse.playerName || settings.playerName || "nhân vật chính";
      setGeneratorMessage({ text: `Đang kết nối API...`, type: 'info' });
      
      const totalTimeoutPromise = new Promise((_, reject) => 
          setTimeout(() => reject(new Error("Tiến trình xử lý quá 600 giây (10 phút). Mô hình đang xử lý dữ liệu phức tạp, vui lòng đợi thêm hoặc thử lại với yêu cầu ngắn gọn hơn.")), 600000)
      );

      const completionPromise = generateCompletionForWorldDetails(
          contextSettings,
          (prompt) => {
              // Extract some info from prompt to provide more granular feedback
              if (prompt.includes("Nhân Vật Chính")) {
                  setGeneratorMessage({ text: `Đang điền thông tin cho ${playerNameForMessage}...`, type: 'info' });
              } else if (prompt.includes("NPC Khởi Đầu")) {
                  setGeneratorMessage({ text: `Đang tạo danh sách NPC cho thế giới...`, type: 'info' });
              } else if (prompt.includes("Kỹ Năng Khởi Đầu")) {
                  setGeneratorMessage({ text: `Đang thiết lập kỹ năng và vật phẩm...`, type: 'info' });
              } else {
                  setGeneratorMessage({ text: `Đang kết nối API và bắt đầu phân tích...`, type: 'info' });
              }
          },
          (model) => {
              setGeneratorMessage(prev => prev ? { ...prev, text: `${prev.text} (Đang dùng: ${model})` } : null);
          },
          rawContent,
          undefined,
          (text) => setStreamingText(text)
      );

      try {
          // Race against the total timeout
          const { response: completionResponse, rawText, constructedPrompt } = await Promise.race([
              completionPromise,
              totalTimeoutPromise
          ]) as any;
          
          stopTimer();
          setRawApiResponseText(rawText);
          setSentWorldGenPrompt(constructedPrompt);

      // Step 4: Merge everything into settings
      setSettings(prev => {
          const newSettings = { ...prev };
          const merged = completionResponse;

          const isEmpty = (val: any) => {
              if (Array.isArray(val)) return val.length === 0;
              if (typeof val === 'string') return val.trim() === '';
              return !val;
          };

          // Basic Info (Prefer AI completion for these if they were empty)
          if (!isEmpty(merged.worldTheme)) newSettings.theme = merged.worldTheme;
          if (!isEmpty(merged.worldSettingDescription)) newSettings.settingDescription = merged.worldSettingDescription;
          if (!isEmpty(merged.worldWritingStyle)) newSettings.writingStyle = merged.worldWritingStyle;
          if (!isEmpty(merged.originalStorySummary)) newSettings.originalStorySummary = merged.originalStorySummary;
          if (!isEmpty(merged.currencyName)) newSettings.currencyName = merged.currencyName;
          // User requested: Always use Custom Genre and set it to the work title or theme
          newSettings.genre = CUSTOM_GENRE_VALUE;
          newSettings.customGenreName = workTitle || merged.worldTheme || prev.theme || "";
          if (merged.isCultivationEnabled !== undefined) newSettings.isCultivationEnabled = merged.isCultivationEnabled;

          // Player Info
          if (!isEmpty(merged.playerName)) newSettings.playerName = merged.playerName;
          if (!isEmpty(merged.playerGender)) newSettings.playerGender = merged.playerGender;
          if (!isEmpty(merged.playerRace)) newSettings.playerRace = merged.playerRace;
          if (!isEmpty(merged.playerPersonality)) newSettings.playerPersonality = merged.playerPersonality;
          if (!isEmpty(merged.playerBackstory)) newSettings.playerBackstory = merged.playerBackstory;
          if (!isEmpty(merged.playerGoal)) newSettings.playerGoal = merged.playerGoal;
          if (!isEmpty(merged.playerStartingLocationType)) newSettings.playerStartingLocationType = merged.playerStartingLocationType;
          if (!isEmpty(merged.playerStartingTraits)) newSettings.playerStartingTraits = merged.playerStartingTraits;
          if (merged.startingCurrency !== undefined) newSettings.startingCurrency = merged.startingCurrency;
          if (!isEmpty(merged.playerSpiritualRoot)) newSettings.playerSpiritualRoot = merged.playerSpiritualRoot;
          if (!isEmpty(merged.playerSpecialPhysique)) newSettings.playerSpecialPhysique = merged.playerSpecialPhysique;
          if (merged.playerThoNguyen !== undefined) newSettings.playerThoNguyen = merged.playerThoNguyen;
          if (merged.playerMaxThoNguyen !== undefined) newSettings.playerMaxThoNguyen = merged.playerMaxThoNguyen;

          // Starting Elements (Merge and ensure minimums)
          // We append AI generated ones to existing ones from setupData
          if (merged.startingSkills?.length > 0) {
              const processedSkills = processSkillDetails(merged.startingSkills);
              newSettings.startingSkills = [...(baseResponse.startingSkills || []), ...processedSkills];
          } else if (baseResponse.startingSkills?.length > 0) {
              newSettings.startingSkills = processSkillDetails(baseResponse.startingSkills);
          }
          if (merged.startingItems?.length > 0) {
              const processedItems = processItemDetails(merged.startingItems);
              newSettings.startingItems = [...(baseResponse.startingItems || []), ...processedItems];
          } else if (baseResponse.startingItems?.length > 0) {
              newSettings.startingItems = processItemDetails(baseResponse.startingItems);
          }
          if (merged.startingNPCs?.length > 0) {
              // Create a map of existing NPCs from baseResponse to avoid duplicates but keep official ones
              const npcMap = new Map<string, StartingNPC>();
              baseResponse.startingNPCs?.forEach(npc => {
                  if (npc.name) npcMap.set(npc.name.toLowerCase(), npc);
              });
              
              merged.startingNPCs.forEach(newNpc => {
                  if (!newNpc.name) return;
                  const npcKey = newNpc.name.toLowerCase();
                  const existing = npcMap.get(npcKey);
                  if (existing) {
                      // Merge: Keep isOfficial from base, but take details from AI
                      npcMap.set(npcKey, { ...existing, ...newNpc, isOfficial: existing.isOfficial });
                  } else {
                      npcMap.set(npcKey, newNpc);
                  }
              });
              newSettings.startingNPCs = Array.from(npcMap.values()).slice(0, 6);
          }
          if (merged.startingYeuThu?.length > 0) {
              newSettings.startingYeuThu = [...(baseResponse.startingYeuThu || []), ...merged.startingYeuThu];
          }
          if (merged.startingLore?.length > 0) {
              newSettings.startingLore = [...(baseResponse.startingLore || []), ...merged.startingLore];
          }
          if (merged.startingLocations?.length > 0) {
              newSettings.startingLocations = [...(baseResponse.startingLocations || []), ...merged.startingLocations];
          }
          if (merged.startingFactions?.length > 0) {
              newSettings.startingFactions = [...(baseResponse.startingFactions || []), ...merged.startingFactions];
          }

          if (merged.raceCultivationSystems?.length > 0) {
              newSettings.raceCultivationSystems = merged.raceCultivationSystems;
          }
          if (merged.yeuThuRealmSystem) {
              newSettings.yeuThuRealmSystem = merged.yeuThuRealmSystem;
          }
          newSettings.canhGioiKhoiDau = "";
          
          return newSettings;
      });

      if (completionResponse.originalStorySummary) {
          setOriginalStorySummary(completionResponse.originalStorySummary);
      }

      setGeneratorMessage({ text: isNoWork ? "Đã khởi tạo thế giới thành công!" : `Đã hoàn tất phân tích và khởi tạo thế giới đồng nhân cho "${workTitle}"!`, type: 'success' });
      } catch (innerError) {
          stopTimer();
          setGeneratorMessage({ text: innerError instanceof Error ? innerError.message : "Lỗi khi phân tích chi tiết", type: 'error' });
          console.error(innerError);
          return;
      }
    } catch (e) {
      stopTimer();
      const errorMsg = e instanceof Error ? e.message : String(e);
      setGeneratorMessage({ text: `Lỗi khi phân tích: ${errorMsg}`, type: 'error' });
    } finally {
      setIsAnalyzingWork(false);
      setIsStreamingActive(false);
    }
  };

  const handleGenerateTimelineEvents = async () => {
      if (!originalStorySummary) {
          setGeneratorMessage({ text: 'Vui lòng điền Tóm Tắt Cốt Truyện Nguyên Tác trước.', type: 'error' });
          return;
      }
      setIsGeneratingTimeline(true);
      setGeneratorMessage({ text: 'AI đang phân tích cốt truyện để liệt kê Dòng Thời Gian Nguyên Tác...', type: 'info' });
      setStreamingText('');
      setIsStreamingActive(true);
      
      try {
          let canonData: string | undefined = rawCanonData || undefined;
          if (settings.isStrictGrounding && settings.remoteCanonUrl && !canonData) {
              setGeneratorMessage({ text: "Đang tải dữ liệu gốc từ URL...", type: 'info' });
              const fetched = await fetchRawCanonData(settings.remoteCanonUrl);
              if (fetched) {
                  canonData = fetched;
                  setRawCanonData(fetched);
              }
          }
          const { events } = await generateTimelineEventsService(
              originalStorySummary, 
              settings.theme || '', 
              canonData, 
              (prompt) => {
                  setGeneratorMessage({ text: `AI đang lập timeline... (Prompt dài ${prompt.length} ký tự)`, type: 'info' });
              },
              (text) => setStreamingText(text),
              (msg) => setGeneratorMessage({ text: msg, type: 'info' })
          );
          
          const cleanEvents = sanitizeTimelineEvents(events);
          setSettings(prev => ({ ...prev, timelineEvents: cleanEvents }));
          setGeneratorMessage({ text: `Đã tạo thành công ${cleanEvents.length} sự kiện dòng thời gian.`, type: 'success' });
      } catch (e) {
          const errorMsg = e instanceof Error ? e.message : String(e);
          setGeneratorMessage({ text: `Lỗi khi tạo Dòng Thời Gian: ${errorMsg}`, type: 'error' });
      } finally {
          setIsGeneratingTimeline(false);
          setIsStreamingActive(false);
      }
  };

  const handleAppendTimelineEvents = async () => {
      const currentEvents = settings.timelineEvents || [];
      if (currentEvents.length === 0) {
          return handleGenerateTimelineEvents();
      }
      setIsGeneratingTimeline(true);
      setGeneratorMessage({ text: 'AI đang nối tiếp 10 sự kiện tiếp theo trong Dòng Thời Gian Nguyên Tác...', type: 'info' });
      setStreamingText('');
      setIsStreamingActive(true);
      
      try {
          let canonData: string | undefined = rawCanonData || undefined;
          if (settings.isStrictGrounding && settings.remoteCanonUrl && !canonData) {
              setGeneratorMessage({ text: "Đang tải dữ liệu gốc từ URL...", type: 'info' });
              const fetched = await fetchRawCanonData(settings.remoteCanonUrl);
              if (fetched) {
                  canonData = fetched;
                  setRawCanonData(fetched);
              }
          }
          const lastEvents = currentEvents.slice(-5);
          const { events } = await appendTimelineEventsService(
              lastEvents, 
              settings.theme || '', 
              originalStorySummary,
              canonData, 
              currentEvents.length + 1,
              (prompt) => {
                  setGeneratorMessage({ text: `AI đang nối tiếp timeline... (Prompt dài ${prompt.length} ký tự)`, type: 'info' });
              },
              (text) => setStreamingText(text),
              (msg) => setGeneratorMessage({ text: msg, type: 'info' })
          );
          
          const cleanEvents = sanitizeTimelineEvents(events);
          setSettings(prev => ({ ...prev, timelineEvents: sanitizeTimelineEvents([...(prev.timelineEvents || []), ...cleanEvents]) }));
          setGeneratorMessage({ text: `Đã nối tiếp thành công +${cleanEvents.length} sự kiện dòng thời gian mới.`, type: 'success' });
      } catch (e) {
          const errorMsg = e instanceof Error ? e.message : String(e);
          setGeneratorMessage({ text: `Lỗi khi nối tiếp Dòng Thời Gian: ${errorMsg}`, type: 'error' });
      } finally {
          setIsGeneratingTimeline(false);
          setIsStreamingActive(false);
      }
  };

  const handleGenerateCompletion = async () => {
    setIsGeneratingCompletion(true);
    setGeneratorMessage(null);
    setRawApiResponseText(null);
    setSentWorldGenPrompt(null);
    setStreamingText('');
    setIsStreamingActive(true);
    try {
        let canonData: string | undefined = rawCanonData || undefined;
        if (settings.isStrictGrounding && settings.remoteCanonUrl && !canonData) {
            setGeneratorMessage({ text: "Đang tải dữ liệu gốc từ URL...", type: 'info' });
            const fetched = await fetchRawCanonData(settings.remoteCanonUrl);
            if (fetched) {
              canonData = fetched;
              setRawCanonData(fetched);
            }
        }

        const { response, rawText, constructedPrompt } = await generateCompletionForWorldDetails(
            settings,
            (prompt) => setGeneratorMessage({ text: `AI đang hoàn thiện... (Prompt dài ${prompt.length} ký tự)`, type: 'info' }),
            undefined,
            canonData,
            undefined,
            (text) => setStreamingText(text)
        );
        setRawApiResponseText(rawText);
        setSentWorldGenPrompt(constructedPrompt);

        // Conditional Merging Logic
        setSettings(prev => {
            const newSettings = { ...prev };
            const mergedResponse = response;

            const isFalsyOrEmpty = (value: any) => {
                if (Array.isArray(value)) return value.length === 0;
                if (typeof value === 'string') return value.trim() === '';
                return !value;
            };
            
            if (isFalsyOrEmpty(prev.theme) && mergedResponse.worldTheme) newSettings.theme = mergedResponse.worldTheme;
            if (isFalsyOrEmpty(prev.settingDescription) && mergedResponse.worldSettingDescription) newSettings.settingDescription = mergedResponse.worldSettingDescription;
            if (isFalsyOrEmpty(prev.writingStyle) && mergedResponse.worldWritingStyle) newSettings.writingStyle = mergedResponse.worldWritingStyle;
            if (isFalsyOrEmpty(prev.currencyName) && mergedResponse.currencyName) newSettings.currencyName = mergedResponse.currencyName;
            if (isFalsyOrEmpty(prev.playerName) && mergedResponse.playerName) newSettings.playerName = mergedResponse.playerName;
            if (isFalsyOrEmpty(prev.playerGender) && mergedResponse.playerGender) newSettings.playerGender = mergedResponse.playerGender;
            if (isFalsyOrEmpty(prev.playerRace) && mergedResponse.playerRace) newSettings.playerRace = mergedResponse.playerRace;
            if (isFalsyOrEmpty(prev.playerPersonality) && mergedResponse.playerPersonality) newSettings.playerPersonality = mergedResponse.playerPersonality;
            if (isFalsyOrEmpty(prev.playerBackstory) && mergedResponse.playerBackstory) newSettings.playerBackstory = mergedResponse.playerBackstory;
            if (isFalsyOrEmpty(prev.playerGoal) && mergedResponse.playerGoal) newSettings.playerGoal = mergedResponse.playerGoal;
            if (isFalsyOrEmpty(prev.playerStartingTraits) && mergedResponse.playerStartingTraits) newSettings.playerStartingTraits = mergedResponse.playerStartingTraits;
            if (isFalsyOrEmpty(prev.playerSpiritualRoot) && mergedResponse.playerSpiritualRoot) newSettings.playerSpiritualRoot = mergedResponse.playerSpiritualRoot;
            if (isFalsyOrEmpty(prev.playerSpecialPhysique) && mergedResponse.playerSpecialPhysique) newSettings.playerSpecialPhysique = mergedResponse.playerSpecialPhysique;
            if (!prev.playerThoNguyen && mergedResponse.playerThoNguyen) newSettings.playerThoNguyen = mergedResponse.playerThoNguyen;
            if (!prev.playerMaxThoNguyen && mergedResponse.playerMaxThoNguyen) newSettings.playerMaxThoNguyen = mergedResponse.playerMaxThoNguyen;
            if (!prev.startingCurrency && mergedResponse.startingCurrency) newSettings.startingCurrency = mergedResponse.startingCurrency;
            if (isFalsyOrEmpty(prev.raceCultivationSystems) && (mergedResponse.raceCultivationSystems || []).length > 0) newSettings.raceCultivationSystems = mergedResponse.raceCultivationSystems;
            if (isFalsyOrEmpty(prev.yeuThuRealmSystem) && mergedResponse.yeuThuRealmSystem) newSettings.yeuThuRealmSystem = mergedResponse.yeuThuRealmSystem;
            if (isFalsyOrEmpty(prev.canhGioiKhoiDau) && mergedResponse.canhGioiKhoiDau) newSettings.canhGioiKhoiDau = mergedResponse.canhGioiKhoiDau;
            
            if (isFalsyOrEmpty(prev.startingSkills) && (mergedResponse.startingSkills || []).length > 0) newSettings.startingSkills = mergedResponse.startingSkills;
            if (isFalsyOrEmpty(prev.startingItems) && mergedResponse.startingItems && mergedResponse.startingItems.length > 0) {
                newSettings.startingItems = processItemDetails(mergedResponse.startingItems);
            }
            if (isFalsyOrEmpty(prev.startingNPCs) && (mergedResponse.startingNPCs || []).length > 0) newSettings.startingNPCs = mergedResponse.startingNPCs.slice(0, 6);
            if (isFalsyOrEmpty(prev.startingYeuThu) && (mergedResponse.startingYeuThu || []).length > 0) newSettings.startingYeuThu = mergedResponse.startingYeuThu;
            if (isFalsyOrEmpty(prev.startingLore) && (mergedResponse.startingLore || []).length > 0) newSettings.startingLore = mergedResponse.startingLore;
            if (isFalsyOrEmpty(prev.startingLocations) && (mergedResponse.startingLocations || []).length > 0) newSettings.startingLocations = mergedResponse.startingLocations;
            if (isFalsyOrEmpty(prev.startingFactions) && (mergedResponse.startingFactions || []).length > 0) newSettings.startingFactions = mergedResponse.startingFactions;

            return newSettings;
        });

        if (response.playerAvatarUrl && !settings.playerAvatarUrl) {
            setPlayerUploadedAvatarData(response.playerAvatarUrl);
        }
        setGeneratorMessage({ text: "AI đã hoàn thiện các trường còn trống!", type: 'success' });

    } catch (e) {
        const errorMsg = e instanceof Error ? e.message : String(e);
        setGeneratorMessage({ text: `Lỗi khi hoàn thiện thế giới: ${errorMsg}`, type: 'error' });
    } finally {
        setIsGeneratingCompletion(false);
        setIsStreamingActive(false);
    }
  };
  
  const handleGenerateCharacterFromName = async (customPrompt?: string) => {
    if (!settings.playerName.trim()) {
      setGeneratorMessage({ text: 'Vui lòng nhập tên nhân vật để AI hỗ trợ.', type: 'error' });
      return;
    }
    setIsGeneratingCharacter(true);
    setGeneratorMessage(null);
    setRawApiResponseText(null);
    setSentWorldGenPrompt(null);
    setStreamingText('');
    setIsStreamingActive(true);

    try {
      let canonData: string | undefined = rawCanonData || undefined;
      if (settings.isStrictGrounding && settings.remoteCanonUrl && !canonData) {
          setGeneratorMessage({ text: "Đang tải dữ liệu chuẩn bị trích xuất...", type: 'info' });
          const fetched = await fetchRawCanonData(settings.remoteCanonUrl);
          if (fetched) {
            canonData = fetched;
            setRawCanonData(fetched);
          }
      }

      const worldContext = selectedWork 
        ? `Tác phẩm: ${selectedWork.title}. Tóm tắt: ${selectedWork.description}. ${settings.theme}. ${settings.settingDescription}`
        : `${settings.theme}. ${settings.settingDescription}. ${originalStorySummary}`;
      
      let response: any, rawText: any, constructedPrompt: any;

      if (settings.isStrictGrounding && canonData) {
        setGeneratorMessage({ text: "🔍 Đang tra cứu 'Strict Librarian' trong nguyên tác...", type: 'info' });
        
        // 1. Tìm kiếm chặt chẽ
        const searchResults = StrictLibrarianService.strictSearch(canonData, settings.playerName, 1500);
        
        if (searchResults.length === 0) {
            throw new Error(`Không tìm thấy bất kỳ thông tin nào về "${settings.playerName}" trong tài liệu.`);
        }

        // 2. Phân tích với Grounding chặt chẽ
        setGeneratorMessage({ text: "📝 [BƯỚC 2/2] Đang biên soạn thông tin nhân vật (Strict Grounding)...", type: 'info' });
        const strictAnalysisPrompt = `Hãy đóng vai một Thủ thư khó tính, trích xuất thông tin nhân vật "${settings.playerName}" dựa trên những đoạn văn bản bằng chứng này. CẤM BỊA ĐẶT. ${customPrompt ? `YÊU CẦU THÊM: ${customPrompt}` : ""}`;
        
        const rawAnalysis = await GeminiService.analyzeWithStrictGrounding(searchResults, strictAnalysisPrompt);
        
        if (rawAnalysis.includes("[NO_DATA_FOUND]")) {
            throw new Error(`AI không tìm thấy thông tin hợp lệ về "${settings.playerName}" trong các đoạn văn thu được.`);
        }

        // Logic cũ parseAIResponseText cần được giữ hoặc điều chỉnh tùy cấu trúc.
        // Giả định analyzeWithStrictGrounding vẫn trả về text mà chúng ta cần parseAiResponseText?
        // Wait, analyzeWithStrictGrounding trả về text (string).
        // Let's re-use parseAiResponseText.
        const { parseAiResponseText } = await import('../services/geminiService');
        response = parseAiResponseText(rawAnalysis);
        rawText = rawAnalysis;
        constructedPrompt = strictAnalysisPrompt;
      } else {
        const result = await generateCharacterDetailsFromName(
          settings,
          (prompt) => setGeneratorMessage({ text: `AI đang phân tích nhân vật...`, type: 'info' }),
          customPrompt,
          (text) => setStreamingText(text)
        );
        response = result.response;
        rawText = result.rawText;
        constructedPrompt = result.constructedPrompt;
      }

      setRawApiResponseText(rawText);
      setSentWorldGenPrompt(constructedPrompt);

      if (!response) {
        throw new Error("AI không trả về kết quả hợp lệ cho nhân vật.");
      }

      setSettings(prev => ({
        ...prev,
        playerGender: response.playerGender || prev.playerGender,
        playerRace: response.playerRace || prev.playerRace,
        playerPersonality: response.playerPersonality || prev.playerPersonality,
        playerPersonalityCore: response.playerPersonalityCore || prev.playerPersonalityCore,
        playerBackstory: response.playerBackstory || prev.playerBackstory,
        initialContext: response.initialContext || prev.initialContext,
        playerGoal: response.playerGoal || prev.playerGoal,
        playerStartingTraits: response.playerStartingTraits || prev.playerStartingTraits,
        playerSpiritualRoot: response.playerSpiritualRoot || prev.playerSpiritualRoot,
        playerSpecialPhysique: response.playerSpecialPhysique || prev.playerSpecialPhysique,
        playerThoNguyen: response.playerThoNguyen || prev.playerThoNguyen,
        playerMaxThoNguyen: response.playerMaxThoNguyen || prev.playerMaxThoNguyen,
        currencyName: response.currencyName || prev.currencyName,
        startingCurrency: response.startingCurrency || prev.startingCurrency,
        playerStartingLocationType: response.playerStartingLocationType || prev.playerStartingLocationType,
        canhGioiKhoiDau: response.canhGioiKhoiDau || prev.canhGioiKhoiDau,
      }));

      if (response.startingSkills && response.startingSkills.length > 0) {
        setSettings(prev => ({ ...prev, startingSkills: response.startingSkills }));
      }
      if (response.startingItems && response.startingItems.length > 0) {
        setSettings(prev => ({ ...prev, startingItems: response.startingItems }));
      }

      setGeneratorMessage({ text: "AI đã tạo xong thông tin nhân vật!", type: 'success' });
    } catch (e) {
      setGeneratorMessage({ text: `Lỗi khi tạo nhân vật: ${e instanceof Error ? e.message : String(e)}`, type: 'error' });
    } finally {
      setIsGeneratingCharacter(false);
      setIsStreamingActive(false);
    }
  };

  const handleSubmit = () => {
    if(!settings.saveGameName.trim()){ setGeneratorMessage({text: VIETNAMESE.saveGameNameRequiredError, type: 'error'}); setActiveTab('worldSettings'); return; }
    let missingFieldsError = "Vui lòng điền đầy đủ các trường thông tin cơ bản: "; const missingFields: string[] = [];
    
    // Auto-sync cultivation systems if needed before validation
    let currentSettings = { ...settings };
    if (currentSettings.isCultivationEnabled && 
        currentSettings.cultivationSystem.majorRealmsRaw.trim() !== "" && 
        (currentSettings.raceCultivationSystems.length === 0 || 
         currentSettings.raceCultivationSystems.every(s => !s.realmSystem.trim()) || 
         !currentSettings.yeuThuRealmSystem.trim())) {
      
      const majors = parseRealmString(currentSettings.cultivationSystem.majorRealmsRaw);
      if (majors.length > 0) {
        currentSettings.raceCultivationSystems = currentSettings.raceCultivationSystems.map(s => ({
          ...s,
          realmSystem: currentSettings.cultivationSystem.majorRealmsRaw
        }));
        currentSettings.yeuThuRealmSystem = currentSettings.cultivationSystem.majorRealmsRaw;
        
        // Update state to keep UI in sync, but continue with local finalSettings
        setSettings(currentSettings);
      }
    }

    if (!currentSettings.theme.trim()) missingFields.push("Chủ đề"); 
    if (!currentSettings.settingDescription.trim()) missingFields.push("Bối cảnh"); 
    if (!currentSettings.writingStyle.trim()) missingFields.push("Văn phong"); 
    if (!currentSettings.playerName.trim()) missingFields.push("Tên nhân vật"); 
    if (!currentSettings.playerPersonality.trim()) missingFields.push("Tính cách NV"); 
    if (!currentSettings.playerBackstory.trim()) missingFields.push("Tiểu sử NV"); 
    if (!currentSettings.playerGoal.trim()) missingFields.push("Mục tiêu NV");
    
    if (currentSettings.isCultivationEnabled) { 
        if ((currentSettings.raceCultivationSystems.length > 0 && currentSettings.raceCultivationSystems.some(s => !s.raceName.trim() || !s.realmSystem.trim())) || !currentSettings.yeuThuRealmSystem.trim()) {
            // Only add if we can't find ANY system
            if (!currentSettings.cultivationSystem.majorRealmsRaw.trim()) {
                missingFields.push("Hệ thống cảnh giới");
            }
        }
        if (!currentSettings.canhGioiKhoiDau.trim() || currentSettings.canhGioiKhoiDau === VIETNAMESE.mortalRealmName) missingFields.push("Cảnh giới khởi đầu"); 
    }
    
    if (currentSettings.genre === CUSTOM_GENRE_VALUE && !currentSettings.customGenreName?.trim()) missingFields.push(VIETNAMESE.customGenreNameLabel);
    
    if (missingFields.length > 0) { 
      setGeneratorMessage({ text: missingFieldsError + missingFields.join(', ') + ".", type: "error" }); 
      if(!currentSettings.playerName.trim() || !currentSettings.playerPersonality.trim() || !currentSettings.playerBackstory.trim() || !currentSettings.playerGoal.trim()) setActiveTab('characterStory'); 
      else if (!currentSettings.theme.trim() || !currentSettings.settingDescription.trim() || !currentSettings.writingStyle.trim() || (currentSettings.isCultivationEnabled && (!currentSettings.cultivationSystem.majorRealmsRaw.trim() || !currentSettings.canhGioiKhoiDau.trim())) || (currentSettings.genre === CUSTOM_GENRE_VALUE && !currentSettings.customGenreName?.trim())) setActiveTab('worldSettings'); 
      return; 
    }
    
    const finalSettings = { ...currentSettings, originalStorySummary: originalStorySummary };
    if (!finalSettings.isCultivationEnabled) { 
      finalSettings.raceCultivationSystems = [];
      finalSettings.yeuThuRealmSystem = "";
      finalSettings.canhGioiKhoiDau = ""; 
    }
    if (finalSettings.genre !== CUSTOM_GENRE_VALUE) finalSettings.customGenreName = "";
    
    // Ensure playerAvatarUrl in settings reflects the chosen avatar data source
    // playerUploadedAvatarData holds the actual data (base64 or URL)
    // settings.playerAvatarUrl is more like a state descriptor for how it was set
    if (playerUploadedAvatarData) {
      if (playerUploadedAvatarData.startsWith('data:')) {
        finalSettings.playerAvatarUrl = "uploaded_via_file"; // Or the specific AI gen fail state if that's in playerUploadedAvatarData
      } else if (playerUploadedAvatarData.startsWith('http')) {
        finalSettings.playerAvatarUrl = playerUploadedAvatarData;
      } else {
        // This case handles placeholders like 'upload_pending_after_ai_gen_cloudinary_fail'
        // if it somehow ended up in playerUploadedAvatarData. Or if playerUploadedAvatarData is not a recognized format.
        // We need to ensure finalSettings.playerAvatarUrl reflects the correct state description.
        // If playerUploadedAvatarData is 'upload_pending_after_ai_gen_cloudinary_fail', then finalSettings.playerAvatarUrl should be too.
        // If playerUploadedAvatarData is 'uploaded_via_file' (e.g., from CharacterStoryTab handleChange), then that's fine.
        // For now, let's be explicit:
        if (settings.playerAvatarUrl === 'upload_pending_after_ai_gen_cloudinary_fail') {
             finalSettings.playerAvatarUrl = 'upload_pending_after_ai_gen_cloudinary_fail';
        } else if (settings.playerAvatarUrl === 'uploaded_via_file') {
             finalSettings.playerAvatarUrl = 'uploaded_via_file';
        } else {
             finalSettings.playerAvatarUrl = undefined; // If unsure, clear it
        }
      }
    } else { // No playerUploadedAvatarData
        finalSettings.playerAvatarUrl = undefined;
    }

    onSetupComplete(finalSettings, playerUploadedAvatarData); 
  };

  const handleExportSettings = () => {
    try {
      const settingsToExport = { ...settings, originalStorySummary }; const jsonString = JSON.stringify(settingsToExport, null, 2); const blob = new Blob([jsonString], { type: 'application/json' }); const url = URL.createObjectURL(blob); const link = document.createElement('a');
      link.download = `${settings.saveGameName || 'Untitled'}_thiết lập.json`; link.href = url; document.body.appendChild(link); link.click(); document.body.removeChild(link); URL.revokeObjectURL(url);
      setGeneratorMessage({ text: VIETNAMESE.worldSettingsExportedSuccess, type: 'success' });
    } catch (error) { console.error("Error exporting world settings:", error); setGeneratorMessage({ text: VIETNAMESE.errorExportingWorldSettings, type: 'error' }); }
  };

  const handleExportSettingsTxt = () => {
    try {
      const settingsToExport = { ...settings, originalStorySummary };
      const jsonString = JSON.stringify(settingsToExport, null, 2);
      const blob = new Blob([jsonString], { type: 'text/plain;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.download = `${settings.saveGameName || 'Untitled'}_thiết lập.txt`;
      link.href = url;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      setGeneratorMessage({ text: "Đã xuất thiết lập dạng .txt thành công!", type: 'success' });
    } catch (error) {
      console.error("Error exporting world settings as txt:", error);
      setGeneratorMessage({ text: "Lỗi khi xuất thiết lập .txt", type: 'error' });
    }
  };

  const handleImportSettingsFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const content = e.target?.result as string; const importedSettings = JSON.parse(content) as WorldSettings;
          if (importedSettings && importedSettings.theme !== undefined && importedSettings.playerName !== undefined) {
            setSettings({ 
              ...DEFAULT_WORLD_SETTINGS, 
              ...importedSettings,
              playerRace: importedSettings.playerRace || DEFAULT_WORLD_SETTINGS.playerRace, 
              isCultivationEnabled: importedSettings.isCultivationEnabled === undefined ? true : importedSettings.isCultivationEnabled, 
              genre: importedSettings.genre || DEFAULT_WORLD_SETTINGS.genre, 
              customGenreName: importedSettings.genre === CUSTOM_GENRE_VALUE ? (importedSettings.customGenreName || '') : '', 
              startingSkills: importedSettings.startingSkills || [], 
              startingItems: importedSettings.startingItems || [], 
              startingNPCs: importedSettings.startingNPCs || [], 
              startingYeuThu: importedSettings.startingYeuThu || [], // New
              startingLore: importedSettings.startingLore || [], 
              startingLocations: importedSettings.startingLocations || [], 
              startingFactions: importedSettings.startingFactions || [], 
              playerAvatarUrl: importedSettings.playerAvatarUrl, // This will trigger useEffect to update preview/data
              nsfwMode: importedSettings.nsfwMode || false,
              nsfwDescriptionStyle: importedSettings.nsfwDescriptionStyle || DEFAULT_NSFW_DESCRIPTION_STYLE,
              violenceLevel: importedSettings.violenceLevel || DEFAULT_VIOLENCE_LEVEL,
              storyTone: importedSettings.storyTone || DEFAULT_STORY_TONE,
              startingDate: importedSettings.startingDate || DEFAULT_WORLD_SETTINGS.startingDate,
              raceCultivationSystems: importedSettings.raceCultivationSystems || DEFAULT_WORLD_SETTINGS.raceCultivationSystems, // NEW
              yeuThuRealmSystem: importedSettings.yeuThuRealmSystem || DEFAULT_WORLD_SETTINGS.yeuThuRealmSystem, // NEW
              canhGioiKhoiDau: importedSettings.canhGioiKhoiDau || DEFAULT_WORLD_SETTINGS.canhGioiKhoiDau, // NEW
            });
            setOriginalStorySummary(importedSettings.originalStorySummary || ''); 
            setShowOriginalStorySummaryInput(!!importedSettings.originalStorySummary);
            // The useEffect hook that depends on settings.playerAvatarUrl will handle
            // playerAvatarPreviewUrl and playerUploadedAvatarData.
            setGeneratorMessage({ text: VIETNAMESE.worldSettingsImportedSuccess, type: 'success' }); 
            setActiveTab('worldSettings'); 
          } else setGeneratorMessage({ text: VIETNAMESE.invalidWorldSettingsFile, type: 'error' });
        } catch (error) { console.error("Error importing world settings:", error); setGeneratorMessage({ text: VIETNAMESE.errorImportingWorldSettings, type: 'error' }); }
      };
      reader.readAsText(file);
    }
    if (importSettingsFileRef.current) importSettingsFileRef.current.value = "";
  };
  

  const handleSetupCultivation = useCallback((majors: string[], minors: string[]) => {
    // Gọi hàm apply từ hook để xử lý toàn bộ luồng dữ liệu
    // Sử dụng trực tiếp giá trị raw từ settings để đảm bảo tính nhất quán
    applyCultivationSystem(settings.cultivationSystem.majorRealmsRaw, settings.cultivationSystem.minorRealmsRaw);
    setGeneratorMessage({ text: "Hệ thống đã được thiết lập & Cảnh giới khởi đầu đã cập nhật!", type: 'success' });
  }, [applyCultivationSystem, settings.cultivationSystem.majorRealmsRaw, settings.cultivationSystem.minorRealmsRaw]);

  const onNestedChange = useCallback((parent: keyof WorldSettings, field: string, value: any) => {
    setSettings(prev => ({
      ...prev,
      [parent]: {
        ...(prev[parent] as any),
        [field]: value
      }
    }));
  }, []);

  const setSimpleField = useCallback((key: keyof WorldSettings, value: any) => {
    setSettings(prev => ({
      ...prev,
      [key]: value
    }));
  }, []);

  const handleBack = () => {
    audioService.stop();
    setCurrentScreen(GameScreen.Initial);
  };

  return (
    <div className="min-h-[100dvh] w-full flex flex-col items-center justify-start bg-gray-800 p-4 py-8 relative overflow-x-hidden">
      {/* Guide Overlay */}
      <GuideOverlay 
        isActive={isGuideOverlayActive} 
        onClose={() => {
          setIsGuideOverlayActive(false);
          setActiveGuideId(null);
        }} 
      />

      <div className="w-full max-w-4xl bg-gray-900 shadow-2xl rounded-xl p-6 space-y-6 relative z-[51]">
        {/* Nút "?" nhấp nháy kích hoạt Hướng dẫn trực quan */}
        <GuideToggleButton 
          isActive={isGuideOverlayActive} 
          onClick={() => {
            const nextState = !isGuideOverlayActive;
            setIsGuideOverlayActive(nextState);
            if (!nextState) setActiveGuideId(null);
          }} 
          className="top-4 right-6"
        />

        <div className="absolute top-4 left-6 flex items-center gap-3">
          <div className="flex items-center gap-2 bg-gray-800/50 px-3 py-1 rounded-full border border-gray-700">
              <span className="text-[10px] font-bold text-gray-400 tracking-widest">API</span>
              <div className={`w-2 h-2 rounded-full ${
                  isApiVerified ? 'bg-green-500 animate-pulse shadow-[0_0_8px_#22c55e]' : 'bg-red-500'
              }`} />
          </div>

          <div className="flex items-center gap-2 bg-gray-800/50 px-2.5 py-1 rounded-full border border-gray-700 shadow-sm">
            <button onClick={toggleMute} className="text-gray-300 hover:text-white transition-colors focus:outline-none" title="Bật/Tắt âm thanh">
              {volume === 0 ? <VolumeX className="w-3.5 h-3.5 text-red-400" /> : <Volume2 className="w-3.5 h-3.5 text-indigo-400" />}
            </button>
            <input 
              type="range" 
              min="0" 
              max="200" 
              value={volume} 
              onChange={handleVolumeChange} 
              className="w-16 h-1 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-indigo-500 focus:outline-none"
              title={`Âm lượng: ${volume}%`}
            />
            <span className="text-[9px] font-mono text-gray-400 w-7 text-right">{volume}%</span>
          </div>
        </div>
        <h1 className="text-3xl font-bold text-center text-transparent bg-clip-text bg-gradient-to-r from-purple-400 via-pink-500 to-red-500">
          {VIETNAMESE.newGame}
        </h1>
        <div className="flex flex-col sm:flex-row gap-2 justify-center items-center mb-4">
            <div className="relative w-full sm:w-auto">
              <Button onClick={handleExportSettings} variant="secondary" className="w-full">
                  {VIETNAMESE.exportWorldSettingsButton}
              </Button>
              {isGuideOverlayActive && (
                <GuideMarker id="setup-export" index={5} text="Xuất toàn bộ cấu hình thế giới hiện tại ra file JSON để lưu trữ hoặc chia sẻ." position="top" activeId={activeGuideId} onToggle={setActiveGuideId} />
              )}
            </div>
            
            <div className="relative w-full sm:w-auto">
              <Button onClick={handleExportSettingsTxt} variant="secondary" className="w-full">
                  {VIETNAMESE.exportWorldSettingsTxtButton}
              </Button>
              {isGuideOverlayActive && (
                <GuideMarker id="setup-export-txt" index={6} text="Xuất cấu hình dưới dạng văn bản (.txt) dễ đọc để xem lại hoặc lưu trữ." position="top" activeId={activeGuideId} onToggle={setActiveGuideId} />
              )}
            </div>

            <div className="relative w-full sm:w-auto">
              <Button onClick={() => importSettingsFileRef.current?.click()} variant="secondary" className="w-full">
                  {VIETNAMESE.importWorldSettingsButton}
              </Button>
              {isGuideOverlayActive && (
                <GuideMarker id="setup-import" index={7} text="Nhập file cấu hình (.json hoặc .txt) bạn đã có để bắt đầu nhanh." position="top" activeId={activeGuideId} onToggle={setActiveGuideId} />
              )}
            </div>
            <input type="file" ref={importSettingsFileRef} onChange={handleImportSettingsFileChange} accept=".json,.txt" className="hidden" />
        </div>

        {generatorMessage && (
          <div className={`p-3 rounded-md text-sm flex items-center justify-between ${ generatorMessage.type === 'success' ? 'bg-green-600/80 text-white' : generatorMessage.type === 'error' ? 'bg-red-600/80 text-white' : 'bg-blue-600/80 text-white' }`}>
            <div className="flex items-center gap-2">
              {generatorMessage.type === 'info' && <Loader2 className="w-4 h-4 animate-spin" />}
              <span>{generatorMessage.text}</span>
              {generationTimer > 0 && generatorMessage.type === 'info' && (
                <span className="ml-2 font-mono text-xs bg-black/20 px-1.5 py-0.5 rounded">
                  {generationTimer}s
                </span>
              )}
            </div>
            <div className="flex gap-2">
              {sentWorldGenPrompt && generatorMessage.type !== 'info' && ( <Button variant="ghost" size="sm" onClick={() => setShowSentPromptModal(true)} className="ml-2 mt-1 text-xs !p-1 border-current hover:bg-white/20"> {VIETNAMESE.viewSentPromptButton} </Button> )}
              {rawApiResponseText && generatorMessage.type !== 'info' && ( <Button variant="ghost" size="sm" onClick={() => setShowRawResponseModal(true)} className="ml-2 mt-1 text-xs !p-1 border-current hover:bg-white/20"> {VIETNAMESE.viewRawAiResponseButton} </Button> )}
            </div>
          </div>
        )}

        <StreamingConsole 
          streamingText={streamingText} 
          isStreamingActive={isStreamingActive} 
          onClose={() => setStreamingText('')} 
        />

        <div className="border-b border-gray-700 sticky top-0 bg-gray-900 z-10 -mx-6 px-6 mb-2 pt-6">
          <nav className="flex space-x-2 sm:space-x-4 overflow-x-auto pb-2 hide-scrollbar" aria-label="Tabs">
            <div className="relative">
              <button onClick={() => setActiveTab('aiAssist')} className={activeTab === 'aiAssist' ? activeTabStyle : inactiveTabStyle}>AI Hỗ Trợ</button>
              {isGuideOverlayActive && (
                <GuideMarker id="setup-tab-ai" index={1} text="Bước 1: Chọn hoặc dán link nguyên tác để AI phân tích và tự động sinh toàn bộ bối cảnh!" position="bottom" activeId={activeGuideId} onToggle={setActiveGuideId} />
              )}
            </div>
            <div className="relative">
              <button onClick={() => setActiveTab('characterStory')} className={activeTab === 'characterStory' ? activeTabStyle : inactiveTabStyle}>Nhân Vật & Cốt Truyện</button>
              {isGuideOverlayActive && (
                <GuideMarker id="setup-tab-character" index={2} text="Bước 2: Thiết lập tên, giới tính, chủng tộc và tiểu sử cho nhân vật của bạn." position="bottom" activeId={activeGuideId} onToggle={setActiveGuideId} />
              )}
            </div>
            <div className="relative">
              <button onClick={() => setActiveTab('worldSettings')} className={activeTab === 'worldSettings' ? activeTabStyle : inactiveTabStyle}>Thiết Lập Thế Giới</button>
              {isGuideOverlayActive && (
                <GuideMarker id="setup-tab-world" index={3} text="Bước 3: Tùy chỉnh bối cảnh chi tiết, thể loại và tên file lưu cho thế giới này." position="bottom" activeId={activeGuideId} onToggle={setActiveGuideId} />
              )}
            </div>
            <div className="relative">
              <button onClick={() => setActiveTab('startingElements')} className={activeTab === 'startingElements' ? activeTabStyle : inactiveTabStyle}>Yếu Tố Khởi Đầu</button>
              {isGuideOverlayActive && (
                <GuideMarker id="setup-tab-elements" index={4} text="Bước 4: Kiểm tra và tinh chỉnh Kỹ năng, Vật phẩm, NPC và Yêu thú khởi đầu." position="bottom" activeId={activeGuideId} onToggle={setActiveGuideId} />
              )}
            </div>
          </nav>
        </div>

        <div className="pb-4">
          {activeTab === 'aiAssist' && (
            <AIAssistTab
              settings={settings} // Pass full settings
              handleChange={handleChange} // Pass handleChange for nsfwMode and other settings
              storyIdea={storyIdea} setStoryIdea={setStoryIdea}
              // isOriginalStoryIdeaNsfw and setIsOriginalStoryIdeaNsfw are removed
              handleGenerateFromStoryIdea={handleGenerateFromStoryIdea} isGeneratingDetails={isGeneratingDetails}
              handleGenerateCompletion={handleGenerateCompletion} isGeneratingCompletion={isGeneratingCompletion}
              handleGenerateTimelineEvents={handleGenerateTimelineEvents} isGeneratingTimeline={isGeneratingTimeline}
              fanficSourceType={fanficSourceType} setFanficSourceType={setFanficSourceType}
              fanficStoryName={fanficStoryName} setFanficStoryName={setFanficStoryName}
              fanficFile={fanficFile} handleFanficFileChange={handleFanficFileChange}
              fanficTokenCount={fanficTokenCount} isLoadingTokens={isLoadingTokens}
              fanficPlayerDescription={fanficPlayerDescription} setFanficPlayerDescription={setFanficPlayerDescription}
              // isFanficIdeaNsfw and setIsFanficIdeaNsfw are removed
              handleAnalyzeWork={handleAnalyzeWork} isAnalyzingWork={isAnalyzingWork}
              handleStressTest={handleStressTest} isStressTesting={isStressTesting}
              stressTestProgress={stressTestProgress} stressTestResults={stressTestResults}
              availableWorks={allWorks.map(w => w.title)}
              onOpenWorkSelectionModal={() => setIsWorkSelectionModalOpen(true)}
              originalStorySummary={originalStorySummary} handleOriginalStorySummaryChange={handleOriginalStorySummaryChange}
              showOriginalStorySummaryInput={showOriginalStorySummaryInput} setShowOriginalStorySummaryInput={setShowOriginalStorySummaryInput}
              fanficFileInputRef={fanficFileInputRef}
              isGuideOverlayActive={isGuideOverlayActive}
              activeGuideId={activeGuideId}
              setActiveGuideId={setActiveGuideId}
            />
          )}
          {activeTab === 'characterStory' && (
            <CharacterStoryTab
              settings={settings}
              handleChange={handleChange}
              playerAvatarPreviewUrl={playerAvatarPreviewUrl} // Pass down for preview
              setPlayerAvatarPreviewUrl={setPlayerAvatarPreviewUrl} // Allow CharacterStoryTab to update preview
              onPlayerAvatarDataChange={setPlayerUploadedAvatarData} // Allow CharacterStoryTab to set the raw data
              handleGenerateCharacterFromName={handleGenerateCharacterFromName}
              isGeneratingCharacter={isGeneratingCharacter}
              selectedWork={selectedWork}
              isGuideOverlayActive={isGuideOverlayActive}
              activeGuideId={activeGuideId}
              setActiveGuideId={setActiveGuideId}
            />
          )}
          {activeTab === 'worldSettings' && (
            <WorldSettingsTab 
              settings={settings} 
              handleChange={handleChange} 
              onNestedChange={onNestedChange}
              setSimpleField={setSimpleField}
              handleSetupCultivation={handleSetupCultivation}
              handleRaceSystemChange={handleRaceSystemChange}
              addRaceSystem={addRaceSystem}
              removeRaceSystem={removeRaceSystem}
              batchUpdateNPCs={batchUpdateNPCs}
              rawCanonData={rawCanonData}
              setRawCanonData={setRawCanonData}
              originalStorySummary={originalStorySummary}
              handleOriginalStorySummaryChange={handleOriginalStorySummaryChange}
              showOriginalStorySummaryInput={showOriginalStorySummaryInput}
              setShowOriginalStorySummaryInput={setShowOriginalStorySummaryInput}
              handleGenerateTimelineEvents={handleGenerateTimelineEvents}
              handleAppendTimelineEvents={handleAppendTimelineEvents}
              isGeneratingTimeline={isGeneratingTimeline}
              isAnalyzingWork={isAnalyzingWork}
              handleRewriteWorldSettings={handleRewriteWorldSettings}
              isRewritingWorldSettings={isRewritingWorldSettings}
              isGuideOverlayActive={isGuideOverlayActive}
              activeGuideId={activeGuideId}
              setActiveGuideId={setActiveGuideId}
              setStreamingText={setStreamingText}
              setIsStreamingActive={setIsStreamingActive}
            />
          )}
          {activeTab === 'startingElements' && (
            <StartingElementsTab
              settings={settings}
              handleRewriteStartingElements={handleRewriteStartingElements}
              isRewritingStartingElements={isRewritingStartingElements}
              isSkillsSectionOpen={isSkillsSectionOpen} setIsSkillsSectionOpen={setIsSkillsSectionOpen}
              handleStartingSkillChange={handleStartingSkillChange} addStartingSkill={addStartingSkill} removeStartingSkill={removeStartingSkill}
              isItemsSectionOpen={isItemsSectionOpen} setIsItemsSectionOpen={setIsItemsSectionOpen}
              handleStartingItemChange={handleStartingItemChange} addStartingItem={addStartingItem} removeStartingItem={removeStartingItem}
              isNpcsSectionOpen={isNpcsSectionOpen} setIsNpcsSectionOpen={setIsNpcsSectionOpen}
              handleStartingNPCChange={handleStartingNPCChange} addStartingNPC={addStartingNPC} removeStartingNPC={removeStartingNPC}
              isYeuThuSectionOpen={isYeuThuSectionOpen} setIsYeuThuSectionOpen={setIsYeuThuSectionOpen}
              handleStartingYeuThuChange={handleStartingYeuThuChange} addStartingYeuThu={addStartingYeuThu} removeStartingYeuThu={removeStartingYeuThu}
              isLoreSectionOpen={isLoreSectionOpen} setIsLoreSectionOpen={setIsLoreSectionOpen}
              handleStartingLoreChange={handleStartingLoreChange} addStartingLore={addStartingLore} removeStartingLore={removeStartingLore}
              isLocationsSectionOpen={isLocationsSectionOpen} setIsLocationsSectionOpen={setIsLocationsSectionOpen}
              handleStartingLocationChange={handleStartingLocationChange} addStartingLocation={addStartingLocation} removeStartingLocation={removeStartingLocation}
              isFactionsSectionOpen={isFactionsSectionOpen} setIsFactionsSectionOpen={setIsFactionsSectionOpen}
              handleStartingFactionChange={handleStartingFactionChange} addStartingFaction={addStartingFaction} removeStartingFaction={removeStartingFaction}
              isGuideOverlayActive={isGuideOverlayActive}
              activeGuideId={activeGuideId}
              setActiveGuideId={setActiveGuideId}
            />
          )}
        </div>

        <div className="mt-8 flex flex-col sm:flex-row justify-between items-center pt-6 border-t border-gray-700 space-y-3 sm:space-y-0 sm:space-x-4">
          <Button variant="secondary" onClick={handleBack} className="w-full sm:w-auto">
            {VIETNAMESE.goBackButton}
          </Button>
          <div className="relative w-full sm:w-auto">
            <Button variant="primary" size="lg" onClick={handleSubmit} className="w-full" isLoading={isGeneratingDetails || isGeneratingCompletion} disabled={isGeneratingDetails || isGeneratingCompletion} >
              {VIETNAMESE.startGame}
            </Button>
            {isGuideOverlayActive && (
              <GuideMarker id="setup-start" index={17} text="Bước cuối cùng: Khi đã hài lòng với mọi thiết lập, nhấn vào đây để bắt đầu hành trình của bạn!" position="top" activeId={activeGuideId} onToggle={setActiveGuideId} />
            )}
          </div>
        </div>
      </div>
      {showRawResponseModal && rawApiResponseText && ( <Modal isOpen={showRawResponseModal} onClose={() => setShowRawResponseModal(false)} title={VIETNAMESE.rawAiResponseModalTitle}> <pre className="whitespace-pre-wrap break-all bg-gray-700 p-3 rounded-md text-xs text-gray-200 max-h-[60vh] overflow-y-auto custom-scrollbar"> {rawApiResponseText} </pre> </Modal> )}
      {showSentPromptModal && sentWorldGenPrompt && ( <Modal isOpen={showSentPromptModal} onClose={() => setShowSentPromptModal(false)} title={VIETNAMESE.sentPromptModalTitle}> <pre className="whitespace-pre-wrap break-all bg-gray-700 p-3 rounded-md text-xs text-gray-200 max-h-[60vh] overflow-y-auto custom-scrollbar"> {sentWorldGenPrompt} </pre> </Modal> )}
      
      <WorkSelectionModal
        isOpen={isWorkSelectionModalOpen}
        onClose={() => setIsWorkSelectionModalOpen(false)}
        works={allWorks}
        onSelect={(work) => {
          setSelectedWork(work.id === 'url-source' ? null : work);
          setFanficStoryName(work.title);
          setRawCanonData(null); // Clear previous canon data
          const isUrl = work.id === 'url-source';
          const summary = isUrl 
            ? `Tác phẩm từ URL: ${work.title}\n\nĐây là liên kết bên ngoài do người dùng cung cấp. AI sẽ tải dữ liệu trực tiếp từ liên kết này để làm căn cứ nguyên tác.`
            : `Tên tác phẩm: ${work.title}\n\nMô tả: ${work.description}\n\nCốt truyện: ${work.plot}\n\nBối cảnh thế giới: ${work.worldSetting}`;
          
          setOriginalStorySummary(summary);
          setSettings(prev => ({ 
            ...prev, 
            originalStorySummary: summary,
            originalWork: isUrl ? 'URL_SOURCE' : work.title,
            remoteCanonUrl: isUrl ? work.title : '', 
            isStrictGrounding: isUrl ? true : prev.isStrictGrounding
          }));
        }}
      />
    </div>
  );
};

export default GameSetupScreen;