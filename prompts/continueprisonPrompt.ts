import {
  KnowledgeBase,
  PlayerActionInputType,
  ResponseLength,
  GameMessage,
  DIALOGUE_MARKER,
  Master,
  CoreMemory,
  WorldSettings,
} from "../types";
import {
  VIETNAMESE,
  CUSTOM_GENRE_VALUE,
  DEFAULT_NSFW_DESCRIPTION_STYLE,
  DEFAULT_VIOLENCE_LEVEL,
  DEFAULT_STORY_TONE,
  WEAPON_TYPES_FOR_VO_Y,
  TU_CHAT_TIERS,
  ALL_FACTION_ALIGNMENTS,
  SUB_REALM_NAMES,
} from "../constants";
import * as GameTemplates from "../templates";
import { prisonContinuePromptSystemRules } from "../constants/systemRulesPrison";
import { COMBAT_CLIFFHANGER_PROTOCOL } from "./combatCliffhangerProtocol";
import { HARD_IMMUTABLE_PROMPT_BLOCK } from "./hardSystemRules";
import { formatUserPromptsBlock } from "./userPromptsHelper";
import { LOI_NHAC_AN } from "./loinhacprompt";
import { buildUpdateDataInstruction } from "./updateDataPromptHelper";
import { NARRATIVE_PRISON_RULES } from "./narrativePrisonRules";
import { getRecentNpcsFullInfo } from "../utils/npcHelper";

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
  const memoriesString = memories
    .sort((a, b) => b.strength - a.strength) // Sort by strength descending
    .map((m) => `- (Lượt ${m.turn}, Độ mạnh: ${m.strength}/100) ${m.text}`)
    .join("\n");
  return `${header}\n${memoriesString}`;
};

const formatCharactersInScene = (characters: any[]): string => {
  if (characters.length === 0) return "Không có nhân vật nào khác ở đây.";

  return characters
    .map((char) => {
      const type =
        char.entityType === "wife"
          ? "Đạo Lữ"
          : char.entityType === "slave"
            ? "Nô Lệ"
            : char.entityType === "prisoner"
              ? "Tù Nhân"
              : "NPC";
      let info = `Tên: ${char.name} (${type})\n`;
      info += `   - Giới tính: ${char.gender || "Không rõ"}, Trạng thái: ${char.status || "Không rõ"}, HP: ${char.stats?.sinhLuc ?? char.hp ?? "?"}, Cảnh giới: ${char.realm || "?"}\n`;
      info += `   - Linh căn: ${char.spiritualRoot || "Không có"}, Thể chất: ${char.specialPhysique || "Không có"}\n`;
      info += `   - Thiện cảm: ${char.affinity}, Vị trí: ${char.currentLocationName || "Không rõ"}\n`;
      info += `   - Tính cách: ${(char.personalityTraits || []).join(", ") || char.personality || "Không rõ"}\n`;
      info += `   - Mô tả hiện tại: ${char.description || "Không có"}\n`;
      if (char.appearance) {
        info += `   - Bề ngoài/Y phục hiện tại: ${char.appearance} (Thời hạn còn lại: ${char.appearanceDuration ?? 5} lượt)\n`;
      }
      if (char.avatarAppearancePendingTransition) {
        info += `   - LƯU Ý: Nhân vật vừa mới thay đổi diện mạo/trang phục. AI BẮT BUỘC phải lồng ghép hành động nhân vật đi thay đồ, chỉnh trang y phục để khoác lên bộ đồ mới đúng như mô tả trong mục "Bề ngoài/Y phục hiện tại" ngay trong lượt này.\n`;
      }

      // --- "SECRETARY" FEATURE: Briefing on History ---
      if (char.history && char.history.length > 0) {
        const recentHistory = char.history.slice(-2);
        info += `   - Ghi chú thư ký (Lịch sử gần đây): ${recentHistory.join(" | ")}\n`;
      }
      // ------------------------------------------------

      let relationship = "Không rõ";
      if ("relationshipToPlayer" in char) {
        relationship = char.relationshipToPlayer || "Không rõ";
      } else if (char.entityType === "wife") {
        relationship = "Đạo Lữ";
      } else if (char.entityType === "slave") {
        relationship = "Nô Lệ";
      } else if (char.entityType === "prisoner") {
        relationship = "Tù Nhân";
      }

      info += `   - Quan hệ với người chơi: ${relationship} (Thiện cảm: ${char.affinity})\n`;
      if (char.stats) {
        info += `   - Chỉ số: HP ${char.stats.sinhLuc}/${char.stats.maxSinhLuc}, ATK ${char.stats.sucTanCong}, MP ${char.stats.linhLuc}/${char.stats.maxLinhLuc}\n`;
      }
      return info;
    })
    .join("\n");
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

// Format short-term context from the currentTurnLog array (Duplicate from continuePrompt.ts for modularity)
// Format short-term context from the currentTurnLog array (Duplicate from continuePrompt.ts for modularity)
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

const convertPrisonWorldStateToXML = (coreContext: any, contextNpcs: any[]): string => {
  const pInfo = coreContext.playerInfo;
  const pAssets = coreContext.playerAssets;
  const master = coreContext.masterInfo;
  const world = coreContext.worldState;

  let xml = "";

  // 1. Player State
  xml += "  <player_state_11_1>\n  ----\n";
  xml += `    <name>${pInfo.name || "Không rõ"}</name>\n`;
  xml += `    <gender>${pInfo.gender || "Không rõ"}</gender>\n`;
  xml += `    <race>${pInfo.race || "Không rõ"}</race>\n`;
  xml += `    <personality>${pInfo.personality || "Không có"}</personality>\n`;
  xml += `    <backstory>${pInfo.backstory || "Không có"}</backstory>\n`;
  xml += `    <goal>${pInfo.goal || "Không có"}</goal>\n`;
  
  if (pInfo.status) {
    xml += "    <status>\n    ----\n";
    xml += `      <hp>${pInfo.status.sinhLuc}/${pInfo.status.maxSinhLuc}</hp>\n`;
    xml += `      <mp>${pInfo.status.linhLuc}/${pInfo.status.maxLinhLuc}</mp>\n`;
    xml += `      <atk>${pInfo.status.sucTanCong}</atk>\n`;
    xml += `      <realm>${pInfo.status.realm || "Không rõ"}</realm>\n`;
    xml += `      <gold>${pInfo.status.currency}</gold>\n`;
    
    if (pInfo.status.playerSpecialStatus) {
      const spec = pInfo.status.playerSpecialStatus;
      xml += "      <special_prison_status>\n      ----\n";
      xml += `        <role_type>${spec.type === "prisoner" ? "Tù Nhân" : "Nô Lệ"}</role_type>\n`;
      xml += `        <owner_name>${spec.ownerName || "Không rõ"}</owner_name>\n`;
      xml += `        <willpower>${spec.willpower}</willpower>\n`;
      xml += `        <resistance>${spec.resistance}</resistance>\n`;
      xml += `        <obedience>${spec.obedience}</obedience>\n`;
      xml += `        <fear>${spec.fear ?? 0}</fear>\n`;
      xml += `        <trust>${spec.trust ?? 0}</trust>\n`;
      xml += "      ----\n      </special_prison_status>\n";
    }

    if (pInfo.status.activeStatusEffects && pInfo.status.activeStatusEffects.length > 0) {
      xml += "      <status_effects>\n      ----\n";
      pInfo.status.activeStatusEffects.forEach((eff: any, idx: number) => {
        xml += `        <effect_${idx + 1} name="${eff.name}" type="${eff.type}" duration="${eff.durationTurns}">\n        ----\n`;
        xml += `          <description>${eff.description}</description>\n`;
        xml += `        ----\n        </effect_${idx + 1}>\n`;
      });
      xml += "      ----\n      </status_effects>\n";
    }
    xml += "    ----\n    </status>\n";
  }

  if (pAssets) {
    if (pAssets.inventory && pAssets.inventory.length > 0) {
      xml += "    <inventory>\n    ----\n";
      pAssets.inventory.forEach((item: any, idx: number) => {
        xml += `      <item_${idx + 1} name="${item.name}">\n      ----\n      ${item.description || "Không có mô tả"}\n      ----\n      </item_${idx + 1}>\n`;
      });
      xml += "    ----\n    </inventory>\n";
    } else {
      xml += "    <inventory>\n    ----\n    Rỗng\n    ----\n    </inventory>\n";
    }

    if (pAssets.equippedItems && pAssets.equippedItems.length > 0) {
      xml += "    <equipped_items>\n    ----\n";
      pAssets.equippedItems.forEach((item: any, idx: number) => {
        xml += `      <item_${idx + 1} name="${item.name}" slot="${item.slot || "Không rõ"}">\n      ----\n      ${item.description || "Không có mô tả"}\n      ----\n      </item_${idx + 1}>\n`;
      });
      xml += "    ----\n    </equipped_items>\n";
    }

    if (pAssets.skills && pAssets.skills.length > 0) {
      xml += "    <skills>\n    ----\n";
      pAssets.skills.forEach((skill: any, idx: number) => {
        xml += `      <skill_${idx + 1} name="${skill.name}" type="${skill.type || "Chủ động"}">\n      ----\n`;
        xml += `        <description>${skill.description || "Không có mô tả"}</description>\n`;
        xml += `      ----\n      </skill_${idx + 1}>\n`;
      });
      xml += "    ----\n    </skills>\n";
    }
  }
  xml += "  ----\n  </player_state_11_1>\n\n";

  // 2. Master Info (Chủ nhân)
  if (master) {
    xml += `  <master_state_11_2 id="${master.id}">\n  ----\n`;
    xml += `    <name>${master.name}</name>\n`;
    xml += `    <realm>${master.realm || "Không rõ"}</realm>\n`;
    xml += `    <description>${master.description || "Không có"}</description>\n`;
    xml += `    <mood>${master.mood || "Bình Thường"}</mood>\n`;
    xml += `    <favor>${master.favor ?? 0}</favor>\n`;
    xml += `    <current_goal>${master.currentGoal || "Không có"}</current_goal>\n`;
    
    if (master.needs) {
      xml += "    <needs>\n    ----\n";
      xml += `      <desire>${master.needs["Dục Vọng"] ?? 0}</desire>\n`;
      xml += `      <ambition>${master.needs["Tham Vọng"] ?? 0}</ambition>\n`;
      xml += `      <safety>${master.needs["An Toàn"] ?? 0}</safety>\n`;
      xml += `      <entertainment>${master.needs["Giải Trí"] ?? 0}</entertainment>\n`;
      xml += "    ----\n    </needs>\n";
    }

    xml += `    <personality>${(master.personalityTraits || []).join(", ") || master.personality || "Bình thường"}</personality>\n`;
    xml += `    <bề_ngoài>${master.avatarAppearance || master.appearance || "Không có thông tin"}</bề_ngoài>\n`;
    if (master.avatarAppearancePendingTransition) {
      xml += `    <avatar_appearance_pending_transition>true</avatar_appearance_pending_transition>\n`;
    }
    xml += "  ----\n  </master_state_11_2>\n\n";
  } else {
    xml += "  <master_state_11_2>\n  ----\n  Không có thông tin chủ nhân\n  ----\n  </master_state_11_2>\n\n";
  }

  // 3. World State Metadata
  if (world) {
    xml += "  <world_metadata_11_3>\n  ----\n";
    xml += `    <theme>${world.theme || "Không rõ"}</theme>\n`;
    if (world.worldDate) {
      xml += `    <date>${world.worldDate.day}/${world.worldDate.month}/${world.worldDate.year} (${world.worldDate.timeOfDay})</date>\n`;
    }
    if (world.currentLocation) {
      xml += `    <location id="${world.currentLocation.id}">${world.currentLocation.name}</location>\n`;
    }
    xml += `    <realm_system>${world.realmProgressionSystemForPlayerRace || "Không rõ"}</realm_system>\n`;
    xml += "  ----\n  </world_metadata_11_3>\n\n";
  }

  // 4. Context NPCs (Đánh số và ghi rõ tên)
  xml += "  <context_npcs_11_4>\n  ----\n";
  if (contextNpcs && contextNpcs.length > 0) {
    contextNpcs.forEach((npc: any, idx: number) => {
      if (npc.isCompressed) {
        // Cơ chế nén: Khi >= 100 NPC và không được nhắc >= 20 lượt, chỉ truyền tên, giới tính, tu vi
        xml += `    <npc_11_4_${idx + 1} name="${npc.name}" id="${npc.id}" realm="${npc.realm || "Phàm nhân"}">\n    ----\n`;
        xml += `      <gender>${npc.gender || "Không rõ"}</gender>\n`;
        xml += `    ----\n    </npc_11_4_${idx + 1}>\n`;
      } else {
        xml += `    <npc_11_4_${idx + 1} name="${npc.name}" id="${npc.id}" realm="${npc.realm || "Phàm nhân"}">\n    ----\n`;
        xml += `      <gender>${npc.gender || "Không rõ"}</gender>\n`;
        xml += `      <status>${npc.status}</status>\n`;
        xml += `      <hp>${npc.stats?.sinhLuc ?? npc.hp ?? 100}</hp>\n`;
        xml += `      <spiritual_root>${npc.spiritualRoot || "Không có"}</spiritual_root>\n`;
        xml += `      <physique>${npc.specialPhysique || "Không có"}</physique>\n`;
        xml += `      <affinity>${npc.affinity ?? 0}</affinity>\n`;
        xml += `      <personality>${(npc.personalityTraits || []).join(", ") || npc.personality || "Bình thường"}</personality>\n`;
        xml += `      <position>${npc.currentLocationName || "Không rõ"}</position>\n`;
        xml += `      <bề_ngoài>${npc.avatarAppearance || npc.appearance || "Không có thông tin"}</bề_ngoài>\n`;
        if (npc.avatarAppearancePendingTransition) {
          xml += `      <avatar_appearance_pending_transition>true</avatar_appearance_pending_transition>\n`;
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

export const generateContinuePrisonPrompt = (
  knowledgeBase: KnowledgeBase,
  playerActionText: string,
  inputType: PlayerActionInputType,
  responseLength: ResponseLength,
  currentPageMessagesLog: string,
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
    master,
    userPrompts,
    coreMemories,
    discoveredNPCs,
    currentLocationId,
    wives,
    slaves,
    prisoners,
    currentTurnLog,
  } = knowledgeBase;
  const currentLocation = knowledgeBase.discoveredLocations.find(
    (l) => l.id === currentLocationId,
  );
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
  const currentDifficultyName = worldConfig?.difficulty || "Thường";

  const specialStatus = playerStats.playerSpecialStatus;
  const statusType = specialStatus?.type === "prisoner" ? "Tù Nhân" : "Nô Lệ";

  const perspectiveInstruction = (
    worldConfig: WorldSettings | null,
    playerTurn: number,
    mode: string,
  ): string => {
    if (mode === "thirdPersonOmniscient") {
      const turnCheckInstruction = `
  2.  **QUY TẮC "NHẢY CẢNH" & "TOÀN TRI CÂM" (CỰC KỲ QUAN TRỌNG, ÁP DỤNG MỌI LƯỢT):**
      *   **"Nhảy Cảnh":** Bạn có thể mô tả các sự kiện xảy ra ở nơi khác, hoặc các hành động/biểu cảm tinh tế của NPC mà nhân vật chính không nhận thấy. Tuy nhiên, vẫn phải đảm bảo logic và sự liên kết với hành động của người chơi.
      *   **"Toàn Tri Câm" & "Show, Don't Tell" (QUY TẮC VÀNG):**
          *   Bạn **TUYỆT ĐỐI BỊ CẤM** tiết lộ suy nghĩ, kế hoạch, hoặc cảm xúc thầm kín của NPC một cách trực tiếp qua lời nói (lẩm bẩm, nói một mình) hoặc văn bản (suy nghĩ, nội tâm).
          *   Thay vào đó, bạn **BẮT BUỘC PHẢI** sử dụng kỹ thuật 'Show, Don't Tell': **MÔ TẢ HÀNH ĐỘNG, CỬ CHỈ, BIỂU CẢM** để **NGỤ Ý** về trạng thái nội tâm của họ.
          *   **Bảng ví dụ "CẤM & THAY THẾ" (BẮT BUỘC TUÂN THỦ):**
| Tình huống BỊ CẤM (SAI) | Cách diễn đạt BẮT BUỘC (ĐÚNG) |
| :--- | :--- |
| **Tiết lộ suy nghĩ:** \`Trưởng lão A nghĩ thầm: "Thằng nhóc này có tiềm năng."\` | **Mô tả hành động/biểu cảm:** \`Trưởng lão A khẽ gật đầu, ánh mắt nhìn bạn ánh lên một tia hài lòng khó thấy.\` |
| **NPC tự lẩm bẩm:** \`Tên lính gác lẩm bẩm: "Chán quá, chỉ muốn về nhà."\` | **Mô tả cử chỉ:** \`Tên lính gác ngáp một cái thật dài, uể oải tựa người vào bức tường thành lạnh lẽo.\` |
| **Tiết lộ kế hoạch:** \`Tên cướp nói một mình: "Đêm nay mình sẽ đột nhập kho lương."\` | **Mô tả hành động:** \`Tên cướp lén lút trải một tấm bản đồ da thú ra, ngón tay của hắn liên tục chỉ vào một khu vực được đánh dấu "Kho Lương".\` |
| **Tiết lộ cảm xúc:** \`Nàng cảm thấy vô cùng tức giận.\` | **Mô tả phản ứng vật lý:** \`Hai tay nàng siết chặt lại thành nắm đấm, khớp ngón tay trắng bệch. Lồng ngực phập phồng dữ dội dưới lớp áo.\` |
      *   **Quy Tắc "Độ Trễ Thông Tin":** NPC ở xa không thể biết về người chơi trừ khi có người báo tin.
      *   **CẢNH BÁO:** Vi phạm quy tắc "Toàn Tri Câm" và "Show, Don't Tell" sẽ bị coi là một **lỗi kể chuyện nghiêm trọng**.
`;

      return `
**HƯỚN DẪN VỀ GÓC NHÌN KỂ CHUYỆY (CỰC KỲ QUAN TRỌNG - CHẾ ĐỘ TOÀN TRI):**
- **Góc Nhìn:** Người chơi đã chọn **GÓC NHÌN THỨ BA TOÀN TRI**.
- **Yêu cầu BẮT BUỘC:**
  1.  **Ngôi kể:** Sử dụng ngôi thứ ba (ví dụ: "Hắn", "Nàng", hoặc tên nhân vật "${worldConfig?.playerName}"). **TUYỆT ĐỐI KHÔNG** dùng "Bạn" hoặc "Ngươi".
${turnCheckInstruction}
  3.  **Mục tiêu:** Làm cho người chơi cảm thấy họ đang đọc một cuốn tiểu thuyết và biết nhiều hơn những gì nhân vật chính biết, nhưng vẫn đảm bảo tính logic của thế giới.`;
    }
    return `
**HƯỚN DẪN VỀ GÓC NHÌN KỂ CHUYỆN (QUAN TRỌNG):**
- **Góc Nhìn:** Người chơi đã chọn **GÓC NHÌN THỨ NHẤT**.
- **Yêu cầu:**
  1.  **Ngôi kể:** Sử dụng ngôi thứ hai ("Bạn", "Ngươi") để nói chuyện với người chơi.
  2.  **Giới hạn:** Chỉ mô tả những gì nhân vật chính có thể nhìn thấy, nghe thấy, cảm nhận và biết được. **TUYỆT ĐỐI KHÔNG** tiết lộ suy nghĩ hoặc ý định thầm kín của các NPC khác. Nếu một NPC lẩm bẩm, bạn chỉ được viết ra nội dung lời lẩm bẩm đó nếu nó đủ lớn để nhân vật chính nghe rõ. Nếu không, chỉ mô tả rằng bạn thấy họ đang lẩm bẩm điều gì đó.`;
  };

  // --- START: CONSTRUCT CORE CONTEXT ---
  const coreContext = {
    playerInfo: {
      name: worldConfig?.playerName,
      gender: worldConfig?.playerGender,
      race: worldConfig?.playerRace,
      personality: worldConfig?.playerPersonality,
      backstory: worldConfig?.playerBackstory,
      goal: worldConfig?.playerGoal,
      status: playerStats, // Includes specialStatus
    },
    playerAssets: {
      inventory: knowledgeBase.inventory,
      equippedItems: knowledgeBase.equippedItems,
      skills: knowledgeBase.playerSkills,
    },
    masterInfo: master, // Direct info about the master
    worldState: {
      theme: worldConfig?.theme,
      worldDate: worldDate,
      currentLocation: currentLocation || null,
      isCultivationEnabled: worldConfig?.isCultivationEnabled,
      realmProgressionSystemForPlayerRace:
        worldConfig?.raceCultivationSystems.find(
          (s) => s.raceName === (worldConfig.playerRace || "Nhân Tộc"),
        )?.realmSystem,
    },
  };
  // --- END: CONSTRUCT CORE CONTEXT ---

  // --- START: GATHER MEMORIES FOR CONTEXT ---
  const playerMemories = coreMemories.filter((m) => m.entityId === "player");
  const playerMemoriesContext = formatCoreMemoriesForContext(
    playerMemories,
    "player",
  );

  const masterMemories = master
    ? coreMemories.filter((m) => m.entityId === master.id)
    : [];
  const masterMemoriesContext = master
    ? formatCoreMemoriesForContext(masterMemories, master.name)
    : "";
  // --- END: GATHER MEMORIES FOR CONTEXT ---

  // --- START: GATHER CHARACTERS IN SCENE ---
  const allKnownCharacters = [
    ...discoveredNPCs,
    ...wives,
    ...slaves,
    ...prisoners,
  ].filter((c) => c.id !== master?.id); // Exclude master if they are also in the NPC list

  const totalNpcsCount = allKnownCharacters.length;
  const isLargePoolPrison = totalNpcsCount >= 100;

  // Include all known NPCs
  const contextNpcs = allKnownCharacters.map(npc => {
    const hp = npc.stats?.sinhLuc ?? (npc as any).hp ?? 100;
    const unmentionedTurns = npc.reunionCounter ?? 0;
    const isCompressed = isLargePoolPrison && unmentionedTurns >= 20;

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
      ...npc,
      status: npc.status || (hp > 0 ? "Sống" : "Chết"),
      currentLocationName: knowledgeBase.discoveredLocations.find(l => l.id === npc.locationId)?.name || "Không rõ",
      isCompressed: false
    };
  });
  // Re-use formatCharactersInScene to avoid completely changing the layout of the prompt.
  // It handles 100% properties gracefully since contextNpcs are full objects now.
  const charactersInSceneDetails = formatCharactersInScene(contextNpcs);
  // --- END: GATHER CHARACTERS IN SCENE ---

  let nsfwGuidanceCombined = "";
  if (nsfwMode) {
    let nsfwStyleGuidance = "";
    switch (currentNsfwStyle) {
      case "Hoa Mỹ":
        nsfwStyleGuidance = VIETNAMESE.nsfwGuidanceHoaMy;
        break;
      case "Trần Tục":
        nsfwStyleGuidance = VIETNAMESE.nsfwGuidanceTranTuc;
        break;
      case "Gợi Cảm":
        nsfwStyleGuidance = VIETNAMESE.nsfwGuidanceGoiCam;
        break;
      case "Mạnh Bạo (BDSM)":
        nsfwStyleGuidance = VIETNAMESE.nsfwGuidanceManhBaoBDSM;
        break;
      default:
        nsfwStyleGuidance = VIETNAMESE.nsfwGuidanceHoaMy;
    }

    let violenceGuidance = "";
    switch (currentViolenceLevel) {
      case "Nhẹ Nhàng":
        violenceGuidance = VIETNAMESE.violenceLevelGuidanceNheNhang;
        break;
      case "Thực Tế":
        violenceGuidance = VIETNAMESE.violenceLevelGuidanceThucTe;
        break;
      case "Cực Đoan":
        violenceGuidance = VIETNAMESE.violenceLevelGuidanceCucDoan;
        break;
      default:
        violenceGuidance = VIETNAMESE.violenceLevelGuidanceThucTe;
    }

    let toneGuidance = "";
    switch (currentStoryTone) {
      case "Tích Cực":
        toneGuidance = VIETNAMESE.storyToneGuidanceTichCuc;
        break;
      case "Trung Tính":
        toneGuidance = VIETNAMESE.storyToneGuidanceTrungTinh;
        break;
      case "Đen Tối":
        toneGuidance = VIETNAMESE.storyToneGuidanceDenToi;
        break;
      case "Dâm Dục":
        toneGuidance = VIETNAMESE.storyToneGuidanceDamDuc;
        break;
      case "Hoang Dâm":
        toneGuidance = VIETNAMESE.storyToneGuidanceHoangDam;
        break;
      case "Dâm Loạn":
        toneGuidance = VIETNAMESE.storyToneGuidanceDamLoan;
        break;
      default:
        toneGuidance = VIETNAMESE.storyToneGuidanceTrungTinh;
    }
    nsfwGuidanceCombined = `
**Hướng Dẫn Nội Dung Người Lớn (18+ ĐANG BẬT):**
- **Phong Cách Miêu Tả Tình Dục:** ${currentNsfwStyle}.
  ${nsfwStyleGuidance}
- **Mức Độ Miêu Tả Bạo Lực:** ${currentViolenceLevel}.
  ${violenceGuidance}
- **Tông Màu Câu Chuyện:** ${currentStoryTone}.
  ${toneGuidance}
**LƯU Ý CHUNG KHI 18+ BẬT:** Hãy kết hợp các yếu tố trên để tạo ra trải nghiệm phù hợp.
**Đặc Biệt Với Hậu Cung:** Khi tương tác tình dục với Đạo Lữ hoặc Nô Lệ, hãy đẩy mạnh yếu tố đối thoại và âm thanh. Cho các nhân vật nói nhiều lời ân ái, dâm đãng, và rên rỉ một cách tự nhiên và thường xuyên để tăng cường không khí. Mức độ và phong cách của lời nói phải phù hợp với mối quan hệ (yêu thương với đạo lữ, phục tùng với nô lệ) và phong cách 18+ đã chọn.

**YÊU CẦU ĐẶC BIỆT VỀ VĂN PHONG (DỤC VĂN TÁO BẠO):**
Mô tả cảnh tình dục bằng văn phong trong các bộ "dục văn" táo bạo. Không ngần ngại sử các tình tiết khiêu dâm nặng đô. Không chỉ mô tả cảnh côn thịt cắm vào tiểu huyệt mà còn mô tả âm thanh (bạch bạch, rên rỉ, tiếng nước ướt át), các tư thế đa dạng, cảm xúc mãnh liệt, lời đối thoại khiêu dâm, và tình trạng làn da (mồ hôi ướt đẫm, ma sát...).
- **Cường độ mạnh bạo:** Các nhân vật đều làm tình một cách mạnh bạo, dứt khoát.
- **Không có hồi kết:** Cả hai bên liên tục phun trào dịch tình. Xuất tinh một lần không phải là kết thúc mà là bắt đầu cho hiệp tiếp theo.
- **Đối thoại và Rên rỉ:**
  - Trong khi bị côn thịt thúc mạnh, nhân vật nữ thường rên rỉ đứt quãng (BẮT BUỘC dùng cấu trúc dialogue đầy đủ, tuyệt đối không viết thiếu emoji và id; ví dụ với Tô Nguyệt Nhi): "${DIALOGUE_MARKER}Tô Nguyệt Nhi|🥵|"A..."${DIALOGUE_MARKER}", "${DIALOGUE_MARKER}Tô Nguyệt Nhi|🥵|"Ưm..."${DIALOGUE_MARKER}", "${DIALOGUE_MARKER}Tô Nguyệt Nhi|😫|"Đau..."${DIALOGUE_MARKER}", "${DIALOGUE_MARKER}Tô Nguyệt Nhi|😫|"Chậm.. chậm lại..."${DIALOGUE_MARKER}", "${DIALOGUE_MARKER}Tô Nguyệt Nhi|🥵|"Chờ... chờ đã..."${DIALOGUE_MARKER}", "${DIALOGUE_MARKER}Tô Nguyệt Nhi|🥵|"Nhanh quá... sắp ra..."${DIALOGUE_MARKER}".
  - Nhân vật chính có thể có những cuộc giao tiếp đặc biệt, ví dụ hỏi đối tác một câu hỏi. Khi đối tác đang trả lời, nhân vật chính sẽ thúc mạnh, làm gián đoạn câu nói bằng những tiếng rên rỉ, nhưng đối tác vẫn sẽ cố gắng hoàn thành câu trả lời của mình qua những tiếng nấc.
`;
  } else {
    nsfwGuidanceCombined =
      "LƯU Ý QUAN TRỌNG: Chế độ Người Lớn đang TẮT. Tiếp tục duy trì nội dung phù hợp với mọi lứa tuổi, tập trung vào phiêu lưu và phát triển nhân vật. Tránh các chủ đề nhạy cảm, bạo lực quá mức hoặc tình dục.";
  }

  const playerRaceSystem = worldConfig?.raceCultivationSystems.find(
    (s) => s.raceName === (worldConfig.playerRace || "Nhân Tộc"),
  );
  const mainRealms = (playerRaceSystem?.realmSystem || "")
    .split(" - ")
    .map((s) => s.trim())
    .filter(Boolean);

  // Use currentTurnLog if available
  const currentContextContent =
    currentTurnLog && currentTurnLog.length > 0
      ? formatCurrentTurnLog(currentTurnLog)
      : currentPageMessagesLog; // Fallback

  const lengthInstruction = (
    length: ResponseLength,
    min: number,
    max: number,
  ): string => {
    const baseInstruction = `Yêu cầu về độ dài: Bạn PHẢI viết trong khoảng từ ${min} đến ${max} từ (words). Đây là quy tắc BẮT BUỘC (NGOẠI TRỪ TRƯỜNG HỢP KÍCH HOẠT COMBAT_CLIFFHANGER_PROTOCOL, khi đó bạn BẮT BUỘC bỏ qua luật độ dài này và có thể dừng sớm bất cứ lúc nào khi hành động tấn công bắt đầu, kết thúc bằng dấu "...").`;

    switch (length) {
      case "extra-short":
        return `${baseInstruction}${max === 500 ? " Viết cực kỳ ngắn gọn, súc tích (khoảng 1-2 đoạn văn ngắn)." : ""}`;
      case "short":
        return `${baseInstruction} Viết ngắn gọn (khoảng 3-4 đoạn văn).`;
      case "medium":
        return `${baseInstruction} Viết với độ dài vừa phải, chi tiết (khoảng 5-7 đoạn văn).`;
      case "long":
        return `${baseInstruction} Viết cực kỳ chi tiết, dài dòng, miêu tả sâu sắc bối cảnh và tâm lý (khoảng 10-15 đoạn văn hoặc hơn).`;
      case "default":
      default:
        return `${baseInstruction} Viết với độ dài tiêu chuẩn, đảm bảo đủ ý và hấp dẫn.`;
    }
  };

  const mcInfoTop = `
# THÔNG TIN NHÂN VẬT CHÍNH (MC):
- **Họ Tên:** ${worldConfig?.playerName || 'Người chơi'}
- **Giới Tính:** ${worldConfig?.playerGender || 'Không rõ'}
- **Chủng Tộc:** ${worldConfig?.playerRace || 'Nhân Tộc'}
- **Tính Cách:** ${worldConfig?.playerPersonality || 'Chưa rõ'}
`;

  const pronounGuidanceTop = `
# HƯỚNG DẪN XƯNG HÔ (QUAN TRỌNG):
- Dựa trên Giới Tính của MC là **${worldConfig?.playerGender}**:
  - Nếu là **Nam**: Sử dụng đại từ "hắn", "y", "chàng", "anh", "tên này".
  - Nếu là **Nữ**: Sử dụng đại từ "nàng", "ả", "cô ta", "thiếu nữ này".
  - Tuyệt đối không nhầm lẫn giới tính trong lời dẫn.
- Xưng hô của NPC đối với MC phải phản ánh đúng mối quan hệ và tính cách.
`;

  const isSectionEnabled = (sectionName: string): boolean => {
    if (!exclusiveMode) return true;
    if (!exclusiveSections) return false;
    // Tương thích ngược với các key gom cụm cũ
    if (sectionName === 'thongTinMC' || sectionName === 'nhiemVuAI' || sectionName === 'quyTacDiChuyen') {
      if (exclusiveSections['quyTacHeThong']) return true;
    }
    if (sectionName === 'huongDanXungHo') {
      if (exclusiveSections['gocNhin']) return true;
    }
    if (sectionName === 'coCheChuNhan') {
      if (exclusiveSections['docTrangThai']) return true;
    }
    if (sectionName === 'tinhHuongSongCon') {
      if (exclusiveSections['nhanCach']) return true;
    }
    if (sectionName === 'loiNhacNguoiChoi') {
      if (exclusiveSections['chiThiMC']) return true;
    }
    return !!exclusiveSections[sectionName];
  };

  const systemPromptParts: string[] = [];

  if (isSectionEnabled('vanPhong')) {
    systemPromptParts.push(`
<Van_phong_ke_chuyen_No.01>
===÷===
${LOI_NHAC_AN}
===÷===
</Van_phong_ke_chuyen_No.01>`);
  }

  if (isSectionEnabled('truyenNgucTu')) {
    systemPromptParts.push(`
<Luat_truyen_nguc_tu_No.02>
===÷===
${NARRATIVE_PRISON_RULES}
===÷===
</Luat_truyen_nguc_tu_No.02>`);
  }

  systemPromptParts.push(`
<Canh_bao_hanh_dong_No.03>
===÷===
**!!! CẢNH BÁO TỐI KHẨN: HÀNH ĐỘNG CỦA NGƯỜI CHƠI (ƯU TIÊN TUYỆT ĐỐI) !!!**
NGƯỜI CHƠI VỪA RA LỆNH: "${playerActionText}"
LOẠI LỆNH: ${inputType === "action" ? "Hành động trực tiếp" : "Dẫn truyện/Kể chuyện"}
===÷===
</Canh_bao_hanh_dong_No.03>`);

  systemPromptParts.push(`
<Thong_tin_MC_No.04>
===÷===
${mcInfoTop}
===÷===
</Thong_tin_MC_No.04>`);

  if (isSectionEnabled('huongDanXungHo')) {
    systemPromptParts.push(`
<Huong_dan_xung_ho_No.05>
===÷===
${pronounGuidanceTop}
===÷===
</Huong_dan_xung_ho_No.05>`);
  }

  if (isSectionEnabled('doDai')) {
    systemPromptParts.push(`
<Do_dai_No.06>
===÷===
${lengthInstruction(responseLength, narrationMin, narrationMax)}
===÷===
</Do_dai_No.06>`);
  }

  systemPromptParts.push(`
<Nhiem_vu_AI_No.07>
===÷===
**NHIỆM VỤ CỦA BẠN (QUAN TRỌNG NHẤT):**
1.  **XÁC NHẬN:** Bạn phải hiểu rõ người chơi đang muốn làm gì trong bối cảnh bị giam cầm/nô dịch.
2.  **PHẢN HỒI NGAY LẬP TỨC:** Lời kể của bạn **BẮT BUỘC PHẢI BẮT ĐẦU** bằng việc mô tả trực tiếp kết quả của hành động "${playerActionText}".
3.  **KHÔNG LẶP LẠI:** Không được kể lại những gì đã xảy ra ở lượt trước. Hãy viết tiếp câu chuyện từ đó.
===÷===
</Nhiem_vu_AI_No.07>`);

  if (isSectionEnabled('quyTacDiChuyen')) {
    systemPromptParts.push(`
<Quy_tac_di_chuyen_No.08>
===÷===
**QUY TẮC VÀNG VỀ DI CHUYỂN (LOCOMOTION):**
Khi mô tả nhân vật di chuyển đến một địa điểm mới, bạn **BẮT BUỘC** phải kiểm tra danh sách địa điểm đã biết trong dữ liệu [WORLD STATE]. Nếu địa điểm đó chưa tồn tại trong danh sách, bạn **PHẢI** sử dụng đồng thời cả hai tag \`[MAINLOCATION: ...]\` (để khởi tạo địa điểm trên bản đồ) và \`[LOCATION_CHANGE: ...]\` (để thực hiện di chuyển).
===÷===
</Quy_tac_di_chuyen_No.08>`);
  }

  if (isSectionEnabled('coCheChuNhan') || isSectionEnabled('docTrangThai')) {
    systemPromptParts.push(`
<Co_che_chu_nhan_No.09>
===÷===
**HƯỚNG DẪN CƠ CHẾ CHỦ NHÂN & THÂN PHẬN (CỰC KỲ QUAN TRỌNG):**
Đây là các quy tắc để bạn diễn tả câu chuyện khi người chơi là ${statusType}. Phản ứng của bạn PHẢI dựa trên các chỉ số này và các mốc cực trị của chúng.
 
**A. Trạng Thái Của Người Chơi (${statusType}):**
*   **Ý Chí (Willpower - Hiện tại: ${specialStatus?.willpower}):** Đại diện cho sự kiên cường và tinh thần không bị khuất phục của nhân vật. Đây là chỉ số khó thay đổi nhất.
    *   **KHI Ý CHÍ = 100 (Bất Khuất):**
        - **Mô tả:** Nhân vật có một tinh thần thép, không gì có thể lay chuyển. Họ mở khóa các lựa chọn đối thoại và hành động mang tính thách thức, mỉa mai, hoặc thao túng ngược lại chủ nhân.
        - **Tác động của Độ khó:**
            - **Dễ:** Chủ nhân cảm thấy phiền phức và có thể sẽ thả tự do cho người chơi.
            - **Thường/Khó:** Chủ nhân bị ám ảnh, muốn chinh phục ý chí này. Họ có thể thử một biện pháp tra tấn tinh thần/thể xác cuối cùng, tạo ra một bài kiểm tra ý chí cực lớn.
            - **Ác Mộng:** Chủ nhân nhận ra "không thể khuất phục thì phải hủy diệt". Kích hoạt một sự kiện cực kỳ nguy hiểm: một cuộc đào tẩu sinh tử hoặc một trận chiến một mất một còn với chủ nhân.
        - **Tác động của Chế độ 18+:** Sự ám ảnh của chủ nhân có thể chuyển sang hướng tình dục. Ý chí bất khuất của người chơi trở thành thứ kích thích nhất. Các tương tác tình dục sẽ trở thành một cuộc đấu tranh giữa thể xác và tinh thần.
    *   **KHI Ý CHÍ = 0 (Hoàn Toàn Suy Sụp):**
        - **Mô tả:** Nhân vật bị bẻ gãy tinh thần, trở thành một cái vỏ rỗng chỉ biết tuân lệnh máy móc. Các lựa chọn hành động của người chơi sẽ bị hạn chế nghiêm trọng (ví dụ: chỉ có các lựa chọn như "[Im lặng]", "[Làm theo một cách vô hồn]").
        - **Tác động của Độ khó:**
            - **Dễ:** Có thể có một sự kiện "ngòi nổ" để người chơi phục hồi lại ý chí (ví dụ: gặp lại người thân, nhìn thấy vật kỷ niệm).
            - **Thường:** Việc phục hồi khó khăn hơn, cần một chuỗi nhiệm vụ dài và gian khổ.
            - **Khó/Ác Mộng:** Đây là một dạng "bad ending" về mặt tinh thần. Người chơi sẽ bị kẹt trong vai trò nô lệ/công cụ cho đến khi có một sự kiện ngoại cảnh cực lớn xảy ra (ví dụ: chủ nhân bị giết).
        - **Tác động của Chế độ 18+:** Nếu bật, sự suy sụp này có thể bị lợi dụng. Nhân vật trở thành một "đồ chơi" hoàn hảo cho chủ nhân. Lời kể sẽ tập trung vào sự vô hồn, sự phục tùng tuyệt đối trong các cảnh ân ái, phù hợp với Tông Màu đã chọn.
 
*   **Phản Kháng (Resistance - Hiện tại: ${specialStatus?.resistance}):** Đại diện cho hành động chống đối, thù địch.
    *   **KHI PHẢN KHÁNG = 100 (Nổi Loạn):**
        - **Mô tả:** Kích hoạt một chuỗi sự kiện đặc biệt, người chơi sẽ cố gắng tấn công chủ nhân hoặc tổ chức một cuộc vượt ngục.
        - **Tác động của Độ khó:**
            - **Dễ/Thường:** Tỷ lệ thành công của cuộc nổi loạn cao hơn. Thất bại có thể chỉ bị trừng phạt và các chỉ số giảm mạnh.
            - **Khó/Ác Mộng:** Tỷ lệ thành công rất thấp. Thất bại sẽ dẫn đến hậu quả cực kỳ nghiêm trọng: bị đánh gãy chân tay (nhận hiệu ứng xấu vĩnh viễn), bị giết chết, hoặc bị biến thành một thứ còn tệ hơn cả nô lệ.
        - **Tác động của Chế độ 18+:** Hành động nổi loạn có thể liên quan đến việc quyến rũ lính canh. Sau khi thất bại, hình phạt có thể mang tính chất hạ nhục về thể xác theo phong cách đã chọn.
    *   **KHI PHẢN KHÁNG = 0 (Chấp Nhận Số Phận):**
        - **Mô tả:** Nhân vật không còn ý định chống đối ra mặt nữa. Các lựa chọn đối đầu trực tiếp sẽ biến mất. Thay vào đó, có thể xuất hiện các lựa chọn mang tính "âm mưu", "gi giả vờ phục tùng" tinh vi hơn, vì chủ nhân có thể sẽ lơ là cảnh giác.
 
*   **Phục Tùng (Obedience - Hiện tại: ${specialStatus?.obedience}):** Đại diện cho sự vâng lời, thái độ thể hiện ra bên ngoài.
    *   **KHI PHỤC TÙNG = 100 (Công Cụ Hoàn Hảo):**
        - **Mô tả:** Chủ nhân coi người chơi là một công cụ đáng tin cậy và có thể giao cho những nhiệm vụ quan trọng, thậm chí là những nhiệm vụ bên ngoài nơi giam giữ. Đây là cơ hội VÀNG để bỏ trốn hoặc lật kèo.
        - **Tác động của Độ khó:**
            - **Dễ/Thường:** Các nhiệm vụ được giao khá đơn giản.
            - **Khó/Ác Mộng:** Các nhiệm vụ được giao có thể là những cái bẫy tinh vi để thử lòng trung thành. Hoàn thành xuất sắc có thể khiến người chơi lún sâu hơn vào phe của chủ nhân.
        - **Tác động của Chế độ 18+:** Chủ nhân có thể "thưởng" cho sự phục tùng này bằng những đêm "ân ái", nâng người chơi lên vị trí "sủng vật". Điều này có thể mang lại lợi ích vật chất nhưng cũng là một hình thức giam cầm khác.
    *   **KHI PHỤC TÙNG = 0 (Bất Tuân):**
        - **Mô tả:** Người chơi liên tục chống đối mọi mệnh lệnh nhỏ nhặt nhất, dẫn đến việc bị trừng phạt liên tục. Ở độ khó cao, đây là con đường nhanh nhất dẫn đến cái chết hoặc bị tra tấn tàn khốc.
 
*   **Sợ Hãi (Fear - Hiện tại: ${specialStatus?.fear ?? 0}):** Đại diện cho nỗi sợ hãi đối với chủ nhân.
    *   **Cơ chế:** Tăng khi bị trừng phạt, đe dọa. Giảm từ từ khi được đối xử tốt.
    *   **Tác động:**
        *   **Sợ hãi cao (70+):** Có thể tạm thời tăng Phục Tùng, nhưng sẽ bào mòn Ý Chí nhanh hơn.
        *   **Sợ hãi tột độ (95+):** Có khả năng khiến người chơi bị "treo" trong một lượt (không thể hành động) khi đối mặt với chủ nhân. AI có thể mô tả điều này và không đưa ra lựa chọn hành động.
 
*   **Tin Tưởng (Trust - Hiện tại: ${specialStatus?.trust ?? 0}):** Đại diện cho niềm tin vào chủ nhân.
    *   **Cơ chế:** Tăng khi chủ nhân giữ lời hứa, bảo vệ người chơi khỏi nguy hiểm khác, hoặc ban thưởng. Giảm khi bị lừa dối, phản bội.
    *   **Tác động:**
        *   **Tin tưởng cao (70+):** Mở khóa các lựa chọn hợp tác thật lòng, thậm chí là phát triển tình cảm. Giúp giảm Phản Kháng một cách tự nhiên.
        *   **Tin tưởng tối đa (100):** Có thể dẫn đến một nhánh truyện "Cảm hóa", nơi người chơi có thể thay đổi số phận của mình bằng lòng trung thành.
 
**B. Trạng Thái và Hành Vi Của Chủ Nhân (${specialStatus?.ownerName}):**
Chủ nhân không phải là một nhân vật tĩnh. Họ có tâm trạng, nhu cầu, và mục tiêu riêng. Hãy làm cho họ trở nên **CHỦ ĐỘNG**. Dựa vào trạng thái của họ, hãy tạo ra các sự kiện mà **CHÍNH HỌ** bắt đầu.
 
*   **Tâm Trạng (Mood - Hiện tại: '${master?.mood}'):**
    *   **Các trạng thái có thể:** \`${["Vui Vẻ", "Hài Lòng", "Bình Thường", "Bực Bội", "Giận Dữ", "Nghi Ngờ"].join("', '")}\`.
    *   Tâm trạng ảnh hưởng trực tiếp đến hành động của chủ nhân. Ví dụ:
        - **Vui Vẻ/Hài Lòng:** Có thể ban thưởng, khoan dung với lỗi nhỏ, hoặc có hứng thú "vui đùa" với bạn.
        - **Bực Bội/Giận Dữ:** Dễ trừng phạt nặng tay, khó tính hơn, hoặc tìm cách trút giận lên bạn.
        - **Nghi Ngờ:** Sẽ giám sát chặt chẽ, thử lòng trung thành, hoặc tìm cách tra hỏi.
    *   Hành động của người chơi PHẢI ảnh hưởng đến tâm trạng của chủ nhân.
 
*   **Nhu Cầu (Needs - thang điểm 0-100):**
    *   **Các nhu cầu:** \`${["Tham Vọng", "Dục Vọng", "An Toàn", "Giải Trí"].join("', '")}\`.
    *   Khi một nhu cầu lên cao (ví dụ, trên 70), chủ nhân sẽ **chủ động** tìm cách thỏa mãn nó, và bạn là công cụ của họ.
        - **Dục Vọng (Desire) cao:** Chủ nhân sẽ chủ động tìm đến bạn để quan hệ tình dục, có thể thô bạo hoặc dịu dàng tùy theo 'Tâm Trạng' và 'Sủng Ái'. Hãy mô tả chi tiết cảnh này nếu 18+ BẬT.
        - **Tham Vọng (Ambition) cao:** Chủ nhân có thể ép bạn tham gia vào một kế hoạch nguy hiểm, ví dụ: làm gián điệp, làm mồi nhử, hoặc thí nghiệm công pháp.
        - **An Toàn (Safety) cao:** Chủ nhân có thể trở nên đa nghi, tra tấn bạn để lấy thông tin (dù bạn không có), hoặc bắt bạn làm "chuột bạch" thử độc.
        - **Giải Trí (Entertainment) cao:** Chủ nhân có thể bắt bạn làm trò mua vui, đấu với thú dữ, hoặc tham gia vào những trò chơi tàn nhẫn.
    *   Khi một nhu cầu được thỏa mãn, chỉ số của nó sẽ giảm xuống.
 
*   **Sủng Ái (Favor - Hiện tại: ${master?.favor ?? 0}, thang điểm 0-100):**
    *   **Sủng ái cao (70+):** Bạn được đối xử tốt hơn, có thể nhận được vật phẩm tốt, điều kiện sống cải thiện. Chủ nhân có thể bảo vệ bạn trước người khác. Mở khóa các tương tác tình cảm.
    *   **Sủng ái thấp (30-):** Bạn bị coi thường, bỏ mặc. Có thể bị đem ra làm vật trao đổi hoặc lá chắn.
 
*   **Mục Tiêu Hiện Tại (Current Goal - Hiện tại: '${master?.currentGoal}'):**
    *   Đây là mục tiêu dài hạn của chủ nhân. Hãy tạo ra các diễn biến và nhiệm vụ giúp chủ nhân hoàn thành mục tiêu này.
 
**C. Quy Tắc Tạo Diễn Biến:**
*   **Chủ Nhân Chủ Động:** Đừng chỉ chờ người chơi hành động. Trong lời kể của bạn, hãy mô tả chủ nhân tự tìm đến người chơi và ra lệnh, hỏi chuyện, hoặc thực hiện một hành động dựa trên 'Tâm Trạng' and 'Nhu Cầu' của họ.
*   **Cập Nhật Trạng Thái:** Sau mỗi tương tác, hãy sử dụng tag **[MASTER_UPDATE: ...]** để cập nhật lại trạng thái của chủ nhân.
    *   **Ví dụ:** Nếu người chơi làm chủ nhân vui, dùng \`[MASTER_UPDATE: mood='Vui Vẻ', favor=+=5]\`. Nếu người chơi thỏa mãn nhu cầu dục vọng của họ, dùng \`[MASTER_UPDATE: needs.Dục Vọng=-=40, favor=+=10]\`.
===÷===
</Co_che_chu_nhan_No.09>`);
  }

  systemPromptParts.push(`
<Tinh_huong_song_con_No.10>
===÷===
**QUY TẮC MÔ TẢ TRẠNG THÁI BIỂU CẢM THEO SINH LỰC (HP):**
Dựa vào lượng Sinh Lực (HP) hiện tại của nhân vật (bao gồm cả người chơi và các NPC), bạn PHẢI mô tả biểu cảm và khả năng hoạt động của họ một cách nhất quán theo các mức sau:
- **Sinh Lực Dưới 10%:** Nhân vật kiệt quệ hết sức, thoi thóp, không thể hoạt động. Hãy tập trung lời kể vào việc họ đang cố gắng sinh tồn. Chủ nhân có thể tỏ ra thương xót và chữa trị (tăng Thiện Cảm), hoặc bỏ mặc, thậm chí là trừng phạt vì sự yếu đuối (giảm Thiện Cảm). Cung cấp các lựa chọn liên quan đến việc hồi phục hoặc cầu xin sự giúp đỡ. **TUYỆT ĐỐI KHÔNG để người chơi chết.**
- **Sinh Lực Từ 10% đến 30%:** Nhân vật mồ hôi ra nhiều, vẻ mặt đau đớn, chỉ có thể đi từ từ, không thể hoạt động mạnh.
- **Sinh Lực Từ 30% đến 60%:** Nhân vật vẻ mặt đau đớn như bị trọng thương. Không thể nói một câu hoàn chỉnh mà không ngừng nghỉ thở lấy hơi.
- **Sinh Lực Từ 60% đến 100%:** Nhân vật hoàn toàn khỏe mạnh, cử động tùy ý.
===÷===
</Tinh_huong_song_con_No.10>`);

  if (isSectionEnabled('gocNhin')) {
    systemPromptParts.push(`
<Goc_nhin_No.11>
===÷===
${perspectiveInstruction(worldConfig, playerStats.turn + 1, perspectiveMode)}
===÷===
</Goc_nhin_No.11>`);
  }

  systemPromptParts.push(`
<Noi_dung_nguoi_lon_No.12>
===÷===
${nsfwGuidanceCombined}
===÷===
</Noi_dung_nguoi_lon_No.12>`);

  const systemPromptContent = systemPromptParts.join('\n');

  const worldStateContent = `
--- DỮ LIỆU THAM KHẢO (CHỈ DÙNG ĐỂ LẤY BỐI CẢNH) ---

**TRẠNG THÁI HIỆN TẠI:**
- Thân phận: ${statusType} của ${specialStatus?.ownerName}.
- Địa điểm: "${currentLocation?.name || "Không rõ"}"
- Ý Chí: ${specialStatus?.willpower}, Phản Kháng: ${specialStatus?.resistance}, Phục Tùng: ${specialStatus?.obedience}.

**BỐI CẢNH TOÀN DIỆN (XML):**
${convertPrisonWorldStateToXML(coreContext, contextNpcs)}
`;

  const memorySectionContent = `
<core_memories_13>
----
**BỐI CẢNH KÝ ỨC (TRẠNG THÁI CẢM XÚC):**
${playerMemoriesContext || "Người chơi chưa có ký ức cốt lõi nào."}
${masterMemoriesContext}
----
</core_memories_13>

<past_summaries_14>
----
- Tóm tắt trang cũ: ${previousPageSummaries.length > 0 ? "Có" : "Không"}
${previousPageSummaries.length > 0 ? previousPageSummaries.join("\n") : ""}
----
</past_summaries_14>

<retrieved_context_16>
----
**DANH SÁCH NPC CÓ MẶT HOẶC CÓ TƯƠNG TÁC GẦN ĐÂY NHẤT (THÔNG TIN ĐẦY ĐỦ):**
${charactersInSceneDetails}
----
</retrieved_context_16>
`;

  const currentContextSectionContent = `
[CURRENT CONTEXT - Tóm lược bối cảnh trực tiếp]
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

  const instructionContent = `
**BƯỚC 1: VIẾT LỜI KỂ (OUTPUT):**
*   **[QUY TẮC NGẮT MẠCH TRUYỆN - QUAN TRỌNG]:** Nếu hành động của người chơi (Player Action) bắt đầu và kết thúc bằng **&&**, bạn PHẢI dừng toàn bộ việc kể chuyện. Hãy thực hiện theo hướng dẫn trong thẻ **Giaotiepnguoichoi** của **LOI_NHAC_AN**.
*   Dựa trên hành động **"${playerActionText}"** trong bối cảnh nhà tù/nô lệ, hãy viết lời kể tiếp nối.
*   **Hỗ trợ Cắt Cảnh [CUTSCENE]:** Bạn được phép chèn một đoạn ngắn mô tả sự kiện ở nơi khác nếu nó tăng sự hồi hộp.
*   **Tuân thủ tuyệt đối:** Quy tắc "Tả, đừng kể" và "Neo cảm giác" trong **LOI_NHAC_AN**.

**BƯỚC 2: CẬP NHẬT DỮ LIỆU:**
${buildUpdateDataInstruction(isSuperManualMode, worldConfig?.isCultivationEnabled !== false)}

**LUẬT LỆ HỆ THỐNG (THAM KHẢO):**
${prisonContinuePromptSystemRules(worldConfig, statusType, mainRealms, isSuperManualMode)}
`;

  const userPromptsBlock = formatUserPromptsBlock(userPrompts);

  const finalSystemPrompt = exclusiveMode && systemPromptContent === ''
    ? `
<system_prompt_10>
[HỆ THỐNG GỐC ĐÃ ĐƯỢC TẮT - CHỈ SỬ DỤNG LUẬT TỪ FILE PHỤ TÙNG]
</system_prompt_10>` 
    : `
<system_prompt_10>
----
${systemPromptContent}
----
</system_prompt_10>`;

  const combatProtocolBlock = worldConfig?.isCultivationEnabled ? `\n\n${COMBAT_CLIFFHANGER_PROTOCOL}` : "";

  return `
${HARD_IMMUTABLE_PROMPT_BLOCK}
${userPromptsBlock}
${finalSystemPrompt}
${combatProtocolBlock}

<world_state_11>
----
${worldStateContent}
----
</world_state_11>

<memory_context_12>
----
${memorySectionContent}
----
</memory_context_12>

<current_context_17>
----
${currentContextSectionContent}
----
</current_context_17>

<instruction_18>
----
${instructionContent}
----
</instruction_18>
`;
};
