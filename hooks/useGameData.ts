import { useState, useCallback } from 'react';
import { KnowledgeBase, GameMessage, CombatEndPayload, ResponseLength } from '../types';
import { INITIAL_KNOWLEDGE_BASE } from '../constants';
import { sanitizeKbBackslashes } from '../utils/tagProcessingUtils';
import { MasterIntegrityService } from '../services/MasterIntegrityService';


const isEntityFemale = (entity: any): boolean => {
  if (!entity) return false;
  if (entity.gender && typeof entity.gender === 'string') {
    return entity.gender.toLowerCase().includes("nữ");
  }
  return false;
};

const ensureFemaleAvatars = (kb: KnowledgeBase): KnowledgeBase => {
  if (!kb) return kb;

  let changed = false;

  const processList = (list: any[] | undefined) => {
    if (!list) return list;
    return list.map(item => {
      if (item && isEntityFemale(item)) {
        if (item.avatarHairId === undefined || item.avatarFaceId === undefined) {
          changed = true;
          return {
            ...item,
            avatarHairId: item.avatarHairId !== undefined ? item.avatarHairId : Math.floor(Math.random() * 25),
            avatarFaceId: item.avatarFaceId !== undefined ? item.avatarFaceId : Math.floor(Math.random() * 25),
          };
        }
      }
      return item;
    });
  };

  const discoveredNPCs = processList(kb.discoveredNPCs);
  const wives = processList(kb.wives);
  const slaves = processList(kb.slaves);
  const companions = processList(kb.companions);
  const prisoners = processList(kb.prisoners);

  let master = kb.master;
  if (master && isEntityFemale(master)) {
    if (master.avatarHairId === undefined || master.avatarFaceId === undefined) {
      changed = true;
      master = {
        ...master,
        avatarHairId: master.avatarHairId !== undefined ? master.avatarHairId : Math.floor(Math.random() * 25),
        avatarFaceId: master.avatarFaceId !== undefined ? master.avatarFaceId : Math.floor(Math.random() * 25),
      };
    }
  }

  if (changed) {
    return {
      ...kb,
      discoveredNPCs: discoveredNPCs || [],
      wives: wives || [],
      slaves: slaves || [],
      companions: companions || [],
      prisoners: prisoners || [],
      master,
    };
  }

  return kb;
};

export const useGameData = () => {
  const [knowledgeBase, setKnowledgeBaseState] = useState<KnowledgeBase>(() => {
    const base = JSON.parse(JSON.stringify(INITIAL_KNOWLEDGE_BASE));
    // Restore remote canon from localStorage if present
    const savedUrl = localStorage.getItem('REMOTE_CANON_URL');
    const useRemote = localStorage.getItem('USE_REMOTE_CANON') === 'true';
    if (savedUrl && useRemote) {
        if (!base.worldConfig) base.worldConfig = {};
        base.worldConfig.remoteCanonUrl = savedUrl;
        base.worldConfig.useRemoteCanon = true;
    }
    const sanitized = ensureFemaleAvatars(sanitizeKbBackslashes(base));
    const { updatedKb } = MasterIntegrityService.validateAndEnforceMasterIntegrity(sanitized);
    return updatedKb;
  });

  const setKnowledgeBase = useCallback((
    value: KnowledgeBase | ((prev: KnowledgeBase) => KnowledgeBase)
  ) => {
    setKnowledgeBaseState((prev) => {
      const next = typeof value === 'function' ? value(prev) : value;
      const sanitized = ensureFemaleAvatars(sanitizeKbBackslashes(next));
      const { updatedKb } = MasterIntegrityService.validateAndEnforceMasterIntegrity(sanitized);
      return updatedKb;
    });
  }, []);
  const [gameMessages, setGameMessages] = useState<GameMessage[]>([]);
  const [rawAiResponsesLog, setRawAiResponsesLog] = useState<string[]>([]);
  const [sentPromptsLog, setSentPromptsLog] = useState<string[]>([]);
  const [sentEconomyPromptsLog, setSentEconomyPromptsLog] = useState<string[]>([]);
  const [receivedEconomyResponsesLog, setReceivedEconomyResponsesLog] = useState<string[]>([]);
  const [sentGeneralSubLocationPromptsLog, setSentGeneralSubLocationPromptsLog] = useState<string[]>([]);
  const [receivedGeneralSubLocationResponsesLog, setReceivedGeneralSubLocationResponsesLog] = useState<string[]>([]);
  const [latestPromptTokenCount, setLatestPromptTokenCount] = useState<number | null | string>(null);
  const [summarizationResponsesLog, setSummarizationResponsesLog] = useState<string[]>([]);
  const [sentCraftingPromptsLog, setSentCraftingPromptsLog] = useState<string[]>([]);
  const [receivedCraftingResponsesLog, setReceivedCraftingResponsesLog] = useState<string[]>([]);
  const [sentCultivationPromptsLog, setSentCultivationPromptsLog] = useState<string[]>([]);
  const [receivedCultivationResponsesLog, setReceivedCultivationResponsesLog] = useState<string[]>([]);
  const [companionInteractionLog, setCompanionInteractionLog] = useState<string[]>([]);
  const [prisonerInteractionLog, setPrisonerInteractionLog] = useState<string[]>([]);
  const [sentPrisonerPromptsLog, setSentPrisonerPromptsLog] = useState<string[]>([]);
  const [receivedPrisonerResponsesLog, setReceivedPrisonerResponsesLog] = useState<string[]>([]);
  const [sentCompanionPromptsLog, setSentCompanionPromptsLog] = useState<string[]>([]);
  const [receivedCompanionResponsesLog, setReceivedCompanionResponsesLog] = useState<string[]>([]);
  const [retrievedRagContextLog, setRetrievedRagContextLog] = useState<string[]>([]); // NEW
  
  // New logs for post-combat AI interactions
  const [sentCombatSummaryPromptsLog, setSentCombatSummaryPromptsLog] = useState<string[]>([]);
  const [receivedCombatSummaryResponsesLog, setReceivedCombatSummaryResponsesLog] = useState<string[]>([]);
  const [sentVictoryConsequencePromptsLog, setSentVictoryConsequencePromptsLog] = useState<string[]>([]);
  const [receivedVictoryConsequenceResponsesLog, setReceivedVictoryConsequenceResponsesLog] = useState<string[]>([]);
  
  const [apiKeyDisplay, setApiKeyDisplay] = useState<string | null>(null); // NEW
  const [messageIdBeingEdited, setMessageIdBeingEdited] = useState<string | null>(null);
  const [selectedResponseLength, setSelectedResponseLength] = useState<ResponseLength>('extra-short');

  const addMessageAndUpdateState = useCallback((
    newMessages: GameMessage[],
    newKnowledgeBase?: KnowledgeBase | null,
    startingCurrency?: number,
    callback?: () => void
  ) => {
    if (newMessages && newMessages.length > 0) {
      setGameMessages(prev => {
        let merged = [...prev, ...newMessages];
        const currentTurn = newKnowledgeBase?.playerStats?.turn || merged[merged.length - 1]?.turnNumber || 0;
        
        // Tự động xoá bỏ các nội dung lời kể, nội dung phản hồi thô đã quá 1500 lượt
        if (currentTurn > 1500) {
            const placeholderText = "*[Nội dung lời kể và phản hồi thô đã được dọn dẹp tự động để tối ưu bộ nhớ]*";
            merged = merged.map(msg => {
                if (currentTurn - msg.turnNumber > 1500 && (msg.type === 'narration' || msg.type === 'system')) {
                    if (msg.content && msg.content !== placeholderText) {
                        return { ...msg, content: placeholderText };
                    }
                }
                return msg;
            });
        }
        
        return merged;
      });
    }
    
    if (newKnowledgeBase) {
      if (startingCurrency !== undefined) {
          setKnowledgeBase(prev => {
              if (!prev) return newKnowledgeBase;
              const merged = { ...newKnowledgeBase };
              const aiDelta = newKnowledgeBase.playerStats.currency - startingCurrency;
              merged.playerStats.currency = prev.playerStats.currency + aiDelta;
              return merged;
          });
      } else {
          setKnowledgeBase(newKnowledgeBase);
      }
    }
    
    if (callback) callback();
  }, [setGameMessages, setKnowledgeBase]);
  
  const resetGameData = useCallback(() => {
    setKnowledgeBase(JSON.parse(JSON.stringify(INITIAL_KNOWLEDGE_BASE)));
    setGameMessages([]);
    setRawAiResponsesLog([]);
    setSentPromptsLog([]);
    setSentEconomyPromptsLog([]);
    setReceivedEconomyResponsesLog([]);
    setSentGeneralSubLocationPromptsLog([]);
    setReceivedGeneralSubLocationResponsesLog([]);
    setLatestPromptTokenCount(null);
    setSummarizationResponsesLog([]);
    setSentCraftingPromptsLog([]);
    setReceivedCraftingResponsesLog([]);
    setSentCultivationPromptsLog([]);
    setReceivedCultivationResponsesLog([]);
    setCompanionInteractionLog([]);
    setPrisonerInteractionLog([]);
    setSentPrisonerPromptsLog([]);
    setReceivedPrisonerResponsesLog([]);
    setSentCompanionPromptsLog([]);
    setReceivedCompanionResponsesLog([]);
    setRetrievedRagContextLog([]); // NEW
    // Reset new logs
    setSentCombatSummaryPromptsLog([]);
    setReceivedCombatSummaryResponsesLog([]);
    setSentVictoryConsequencePromptsLog([]);
    setReceivedVictoryConsequenceResponsesLog([]);
    setMessageIdBeingEdited(null);
    setSelectedResponseLength('extra-short'); // Reset on new game
    setApiKeyDisplay(null); // NEW
  }, [setKnowledgeBase, setGameMessages, setRawAiResponsesLog, setSentPromptsLog, setSentEconomyPromptsLog, setReceivedEconomyResponsesLog, setSentGeneralSubLocationPromptsLog, setReceivedGeneralSubLocationResponsesLog, setLatestPromptTokenCount, setSummarizationResponsesLog, setSentCraftingPromptsLog, setReceivedCraftingResponsesLog, setMessageIdBeingEdited, setRetrievedRagContextLog]);


  return {
    knowledgeBase,
    setKnowledgeBase,
    gameMessages,
    setGameMessages,
    rawAiResponsesLog,
    setRawAiResponsesLog,
    sentPromptsLog,
    setSentPromptsLog,
    sentEconomyPromptsLog,
    setSentEconomyPromptsLog,
    receivedEconomyResponsesLog,
    setReceivedEconomyResponsesLog,
    sentGeneralSubLocationPromptsLog,
    setSentGeneralSubLocationPromptsLog,
    receivedGeneralSubLocationResponsesLog,
    setReceivedGeneralSubLocationResponsesLog,
    latestPromptTokenCount,
    setLatestPromptTokenCount,
    summarizationResponsesLog,
    setSummarizationResponsesLog,
    sentCraftingPromptsLog,
    setSentCraftingPromptsLog,
    receivedCraftingResponsesLog,
    setReceivedCraftingResponsesLog,
    sentCultivationPromptsLog,
    setSentCultivationPromptsLog,
    receivedCultivationResponsesLog,
    setReceivedCultivationResponsesLog,
    companionInteractionLog,
    setCompanionInteractionLog,
    prisonerInteractionLog,
    setPrisonerInteractionLog,
    sentPrisonerPromptsLog,
    setSentPrisonerPromptsLog,
    receivedPrisonerResponsesLog,
    setReceivedPrisonerResponsesLog,
    sentCompanionPromptsLog,
    setSentCompanionPromptsLog,
    receivedCompanionResponsesLog,
    setReceivedCompanionResponsesLog,
    retrievedRagContextLog, // NEW
    setRetrievedRagContextLog, // NEW
    // New states for post-combat logs
    sentCombatSummaryPromptsLog,
    setSentCombatSummaryPromptsLog,
    receivedCombatSummaryResponsesLog,
    setReceivedCombatSummaryResponsesLog,
    sentVictoryConsequencePromptsLog,
    setSentVictoryConsequencePromptsLog,
    receivedVictoryConsequenceResponsesLog,
    setReceivedVictoryConsequenceResponsesLog,
    messageIdBeingEdited,
    setMessageIdBeingEdited,
    selectedResponseLength,
    setSelectedResponseLength,
    apiKeyDisplay, // NEW
    setApiKeyDisplay, // NEW
    addMessageAndUpdateState,
    resetGameData
  };
};
