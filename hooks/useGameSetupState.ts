import * as React from 'react';
import { useState, useCallback, useRef, useEffect } from 'react';
import { WorldSettings, StartingSkill, StartingItem, StartingNPC, StartingLore, StartingLocation, StartingFaction, StartingYeuThu, RaceCultivationSystem, GameScreen, WorldDate, MajorRealm } from '@/types';
import { DEFAULT_WORLD_SETTINGS, VIETNAMESE, CUSTOM_GENRE_VALUE, MAX_TOKENS_FANFIC, DEFAULT_VIOLENCE_LEVEL, DEFAULT_STORY_TONE, DEFAULT_NSFW_DESCRIPTION_STYLE } from '@/constants';
import { generateUnifiedCultivation } from '@/services/ai/cultivationUnifiedService';
import { generateWorldDetailsFromStory, generateFanfictionWorldDetails, countTokens, generateCompletionForWorldDetails, generateCharacterDetailsFromName } from '@/services/geminiService';
import { RealmParserService } from '@/services/RealmParserService';
import { parseUnifiedRealmString, parseRealmString } from '@/utils/realmParser';
import { normalizeCultivationFromAiResponse } from '@/utils/cultivationSyncService';
import { applyCultivationToWorldSettings } from '@/utils/cultivationStateApplier';
import * as GameTemplates from '@/templates';

export const useGameSetupState = (onSetupComplete: (settings: WorldSettings, uploadedAvatarData?: string | null) => void) => {
  const [settings, setSettings] = useState<WorldSettings>({
    ...DEFAULT_WORLD_SETTINGS,
    saveGameName: DEFAULT_WORLD_SETTINGS.saveGameName || '',
    genre: DEFAULT_WORLD_SETTINGS.genre,
    customGenreName: DEFAULT_WORLD_SETTINGS.customGenreName || '',
    isCultivationEnabled: DEFAULT_WORLD_SETTINGS.isCultivationEnabled,
    cultivationSystem: { ...(DEFAULT_WORLD_SETTINGS.cultivationSystem || { majorRealmsRaw: '', minorRealmsRaw: '', parsedMajors: [], parsedMinors: [], isReady: false }) },
    startingSkills: [...(DEFAULT_WORLD_SETTINGS.startingSkills || [])],
    startingItems: (DEFAULT_WORLD_SETTINGS.startingItems || []).map(item => ({
        ...item, 
        category: item.category || GameTemplates.ItemCategory.MISCELLANEOUS, 
        quantity: item.quantity || 1
    })),
    startingNPCs: [...(DEFAULT_WORLD_SETTINGS.startingNPCs || [])],
    startingYeuThu: [...(DEFAULT_WORLD_SETTINGS.startingYeuThu || [])],
    startingLore: [...(DEFAULT_WORLD_SETTINGS.startingLore || [])],
    startingLocations: [...(DEFAULT_WORLD_SETTINGS.startingLocations || [])],
    startingFactions: [...(DEFAULT_WORLD_SETTINGS.startingFactions || [])],
    originalStorySummary: DEFAULT_WORLD_SETTINGS.originalStorySummary || "",
    raceCultivationSystems: [...(DEFAULT_WORLD_SETTINGS.raceCultivationSystems || [])],
    yeuThuRealmSystem: DEFAULT_WORLD_SETTINGS.yeuThuRealmSystem,
    canhGioiKhoiDau: DEFAULT_WORLD_SETTINGS.canhGioiKhoiDau,
    playerAvatarUrl: DEFAULT_WORLD_SETTINGS.playerAvatarUrl,
    playerSpiritualRoot: DEFAULT_WORLD_SETTINGS.playerSpiritualRoot,
    playerSpecialPhysique: DEFAULT_WORLD_SETTINGS.playerSpecialPhysique,
    playerPersonalityCore: DEFAULT_WORLD_SETTINGS.playerPersonalityCore || '',
    nsfwMode: DEFAULT_WORLD_SETTINGS.nsfwMode || false,
    nsfwDescriptionStyle: DEFAULT_WORLD_SETTINGS.nsfwDescriptionStyle || DEFAULT_NSFW_DESCRIPTION_STYLE,
    violenceLevel: DEFAULT_WORLD_SETTINGS.violenceLevel || DEFAULT_VIOLENCE_LEVEL,
    storyTone: DEFAULT_WORLD_SETTINGS.storyTone || DEFAULT_STORY_TONE,
    originalWork: DEFAULT_WORLD_SETTINGS.originalWork || "",
    startingDate: DEFAULT_WORLD_SETTINGS.startingDate,
    startingCurrency: DEFAULT_WORLD_SETTINGS.startingCurrency,
  });

  const [playerAvatarPreviewUrl, setPlayerAvatarPreviewUrl] = useState<string | null>(null);
  const [playerUploadedAvatarData, setPlayerUploadedAvatarData] = useState<string | null>(null);

  const [storyIdea, setStoryIdea] = useState('');
  const [fanficSourceType, setFanficSourceType] = useState<'name' | 'file'>('name');
  const [fanficStoryName, setFanficStoryName] = useState('');
  const [fanficFile, setFanficFile] = useState<File | null>(null);
  const [fanficFileContent, setFanficFileContent] = useState<string | null>(null);
  const [fanficTokenCount, setFanficTokenCount] = useState<number | null>(null);
  const [fanficPlayerDescription, setFanficPlayerDescription] = useState('');
  const [originalStorySummary, setOriginalStorySummary] = useState<string>(settings.originalStorySummary || '');
  const [showOriginalStorySummaryInput, setShowOriginalStorySummaryInput] = useState<boolean>(!!settings.originalStorySummary);
  
  const [isGeneratingDetails, setIsGeneratingDetails] = useState(false);
  const [generatorMessage, setGeneratorMessage] = useState<{ text: string; type: 'success' | 'error' | 'info' } | null>(null);
  const [isGeneratingFanficDetails, setIsGeneratingFanficDetails] = useState(false);
  const [isGeneratingCompletion, setIsGeneratingCompletion] = useState(false);
  const [isGeneratingCharacter, setIsGeneratingCharacter] = useState(false);
  const [isLoadingTokens, setIsLoadingTokens] = useState(false);
  const [rawApiResponseText, setRawApiResponseText] = useState<string | null>(null);
  const [sentWorldGenPrompt, setSentWorldGenPrompt] = useState<string | null>(null);
  
  // Tự động đồng bộ hóa danh sách cảnh giới đã parse khi chuỗi raw thay đổi
  useEffect(() => {
    const majorNames = RealmParserService.parseMajorRealms(settings.cultivationSystem.majorRealmsRaw);
    const minorNames = RealmParserService.parseMinorRealms(settings.cultivationSystem.minorRealmsRaw);
    const majors = majorNames.map(name => ({ name, levels: 1 }));
    const minors = minorNames;
    
    if (JSON.stringify(majors) !== JSON.stringify(settings.cultivationSystem.parsedMajors) ||
        JSON.stringify(minors) !== JSON.stringify(settings.cultivationSystem.parsedMinors) ||
        (majors.length > 0 && !settings.cultivationSystem.isReady)) {
      setSettings(prev => ({
        ...prev,
        cultivationSystem: {
          ...prev.cultivationSystem,
          parsedMajors: majors,
          parsedMinors: minors,
          isReady: majors.length > 0 && minors.length > 0
        }
      }));
    }
  }, [settings.cultivationSystem.majorRealmsRaw, settings.cultivationSystem.minorRealmsRaw]);

  const fanficFileInputRef = useRef<HTMLInputElement>(null);
  const importSettingsFileRef = useRef<HTMLInputElement>(null);

  const processItemDetails = (items: StartingItem[]): StartingItem[] => {
    if (!items) return [];
    return items.map(item => {
        if (item.category === GameTemplates.ItemCategory.EQUIPMENT && item.equipmentDetails) {
            const newItem = { ...item, equipmentDetails: { ...item.equipmentDetails } };
            if (newItem.equipmentDetails.statBonusesString && !newItem.equipmentDetails.statBonuses) {
                try {
                    newItem.equipmentDetails.statBonuses = JSON.parse(newItem.equipmentDetails.statBonusesString);
                } catch (e) {
                    newItem.equipmentDetails.statBonuses = {};
                }
            }
            if (newItem.equipmentDetails.uniqueEffectsString && !newItem.equipmentDetails.uniqueEffects) {
                newItem.equipmentDetails.uniqueEffects = newItem.equipmentDetails.uniqueEffectsString.split(';').map(s => s.trim()).filter(Boolean);
            }
            return newItem;
        }
        return item;
    });
  };

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
        return;
    }
    
    if (type === 'checkbox') {
        const checked = (e.target as HTMLInputElement).checked;
        setSettings(prev => {
            const newSettings = { ...prev, [name]: checked };
            if (name === 'isCultivationEnabled' && !checked) {
                newSettings.raceCultivationSystems = [{ id: 'default-human-1', raceName: 'Nhân Tộc', realmSystem: VIETNAMESE.noCultivationSystem }];
                newSettings.yeuThuRealmSystem = VIETNAMESE.noCultivationSystem;
                newSettings.canhGioiKhoiDau = VIETNAMESE.mortalRealmName;
            } else if (name === 'isCultivationEnabled' && checked) {
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
    setGeneratorMessage(null);
    setRawApiResponseText(null);
    setSentWorldGenPrompt(null);
  }, [settings.saveGameName]);

  const handleSetupCultivation = useCallback((majors: string[], minors: string[]) => {
    const majorRealms: MajorRealm[] = majors.map(name => ({ name, levels: 1 }));
    setSettings(prev => ({
      ...prev,
      cultivationSystem: {
        ...prev.cultivationSystem,
        parsedMajors: majorRealms,
        parsedMinors: minors,
        isReady: majors.length > 0 && minors.length > 0
      }
    }));
  }, []);

  const onNestedChange = useCallback((parent: keyof WorldSettings, field: string, value: any) => {
    setSettings(prev => {
      if (!field || typeof prev[parent] !== 'object' || prev[parent] === null) {
        return { ...prev, [parent]: value };
      }
      return {
        ...prev,
        [parent]: {
          ...(prev[parent] as any),
          [field]: value
        }
      };
    });
  }, []);

  const setSimpleField = useCallback((key: keyof WorldSettings, value: any) => {
    setSettings(prev => ({ ...prev, [key]: value }));
  }, []);

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

  const handleStartingSkillChange = (index: number, field: string, value: any) => {
    setSettings(prev => {
      const newSkills = [...(prev.startingSkills || [])];
      let skillToUpdate = { ...(newSkills[index] || {}) } as StartingSkill;
  
      const fieldParts = field.split('.');
      if (fieldParts.length > 1) {
        let currentLevel: any = skillToUpdate;
        for (let i = 0; i < fieldParts.length - 1; i++) {
          if (currentLevel[fieldParts[i]] === undefined) currentLevel[fieldParts[i]] = {};
          currentLevel = currentLevel[fieldParts[i]];
        }
        currentLevel[fieldParts[fieldParts.length - 1]] = value;
      } else {
        (skillToUpdate as any)[field] = value;
      }
      
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

  const handleStartingItemChange = (index: number, field: string, value: any) => {
      setSettings(prev => {
          const newItems = [...(prev.startingItems || [])];
          const itemToUpdate = { ...(newItems[index] || {}) } as StartingItem;

          if (!itemToUpdate.equipmentDetails) itemToUpdate.equipmentDetails = {};
          if (!itemToUpdate.potionDetails) itemToUpdate.potionDetails = {};
          if (!itemToUpdate.materialDetails) itemToUpdate.materialDetails = {};
          if (!itemToUpdate.questItemDetails) itemToUpdate.questItemDetails = {};
          if (!itemToUpdate.miscDetails) itemToUpdate.miscDetails = {};

          if (field.startsWith('equipmentDetails.')) {
              const subField = field.substring('equipmentDetails.'.length);
              if (subField === 'statBonuses') {
                  if (typeof value === 'object' && value !== null) {
                      itemToUpdate.equipmentDetails!.statBonuses = value;
                      itemToUpdate.equipmentDetails!.statBonusesString = JSON.stringify(value);
                  }
              } else if (subField === 'uniqueEffects') {
                  if (Array.isArray(value)) {
                      itemToUpdate.equipmentDetails!.uniqueEffects = value;
                      itemToUpdate.equipmentDetails!.uniqueEffectsString = value.join(';');
                  }
              } else {
                  (itemToUpdate.equipmentDetails as any)[subField] = value;
              }
          } else if (field.startsWith('potionDetails.')) {
              const subField = field.substring('potionDetails.'.length);
              (itemToUpdate.potionDetails as any)[subField] = value;
          } else if (field.startsWith('materialDetails.')) {
              const subField = field.substring('materialDetails.'.length);
              (itemToUpdate.materialDetails as any)[subField] = value;
          } else if (field.startsWith('questItemDetails.')) {
              const subField = field.substring('questItemDetails.'.length);
              (itemToUpdate.questItemDetails as any)[subField] = value;
          } else if (field.startsWith('miscDetails.')) {
              const subField = field.substring('miscDetails.'.length);
              (itemToUpdate.miscDetails as any)[subField] = (typeof value === 'string' && (value === 'true' || value === 'false')) ? value === 'true' : value;
          } else {
              if (field === 'quantity' || field === 'value') {
                  (itemToUpdate as any)[field] = parseInt(value as string, 10) || 0;
              } else {
                  (itemToUpdate as any)[field] = value;
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

  const handleStartingNPCChange = (index: number, field: keyof StartingNPC, value: any) => setSettings(prev => { const newNPCs = [...(prev.startingNPCs || [])]; newNPCs[index] = { ...newNPCs[index], [field]: value }; return { ...prev, startingNPCs: newNPCs }; });
  const addStartingNPC = () => setSettings(prev => ({ ...prev, startingNPCs: [...(prev.startingNPCs || []), { name: '', personality: '', initialAffinity: 0, details: '', gender: 'Không rõ', race: 'Nhân Tộc', realm: '', tuChat: 'Trung Phẩm', thoNguyen: 120, maxThoNguyen: 120 }] }));
  const removeStartingNPC = (index: number) => setSettings(prev => ({ ...prev, startingNPCs: (prev.startingNPCs || []).filter((_, i) => i !== index) }));

  const handleStartingYeuThuChange = (index: number, field: keyof StartingYeuThu, value: any) => {
    setSettings(prev => {
        const newYeuThu = [...(prev.startingYeuThu || [])];
        newYeuThu[index] = { ...newYeuThu[index], [field]: value };
        return { ...prev, startingYeuThu: newYeuThu };
    });
  };
  const addStartingYeuThu = () => setSettings(prev => ({ ...prev, startingYeuThu: [...(prev.startingYeuThu || []), { name: '', species: '', description: '', isHostile: true }] }));
  const removeStartingYeuThu = (index: number) => setSettings(prev => ({ ...prev, startingYeuThu: (prev.startingYeuThu || []).filter((_, i) => i !== index) }));

  const handleStartingLoreChange = (index: number, field: keyof StartingLore, value: any) => setSettings(prev => { const newLore = [...(prev.startingLore || [])]; newLore[index] = { ...newLore[index], [field]: value }; return { ...prev, startingLore: newLore }; });
  const addStartingLore = () => setSettings(prev => ({ ...prev, startingLore: [...(prev.startingLore || []), { title: '', content: '' }] }));
  const removeStartingLore = (index: number) => setSettings(prev => ({ ...prev, startingLore: (prev.startingLore || []).filter((_, i) => i !== index) }));

  const handleStartingLocationChange = (index: number, field: keyof StartingLocation, value: any) => {
    setSettings(prev => {
      const newLocations = [...(prev.startingLocations || [])];
      const locToUpdate = { ...newLocations[index] };
      if (field === 'mapX' || field === 'mapY') {
        const numValue = parseInt(value as string, 10);
        (locToUpdate as any)[field] = isNaN(numValue) ? undefined : numValue;
      } else {
        (locToUpdate as any)[field] = value;
      }
      newLocations[index] = locToUpdate;
      return { ...prev, startingLocations: newLocations };
    });
  };
  const addStartingLocation = () => setSettings(prev => ({ ...prev, startingLocations: [...(prev.startingLocations || []), { name: '', description: '', isSafeZone: false, regionId: '', mapX: undefined, mapY: undefined, locationType: GameTemplates.LocationType.DEFAULT }] }));
  const removeStartingLocation = (index: number) => setSettings(prev => ({ ...prev, startingLocations: (prev.startingLocations || []).filter((_, i) => i !== index) }));

  const handleStartingFactionChange = (index: number, field: keyof StartingFaction, value: any) => setSettings(prev => { const newFactions = [...(prev.startingFactions || [])]; newFactions[index] = { ...newFactions[index], [field]: value }; return { ...prev, startingFactions: newFactions }; });
  const addStartingFaction = () => setSettings(prev => ({ ...prev, startingFactions: [...(prev.startingFactions || []), { name: '', description: '', alignment: GameTemplates.FactionAlignment.TRUNG_LAP, initialPlayerReputation: 0 }] }));
  const removeStartingFaction = (index: number) => setSettings(prev => ({ ...prev, startingFactions: (prev.startingFactions || []).filter((_, i) => i !== index) }));

  const handleGenerateFromStoryIdea = async () => {
    if (!storyIdea.trim()) { setGeneratorMessage({ text: 'Vui lòng nhập ý tưởng cốt truyện.', type: 'error' }); return; }
    setIsGeneratingDetails(true); setGeneratorMessage(null); setRawApiResponseText(null); setSentWorldGenPrompt(null);
    try {
      const {response, rawText, constructedPrompt} = await generateWorldDetailsFromStory(
        storyIdea, 
        settings.nsfwMode || false, 
        settings.genre, 
        settings.isCultivationEnabled,
        settings.violenceLevel || DEFAULT_VIOLENCE_LEVEL,
        settings.storyTone || DEFAULT_STORY_TONE,
        settings.genre === CUSTOM_GENRE_VALUE ? settings.customGenreName : undefined,
        settings.nsfwDescriptionStyle || DEFAULT_NSFW_DESCRIPTION_STYLE,
        (prompt) => setGeneratorMessage({ text: `Đang gửi prompt (dài ${prompt.length} ký tự)...`, type: 'info'}) 
      );
      setRawApiResponseText(rawText); setSentWorldGenPrompt(constructedPrompt);
      
      // Handle unified cultivation system
      const normalizedCult = normalizeCultivationFromAiResponse(response);
      if (normalizedCult.cultivationSystem) {
        response.cultivationSystem = normalizedCult.cultivationSystem;
      }
      if (normalizedCult.raceCultivationSystems) {
        response.raceCultivationSystems = normalizedCult.raceCultivationSystems;
      }

      const processedItems = processItemDetails(response.startingItems || []);
      setSettings(prev => {
        let updated = {
          ...prev,
          ...response,
          startingItems: processedItems,
          startingNPCs: (response.startingNPCs || []).map((npc: any) => ({...npc, gender: npc.gender || 'Không rõ'})),
        };
        if (response.cultivationSystem?.majorRealmsRaw) {
          updated = applyCultivationToWorldSettings(updated, response.cultivationSystem.majorRealmsRaw, response.cultivationSystem.minorRealmsRaw);
        }
        return updated;
      });
      if (response.playerAvatarUrl && response.playerAvatarUrl.startsWith('http')) {
        setPlayerUploadedAvatarData(response.playerAvatarUrl);
      }
      setGeneratorMessage({ text: VIETNAMESE.worldDetailsGeneratedSuccess, type: 'success' });
    } catch (e) { setGeneratorMessage({ text: `${VIETNAMESE.errorGeneratingWorldDetails} ${e instanceof Error ? e.message : String(e)}`, type: 'error' });
    } finally { setIsGeneratingDetails(false); }
  };

  const handleGenerateFromFanfic = async () => {
    let sourceMaterialContent = ''; 
    let isContentProvided = false;
    
    const effectiveStoryName = fanficStoryName.trim();
    const effectivePlayerDescription = fanficPlayerDescription.trim();

    if (fanficSourceType === 'file') {
      if (!fanficFile || !fanficFileContent) { setGeneratorMessage({ text: VIETNAMESE.pleaseSelectFile, type: 'error' }); return; }
      sourceMaterialContent = fanficFileContent; isContentProvided = true;
    } else { 
      if (!effectiveStoryName) { 
        if (effectivePlayerDescription) {
          // Khi tên nguyên tác để trống, dùng mô tả ý tưởng làm nội dung phân tích
          sourceMaterialContent = effectivePlayerDescription;
          isContentProvided = false;
          
          // Điền trực tiếp vào World Theme và Story Summary theo yêu cầu
          setSettings(prev => ({ ...prev, theme: effectivePlayerDescription }));
          setOriginalStorySummary(effectivePlayerDescription);
          setShowOriginalStorySummaryInput(true);
        } else {
          setGeneratorMessage({ text: VIETNAMESE.pleaseEnterStoryName, type: 'error' }); 
          return; 
        }
      } else {
        sourceMaterialContent = effectiveStoryName; 
        isContentProvided = false;
      }
    }
    setIsGeneratingFanficDetails(true); setGeneratorMessage(null); setRawApiResponseText(null); setSentWorldGenPrompt(null);
    try {
      const {response, rawText, constructedPrompt} = await generateFanfictionWorldDetails(
        sourceMaterialContent, isContentProvided, fanficPlayerDescription, settings.nsfwMode || false, settings.genre, settings.isCultivationEnabled,
        settings.violenceLevel || DEFAULT_VIOLENCE_LEVEL, settings.storyTone || DEFAULT_STORY_TONE, settings.genre === CUSTOM_GENRE_VALUE ? settings.customGenreName : undefined, 
        settings.nsfwDescriptionStyle || DEFAULT_NSFW_DESCRIPTION_STYLE, (prompt) => setGeneratorMessage({ text: `Đang gửi prompt (dài ${prompt.length} ký tự)...`, type: 'info'})
      );
      setRawApiResponseText(rawText); setSentWorldGenPrompt(constructedPrompt);

      // Handle unified cultivation system for fanfic
      const normalizedCultFanfic = normalizeCultivationFromAiResponse(response);
      if (normalizedCultFanfic.cultivationSystem) {
        response.cultivationSystem = normalizedCultFanfic.cultivationSystem;
      }
      if (normalizedCultFanfic.raceCultivationSystems) {
        response.raceCultivationSystems = normalizedCultFanfic.raceCultivationSystems;
      }

      const processedItems = processItemDetails(response.startingItems || []);
      setSettings(prev => {
        let updated = {
          ...prev,
          ...response,
          originalWork: fanficSourceType === 'name' ? (fanficStoryName || fanficPlayerDescription) : (response.originalWork || prev.originalWork),
          startingItems: processedItems,
          startingNPCs: (response.startingNPCs || []).map((npc: any) => ({...npc, gender: npc.gender || 'Không rõ'})),
        };
        if (response.cultivationSystem?.majorRealmsRaw) {
          updated = applyCultivationToWorldSettings(updated, response.cultivationSystem.majorRealmsRaw, response.cultivationSystem.minorRealmsRaw);
        }
        return updated;
      });
      if (response.playerAvatarUrl && response.playerAvatarUrl.startsWith('http')) setPlayerUploadedAvatarData(response.playerAvatarUrl);
      if (response.originalStorySummary) { setOriginalStorySummary(response.originalStorySummary); setShowOriginalStorySummaryInput(true); }
      setGeneratorMessage({ text: VIETNAMESE.fanficDetailsGeneratedSuccess, type: 'success' });
    } catch (e) { setGeneratorMessage({ text: `${VIETNAMESE.errorGeneratingFanficDetails} ${e instanceof Error ? e.message : String(e)}`, type: 'error' });
    } finally { setIsGeneratingFanficDetails(false); }
  };

  const handleGenerateCompletion = async () => {
    setIsGeneratingCompletion(true); setGeneratorMessage(null); setRawApiResponseText(null); setSentWorldGenPrompt(null);
    try {
        const { response, rawText, constructedPrompt } = await generateCompletionForWorldDetails(settings, (prompt) => setGeneratorMessage({ text: `AI đang hoàn thiện... (Prompt dài ${prompt.length} ký tự)`, type: 'info' }));
        setRawApiResponseText(rawText); setSentWorldGenPrompt(constructedPrompt);
        setSettings(prev => {
            const newSettings = { ...prev };
            const isFalsyOrEmpty = (value: any) => Array.isArray(value) ? value.length === 0 : (typeof value === 'string' ? value.trim() === '' : !value);
            Object.keys(response).forEach(key => {
                if (isFalsyOrEmpty((prev as any)[key]) && (response as any)[key]) (newSettings as any)[key] = (response as any)[key];
            });
            if (response.startingItems) newSettings.startingItems = processItemDetails(response.startingItems);
            return newSettings;
        });
        if (response.playerAvatarUrl && !settings.playerAvatarUrl) setPlayerUploadedAvatarData(response.playerAvatarUrl);
        setGeneratorMessage({ text: "AI đã hoàn thiện các trường còn trống!", type: 'success' });
    } catch (e) { setGeneratorMessage({ text: `Lỗi khi hoàn thiện thế giới: ${e instanceof Error ? e.message : String(e)}`, type: 'error' });
    } finally { setIsGeneratingCompletion(false); }
  };

  const handleGenerateCharacterFromName = async () => {
    if (!settings.playerName.trim()) {
      setGeneratorMessage({ text: 'Vui lòng nhập tên nhân vật để AI hỗ trợ.', type: 'error' });
      return;
    }
    setIsGeneratingCharacter(true);
    setGeneratorMessage(null);
    setRawApiResponseText(null);
    setSentWorldGenPrompt(null);

    try {
      const { response, rawText, constructedPrompt } = await generateCharacterDetailsFromName(
        settings,
        (prompt) => setGeneratorMessage({ text: `AI đang phân tích nhân vật...`, type: 'info' })
      );
      setRawApiResponseText(rawText);
      setSentWorldGenPrompt(constructedPrompt);

      setSettings(prev => ({
        ...prev,
        playerGender: response.playerGender || prev.playerGender,
        playerRace: response.playerRace || prev.playerRace,
        playerPersonality: response.playerPersonality || prev.playerPersonality,
        playerPersonalityCore: response.playerPersonalityCore || prev.playerPersonalityCore,
        playerBackstory: response.playerBackstory || prev.playerBackstory,
        playerGoal: response.playerGoal || prev.playerGoal,
        playerStartingTraits: response.playerStartingTraits || prev.playerStartingTraits,
        playerSpiritualRoot: response.playerSpiritualRoot || prev.playerSpiritualRoot,
        playerSpecialPhysique: response.playerSpecialPhysique || prev.playerSpecialPhysique,
      }));

      setGeneratorMessage({ text: "AI đã cập nhật thông tin nhân vật!", type: 'success' });
    } catch (e) {
      setGeneratorMessage({ text: `Lỗi khi tạo chi tiết nhân vật: ${e instanceof Error ? e.message : String(e)}`, type: 'error' });
    } finally {
      setIsGeneratingCharacter(false);
    }
  };

  const handleFanficFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setFanficFile(file); setIsLoadingTokens(true);
      try {
        const content = await file.text(); setFanficFileContent(content);
        const tokens = await countTokens(content); setFanficTokenCount(tokens);
        if (tokens > MAX_TOKENS_FANFIC) setGeneratorMessage({ text: VIETNAMESE.tokenCountExceededError(MAX_TOKENS_FANFIC), type: 'error' });
        else setGeneratorMessage({ text: `File "${file.name}" đã sẵn sàng. Ước tính ${tokens} token.`, type: 'success' });
      } catch (err) { setGeneratorMessage({ text: `Lỗi xử lý file: ${err instanceof Error ? err.message : String(err)}`, type: 'error' });
      } finally { setIsLoadingTokens(false); }
    }
  };

  const handleImportSettingsFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const importedSettings = JSON.parse(e.target?.result as string) as WorldSettings;
          if (importedSettings && importedSettings.theme !== undefined) {
            setSettings({ ...DEFAULT_WORLD_SETTINGS, ...importedSettings });
            setOriginalStorySummary(importedSettings.originalStorySummary || ''); 
            setShowOriginalStorySummaryInput(!!importedSettings.originalStorySummary);
            setGeneratorMessage({ text: VIETNAMESE.worldSettingsImportedSuccess, type: 'success' }); 
          } else setGeneratorMessage({ text: VIETNAMESE.invalidWorldSettingsFile, type: 'error' });
        } catch (error) { setGeneratorMessage({ text: VIETNAMESE.errorImportingWorldSettings, type: 'error' }); }
      };
      reader.readAsText(file);
    }
  };

  const handleExportSettings = () => {
    try {
      const blob = new Blob([JSON.stringify({ ...settings, originalStorySummary }, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.download = `${settings.saveGameName || 'Untitled'}_thiết lập.json`; link.href = url;
      document.body.appendChild(link); link.click(); document.body.removeChild(link); URL.revokeObjectURL(url);
      setGeneratorMessage({ text: VIETNAMESE.worldSettingsExportedSuccess, type: 'success' });
    } catch (error) { setGeneratorMessage({ text: VIETNAMESE.errorExportingWorldSettings, type: 'error' }); }
  };

  const handleSubmit = () => {
    if(!settings.saveGameName.trim()){ setGeneratorMessage({text: VIETNAMESE.saveGameNameRequiredError, type: 'error'}); return false; }
    const missingFields: string[] = [];
    if (!settings.theme.trim()) missingFields.push("Chủ đề"); if (!settings.settingDescription.trim()) missingFields.push("Bối cảnh"); if (!settings.writingStyle.trim()) missingFields.push("Văn phong"); if (!settings.playerName.trim()) missingFields.push("Tên nhân vật"); if (!settings.playerPersonality.trim()) missingFields.push("Tính cách NV"); if (!settings.playerBackstory.trim()) missingFields.push("Tiểu sử NV"); if (!settings.playerGoal.trim()) missingFields.push("Mục tiêu NV");
    if (settings.isCultivationEnabled) { if (settings.raceCultivationSystems.some(s => !s.raceName.trim() || !s.realmSystem.trim()) || !settings.yeuThuRealmSystem.trim()) missingFields.push("Hệ thống cảnh giới"); if (!settings.canhGioiKhoiDau.trim() || settings.canhGioiKhoiDau === VIETNAMESE.mortalRealmName) missingFields.push("Cảnh giới khởi đầu"); }
    if (settings.genre === CUSTOM_GENRE_VALUE && !settings.customGenreName?.trim()) missingFields.push(VIETNAMESE.customGenreNameLabel);
    if (missingFields.length > 0) { setGeneratorMessage({ text: "Vui lòng điền đầy đủ: " + missingFields.join(', ') + ".", type: "error" }); return false; }
    
    const finalSettings = { ...settings, originalStorySummary };
    if (playerUploadedAvatarData) {
      if (playerUploadedAvatarData.startsWith('data:')) finalSettings.playerAvatarUrl = "uploaded_via_file";
      else if (playerUploadedAvatarData.startsWith('http')) finalSettings.playerAvatarUrl = playerUploadedAvatarData;
    }
    onSetupComplete(finalSettings, playerUploadedAvatarData);
    return true;
  };

  return {
    settings, setSettings, handleChange, handleSetupCultivation, onNestedChange, setSimpleField, handleRaceSystemChange, addRaceSystem, removeRaceSystem,
    handleStartingSkillChange, addStartingSkill, removeStartingSkill,
    handleStartingItemChange, addStartingItem, removeStartingItem,
    handleStartingNPCChange, addStartingNPC, removeStartingNPC, batchUpdateNPCs,
    handleStartingYeuThuChange, addStartingYeuThu, removeStartingYeuThu,
    handleStartingLoreChange, addStartingLore, removeStartingLore,
    handleStartingLocationChange, addStartingLocation, removeStartingLocation,
    handleStartingFactionChange, addStartingFaction, removeStartingFaction,
    storyIdea, setStoryIdea, handleGenerateFromStoryIdea, isGeneratingDetails,
    fanficSourceType, setFanficSourceType, fanficStoryName, setFanficStoryName,
    fanficFile, handleFanficFileChange, fanficTokenCount, isLoadingTokens,
    fanficPlayerDescription, setFanficPlayerDescription, handleGenerateFromFanfic, isGeneratingFanficDetails,
    handleGenerateCompletion, isGeneratingCompletion,
    handleGenerateCharacterFromName, isGeneratingCharacter,
    originalStorySummary, setOriginalStorySummary, showOriginalStorySummaryInput, setShowOriginalStorySummaryInput,
    generatorMessage, setGeneratorMessage, rawApiResponseText, setRawApiResponseText, sentWorldGenPrompt, setSentWorldGenPrompt,
    playerAvatarPreviewUrl, setPlayerAvatarPreviewUrl, playerUploadedAvatarData, setPlayerUploadedAvatarData,
    fanficFileInputRef, importSettingsFileRef, handleImportSettingsFileChange, handleExportSettings, handleSubmit
  };
};
