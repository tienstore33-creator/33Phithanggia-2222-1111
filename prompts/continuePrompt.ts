import {
  KnowledgeBase,
  PlayerActionInputType,
  ResponseLength,
  CoreMemory,
  WorldSettings,
} from "../types";
import {
  VIETNAMESE,
  CUSTOM_GENRE_VALUE,
  DEFAULT_NSFW_DESCRIPTION_STYLE,
  DEFAULT_VIOLENCE_LEVEL,
  DEFAULT_STORY_TONE,
  SUB_REALM_NAMES,
} from "../constants";
import { continuePromptSystemRules } from "./systemRulesNormal";
import { COMBAT_CLIFFHANGER_PROTOCOL } from "./combatCliffhangerProtocol";
import { HARD_IMMUTABLE_PROMPT_BLOCK } from "./hardSystemRules";
import { LOI_NHAC_AN } from "./loinhacprompt";
import { LOI_NHAC_AN_2 } from "./loinhacprompt2";
import { NARRATIVE_PRISON_RULES } from "./narrativePrisonRules";
import { buildUpdateDataInstruction } from "./updateDataPromptHelper";
import { getRecentNpcsFullInfo } from "../utils/npcHelper";
import { SacredTimelineService } from "../services/SacredTimelineService";
import { formatUserPromptsBlock } from "./userPromptsHelper";
import { isPostCombatAction } from "../services/combat/PostCombatNarrationService";
import { generateTimelineCluePrompt } from "./timelineClueRules";

// Format core memories for the prompt
const formatCoreMemoriesForContext = (
  memories: CoreMemory[],
  personName: string,
): string => {
  if (!memories || memories.length === 0) {
    return "";
  }
  const header =
    personName === "player"
      ? "KÝ ỨC CỐT LÕI CỦA BẠN (NHÂN VẬT CHÍNH):"
      : `KÝ ỨC CỐT LÕI CỦA ${personName}:`;

  // @FIX: [MEMORY - Cốt lõi] Chỉ giữ lại 5 ký ức có độ mạnh lớn nhất và gần nhất
  const filteredMemories = [...memories]
    .sort((a, b) => {
      if (b.strength !== a.strength) {
        return b.strength - a.strength;
      }
      return b.turn - a.turn;
    })
    .slice(0, 5);

  const memoriesString = filteredMemories
    .map((m) => `- (Lượt ${m.turn}, Độ mạnh: ${m.strength}/100) ${m.text}`)
    .join("\n");
  return `${header}\n${memoriesString}`;
};

// Clean retrieved context by removing backstage data
export const cleanRetrievedContext = (context?: string): string => {
  if (!context) return "Không có thông tin liên quan được tìm thấy.";
  return context
    .split('\n---\n')
    .map(chunk => chunk.replace(/[-*]?\s*Dữ Liệu Hậu Trường:[\s\S]*/gi, '').trim())
    .filter(Boolean)
    .join('\n---\n') || "Không có thông tin liên quan được tìm thấy.";
};

// Format structured milestones
const formatMilestones = (
  milestones: Record<string, any> | undefined,
): string => {
  if (!milestones || Object.keys(milestones).length === 0) return "";

  return `
**CÁC CỘT MỐC ĐÁNG NHỚ ĐÃ ĐẠT ĐƯỢC (TUYỆT ĐỐI KHÔNG ĐƯỢC QUÊN):**
${Object.values(milestones)
  .map((m) => `- ${m.description} (Lượt ${m.turn})`)
  .join("\n")}
`;
};

const parseAndSubdivideAiText = (text: string): string => {
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
  cleaned = cleaned.replace(/<(choice|choices|branches)>[\s\S]*?<\/\1>/gi, "");
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

// Format short-term context from the currentTurnLog array
const formatCurrentTurnLog = (log: any[]): string => {
  if (!log || log.length === 0) return "Chưa có hội thoại nào trong trang này.";
  return log
    .map((entry, index) => {
      const isUser = entry.role === "user";
      const roleName = isUser ? "Người chơi" : "AI";
      const id = index + 1;
      
      let innerContent = "";
      if (isUser) {
        innerContent = `\n    <Action></Action>\n`;
      } else {
        innerContent = parseAndSubdivideAiText(entry.text);
      }

      return `<Turn _Log_#${id}+current_context_17>
    <Role>${roleName}</Role>${innerContent}</Turn _Log_#${id}+current_context_17>`;
    })
    .join("\n");
};

const convertWorldStateToXML = (worldState: any): string => {
  const player = worldState.player;
  const master = worldState.master;
  const world = worldState.world;
  const contextNpcs = worldState.contextNpcs;

  let xml = "";

  // 1. Player State
  xml += "  <player_state_11_1>\n  ----\n";
  xml += `    <name>${player.name || "Không rõ"}</name>\n`;
  xml += `    <gender>${player.gender || "Không rõ"}</gender>\n`;
  xml += `    <race>${player.race || "Không rõ"}</race>\n`;
  xml += `    <personality>${player.personality || "Không có"}</personality>\n`;
  xml += `    <personality_core>${player.personalityCore || "Không có"}</personality_core>\n`;
  xml += `    <backstory>${player.backstory || "Không có"}</backstory>\n`;
  xml += `    <goal>${player.goal || "Không có"}</goal>\n`;
  xml += `    <hp>${player.hp}/${player.maxHp}</hp>\n`;
  xml += `    <mp>${player.mp}/${player.maxMp}</mp>\n`;
  xml += `    <atk>${player.atk}</atk>\n`;
  xml += `    <realm>${player.realm || "Không rõ"}</realm>\n`;
  xml += `    <location>${player.location || "Không rõ"}</location>\n`;
  xml += `    <gold>${player.gold}</gold>\n`;
  
  if (player.statusEffects && player.statusEffects.length > 0) {
    xml += "    <status_effects>\n    ----\n";
    player.statusEffects.forEach((eff: any, idx: number) => {
      xml += `      <effect_${idx + 1} name="${eff.name}" type="${eff.type}" duration="${eff.durationTurns}">\n      ----\n`;
      xml += `        <description>${eff.description}</description>\n`;
      xml += `      ----\n      </effect_${idx + 1}>\n`;
    });
    xml += "    ----\n    </status_effects>\n";
  } else {
    xml += "    <status_effects>\n    ----\n    Không có hiệu ứng trạng thái nào đang hoạt động\n    ----\n    </status_effects>\n";
  }

  if (player.inventorySimple && player.inventorySimple.length > 0) {
    xml += "    <inventory>\n    ----\n";
    player.inventorySimple.forEach((item: string, idx: number) => {
      xml += `      <item_${idx + 1}>${item}</item_${idx + 1}>\n`;
    });
    xml += "    ----\n    </inventory>\n";
  } else {
    xml += "    <inventory>\n    ----\n    Rỗng\n    ----\n    </inventory>\n";
  }

  if (player.quests && player.quests.length > 0) {
    xml += "    <active_quests>\n    ----\n";
    player.quests.forEach((q: any, idx: number) => {
      xml += `      <quest_${idx + 1} id="${q.id}" status="${q.status}">\n      ----\n`;
      xml += `        <title>${q.title}</title>\n`;
      xml += `        <description>${q.description}</description>\n`;
      if (q.objectives && q.objectives.length > 0) {
        xml += "        <objectives>\n        ----\n";
        q.objectives.forEach((obj: any, oIdx: number) => {
          xml += `          <objective_${oIdx + 1} completed="${obj.completed}">${obj.text}</objective_${oIdx + 1}>\n`;
        });
        xml += "        ----\n        </objectives>\n";
      }
      xml += `      ----\n      </quest_${idx + 1}>\n`;
    });
    xml += "    ----\n    </active_quests>\n";
  } else {
    xml += "    <active_quests>\n    ----\n    Không có nhiệm vụ hoạt động\n    ----\n    </active_quests>\n";
  }
  xml += "  ----\n  </player_state_11_1>\n\n";

  // 2. Master State (nếu có)
  if (master) {
    xml += `  <master_state_11_2 id="${master.id}">\n  ----\n`;
    xml += `    <name>${master.name}</name>\n`;
    xml += `    <realm>${master.realm}</realm>\n`;
    xml += `    <description>${master.description || "Không có"}</description>\n`;
    xml += `    <affinity>${master.affinity}</affinity>\n`;
    xml += `    <personality>${master.personality}</personality>\n`;
    xml += `    <appearance>${master.appearance}</appearance>\n`;
    if (master.avatarAppearancePendingTransition) {
      xml += `    <avatar_appearance_pending_transition>true</avatar_appearance_pending_transition>\n`;
    }
    if (master.appearanceTurnsRemaining !== undefined) {
      xml += `    <appearance_turns_remaining>${master.appearanceTurnsRemaining}</appearance_turns_remaining>\n`;
    }
    xml += "  ----\n  </master_state_11_2>\n\n";
  } else {
    xml += "  <master_state_11_2>\n  ----\n  Không có chủ nhân/sư phụ trực tiếp\n  ----\n  </master_state_11_2>\n\n";
  }

  // 3. World Metadata
  xml += "  <world_metadata_11_3>\n  ----\n";
  xml += `    <date>${world.date}</date>\n`;
  xml += `    <realm_base>${world.realmBase || "Không rõ"}</realm_base>\n`;
  xml += `    <active_quest_title>${world.activeQuest || "Không có"}</active_quest_title>\n`;
  xml += `    <original_timeline>${world.originalTimeline || "Không có"}</original_timeline>\n`;
  
  if (world.allKnownMainLocations && world.allKnownMainLocations.length > 0) {
    xml += "    <all_known_main_locations>\n    ----\n";
    world.allKnownMainLocations.forEach((locName: string, idx: number) => {
      xml += `      <location_${idx + 1}>${locName}</location_${idx + 1}>\n`;
    });
    xml += "    ----\n    </all_known_main_locations>\n";
  }
  
  xml += "  ----\n  </world_metadata_11_3>\n\n";

  // 4. Context NPCs (Có đánh số cho vị trí của thẻ và kèm tên từng NPC)
  xml += "  <context_npcs_11_4>\n  ----\n";
  if (contextNpcs && contextNpcs.length > 0) {
    contextNpcs.forEach((npc: any, idx: number) => {
      if (npc.isCompressed) {
        // Cơ chế nén: Khi >= 100 NPC và không được nhắc >= 20 lượt, chỉ truyền tên, giới tính, tu vi
        xml += `    <npc_11_4_${idx + 1} name="${npc.name}" id="${npc.id}" realm="${npc.realm}">\n    ----\n`;
        xml += `      <gender>${npc.gender}</gender>\n`;
        xml += `    ----\n    </npc_11_4_${idx + 1}>\n`;
      } else {
        xml += `    <npc_11_4_${idx + 1} name="${npc.name}" id="${npc.id}" realm="${npc.realm}">\n    ----\n`;
        xml += `      <gender>${npc.gender}</gender>\n`;
        xml += `      <status>${npc.status}</status>\n`;
        xml += `      <hp>${npc.hp}</hp>\n`;
        xml += `      <spiritual_root>${npc.spiritualRoot}</spiritual_root>\n`;
        xml += `      <physique>${npc.physique}</physique>\n`;
        xml += `      <affinity>${npc.affinity}</affinity>\n`;
        xml += `      <personality>${npc.personality}</personality>\n`;
        xml += `      <position>${npc.position}</position>\n`;
        xml += `      <active_effects>${npc.activeEffects}</active_effects>\n`;
        const appearanceToUse = npc.avatarAppearance || npc.appearance || "Không có thông tin";
        xml += `      <bề_ngoài>${appearanceToUse}</bề_ngoài>\n`;
        if (npc.avatarAppearancePendingTransition) {
          xml += `      <avatar_appearance_pending_transition>true</avatar_appearance_pending_transition>\n`;
        }
        if (npc.appearanceTurnsRemaining !== undefined && !npc.avatarAppearance) {
          xml += `      <appearance_turns_remaining>${npc.appearanceTurnsRemaining}</appearance_turns_remaining>\n`;
        }
        xml += `    ----\n    </npc_11_4_${idx + 1}>\n`;
      }
    });
  } else {
    xml += "    <no_npcs>\n    ----\n    Không có NPC nào khác trong khu vực\n    ----\n    </no_npcs>\n";
  }
  xml += "  ----\n  </context_npcs_11_4>";

  return xml;
};

export const generateContinuePrompt = (
  knowledgeBase: KnowledgeBase,
  playerActionText: string,
  inputType: PlayerActionInputType,
  responseLength: ResponseLength,
  currentPageMessagesLog: string, // Deprecated in favor of currentTurnLog but kept for signature
  previousPageSummaries: string[],
  narrationMin: number,
  narrationMax: number,
  lastNarrationFromPreviousPage?: string,
  retrievedContext?: string,
  perspectiveMode: string = "firstPerson",
  exclusiveMode: boolean = false,
  exclusiveSections: any = undefined,
  isSuperManualMode: boolean = false,
): string => {
  const {
    worldConfig,
    worldDate,
    playerStats,
    coreMemories,
    discoveredNPCs,
    currentLocationId,
    wives,
    slaves,
    prisoners,
    mainQuest,
    master,
    milestones,
    worldRealmBase,
    currentTurnLog,
    flashState
  } = knowledgeBase;

  // Basic world settings
  const genre = worldConfig?.genre || "Tu Tiên (Mặc định)";
  const customGenreName = worldConfig?.customGenreName;
  const effectiveGenre =
    genre === CUSTOM_GENRE_VALUE && customGenreName ? customGenreName : genre;
  const nsfwMode = worldConfig?.nsfwMode || false;
  const currentNsfwStyle =
    worldConfig?.nsfwDescriptionStyle || DEFAULT_NSFW_DESCRIPTION_STYLE;
  const currentViolenceLevel =
    worldConfig?.violenceLevel || DEFAULT_VIOLENCE_LEVEL;
  const currentStoryTone = worldConfig?.storyTone || DEFAULT_STORY_TONE;

  const perspectiveInstruction = (
    worldConfig: WorldSettings | null,
    mode: string,
  ): string => {
    if (mode === "thirdPersonOmniscient") {
      return `
**HƯỚNG DẪN VỀ GÓC NHÌN KỂ CHUYỆN (CỰC KỲ QUAN TRỌNG - CHẾ ĐỘ TOÀN TRI):**
- **Góc Nhìn:** Người chơi đã chọn **GÓC NHÌN THỨ BA TOÀN TRI**.
- **Yêu cầu BẮT BUỘC:**
  1.  **Ngôi kể:** Sử dụng ngôi thứ ba (ví dụ: "Hắn", "Nàng", hoặc tên nhân vật "${worldConfig?.playerName || ""}"). **TUYỆT ĐỐI KHÔNG** dùng "Bạn" hoặc "Ngươi".
  2.  **Mục tiêu:** Làm cho người chơi cảm thấy họ đang đọc một cuốn tiểu thuyết và biết nhiều hơn những gì nhân vật chính biết, nhưng vẫn đảm bảo tính logic của thế giới.`;
    }
    return `
**HƯỚNG DẪN VỀ GÓC NHÌN KỂ CHUYỆN (QUAN TRỌNG):**
- **Góc Nhìn:** Người chơi đã chọn **GÓC NHÌN THỨ NHẤT**.
- **Yêu cầu:**
  1.  **Ngôi kể:** Sử dụng ngôi thứ hai ("Bạn", "Ngươi") để nói chuyện với người chơi.
  2.  **Giới hạn:** Chỉ mô tả những gì nhân vật chính có thể nhìn thấy, nghe thấy, cảm nhận và biết được. **TUYỆT ĐỐI KHÔNG** tiết lộ suy nghĩ hoặc ý định thầm kín của các NPC khác.`;
  };

  const mainRealms = (
    worldConfig?.raceCultivationSystems.find(
      (s) => s.raceName === (worldConfig.playerRace || "Nhân Tộc"),
    )?.realmSystem || ""
  )
    .split(" - ")
    .map((s) => s.trim())
    .filter(Boolean);
  const systemRules = continuePromptSystemRules(worldConfig, mainRealms, narrationMin, narrationMax, isSuperManualMode);

  // --- 1. [WORLD STATE] JSON CONSTRUCTION ---
  const worldStateJSON = {
    player: {
      name: worldConfig?.playerName,
      deceasedProtagonists: worldConfig?.deceasedProtagonists || knowledgeBase.deceasedProtagonists || [],
      gender: worldConfig?.playerGender,
      race: worldConfig?.playerRace,
      personality: worldConfig?.playerPersonality, // CỰC KỲ QUAN TRỌNG ĐỂ MC DIỄN ĐÚNG VAI
      personalityCore: worldConfig?.playerPersonalityCore,
      backstory: worldConfig?.playerBackstory,
      goal: worldConfig?.playerGoal,
      hp: playerStats.sinhLuc,
      maxHp: playerStats.maxSinhLuc,
      mp: playerStats.linhLuc,
      maxMp: playerStats.maxLinhLuc,
      atk: playerStats.sucTanCong,
      realm: playerStats.realm,
      location:
        knowledgeBase.discoveredLocations.find(
          (l) => l.id === currentLocationId,
        )?.name || "Không rõ",
      gold: playerStats.currency,
      statusEffects: playerStats.activeStatusEffects.map((e) => ({
        name: e.name,
        type: e.type,
        durationTurns: e.durationTurns,
        description: e.description,
      })),
      inventorySimple: knowledgeBase.inventory.map((i) => i.name), // Simplified for tokens
      quests: (knowledgeBase.allQuests || [])
        .filter(q => 
          q.status === 'active' || 
          q.status === 'pending' ||
          ((q.status === 'completed' || q.status === 'failed') && q.resolvedAtTurn !== undefined && (playerStats.turn - q.resolvedAtTurn <= 2))
        )
        .slice(0, 8) // Slightly more limit as we have more states now
    },
    master: master ? {
      id: master.id,
      name: master.name,
      realm: master.realm || "Không rõ",
      description: master.description,
      affinity: master.affinity || 0,
      personality: (master.personalityTraits || []).join(", ") || "Bình thường",
      appearance: ((master as any).avatarAppearance && (master as any).avatarAppearance.trim() !== '') ? (master as any).avatarAppearance : (master.appearance || "Không có thông tin trang phục/bề ngoài"),
      appearanceTurnsRemaining: (master as any).avatarAppearance ? undefined : master.appearanceDuration
    } : null,
    world: {
      date: `${worldDate.day}/${worldDate.month}/${worldDate.year} (${worldDate.timeOfDay})`,
      realmBase: worldRealmBase,
      activeQuest: mainQuest?.title,
      allKnownMainLocations: (knowledgeBase.discoveredLocations || [])
        .filter(loc => !loc.parentLocationId)
        .map(loc => loc.name),
      originalTimeline: (worldConfig?.timelineEvents && knowledgeBase.arcState && knowledgeBase.arcState.originalTimelineIndex != null) 
          ? (() => {
              const idx = knowledgeBase.arcState.originalTimelineIndex;
              const evt = worldConfig.timelineEvents[idx];
              if (!evt) return 'Không có';
              if (knowledgeBase.arcState.originalEventResolved) {
                 return `Đang chờ sự kiện tiếp theo (Sự kiện "${evt.eventName}" đã kết thúc/hoàn thành, vui lòng KHÔNG nhắc lại)`;
              }
              let details = `Sự kiện cốt truyện hiện tại (Mốc Số ${idx + 1}): "${evt.eventName}" (Thời kỳ: ${evt.periodName})\n     • Mô tả diễn biến chính: ${evt.description}`;
              if (evt.location) {
                 details += `\n     • Địa điểm diễn ra mốc này: ${evt.location}`;
              }
              if (evt.characters && evt.characters.length > 0) {
                 details += `\n     • Nhân vật chính tham gia cuộc chơi: ${evt.characters.join(', ')}`;
              }
              
              const nextEvt = worldConfig.timelineEvents[idx + 1];
              const nextNextEvt = worldConfig.timelineEvents[idx + 2];
              
              if (nextEvt) {
                  details += `\n     ----------------------`;
                  details += `\n     • SỰ KIỆN TIẾP THEO SẮP TỚI (Mốc Số ${idx + 2}): "${nextEvt.eventName}"\n       - Mô tả: ${nextEvt.description}\n       - Địa điểm: ${nextEvt.location || 'Chưa rõ'}`;
              }
              if (nextNextEvt) {
                  details += `\n     • SỰ KIỆN TIẾP THEO NỮA (Mốc Số ${idx + 3}): "${nextNextEvt.eventName}"\n       - Mô tả: ${nextNextEvt.description}\n       - Địa điểm: ${nextNextEvt.location || 'Chưa rõ'}`;
                  details += `\n     ----------------------`;
              }

              if (evt.requiredAction) {
                 details += `\n     • [RẤT QUAN TRỌNG - MỚM MỒI HỮU CƠ]:
     <mom_moi_cot_truyen_huu_co>
     Bạn đóng vai trò Người Dẫn Chuyện, KHÔNG ĐƯỢC để người chơi tự bơi hay đi lạc. Hãy thiết lập sẵn các tình huống khách quan, manh mối thực tế, sự xuất hiện bất ngờ của NPC liên quan trong nguyên tác, hoặc địa điểm trong nguyên tác để đẩy MC đi tới địa điểm sự kiện, chạm trán nhân vật nguyên tác và tiến sâu vào mạch truyện chính.
     - CẤM TUYỆT ĐỐI việc cấy ý nghĩ cốt truyện thẳng vào đầu MC mà không có nguồn gốc rõ ràng (như MC đột nhiên nghĩ "mình phải đi làm việc X").
     - TẠO thêm 1-2 [CHOICE: "..."] liên quan trực tiếp đến nhiệm vụ này.
     - Nhiệm vụ của bạn là hướng bối cảnh để thử thách/người chơi thực hiện mục tiêu: "${evt.requiredAction}". ${isSuperManualMode ? '' : 'CẤM TUYỆT ĐỐI việc tự ý đưa vào các tag hệ thống dạng [TAG_NAME: ...].'} Khi sự kiện hoàn tất, đề xuất hoàn thành vào <update_data>.
     </mom_moi_cot_truyen_huu_co>`;
              } else {
                 details += `\n     • [RẤT QUAN TRỌNG - MỚM MỒI HỮU CƠ]:
     <mom_moi_cot_truyen_huu_co>
     Bạn đóng vai trò Người Dẫn Chuyện. KHÔNG ĐƯỢC để người chơi tự bơi. Hãy chủ động thả "thính" bằng các biến cố nhỏ, tin đồn lan truyền từ NPC, hoặc sự xuất hiện bất ngờ của NPC trong nguyên tác, địa điểm trong nguyên tác để dẫn dắt MC chạm trán nhân vật nguyên tác và rơi vào tâm điểm của diễn biến chính ("${evt.eventName}").
     - CẤM TUYỆT ĐỐI việc tự ý cấy ý nghĩ cốt truyện thẳng vào đầu MC không rõ nguồn gốc. Mọi plot hook phải thông qua các sự kiện hoặc tình tiết khách quan để MC tự cảm nhận tự nhiên.
     - TẠO thêm 1-2 [CHOICE: "..."] hướng người chơi vào sự kiện này. ${isSuperManualMode ? '' : 'CẤM TUYỆT ĐỐI việc tự ý đưa vào các tag hệ thống dạng [TAG_NAME: ...].'}
     </mom_moi_cot_truyen_huu_co>`;
              }
              const cluePrompt = generateTimelineCluePrompt(playerStats.turn, evt, nextEvt);
      details += `\n\n${cluePrompt}`;
      return details;
            })() 
          : 'Không có',
    },
    // Include all known NPCs for the storyteller
    contextNpcs: (() => {
      const rawAllNpcs = [
        ...discoveredNPCs,
        ...(wives || []),
        ...(slaves || []),
        ...(prisoners || []),
      ].filter((npc) => npc.id !== master?.id);

      const totalNpcs = rawAllNpcs.length;
      const isLargePool = totalNpcs >= 100;

      return rawAllNpcs.map(npc => {
        const hp = npc.stats?.sinhLuc ?? (npc as any).hp ?? 100;
        const activeEffects = npc.stats?.activeStatusEffects?.map((eff: any) => eff.name).join(", ") || "Không có";
        const unmentionedTurns = npc.reunionCounter ?? 0;
        const isCompressed = isLargePool && unmentionedTurns >= 20;

        if (isCompressed) {
          return {
            id: npc.id,
            name: npc.name,
            gender: npc.gender || "Không rõ",
            realm: npc.realm || "Phàm nhân",
            isCompressed: true
          };
        }

        return {
          id: npc.id,
          name: npc.name,
          gender: npc.gender || "Không rõ",
          status: npc.status || (hp > 0 ? "Sống" : "Chết"),
          hp: hp,
          realm: npc.realm || "Phàm nhân",
          spiritualRoot: npc.spiritualRoot || "Không có",
          physique: npc.specialPhysique || "Không có",
          affinity: npc.affinity || 0,
          personality: (npc.personalityTraits || []).join(", ") || (npc as any).personality || "Bình thường",
          position: knowledgeBase.discoveredLocations.find(l => l.id === npc.locationId)?.name || "Không rõ",
          activeEffects: activeEffects,
          appearance: (npc.avatarAppearance && npc.avatarAppearance.trim() !== '') ? npc.avatarAppearance : (npc.appearance || "Không có thông tin trang phục/bề ngoài"),
          appearanceTurnsRemaining: npc.avatarAppearance ? undefined : npc.appearanceDuration,
          isCompressed: false
        };
      });
    })(),
  };

  // --- 2. [MEMORY] CONSTRUCTION ---
  const npcsListForMemories = [
    ...(discoveredNPCs || []),
    ...(wives || []),
    ...(slaves || []),
    ...(prisoners || []),
  ];

  const playerMemoriesStr = formatCoreMemoriesForContext(
    coreMemories.filter((m) => m.entityId === "player"),
    "player",
  );

  const npcEntityIds = Array.from(
    new Set(
      coreMemories
        .filter((m) => m.entityId && m.entityId !== "player")
        .map((m) => m.entityId)
    )
  );

  const npcMemoriesStr = npcEntityIds
    .map((entityId) => {
      const npc = npcsListForMemories.find((n) => n.id === entityId);
      if (!npc) return "";
      return formatCoreMemoriesForContext(
        coreMemories.filter((m) => m.entityId === entityId),
        npc.name
      );
    })
    .filter(Boolean)
    .join("\n\n");

  const memorySection = `
<core_memories_13>
${playerMemoriesStr}
${npcMemoriesStr ? `\n\n${npcMemoriesStr}` : ""}
</core_memories_13>

<past_summaries_14>
${previousPageSummaries.length > 0 ? previousPageSummaries.join("\n") : "Chưa có tóm tắt."}
${formatMilestones(milestones)}
</past_summaries_14>

<retrieved_context_16>
${cleanRetrievedContext(retrievedContext)}
</retrieved_context_16>
`;

  // --- 3. [CURRENT CONTEXT] CONSTRUCTION ---
  // If currentTurnLog is populated (Phase 2 feature), use it. Otherwise fallback to the string log (Phase 1 legacy support).
  const currentContextContent =
    currentTurnLog && currentTurnLog.length > 0
      ? formatCurrentTurnLog(currentTurnLog)
      : currentPageMessagesLog; // Fallback for transition

const currentContextSection = `
(Dưới đây là tóm tắt bối cảnh các lượt trước. TUYỆT ĐỐI KHÔNG chép lại hay lặp lại các phần này trong câu trả lời thiết kế của bạn. Hãy CHỈ tập trung xử lý Input mới nhất và viết CHUYỂN TIẾP diễn biến cốt truyện.)
<gioi_han_nhan_thuc_mc>
  <luat_vung_toi_hieu_biet_+gioi_han_nhan_thuc_mc>
================
Nội dung trong các thẻ XML khác ngoài <content> (như diễn biến ngầm, động thái thế giới, bí mật bối cảnh, tracking thực thể) HOÀN TOÀN là VÙNG TỐI HIỂU BIẾT (Fog of War) của Nhân Vật Chính (MC). 
MC TUYỆT ĐỐI KHÔNG BIẾT các thông tin này nếu chưa trực tiếp mắt thấy tai nghe trong mạch truyện. 
Các thẻ này CHỈ phục vụ cho AI Người Kể Chuyện nắm bắt bối cảnh để dẫn dắt, TUYỆT ĐỐI CẤM cho MC trở nên TOÀN TRI hoặc hành xử dựa trên tri thức trong các thẻ XML ngầm đó.
================
  </luat_vung_toi_hieu_biet_+gioi_han_nhan_thuc_mc>
</gioi_han_nhan_thuc_mc>
${currentContextContent}
`;

  const lengthInstruction = (
    length: ResponseLength,
    min: number,
    max: number,
  ): string => {
    const baseInstruction = `Yêu cầu về độ dài: Bạn PHẢI viết trong khoảng từ ${min} đến ${max} từ (words). Đây là quy tắc BẮT BUỘC (NGOẠI TRỪ TRƯỜNG HỢP KÍCH HOẠT COMBAT_CLIFFHANGER_PROTOCOL, khi đó bạn BẮT BUỘC bỏ qua luật độ dài này và có thể dừng sớm bất cứ lúc nào khi hành động tấn công bắt đầu, kết thúc bằng dấu "...").`;

    switch (length) {
      case "dialogue":
        return `${baseInstruction} CHẾ ĐỘ ĐỐI THOẠI (500-600 TỪ): Bạn PHẢI tập trung cao độ vào việc tạo ra các đoạn hội thoại, đối đáp sinh động, kịch tính giữa MC và các NPC xuất hiện trong cảnh. Tối thiểu 60-70% dung lượng lời kể là lời thoại trực tiếp, phản ứng ngữ điệu, cử chỉ giao tiếp. Giảm tải tối đa việc miêu tả phong cảnh hay bối cảnh ngoại cảnh dàn trải.`;
      case "extra-short":
        return `${baseInstruction}${max === 500 ? " Viết cực kỳ ngắn gọn, súc tích (khoảng 1-2 đoạn văn ngắn)." : ""}`;
      case "short":
        return `${baseInstruction} Viết ngắn gọn (khoảng 3-4 đoạn văn).`;
      case "medium":
        return `${baseInstruction} Viết with độ dài vừa phải, chi tiết (khoảng 5-7 đoạn văn).`;
      case "long":
        return `${baseInstruction} Viết cực kỳ chi tiết, dài dòng, miêu tả sâu sắc bối cảnh và tâm lý (khoảng 10-15 đoạn văn hoặc hơn).`;
      case "default":
      default:
        return `${baseInstruction} Viết with độ dài tiêu chuẩn, đảm bảo đủ ý và hấp dẫn.`;
    }
  };

  const isSectionEnabled = (sectionName: string): boolean => {
    if (!exclusiveMode) return true;
    if (!exclusiveSections) return false;
    return !!exclusiveSections[sectionName];
  };

  const systemPromptParts: string[] = [];

  if (isSectionEnabled('nhanCach')) {
    systemPromptParts.push(`
<Nhan_cach_No.01>
===÷===
Bạn có hai nhân cách song hành với ngôi kể: nhà tiểu thuyết đại tài và Tác Giả 18+.
- **Nhà tiểu thuyết đại tài (Mặc định):** Tập trung vào viết văn chương cho cốt truyện, phiêu lưu, giải đố, phá án, tả cảnh quan sắc nét, ..... Với trách nhiệm tôn trọng hoàn toàn các logic nguyên tác thế giới đang viết; biết tôn trọng ý định người dùng không mô tả cảnh chiến đấu của MC mà kích hoạt [BEGIN_COMBAT]
- **Tác Giả 18+ (Kích hoạt):** Khi người chơi chọn hành động 18+, hãy mô tả cảnh đó một cách chi tiết, trần trụi, không né tránh.
Bạn PHẢI tự chuyển đổi giữa hai vai trò này dựa trên hành động của người chơi.
Thể loại: ${effectiveGenre}.
Phong cách: ${nsfwMode ? `18+ (${currentNsfwStyle}, ${currentViolenceLevel}, ${currentStoryTone})` : "Bình thường, phù hợp mọi lứa tuổi"}.
===÷===
</Nhan_cach_No.01>`);
  }

  if (isSectionEnabled('gocNhin')) {
    systemPromptParts.push(`
<Goc_nhin_No.02>
===÷===
${perspectiveInstruction(worldConfig, perspectiveMode)}
===÷===
</Goc_nhin_No.02>`);
  }

  if (isSectionEnabled('doDai')) {
    systemPromptParts.push(`
<Do_dai_No.03>
===÷===
${lengthInstruction(responseLength, narrationMin, narrationMax)}
===÷===
</Do_dai_No.03>`);
  }

  if (isSectionEnabled('vanPhong')) {
    systemPromptParts.push(`
<Van_phong_ke_chuyen_No.04>
===÷===
${LOI_NHAC_AN}
===÷===
</Van_phong_ke_chuyen_No.04>`);
  }

  if (isSectionEnabled('boTuVung')) {
    systemPromptParts.push(`
<Quy_tac_bo_tu_vung_No.05>
===÷===
${LOI_NHAC_AN_2}
===÷===
</Quy_tac_bo_tu_vung_No.05>`);
  }

  if (isSectionEnabled('truyenNgucTu')) {
    systemPromptParts.push(`
<Luat_truyen_nguc_tu_No.06>
===÷===
${NARRATIVE_PRISON_RULES}
===÷===
</Luat_truyen_nguc_tu_No.06>`);
  }

  if (isSectionEnabled('quyTacHeThong')) {
    systemPromptParts.push(`
<Quy_tac_he_thong_No.07>
===÷===
${systemRules}
===÷===
</Quy_tac_he_thong_No.07>`);
  }

  if (isSectionEnabled('chiThiMC')) {
    const currentMcName = worldConfig?.playerName || "Người chơi";
    const deceasedMcs = (worldConfig?.deceasedProtagonists || knowledgeBase.deceasedProtagonists || []).join(', ');

    systemPromptParts.push(`
<Chi_thi_MC_No.08>
===÷===
<luat_dinh_danh_mc_hien_tai_+chi_thi_mc>
================
- NHÂN VẬT CHÍNH DUY NHẤT HIỆN TẠI (MC DUY NHẤT): "${currentMcName}".
- DANH SÁCH NHÂN VẬT CHÍNH TIỀN NHIỆM ĐÃ CHẾT: [${deceasedMcs || 'Không có'}].
- NGUYÊN TẮC BẤT DI BẤT DỊCH (CHỐNG QUÁN TÍNH NGỮ CẢNH):
  + Nếu trong các lượt trước có sự kiện đổi góc nhìn / luân hồi chuyển kiếp, MC cũ đã CHẾT.
  + CẤM TUYỆT ĐỐI miêu tả các MC tiền nhiệm đã chết (${deceasedMcs || 'Không có'}) còn sống hay đóng vai nhân vật chính.
  + Mọi góc nhìn (POV), hành vi, câu thoại và diễn biến nội tâm của người chơi PHẢI 100% thuộc về ${currentMcName}.
================
</luat_dinh_danh_mc_hien_tai_+chi_thi_mc>

<cam_mc_suy_nghi_co_che_he_thong>
- **CHỈ THỊ TỐI CAO VỀ MC (Ý CHÍ RIÊNG - CẤM TUYỆT ĐỐI CƠ CHẾ HỆ THỐNG):** Diễn đạt nội tâm MC một cách tự nhiên dựa trên "personality", "backstory", "goal".
- **CẤM TRUYỆN HỆ THỐNG HÓA:** MC tuyệt đối KHÔNG ĐƯỢC PHÉP suy nghĩ, lo âu hay trăn trở về bất kỳ cơ chế cuộc chơi hay thuộc tính nào (như "tăng chỉ số", "roll xúc xắc", "làm nhiệm vụ", "vượt ải", "độ thiện cảm", "lựa chọn hành động", "lượt chơi").
- MC phải hành xử như một sinh linh bản địa có nhân sinh quan chân thật. Mọi plot hook phải đến từ các sự kiện khách quan bên ngoài (mớm mồi hữu cơ), không được "cấy" ý nghĩ cốt truyện vào đầu MC một cách vô căn cứ.
</cam_mc_suy_nghi_co_che_he_thong>
===÷===
</Chi_thi_MC_No.08>`);
  }

  if (isSectionEnabled('docTrangThai')) {
    systemPromptParts.push(`
<Doc_trang_thai_No.09>
===÷===
- **HƯỚNG DẪN ĐỌC TRẠNG THÁI & NHIỆM VỤ:** Để tăng tính nhập vai sâu sắc, bạn PHẢI đọc và phản ánh chân thực trạng thái của MC qua \`player.statusEffects\` (đọc tên, loại buff/debuff và phần mô tả \`description\`, cùng số lượt hiệu lực \`durationTurns\` còn lại) và danh sách nhiệm vụ \`player.quests\`:
  + Với Trạng Thái Tác Động: Nếu MC đang chịu Debuff trừng phạt từ nhiệm vụ thất bại (ví dụ: bị thương nặng, giảm công lực...), hãy miêu tả cụ thể cảm giác suy yếu, kinh mạch bất ổn, hoặc khó khăn trong cử chỉ. Nếu MC đang hưởng Buff lành tính, hãy miêu tả khí chất dũng mãnh, tinh thần phấn chấn hoặc vận khí hanh thông của nhân vật.
  <mom_moi_cot_truyen_huu_co>
  + Với Nhiệm Vụ Đang Thực Hiện (NHIỆM VỤ CỐT TRUYỆN/CHÍNH TUYẾN - MỚM MỒI HỮU CƠ): Bạn PHẢI tăng cường tần suất "mớm mồi" và dẫn dắt liên tục trong MỌI lượt kể. Hãy đọc kỹ \`title\`, \`description\`, \`objectives\`, \`rewardText\`, \`punishmentText\`.
    - Bất kể người chơi làm gì, hãy luôn đan cài một cách khéo léo nhưng rõ rệt các manh mối, tin đồn, sự xuất hiện của NPC liên quan trong nguyên tác, hoặc các địa danh/biến động bối cảnh thực tế trực tiếp dẫn dụ, thúc giúp và tạo áp lực bắt buộc MC phải hành động hướng tới mục tiêu nhiệm vụ cốt truyện.
    - CẤM TUYỆT ĐỐI việc tự ý cấy ý nghĩ về cốt truyện hay nhiệm vụ thẳng tuột vào đầu MC một cách vô cớ (như MC tự dưng nghĩ "mình phải đi tìm Hàn Lập để đi tiếp cốt truyện"). Mọi plot hook phải thông qua các sự kiện, tin đồn hoặc tình tiết khách quan xung quanh để MC tự tiếp nhận tự nhiên.
    - **QUY TẮC LOCATION_CHANGE (SYNC):** Việc di chuyển vị trí chỉ có hiệu lực khi bạn xuất thẻ [LOCATION_CHANGE: name="..."] bên trong thẻ update_data. AI Thiên Đạo Sync CHỈ trích xuất tag này từ update_data của lượt hiện tại.
    - **QUY TẮC XÁC NHẬN HOÀN THÀNH (SYNC):** Khi lời kể đã đáp ứng xong mục tiêu cốt lõi của activeQuest hoặc originalTimeline, PHẢI xuất yêu cầu xác nhận hoàn thành (<quest_completed> / <event_complete>) kèm lý do vào <update_data> để Tag Extractor chốt hoàn thành.
  </mom_moi_cot_truyen_huu_co>
===÷===
</Doc_trang_thai_No.09>`);
  }

  const systemPrompt = systemPromptParts.join('\n');

  const mechanicPlotChoiceInstruction = `- **[BẮT BUỘC]:** Ở MỌI lượt chơi, bạn PHẢI tạo từ 1 đến 2 gợi ý hành động \`[CHOICE: "..." ]\` liên quan trực tiếp đến việc dấn thân, tìm hiểu, mớm mồi hoặc thúc đẩy nhiệm vụ cốt truyện đang diễn ra (như \`activeQuest\` hoặc sự kiện \`originalTimeline\` trong [WORLD STATE]). Hãy viết các lựa chọn này một cách khéo léo, tự nhiên, nhằm thôi thúc người chơi thực hiện nhiệm vụ cốt truyện thay vì bị loãng nội dung.`;

  const finalSystemPrompt = exclusiveMode && systemPrompt === ''
    ? `
<system_prompt_10>
[HỆ THỐNG GỐC ĐÃ ĐƯỢC TẮT - CHỈ SỬ DỤNG LUẬT TỪ FILE PHỤ TÙNG]
</system_prompt_10>` 
    : `
<system_prompt_10>
----
${systemPrompt}
----
</system_prompt_10>`;

  const isPostCombat = isPostCombatAction(playerActionText);
  const combatProtocolBlock = (worldConfig?.isCultivationEnabled && !isPostCombat) ? `\n\n${COMBAT_CLIFFHANGER_PROTOCOL}` : "";
  const postCombatBlock = isPostCombat ? `
<quy_tac_hau_qua_chien_dau>
   <luat_ket_thuc_giao_tranh_+quy_tac_hau_qua_chien_dau>
================
1. ĐÂY LÀ PHÂN CẢNH HẬU QUẢ CHIẾN ĐẤU: Trận đấu VỪA KẾT THÚC HOÀN TOÀN.
2. TUYỆT ĐỐI CẤM KÍCH HOẠT CHIẾN ĐẤU MỚI: Không được tạo thêm tình huống giao tranh, CẤM xuất thẻ [BEGIN_COMBAT] và CẤM COMBAT_CLIFFHANGER_PROTOCOL can thiệp. Kẻ địch đã bị hạ gục/bắt giữ làm tù binh/bỏ chạy theo đúng kết quả đã cung cấp.
3. KHÔNG trừ thêm HP cơ học của bất kỳ nhân vật nào trong lượt này.
4. Tập trung 100% vào việc miêu tả bối cảnh hậu chiến trường, cảm xúc, vết thương hoặc việc bắt giữ/thu dọn chiến lợi phẩm và phản ứng tự nhiên của nhân vật.
================
   </luat_ket_thuc_giao_tranh_+quy_tac_hau_qua_chien_dau>
</quy_tac_hau_qua_chien_dau>` : "";
  const karmaPromptBlock = SacredTimelineService.buildKarmaPromptXML(knowledgeBase);
  const userPromptsBlock = formatUserPromptsBlock(knowledgeBase.userPrompts);

  return `
${HARD_IMMUTABLE_PROMPT_BLOCK}
${userPromptsBlock}
${finalSystemPrompt}
${combatProtocolBlock}
${postCombatBlock}
${karmaPromptBlock}

<world_state_11>
----
${convertWorldStateToXML(worldStateJSON)}
----
</world_state_11>

<memory_context_12>
----
${memorySection}
----
</memory_context_12>

<current_context_17>
----
${currentContextSection}
----
</current_context_17>

<instruction_18>
----
Dựa trên hành động của người chơi và bối cảnh trên, hãy viết tiếp diễn biến câu chuyện.

- **[QUY TẮC NGẮT MẠCH TRUYỆN - QUAN TRỌNG]:** Nếu hành động của người chơi (Player Action) bắt đầu và kết thúc bằng **&&**, bạn PHẢI dừng toàn bộ việc kể chuyện. Hãy thực hiện theo hướng dẫn trong thẻ **Giaotiepnguoichoi** của **LOI_NHAC_AN**.

- **TUYỆT ĐỐI CẤM LẶP LẠI HẬU QUẢ CHIẾN ĐẤU:** Kết quả và hậu quả trận chiến đã được mô tả hoàn chỉnh ở lượt trước và đã được giải quyết xong. Ở lượt này, người chơi đã đưa ra hành động mới (ví dụ: đi dạo, tra hỏi, rời đi, v.v.). Bạn TUYỆT ĐỐI KHÔNG được lặp lại, tóm tắt, hay viết lại bất kỳ tiêu đề nào có dạng "*Kết quả trận chiến:*" hay "*Hậu quả trận chiến:*" một lần nữa, và không mô tả lại diễn biến trận chiến đã qua. Hãy tập trung 100% vào việc xử lý hành động mới nhất của người chơi để phát triển cốt truyện tiếp theo một cách tự nhiên.
1.  **Xử lý Logic:** Tính toán tác động của hành động lên thế giới và chỉ số.
2.  **Viết Lời Kể:** Mô tả sinh động, hấp dẫn, tuân thủ giọng văn đã chọn.
3.  **Tạo Lựa Choice:** Đưa ra đúng 6-8 lựa chọn tiếp theo cho người chơi bằng tag [CHOICE] trong thẻ \`<choice>...</choice>\`. Phản ứng đúng tầm nhìn giác quan của MC, mớm mồi sự kiện timeline, đúng sắc thái Dục vọng (Thống trị, Đồng điệu, Phục tùng, Trêu ghẹo) và đan xen 1-3 hành vi phi lý bất ngờ. **CẤM SPOILER:** Tuyệt đối không đưa các nhãn cơ chế hệ thống như \`[Cốt Truyện]\`, \`[Nhiệm Vụ]\` vào nội dung lựa chọn.
    ${mechanicPlotChoiceInstruction}
${buildUpdateDataInstruction(isSuperManualMode, worldConfig?.isCultivationEnabled !== false)}
----
</instruction_18>
`;
};
