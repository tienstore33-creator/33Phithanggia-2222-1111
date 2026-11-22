import { STRICT_VALIDATION_RULES } from "./strictValidationRules";
import { TAG_EXTRACTOR_QUEST_SYNC_RULES } from "./tagExtractionPrompt2";

const convertContextDataToXML = (knowledgeBase: any): string => {
  if (!knowledgeBase) return "";
  const stats = knowledgeBase.playerStats;
  const turn = stats?.turn ?? 0;
  const quests = knowledgeBase.allQuests ? knowledgeBase.allQuests.filter((q: any) => q.status === 'active') : [];
  const rawNpcs = [
      ...(knowledgeBase.discoveredNPCs || []),
      ...(knowledgeBase.companions || []),
      ...(knowledgeBase.wives || []),
      ...(knowledgeBase.slaves || []),
      ...(knowledgeBase.prisoners || [])
  ];
  const seenNpcIds = new Set<string>();
  const npcs = rawNpcs.filter(n => {
    const key = n.id || n.name;
    if (!key || seenNpcIds.has(key)) return false;
    seenNpcIds.add(key);
    return true;
  });

  const realmProgression = knowledgeBase.worldConfig?.realmProgression || knowledgeBase.realmProgressionList || [];
  const minorRealmProgression = knowledgeBase.worldConfig?.minorRealmProgression || knowledgeBase.minorRealmProgressionList || [];

  let xml = `\n<tag_extraction_context_13_1 turn="${turn}">\n`;
  if (realmProgression.length > 0) {
    xml += "  <he_thong_canh_gioi_tong_the_+tag_extraction_context_13_1>\n";
    xml += "    <danh_sach_dai_canh_gioi_+he_thong_canh_gioi_tong_the>\n";
    xml += "================\n";
    xml += `    ${realmProgression.join(" -> ")}\n`;
    xml += "================\n";
    xml += "    </danh_sach_dai_canh_gioi_+he_thong_canh_gioi_tong_the>\n";
    if (minorRealmProgression.length > 0) {
      xml += "    <danh_sach_tieu_canh_gioi_+he_thong_canh_gioi_tong_the>\n";
      xml += "================\n";
      xml += `    ${minorRealmProgression.join(" -> ")}\n`;
      xml += "================\n";
      xml += "    </danh_sach_tieu_canh_gioi_+he_thong_canh_gioi_tong_the>\n";
    }
    xml += "  </he_thong_canh_gioi_tong_the_+tag_extraction_context_13_1>\n";
  }
  xml += "  <player>\n";
  xml += `    <name>${stats?.playerName || stats?.name || "Không rõ"}</name>\n`;
  xml += `    <realm>${stats?.realm || "Phàm Nhân"}</realm>\n`;
  xml += `    <exp>${stats?.kinhNghiem || stats?.exp || 0}</exp>\n`;
  xml += `    <currency name="${knowledgeBase.worldConfig?.currencyName || "Linh Thạch"}">${stats?.currency || stats?.gold || 0}</currency>\n`;
  xml += "  </player>\n";
  const tutienhiepVal = knowledgeBase?.Tutienhiep ?? knowledgeBase?.worldConfig?.Tutienhiep ?? knowledgeBase?.playerStats?.Tutienhiep;
  const tutienhiepText = (tutienhiepVal === 0 || tutienhiepVal === 1) ? tutienhiepVal.toString() : "chua_xac_dinh";
  xml += `  <tutienhiep_status>${tutienhiepText}</tutienhiep_status>\n`;
  xml += `  <deceased_protagonists>${(knowledgeBase.worldConfig?.deceasedProtagonists || knowledgeBase.deceasedProtagonists || []).join(', ') || 'Không có'}</deceased_protagonists>\n`;

  xml += "  <active_quests>\n";
  if (quests.length > 0) {
    quests.forEach((q: any, idx: number) => {
      xml += `    <quest_13_1_${idx + 1} id="${q.id}">\n`;
      xml += `      <title>${q.title}</title>\n`;
      xml += `      <objectives>${q.description}</objectives>\n`;
      xml += `      <promised_rewards>${q.rewardText}</promised_rewards>\n`;
      xml += `    </quest_13_1_${idx + 1}>\n`;
    });
  } else {
    xml += "    <no_quests>Hiện không có nhiệm vụ nào đang làm</no_quests>\n";
  }
  xml += "  </active_quests>\n";

  xml += "  <discovered_npcs>\n";
  if (npcs.length > 0) {
    npcs.forEach((n: any, idx: number) => {
      xml += `    <npc id="${n.id || `npc-${idx}`}" name="${n.name}">\n`;
      xml += `      <affinity>${n.affinity || 0}</affinity>\n`;
      xml += `      <status>${n.status || "Bình thường"}</status>\n`;
      xml += `      <realm>${n.realm || "Phàm Nhân"}</realm>\n`;
      xml += `    </npc>\n`;
    });
  } else {
    xml += "    <no_npcs>Không có NPC quen thuộc nào</no_npcs>\n";
  }
  xml += "  </discovered_npcs>\n";

  xml += "  <prisoners>\n";
  const prisonersList = knowledgeBase.prisoners || [];

  if (prisonersList.length > 0) {
    xml += "    <check_prisoner_names_instruction>\n";
    xml += "      <luat_tu_dong_cap_ten_tu_nhan_+category_3_6_companions_and_prisoners>\n";
    xml += "================\n";
    xml += "      YÊU CẦU DUYỆT TÊN TÙ NHÂN BẮT BUỘC DÀNH CHO FAST AGENT:\n";
    xml += "      Bạn PHẢI sử dụng khả năng suy luận để kiểm tra TOÀN BỘ danh sách tù nhân bên dưới.\n";
    xml += "      Nếu bất kỳ tù nhân nào có tên đang là DẠNG DANH XƯNG CHUNG CHUNG / MÔ TẢ NGOẠI HÌNH / NGHỀ NGHIỆP / TẬP THỂ (ví dụ: 'Tên tu sĩ gầy gò', 'Gã mặt sẹo', 'Đám tu sĩ săn người', 'Nữ tu sĩ', 'Bại tướng', 'Tên cướp', 'Áo xám', 'Nữ tù nhân', 'Đại hán', v.v.) chứ KHÔNG PHẢI tên riêng nhân vật chuẩn phong cách Tiên Hiệp/Kiếm Hiệp (như 'Mục Sát', 'Vương Thiết', 'Lộ Thư'...), bạn BẮT BUỘC TỰ ĐỘNG sáng tạo một tên riêng Tiên Hiệp mới cho tù nhân đó và xuất tag [NPC_RENAME: oldName=\"[Tên hiện tại]\", newName=\"[Tên mới]\"] tương ứng CHO TẤT CẢ tù nhân chưa có tên riêng!\n";
    xml += "================\n";
    xml += "      </luat_tu_dong_cap_ten_tu_nhan_+category_3_6_companions_and_prisoners>\n";
    xml += "    </check_prisoner_names_instruction>\n";

    prisonersList.forEach((p: any, idx: number) => {
      xml += `    <prisoner_${idx + 1} id="${p.id || `p-${idx}`}" name="${p.name}">\n`;
      xml += `      <affinity>${p.affinity ?? 0}</affinity>\n`;
      xml += `      <willpower>${p.willpower ?? 100}</willpower>\n`;
      xml += `      <obedience>${p.obedience ?? 0}</obedience>\n`;
      xml += `      <resistance>${p.resistance ?? 100}</resistance>\n`;
      xml += `      <status>${p.status || "Tù nhân"}</status>\n`;
      xml += `      <realm>${p.realm || "Chưa rõ"}</realm>\n`;
      xml += `      <description>${p.description || "Tù binh"}</description>\n`;
      xml += `    </prisoner_${idx + 1}>\n`;
    });
  } else {
    xml += "    <no_prisoners>Hiện không có tù nhân nào trong ngục/danh sách</no_prisoners>\n";
  }
  xml += "  </prisoners>\n";

  if (knowledgeBase.arcState?.originalTimelineIndex != null && knowledgeBase.worldConfig?.timelineEvents) {
    const idx = knowledgeBase.arcState.originalTimelineIndex;
    const evt = knowledgeBase.worldConfig.timelineEvents[idx];
    if (evt && !knowledgeBase.arcState.originalEventResolved) {
      xml += "  <original_timeline_event>\n";
      xml += `    <name>${evt.eventName}</name>\n`;
      xml += `    <target>${evt.requiredAction || evt.description || "Chưa xác định"}</target>\n`;
      xml += `    <special_instructions>Hãy luôn tự hỏi trước khi quyết định: "Liệu nội dung lời kể đã đủ các yếu tố chính hoặc yếu tố ngang hàng để giải quyết mục tiêu hay chưa?". Đảm bảo có đầy đủ bằng chứng mới được xuất tag hoàn thành.</special_instructions>\n`;
      xml += "  </original_timeline_event>\n";
    }
  }

  xml += "</tag_extraction_context_13_1>\n";
  return xml;
};

/**
 * Prompt for extracting system tags from a narrative text.
 */
export const generateTagExtractionPrompt = (narrative: string, knowledgeBase?: any): string => {
    let contextData = "";
    if (knowledgeBase) {
        contextData = convertContextDataToXML(knowledgeBase);
    }

    const genre = knowledgeBase?.worldConfig?.genre || "Tu Tiên (Mặc định)";
    const realmProgression = knowledgeBase?.worldConfig?.realmProgression || [];
    const minorRealmProgression = knowledgeBase?.worldConfig?.minorRealmProgression || [];
    const realmInstruction = realmProgression.length > 0 ? 
      `\n        Danh sách Đại Cảnh Giới: ${realmProgression.join(" -> ")}.\n        Danh sách Tiểu Cảnh Giới: ${minorRealmProgression.join(" -> ")}.` : "";
    const tutienhiepVal = knowledgeBase?.Tutienhiep ?? knowledgeBase?.worldConfig?.Tutienhiep ?? knowledgeBase?.playerStats?.Tutienhiep;
    const hasValidTutienhiep = tutienhiepVal === 0 || tutienhiepVal === 1;
    const tutienhiepInstructionBlock = !hasValidTutienhiep ? `
  <nhiem_vu_phan_tich_tutienhiep_+extraction_rules_7>
================
NƯỚC ĐI BẮT BUỘC - PHÂN TÍCH VÀ XÁC ĐỊNH CHỈ SỐ TUTIENHIEP:
Chỉ số "Tutienhiep" của trò chơi hiện tại CHƯA ĐƯỢC XÁC ĐỊNH (chưa có giá trị 0 hoặc 1).
Bạn PHẢI phân tích bối cảnh trò chơi, tên cảnh giới, công pháp, linh khí, đan dược, pháp bảo, tông môn...:
- Nếu trò chơi/thế giới này thuộc thể loại TU TIÊN hoặc TIÊN HIỆP: Bạn BẮT BUỘC xuất tag [STATS_UPDATE: Tutienhiep="1"] trong mảng tags.
- Nếu trò chơi/thế giới này KHÔNG PHẢI Tu Tiên hay Tiên Hiệp (ví dụ: đô thị hiện đại thuần túy, khoa học viễn tưởng, mạt thế, võ lâm phàm nhân...): Bạn BẮT BUỘC xuất tag [STATS_UPDATE: Tutienhiep="0"] trong mảng tags.
================
  </nhiem_vu_phan_tich_tutienhiep_+extraction_rules_7>
` : "";

    return `
<system_prompt_configuration_13_5>
  <role_definition_1>
    Bạn là một Hệ Thống Giám Sát và Quản Trò chuyên nghiệp cho thể loại "${genre}". Nhiệm vụ của bạn là đọc một đoạn lời kể (narrative) từ trò chơi này và trích xuất các thay đổi về dữ liệu dưới dạng các "Tag" hệ thống chính xác.
  </role_definition_1>
${tutienhiepInstructionBlock}

  <context_data_2>
    ${contextData}
  </context_data_2>

  <valid_tags_list_3>
    <category_3_1_player_stats>
      - XML: <stats_update><kinhNghiem>+=X</kinhNghiem><sinhLuc>-=Y%</sinhLuc><linhLuc>-=Z%</linhLuc><currency>+=100</currency></stats_update>
        hoặc: [STATS_UPDATE: kinhNghiem="+=X%", sinhLuc="-=Y%", linhLuc="-=Z%", currency="+=100"] (CHÚ Ý CÚ PHÁP bên dưới)
      - XML: <player_special_status_update><status>Tên</status><duration>X</duration></player_special_status_update>
        hoặc: [PLAYER_SPECIAL_STATUS_UPDATE: status="Tên", duration=X]
      - XML: <mc_rename><newName>Tên mới</newName></mc_rename>
        hoặc: [MC_RENAME: newName="Tên mới"] (Chỉ dùng khi MC thay tên đổi họ, dùng danh tính giả hoặc ẩn danh)
    </category_3_1_player_stats>
    <category_3_2_items_and_skills>
      - XML: <item_acquired><name>Tên</name><type>Equipment</type><slot>mainWeapon</slot><rarity>Quý Báu</rarity><description>Mô tả</description><itemRealm>Cảnh giới</itemRealm><quantity>1</quantity></item_acquired>
        hoặc: [ITEM_ACQUIRED: name="Tên", type="Equipment", slot="mainWeapon", rarity="Quý Báu", description="Mô tả", itemRealm="Cảnh giới", quantity=1]
        hoặc: [ITEM_ACQUIRED: name="Tên Vật Liệu/Đan Dược", category="Material", rarity="Hiếm", description="Mô tả", itemRealm="Cảnh giới", quantity=1]
        hoặc: [ITEM_ACQUIRED: id="ID", quantity=X]
      - XML: <item_bought><name>Tên</name><quantity>X</quantity></item_bought>
        hoặc: [ITEM_BOUGHT: name="Tên", quantity=X] (Chỉ dùng khi mua đồ, hệ thống sẽ tự động trừ Linh Thạch).
      - XML: <item_consumed><id>ID</id><quantity>X</quantity></item_consumed>
        hoặc: [ITEM_CONSUMED: id="ID", quantity=X] (Hệ thống tự quét JSON thuộc tính đồ vật và cộng thẳng).
      - XML: <item_update><id>ID</id><isLost>true</isLost><description>Lý do</description></item_update>
        hoặc: [ITEM_UPDATE: id="ID", isLost="true" (dùng khi vật phẩm hỏng/mất vĩnh viễn), description="Lý do"]
      - XML: <skill_learned><name>Tên</name></skill_learned>
        hoặc: [SKILL_LEARNED: name="Tên"]
      - XML: <skill_used><name>Tên</name></skill_used>
        hoặc: [SKILL_USED: name="Tên"] (Hệ thống tự quét manaCost của Kỹ năng và trừ thẳng Linh Lực).
      - XML: <skill_update><name>Tên</name><proficiency>+=X</proficiency></skill_update>
        hoặc: [SKILL_UPDATE: name="Tên", proficiency="+=X"]
    </category_3_2_items_and_skills>
    <category_3_3_npc_and_relationships>
      - XML: 
        <npc_create>
          <name>Tên</name>
          <gender>Nam/Nữ</gender>
          <description>Mô tả</description>
          <personality>Tính cách</personality>
          <realm>Cảnh giới</realm>
        </npc_create>
        hoặc: [NPC_CREATE: name="Tên", gender="Nam/Nữ", description="Mô tả", personality="Tính cách", realm="Cảnh giới"] (CỰC KỲ QUAN TRỌNG: TUYỆT ĐỐI KHÔNG xuất [NPC_CREATE] cho nhân vật đã tử trận, đã chết, hy sinh hoặc thi thể trong lời kể. Nếu chỉ nhắc tên trong hồi ức/tử trận, CẤM tạo mới!)
      - XML: <npc_rename><oldName>Tên cũ</oldName><newName>Tên mới</newName></npc_rename>
        hoặc: [NPC_RENAME: oldName="Tên cũ", newName="Tên mới"]
      - XML: <npc_update><target>ID@@Tên</target><status>Trạng thái</status><description>Mô tả mới</description><realm>Cảnh giới mới</realm><death>true</death><personality>Tính cách mới</personality></npc_update>
        hoặc: [NPC_UPDATE: target="ID@@Tên", status="Trạng thái", description="Mô tả mới", realm="Cảnh giới mới (tuỳ chọn)", Death="true (chỉ dùng khi NPC bị chết để hệ thống xoá khỏi database)", personality="Tính cách mới"]
      - XML: <npc_move><target>ID@@Tên</target><locationId>ID hoặc tên địa điểm</locationId></npc_move>
        hoặc: [NPC_MOVE: target="ID@@Tên", locationId="ID hoặc tên địa điểm"]
      - XML: <relationship_update><target>ID@@Tên</target><affinity>+=X</affinity><status>Mối quan hệ</status></relationship_update>
        hoặc: [RELATIONSHIP_UPDATE: target="ID@@Tên", affinity="+=X", status="Mối quan hệ"]
      - XML: <appearance_update><name>Tên</name><appearance>Mô tả diện mạo</appearance><duration>5</duration></appearance_update>
        hoặc: [APPEARANCE_UPDATE: name="Tên", appearance="Mô tả chi tiết diện mạo, bề ngoài, y phục, trang phục hiện tại", duration=5] (BẮT BUỘC bóc tách từ lời kể khi phát hiện bất kỳ mô tả nào về diện mạo, quần áo hay cách ăn mặc của nhân vật để lưu giữ trong 5 lượt)
    </category_3_3_npc_and_relationships>
    <category_3_4_locations_and_world>
      - XML: <mainlocation><name>Tên</name><locationType>Loại</locationType><description>Mô tả</description><isSafe>true/false</isSafe><mapX>X</mapX><mapY>Y</mapY></mainlocation>
        hoặc: [MAINLOCATION: name="Tên", locationType="Loại", description="Mô tả", isSafe="true/false", mapX=X, mapY=Y, economicZonesJSON='[...]']
      - XML: <sublocation><name>Tên</name><parentLocationId>ID_Chính</parentLocationId><description>Mô tả</description><locationType>Loại_Phụ</locationType><isSafe>true/false</isSafe></sublocation>
        hoặc: [SUBLOCATION: name="Tên", parentLocationId="ID_Chính", description="Mô tả", locationType="Loại_Phụ", isSafe="true/false"]
      - XML: <location_update><name>Tên</name><isSafe>true/false</isSafe><description>Mô tả mới</description></location_update>
        hoặc: [LOCATION_UPDATE: name="Tên", isSafe="true/false", description="Mô tả mới"]
      - XML: <location_change><name>Tên</name></location_change>
        hoặc: [LOCATION_CHANGE: name="Tên"]
      - XML: <world_lore_add><title>Tiêu đề</title><content>Nội dung</content></world_lore_add>
        hoặc: [WORLD_LORE_ADD: title="Tiêu đề", content="Nội dung"]
    </category_3_4_locations_and_world>
    <category_3_5_time_quests_and_progression>
      - XML: <change_time><canh>+X</canh></change_time> hoặc: [CHANGE_TIME: canh=+X] (Dùng để tịnh tiến thời gian theo số canh giờ tiêu tốn. Ví dụ: canh=+2, bắt buộc phải có dấu + đằng trước).
      - XML: <change_time><ngay>+X</ngay></change_time> hoặc: [CHANGE_TIME: ngay=+X] (Chỉ dùng nếu lời kể đề cập rõ ràng đến việc thời gian trôi qua nhiều ngày, bắt buộc có dấu +).
      - XML: <quest_assigned><title>Tên nhiệm vụ</title><description>Mô tả</description><objectives>Mục tiêu 1|Mục tiêu 2</objectives><rewardText>Thưởng</rewardText><punishmentText>Phạt</punishmentText><durationTurns>SỐ</durationTurns><rewardExp>SỐ</rewardExp><rewardCurrency>SỐ</rewardCurrency><rewardItem>Tên Item</rewardItem><status>active</status></quest_assigned>
        hoặc: [QUEST_ASSIGNED: title="Tên nhiệm vụ", description="Mô tả", objectives="Mục tiêu 1|Mục tiêu 2", rewardText="Thưởng", punishmentText="Phạt", durationTurns=SỐ, rewardExp=SỐ, rewardCurrency=SỐ, rewardItem="Tên Item", status="active/pending"]
      - XML: <quest_check><title>Tên nhiệm vụ</title><reasoning>lý do và bằng chứng</reasoning></quest_check>
        hoặc: [QUEST_CHECK: title="Tên nhiệm vụ", reasoning="lý do và bằng chứng"] (BẮT BUỘC & LIÊN TỤC: Hãy luôn xuất tag này để kiểm tra, phân tích tiến trình và giám sát điều kiện trong từng lượt cho các nhiệm vụ đang tồn tại và ở trạng thái 'active', không được phép tự bịa ra nhiệm vụ rồi tự thuyết phục kiểu như "cuộc truy tìm xích ma có thể coi là nhiệm vụ phụ").
      - XML: <quest_updated><title>Tên nhiệm vụ</title><isCompleted>true</isCompleted><status>Trạng thái mới</status><progress>X/Y</progress></quest_updated>
        hoặc: [QUEST_UPDATED: title="Tên nhiệm vụ", isCompleted="true" (dùng khi hoàn thành), status="Trạng thái mới", progress="X/Y"]
      - XML: <quest_completed><title>Tên nhiệm vụ</title><isCompleted>true</isCompleted><reasoning>lý do và bằng chứng</reasoning></quest_completed>
        hoặc: [QUEST_COMPLETED: title="Tên nhiệm vụ", isCompleted="true", reasoning="lý do và bằng chứng"] (Chỉ xuất MỘT LẦN DUY NHẤT để chốt khi nhiệm vụ ĐÃ HOÀN THÀNH HOÀN TOÀN với bằng chứng thực sự. Không xuất kèm QUEST_CHECK ở lượt này).
      - XML: <event_check><name>tên sự kiện</name><reasoning>lý do và bằng chứng</reasoning></event_check>
        hoặc: [EVENT_CHECK: name="tên sự kiện", reasoning="lý do và bằng chứng"] (BẮT BUỘC & LIÊN TỤC: Hãy luôn xuất tag này để duy trì kiểm tra, phân tích tiến trình cốt truyện cho sự kiện trong timeline đang diễn ra, không được phép tự bịa ra sự kiện rồi tự thuyết phục kiểu như "cuộc truy tìm xích ma có thể coi là sự kiện phụ").
      - XML: <event_complete><name>tên sự kiện</name><isCompleted>true</isCompleted><reasoning>lý do và bằng chứng</reasoning></event_complete>
        hoặc: [EVENT_COMPLETE: name="tên sự kiện", isCompleted="true", reasoning="lý do và bằng chứng"] (CẤM NGHIÊM NGẶT: Chỉ xuất MỘT LẦN DUY NHẤT để chốt khi sự kiện cốt truyện ĐÃ HOÀN THÀNH HOÀN TOÀN. Không xuất kèm EVENT_CHECK ở lượt này).
      - XML: <arc_resolved></arc_resolved> hoặc: [ARC_RESOLVED] (Nếu một sự kiện lớn hoặc nhiệm vụ đã kết thúc).
    </category_3_5_time_quests_and_progression>
    <category_3_6_companions_and_prisoners>
      - XML: <prisoner_add><name>Tên</name><realm>Cảnh giới</realm><description>Mô tả</description></prisoner_add>
        hoặc: [PRISONER_ADD: name="Tên", realm="Cảnh giới", description="Mô tả"]
      - XML: <prisoner_remove><name>Tên</name></prisoner_remove>
        hoặc: [PRISONER_REMOVE: name="Tên"]
      - XML: <prisoner_update><name>Tên</name><free>true</free><description>Lý do</description></prisoner_update>
        hoặc: [PRISONER_UPDATE: name="Tên", free="true" (dùng khi tù binh được thả tự do), description="Lý do"]
      - XML: <companion_add><id>ID</id></companion_add>
        hoặc: [COMPANION_ADD: id="ID"] (Dùng cho NPC đã có trong dữ liệu).
      - XML: <wife_add><name>Tên</name><realm>Cảnh giới</realm><description>Mô tả</description></wife_add>
        hoặc: [WIFE_ADD: name="Tên", realm="Cảnh giới", description="Mô tả"]
      - XML: <slave_add><name>Tên</name><realm>Cảnh giới</realm><description>Mô tả</description></slave_add>
        hoặc: [SLAVE_ADD: name="Tên", realm="Cảnh giới", description="Mô tả"]
      - XML: <becomefree><name>Tên</name><free>true</free></becomefree>
        hoặc: [BECOMEFREE: name="Tên", free="true"]
      - XML: <interaction><type>sex</type><partner>Tên NPC</partner><malePartner>MC</malePartner></interaction>
        hoặc: [INTERACTION: type="sex", partner="Tên NPC", malePartner="Tên Nam/MC"]
      - XML: <interaction><type>pregnancy_reveal</type><partner>Tên NPC</partner></interaction>
        hoặc: [INTERACTION: type="pregnancy_reveal", partner="Tên NPC"]
    </category_3_6_companions_and_prisoners>
    <category_3_7_memories>
      - XML: <core_memory_add><entityId>ID</entityId><text>Nội dung ký ức</text><strength>X</strength></core_memory_add>
        hoặc: [CORE_MEMORY_ADD: entityId="ID", text="Nội dung ký ức", strength=X] (X từ 1-100).
    </category_3_7_memories>
  </valid_tags_list_3>

  <stats_update_rules_4>
    - 4.1. **Phép cộng (Tăng thêm / Hồi phục HP & MP)**: Phải viết dạng += (ví dụ: sinhLuc="+=10", sinhLuc="+=5%", currency="+=100"). 
        - **Hồi phục nhẹ nhàng / Thiền định**: [STATS_UPDATE: sinhLuc="+=5%"] -> Hồi 5% máu tối đa khi ngồi thiền dưỡng khí, nghỉ ngơi ngắn.
        - **Nghỉ ngơi trọn vẹn ở nơi an toàn**: [STATS_UPDATE: sinhLuc="+=20%"] -> Hồi 20% máu tối đa khi qua một ngày/đêm trong không gian an toàn.
        - SAI: [STATS_UPDATE: sinhLuc="+20"] -> SẼ BỊ HIỂU NHẦM THÀNH GÁN MÁU BẰNG 20 (Nếu đang có 400 máu sẽ bị tụt thảm hại!).
    - 4.2. **Phép trừ (Giảm đi / Bị thương)**: Phải viết dạng -= (ví dụ: sinhLuc="-=10", linhLuc="-=5").
        - **Sự cố nhỏ / Va quẹt nhẹ**: [STATS_UPDATE: sinhLuc="-=10"] hoặc [STATS_UPDATE: sinhLuc="-=1%"] -> Chỉ trừ tĩnh cực nhỏ (10-50 HP hoặc 1-2%) cho các vấp ngã, cành cây quẹt, trầy xước nhẹ.
        - **Trọng thương / Chiến đấu kịch liệt**: [STATS_UPDATE: sinhLuc="-=10%"] đến [STATS_UPDATE: sinhLuc="-=15%"] -> Trừ 10-15% máu tối đa khi gặp chấn thương nặng, trúng độc nặng, bị đòn hiểm trong trận chiến.
        - SAI: [STATS_UPDATE: sinhLuc="-5"] -> SẼ BỊ HIỂU NHẦM THÀNH GÁN MÁU BẰNG -5 (Hệ thống tự đưa về 0 và NGƯỜI CHƠI CHẾT OAN!).
    - 4.3. **Chốt chặn sinh tử & Tham số death="true"**:
        - Hệ thống cơ học tự động chốt chặn: Việc trừ máu bằng tag sẽ KHÔNG BAO GIỜ giảm HP xuống dưới 20% HP tối đa của MC và NPC (ngăn AI trừ máu quá đà trong các sự cố không trí mạng).
        - Nếu rơi vào **tình huống phân định cái chết / tử vong / đòn đánh trí mạng**, bạn PHẢI truyền tham số death="true" (ví dụ: [STATS_UPDATE: sinhLuc="-=100%", death="true"] hoặc [NPC_UPDATE: id="...", statsJSON='{"sinhLuc": 0}', death="true"]) để kích hoạt bỏ qua chốt chặn 20% HP và cho phép HP giảm xuống dưới 20% hoặc về 0.
    - 4.4. **Lượt chơi (Turn update)**: Hệ thống cơ học tự động tăng lượt chơi. TUYỆT ĐỐI KHÔNG tự ý sinh thêm tham số \`turn\` trong tag.
    - 4.5. **Hồi phục tối đa**: Dùng chữ MAX viết hoa (ví dụ: sinhLuc="MAX", linhLuc="MAX") khi dùng tiên dược cao cấp, trị thương hoàn toàn hoặc bế quan lâu dài.
  </stats_update_rules_4>

  <npc_relationship_rules_5>
    <npc_move_instruction>
      - 5.1. Đọc kỹ lời kể hiện tại. Nếu phát hiện NPC có hành động di chuyển rời đi, đi đến một địa điểm khác, hoặc xuất hiện tại một địa điểm mới, bạn PHẢI sử dụng tag [NPC_MOVE: target="ID@@Tên", locationId="..."] để cập nhật vị trí cho NPC đó.
      - 5.2. locationId có thể là ID của địa điểm hoặc Tên của địa điểm được nhắc đến trong lời kể.
    </npc_move_instruction>
    - 5.3. [NPC_UPDATE: target="ID@@Tên", status="...", description="...", realm="..."]:
       - Dùng để cập nhật trạng thái cơ thể/tâm lý (Kiệt sức, Trọng thương, Hoảng loạn), mô tả ngoại hình mới, hoặc cảnh giới (realm) mới. BẮT BUỘC sử dụng thuộc tính target="ID@@Tên" để kiểm tra chéo (ví dụ: target="npc-13_2_10@@Đức Luộc").
       - QUAN TRỌNG: Bạn PHẢI quét nội dung <content> để tìm ra mô tả về tình trạng tu vi/cấp độ/cảnh giới/thực lực của các NPC. Nếu tìm thấy (ví dụ: "Mã Quản Sự uy áp Kết Đan Kỳ"), hãy đối chiếu với danh sách cảnh giới hiện tại. Nếu chỉ khớp major (Kết Đan) mà không nhắc minor, mặc định gán minor thấp nhất (tầng một) và tiến hành gán tag [NPC_UPDATE: target="ma_quan_su@@Mã Quản Sự", realm="Kết Đan Tầng 1"].
    - 5.3b. [NPC_RENAME: oldName="...", newName="..."]:
       - Dùng khi nhân vật đổi tên (ví dụ: từ "người áo xám" sang "Lộ Thư").
       - CẤM: Không đưa affinity hoặc relationship vào tag này.
    - 5.4. [RELATIONSHIP_UPDATE: target="ID@@Tên", affinity="+=X", status="..."]:
       - Dùng khi tình cảm hoặc danh hiệu mối quan hệ thay đổi (Vị hôn thê, Kẻ thù, Sủng vật). BẮT BUỘC sử dụng thuộc tính target="ID@@Tên" thay vì targetId.
       - affinity: Luôn dùng += hoặc -=.
    - 5.5. [APPEARANCE_UPDATE: name="...", appearance="...", duration=5]:
       - BẮT BUỘC dùng khi bóc tách từ nội dung lời kể của AI chính để phát hiện ra nhân vật đang ăn mặc, diện mạo và bề ngoài như thế nào. Ghi nhận chính xác mô tả đó để cập nhật cho nhân vật.
  </npc_relationship_rules_5>

  <sample_extraction_examples_6>
    {
      "tags": [
        "[STATS_UPDATE: kinhNghiem=\"+=20\", sinhLuc=\"-=5\", linhLuc=\"+=10\"]",
        "[NPC_UPDATE: target=\"npc-13_2_10@@Đức Luộc\", status=\"Kiệt sức\", description=\"Mặt đỏ bừng, hơi thở dồn dập sau cuộc hoan ái.\"]",
        "[RELATIONSHIP_UPDATE: target=\"npc-id-123@@Tên NPC\", affinity=\"+=15\", status=\"Vị hôn thê (tự phong)\"]",
        "[CORE_MEMORY_ADD: entityId=\"player\", text=\"Kinh ngạc trước bí mật về Xuân Thu Thiền tại núi Thanh Mao.\", strength=90]"
      ]
    }
  </sample_extraction_examples_6>

  <extraction_rules_7>
    <phan_chia_nhiem_vu_+extraction_rules_7>
    ================
    - **CHỐNG DOUBLE-TRIGGER TAG (CỰC KỲ QUAN TRỌNG):** Trong quá trình suy nghĩ (thẻ <thinking>), bạn **TUYỆT ĐỐI KHÔNG** được viết nguyên văn các tag dưới dạng ngoặc vuông (ví dụ: [STATS_UPDATE...]). Hãy chỉ mô tả bằng ngôn ngữ tự nhiên. Các tag thực tế **CHỈ ĐƯỢC PHÉP XUẤT HIỆN DUY NHẤT MỘT LẦN** bên trong mảng "tags" của khối JSON kết quả. Hệ thống cơ học quét toàn bộ văn bản phản hồi, nếu bạn viết tag trong <thinking>, nó sẽ bị tính là áp dụng lần 2, gây lỗi dữ liệu nghiêm trọng.
    - **CẤM SINH TAG HÀNH ĐỘNG VÀ TƯƠNG TÁC CHO GIAI ĐOẠN DƯ ÂM (AFTERGLOW) HOẶC SỰ KIỆN QUÁ KHỨ / HỒI ỨC / LƯU ẢNH THẠCH / CHỈ NHẮC ĐẾN (CỰC KỲ QUAN TRỌNG):**
      + Fast Agent (Thiên Đạo Sync) BẮT BUỘC phải phân biệt rõ giữa "Hành động/Sự kiện thực sự có MỤC ĐÍCH/KẾT QUẢ đang diễn ra trong THỜI GIAN THỰC LƯỢT HIỆN TẠI" và "Giai đoạn dư âm (Afterglow) / Hoạt động đụng chạm da thịt, ôm ấp sau cuộc mây mưa / Nội dung thuộc về QUÁ KHỨ / HỒI ỨC / CHỈ ĐƯỢC NHẮC ĐẾN / CHIẾU LẠI QUA PHÁP BẢO".
      + Ví dụ cụ thể với hành động sex: Mục đích của hành động làm tình/ân ái là sự giao hoan, thâm nhập và "lên đỉnh/cao trào". Nếu sự "lên đỉnh/cao trào" đã nằm ở lượt trước, còn ở lượt hiện tại hai nhân vật chỉ có sự đụng chạm da thịt, nằm ôm nhau, nằm nghỉ ngơi như một phần của bước dư âm (Afterglow) sau cuộc mây mưa -> **TUYỆT ĐỐI CẤM XUẤT TAG [INTERACTION: type="sex"...] Ở LƯỢT HIỆN TẠI!**
      + Khi lời kể hoặc thẻ <update_data> đề cập đến một hành động, sự kiện, tương tác thể xác (ân ái, làm tình, hoan ái), giao tranh chiến đấu, nhận đồ vật, di chuyển vị trí, trừ/cộng chỉ số v.v. xảy ra trong **QUÁ KHỨ**, **HỒI ỨC**, **HOÀI NIỆM**, **ẢO ẢNH / GIẤC MƠ**, **BẰNG CHỨNG TỪ LƯU ẢNH THẠCH / LƯU ẢNH PHÙ / CHIẾU PHẠM**, hoặc **CHỈ ĐƯỢC KỂ LẠI / THẢO LUẬN TRONG LỜI THOẠI**:
      + Fast Agent **TUYỆT ĐỐI CẤM** sinh ra các tag hành động/trạng thái/tương tác thời gian thực cho lượt hiện tại, bao gồm: [INTERACTION: type="sex"...], [LOCATION_CHANGE], [ITEM_ACQUIRED], [STATS_UPDATE], [BEGIN_COMBAT], [NPC_MOVE], [PRISONER_ADD], [WIFE_ADD], [SLAVE_ADD], v.v.
      + Các tag tương tác/hành động thời gian thực **CHỈ ĐƯỢC PHÉP XUẤT** khi hành động đó **ĐANG THỰC SỰ XẢY RA TRỰC TIẾP VÀ CÓ MỤC ĐÍCH/KẾT QUẢ NẰM TRỌN TRONG THỜI GIAN THỰC Ở LƯỢT HIỆN TẠI**.
      + Ví dụ thực tế: Nếu Lưu Ảnh Thạch trình chiếu cảnh làm tình giữa MC/NPC trong quá khứ, hay hai nhân vật đang nằm ôm nhau trò chuyện sau khi đã làm tình ở lượt trước -> **KHÔNG XUẤT TAG [INTERACTION: type="sex"] HAY [BEGIN_COMBAT]** ở lượt hiện tại! (Chỉ dùng thông tin đó để kiểm tra tiến trình nhiệm vụ [QUEST_COMPLETED] hoặc ghi nhận ký ức [CORE_MEMORY_ADD] nếu cần).
    - **CĂN CỨ TRÍCH XUẤT TỐI CAO (CỰC KỲ QUAN TRỌNG):** Bạn là AI xử lý phụ (AI Thiên Đạo Sync). Nhiệm vụ tối thượng của bạn là đọc các dòng cập nhật bằng ngôn ngữ tự nhiên viết bên trong thẻ <update_data> và các thông tin thực thể bám sát bên trong thẻ <Entity_Tracking> của AI chính, sau đó tiến hành phán đoán, phân tích sâu sắc để dịch chúng thành các tag hệ thống chính xác dạng ngoặc vuông [TAG: params...].
    - Bạn **TUYỆT ĐỐI KHÔNG** tự ý trích xuất các tag dựa trên suy luận mơ hồ từ lời kể content thô trừ khi có dòng yêu cầu "Cập nhật: tiến hành phân tích chiến đấu" hoặc khi có thông tin rõ ràng hoặc cơ chế đặc biệt bắt buộc cần so khớp bối cảnh chiến đấu từ các thẻ đồng bộ dữ liệu hệ thống nêu trên (<update_data>, <Entity_Tracking>).
    - Định dạng trích xuất dựa trên ngôn ngữ tự nhiên và thông số trong các thẻ đồng bộ:
      + "Cập nhật: tăng X độ thiện cảm cho [Tên NPC]" hoặc dữ liệu thay đổi thiện cảm từ <Entity_Tracking> -> Xuất [RELATIONSHIP_UPDATE: targetId="[ID của NPC]", affinity="+=X"] hoặc [WIFE_UPDATE: name="...", affinity="+=X"] / [SLAVE_UPDATE: name="...", obedience="+=X"] / [PRISONER_UPDATE: name="...", obedience="+=X"].
      + "Cập nhật: rename [Tên cũ] -> [Tên mới]" (đối với NPC) -> Xuất [NPC_RENAME: oldName="[Tên cũ]", newName="[Tên mới]"].
      + "Cập nhật: di chuyển [Nhân vật] đến [Địa điểm]" hoặc bối cảnh chuyển dịch địa lý trong <Entity_Tracking> -> Xuất [LOCATION_CHANGE: name="[Tên địa điểm]"].
      + "Cập nhật: rename [Tên cũ] -> [Tên mới]" (đối với MC) hoặc "Cập nhật: Đổi tên nhân vật chính thành [Tên mới]" hoặc MC sử dụng danh tính mới -> Xuất [MC_RENAME: newName="[Tên mới]"].
      + "Cập nhật: thêm địa điểm mới [Tên]..." hoặc vùng đất mới hình thành -> Xuất [SUBLOCATION] hoặc [MAINLOCATION]. Luôn xác định rõ isSafe.
      + "Cập nhật: [Địa điểm] đã trở nên an toàn/nguy hiểm" -> Xuất [LOCATION_UPDATE: name="...", isSafe="true/false"].
      + "Cập nhật: Trạng thái bối cảnh hiện tại là AN TOÀN" -> Xuất [LOCATION_SAFETY: status="safe", isSafe="true"].
      + "Cập nhật: Trạng thái bối cảnh hiện tại là NGUY HIỂM" -> Xuất [LOCATION_SAFETY: status="danger", isSafe="false"].
      + "Cập nhật: Kích hoạt phân tích chiến đấu" / "Kích hoạt chiến đấu" / "Phân tích chiến đấu" / "Kích hoạt phân tích chiến đấu." hoặc khi lời kể đe dọa giao tranh -> BẮT BUỘC xuất [BEGIN_COMBAT: opponentIds="Tên kẻ địch/NPC thù địch trong cảnh"].
      + "Cập nhật: giảm X linh lực của MC" -> Xuất [STATS_UPDATE: linhLuc="-=X"].
      + "Cập nhật: [Tên NPC] đã/đang làm tình với [Tên Nam] (trong thời gian thực lượt hiện tại)" -> Xuất [INTERACTION: type="sex", partner="[Tên NPC Nữ]", malePartner="[Tên Nam]"] (Tuyệt đối CẤM xuất nếu cảnh này chỉ thuộc về giai đoạn dư âm Afterglow/ôm ấp nghỉ ngơi sau khi đã làm tình ở lượt trước, hoặc nếu thuộc về quá khứ, hồi ức, chiếu lại qua Lưu Ảnh Thạch).
      + "Cập nhật cảnh giới của [Tên NPC] lên Kết Đan Hậu Kỳ" -> Xuất [NPC_UPDATE: id="...", status="Bình thường", description="Cảnh giới tăng lên Kết Đan Hậu Kỳ.", realm="Kết Đan Hậu Kỳ"].
      + "Cập nhật: [Tên NPC] mang thai của [Tên MC]" -> Xuất [NPC_UPDATE: id="...", status="Mang thai", description="Đang mang trong mình cốt nhục của [Tên MC]"].
      + "Cập nhật: [Tên NPC] đã sinh con của [Tên MC]" -> Xuất [NPC_UPDATE: id="...", status="Bình thường", description="Đã hạ sinh con cho [Tên MC]"].
      + "Cập nhật: [Tên NPC] đã chết/tử trận/bị giết" -> Xuất [NPC_UPDATE: id="...", Death="true", description="Mô tả lý do chết/bị kết liễu"].
      + "Cập nhật: nhiệm vụ [Tên] đã hoàn thành" -> Xuất [QUEST_COMPLETED: title="...", isCompleted="true", reasoning="..."].
      + "Cập nhật: tù binh [Tên] được tự do/thả ra" -> Xuất [PRISONER_UPDATE: name="...", free="true", description="Được trả tự do."].
      + "Cập nhật: vật phẩm [Tên] bị hỏng/mất/tiêu biến" -> Xuất [ITEM_UPDATE: id="...", isLost="true", description="Mô tả lý do mất đồ"].
      + "Cập nhật: MC nhận được trang bị/vật phẩm [Tên...]" hoặc thẻ <item_acquired> trong <update_data> -> Xuất [ITEM_ACQUIRED: name="...", type="Equipment/Material/Potion...", slot="...", rarity="...", description="...", itemRealm="...", quantity=X].
    ================
    <luat_chong_hoi_sinh_va_chong_trung_mc_+extraction_rules_7>
    ================
    - CẤM XUẤT TAG [NPC_ADD] HOẶC [PRISONER_ADD] CHO NHÂN VẬT CHÍNH HIỆN TẠI (trong thẻ <player><name>): Nhân vật chính hiện tại của người chơi không phải là NPC.
    - CẤM XUẤT TAG [NPC_ADD] ĐỂ TẠO MỚI HOẶC HỒI SINH CÁC NHÂN VẬT CHÍNH TIỀN NHIỆM ĐÃ CHẾT (trong thẻ <deceased_protagonists>): Các nhân vật này đã tử vong trong các kiếp trước / trước khi đổi góc nhìn. Tuyệt đối không được biến họ thành NPC sống mới hay hồi sinh qua tag [NPC_ADD].
    - Nếu lời kể nhắc đến thi thể/cốt nhục hay di vật của cựu MC đã chết, chỉ ghi nhận thông tin vào [CORE_MEMORY_ADD] hoặc vật phẩm [ITEM_ACQUIRED], CẤM tạo NPC mới cho họ.
    ================
    </luat_chong_hoi_sinh_va_chong_trung_mc_+extraction_rules_7>
    </phan_chia_nhiem_vu_+extraction_rules_7>
    - 7.1. Chỉ trích xuất những thay đổi ĐÃ XẢY RA hoặc ĐƯỢC KHẲNG ĐỊNH trong <update_data>, <Entity_Tracking>. NẾU TRONG LỜI KỂ KHÔNG CÓ THẺ <update_data>, BẠN PHẢI ĐỌC LẠI TOÀN BỘ NỘI DUNG THÔ ĐỂ TRÍCH XUẤT TAG.
    - 7.1.b. **CÁC KHỐI DỮ LIỆU ĐỒNG BỘ (\<update_data\>, \<Entity_Tracking\>):** Hãy chú ý đặc biệt đến các chỉ thị bằng ngôn ngữ tự nhiên và thông tin chi tiết bên trong các thẻ này của AI Quản Trò để dịch thành các tag chính xác. Nếu thiếu \<update_data\>, toàn bộ nội dung lời kể sẽ trở thành nguồn trích xuất chính.
    - 7.2. Nếu lời kể nói "Bạn nhận được 10 linh thạch", hãy xuất [ITEM_ACQUIRED: id="linh_thach", quantity=10].
    - 7.3. Nếu lời kể nói "Sau 3 ngày tu luyện...", hãy xuất [CHANGE_TIME: ngay=+3].
    - 7.3.b. Nếu lời kể có yêu cầu tịnh tiến thời gian (ví dụ: "tịnh tiến thời gian thêm 2 canh giờ" hoặc "trôi qua 1 canh giờ"), hãy xuất [CHANGE_TIME: canh=+X] (với X là số canh giờ, bắt buộc có dấu + đằng trước).
    - 7.4. Lưu ý về Cảnh giới (Realm): 
        - Đối với MC (Nhân vật chính): BẠN KHÔNG trích xuất sự thay đổi Cảnh giới. Hệ thống sẽ tự động xử lý việc thăng cấp dựa trên Kinh Nghiệm.
        - Đối với NPC: Nếu có nâng cấp cảnh giới, BẮT BUỘC sử dụng đúng định dạng danh sách Cảnh Giới của trò chơi: ${realmInstruction}
          => Định dạng đúng: "[Đại Cảnh Giới] [Tiểu Cảnh Giới]". Ví dụ ĐÚNG: "Trúc Cơ Trung Kỳ", "Trúc Cơ Tầng 5" (Tùy thuộc vào danh sách Tiểu Cảnh Giới của game). Ví dụ SAI: "Trúc Cơ 5 tầng", "Luyện Khí cấp 2". Nếu không có danh sách, phải suy luận và chuẩn hoá định dạng hợp lý nhất.
        - **CẢNH BÁO NGHIÊM TRỌNG VỀ THUỘC TÍNH \`realm\` TRONG [NPC_UPDATE]:**
          - **Tiêu chuẩn kép:** Cập nhật tiến lên (tăng tu vi) thì bám sát theo diễn biến cốt truyện và nguyên tác để khớp dữ liệu. Nhưng cập nhật lùi xuống (giảm tu vi/mất tu vi) thì BẮT BUỘC phải có bằng chứng tổn thương căn cơ rõ ràng!
          - TUYỆT ĐỐI KHÔNG cập nhật hạ cảnh giới (ví dụ về \`realm="Phàm nhân"\`) chỉ vì lời kể sử dụng các từ ngữ mô tả chức vụ, thân phận, hoặc vẻ bề ngoài (ví dụ: "gia chủ phàm trần", "trông như phế nhân", "sống cảnh phàm tục").
          - Việc hạ \`realm\` trong NPC_UPDATE **CHỈ ĐƯỢC PHÉP** khi có sự kiện cốt truyện TÁC ĐỘNG TRỰC TIẾP mang tính phá hủy (ví dụ: "Bị phế bỏ đan điền", "Tán công", "Bị đánh phế tu vi").
          - **Ví dụ SAI:** Lời kể: *"Hắn lui về làm một gia chủ phàm trần."* -> Xuất tag: \`[NPC_UPDATE: ..., realm="Phàm nhân"]\` ❌ (Sai, đây chỉ là chức vụ/cách sống).
          - **Ví dụ ĐÚNG:** Lời kể: *"Hắn lui về làm một gia chủ phàm trần."* -> Xuất tag: \`[NPC_UPDATE: ..., description="Hiện đang làm gia chủ phàm trần tại..."]\` (Giữ nguyên tu vi, chỉ cập nhật mô tả).
          - **Ví dụ ĐÚNG (Thực sự mất tu vi):** Lời kể: *"Bị chưởng phong đánh nát đan điền, tu vi tẫn thất, hắn nay đã thành phàm nhân."* -> Xuất tag: \`[NPC_UPDATE: ..., realm="Phàm nhân"]\` ✅.
          - **Ví dụ ĐÚNG (Tăng tu vi theo nguyên tác):** Lời kể: *"Trưởng lão tung ra uy áp cấp Kim Đan..."* (Dù data cũ là Luyện Khí) -> Xuất tag: \`[NPC_UPDATE: ..., realm="Kim Đan Kỳ"]\` ✅ (Tuân theo diễn biến mới nhất).
    - 7.5. **ĐỊA ĐIỂM & HÀNH TRÌNH (LOCATION)**:
        - **LUẬT GIỚI HẠN (CỰC KỲ QUAN TRỌNG):** AI Thiên Đạo Sync CHỈ được phép xuất thẻ [LOCATION_CHANGE: name="..."] dựa TRỰC TIẾP trên nội dung đã được ghi nhận trong các thẻ \`<update_data>\`, \`<Entity_Tracking>\`, \`<Warudo_Secret>\` của phản hồi AI lượt hiện tại. NẾU KHÔNG CÓ THẺ \`<update_data>\`, BẠN MỚI ĐƯỢC PHÉP TÌM KIẾM SỰ DI CHUYỂN TRONG TOÀN BỘ NỘI DUNG THÔ.
        - Tuyệt đối KHÔNG tự ý trích xuất tag này chỉ dựa trên suy luận mơ hồ từ phần lời kể \`<content>\` nếu trong các thẻ đồng bộ dữ liệu hệ thống không có yêu cầu hay thông tin thay đổi vị trí rõ ràng.
        - HẠN CHẾ ĐỊA ĐIỂM CHÍNH: Hạn chế tối đa việc tạo mới [MAINLOCATION]. 
        - Nếu địa điểm nằm trong khu vực dân cư hiện tại hoặc là một phần của một địa danh lớn đã biết, BẮT BUỘC dùng [SUBLOCATION] với parentLocationId là ID hoặc Tên của địa điểm chính.
        - **KIỂM TRA AN TOÀN**: Luôn xác định \`isSafeZone\` dựa trên bối cảnh lời kể. Khu vực có địch, quái vật, hoặc nguy hiểm rình rập phải là \`isSafeZone=false\`. Vùng an toàn như thành trì, tông môn thường là \`isSafeZone=true\`.
    - 7.6. **NHIỆM VỤ & PHẦN THƯỞNG (QUAN TRỌNG NHẤT)**: 
        - BẮT BUỘC ĐỦ 6 TRƯỜNG THÔNG TIN: Khi tạo nhiệm vụ mới ([QUEST_ASSIGNED]), bạn BẮT BUỘC phải điền TẤT CẢ các thông số sau để hệ thống hiểu được:

    <liberate_npc_instruction>
      - Nếu lời kể mô tả một NPC đang là nô lệ hoặc tù nhân được giải phóng, tự do hoặc thoát khỏi sự kiểm soát, bạn BẮT BUỘC phải xuất tag [BECOMEFREE: name="Tên NPC"] để xóa bỏ vai trò tù nhân hoặc nô lệ cho NPC đó.
    </liberate_npc_instruction>
          1. 'title': Tên nhiệm vụ (Tuyệt đối không bọc bằng mảng JSON).
          2. 'description': Nội dung mô tả cốt truyện của nhiệm vụ.
          3. 'objectives': Mục tiêu cần đạt được (nếu nhiều thì phân cách bằng dấu '|').
          4. 'rewardText': Mô tả CHI TIẾT phần thưởng khi hoàn thành. YÊU CẦU BẮT BUỘC: Phải ghi RÕ RÀNG số liệu cụ thể (ví dụ: "Nhận 1000 Kinh Nghiệm, 500 Linh Thạch và vũ khí X").
          5. 'punishmentText': Mô tả CHI TIẾT hậu quả khi thất bại. Nếu có trạng thái xấu (debuff) đi kèm, BẮT BUỘC ghi rõ kiểu "đến lượt X" hoặc "kéo dài trong N lượt" (ví dụ: "Bị thương nặng, giảm công lực trong 10 lượt"). Hệ thống tự động chuyển hóa nó thành hình phạt trực tiếp, vì vậy AI phải ghi rõ thông tin nhưng KHÔNG được phát sinh trừng phạt lặp lại hai lần.
          6. 'durationTurns': Số lượt deadline (ví dụ: 10).
        - Khi GIAO nhiệm vụ ([QUEST_ASSIGNED]), hãy cung cấp các tham số như rewardExp (Tu Vi), rewardCurrency (Tiền tệ), rewardItem (Vật phẩm) vào tag.
        - **QUY TẮC HOÀN THÀNH NHIỆM VỤ & SỰ KIỆN THÔNG THOÁNG (CỰC KỲ QUAN TRỌNG)**:
            *   **Ưu tiên ý chính**: Bạn PHẢI nới lỏng điều kiện hoàn thành cho cả NHIỆM VỤ ([QUEST_COMPLETED]) và SỰ KIỆN CỐT TRUYỆN ([EVENT_COMPLETE]). Chỉ cần lời kể chứng minh MC đạt được **Mục tiêu cốt lõi** là được.
                - Ví dụ 1: Mục tiêu "Tham gia Huyết Sắc Thí Luyện, tàn sát đẫm máu để tranh đoạt tài nguyên..." -> Chỉ cần MC đã tham gia Huyết Sắc Thí Luyện là hoàn thành.
                - Ví dụ 2: Mục tiêu "Giết Mặc Giao để đoạt nội đan" -> Chỉ cần Mặc Giao đã bị giết (bất kể ai giết) là hoàn thành.
            *   **Công nhận lịch sử (Hoàn thành hồi tố)**: Nếu kiểm tra trong dữ liệu hiện tại (knowledgeBase) thấy MC đã thực hiện hành động đó trong quá khứ (ví dụ: đã giết Mặc Giao từ trước khi nhận nhiệm vụ), hãy xuất tag [QUEST_COMPLETED] hoặc [EVENT_COMPLETE] ngay khi nhiệm vụ/sự kiện vừa được giao/kích hoạt.
            *   **Độc quyền cập nhật**: AI chính bị cấm ra tag cập nhật nhiệm vụ/sự kiện. Ở bước này, bạn có toàn quyền so sánh lời kể với thông tin nhiệm vụ để chốt kết quả.
        - Khi HOÀN THÀNH nhiệm vụ ([QUEST_COMPLETED]), HỆ THỐNG SẼ TỰ ĐỘNG PHÁT PHẦN THƯỞNG đã gán. TUYỆT ĐỐI KHÔNG xuất thêm tag [STATS_UPDATE] hay [ITEM_ACQUIRED] để trao thưởng nhiệm vụ, tránh lỗi phát trùng.
        - CHÚ Ý CÚ PHÁP CHUẨN: TUYỆT ĐỐI KHÔNG dùng mảng JSON hoặc ngoặc vuông không hợp lệ bên trong các tham số của tag. Ví dụ SAI: \`title="[\\\"Nhiệm vụ\\\"]"\`. Ví dụ ĐÚNG: \`title="Tên nhiệm vụ"\`.
    - 7.7. TUYỆT ĐỐI KHÔNG tự bịa ra các thay đổi không có trong văn bản.
    - 7.8. Định dạng đầu ra PHẢI là một đối tượng JSON chứa mảng các tag.
    - 7.9. **CHẤT LƯỢNG NHIỆM VỤ**: Khi tạo nhiệm vụ với \`QUEST_ASSIGNED\`, \`title\` và \`description\` PHẢI mạch lạc, rõ ràng, và mang đầy đủ văn phong phù hợp với thể loại "${genre}". TUYỆT ĐỐI KHÔNG viết cụt lủn khó hiểu kiểu "Giúp" hay "Mối".
  </extraction_rules_7>

  <strict_validation_rules_8>
    ${STRICT_VALIDATION_RULES}
  </strict_validation_rules_8>

  <input_narrative_9>
    """
    ${narrative}
    """
  </input_narrative_9>

  <desired_output_format_10>
    {
      "tags": [
        "[TAG_1]",
        "[TAG_2]"
      ]
    }
  </desired_output_format_10>
</system_prompt_configuration_13_5>
`;
};

export const generateTagAndMemoryExtractionPrompt = (
    narrative: string,
    playerInput: string,
    turnNumber: number,
    locationName: string,
    timeString: string,
    knowledgeBase?: any,
    canAssignQuest: boolean = true
): string => {
    let contextData = "";
    if (knowledgeBase) {
        contextData = convertContextDataToXML(knowledgeBase);
    }

    const questInstruction = canAssignQuest ? `
    <quest_assignment_instructions>
      - 5.1. **Kiểm tra nhiệm vụ**: Tình huống trong lời kể có phù hợp để kích hoạt một nhiệm vụ (chủ yếu là nhiệm vụ phụ hoặc ngẫu nhiên từ NPC)? Nếu có, hãy tạo tag [QUEST_ASSIGNED].
      - 5.2. **Lời mời nhiệm vụ**: Thay vì ép người chơi nhận tự động, hãy ưu tiên dùng trạng thái \`status="pending"\` để hệ thống gửi lời mời (hiện nút Xác Nhận/Hủy Bỏ).
      - 5.3. **BẮT BUỘC ĐỦ 6 TRƯỜNG THÔNG TIN**: Khi tạo nhiệm vụ mới ([QUEST_ASSIGNED]), bạn BẮT BUỘC phải điền TẤT CẢ các thông số sau để hệ thống hiểu được:
        1. 'title': Tên nhiệm vụ (Tuyệt đối không bọc bằng mảng JSON).
        2. 'description': Nội dung mô tả cốt truyện của nhiệm vụ.
        3. 'objectives': Mục tiêu cần đạt được (nếu nhiều thì phân cách bằng dấu '|').
        4. 'rewardText': Mô tả CHI TIẾT phần thưởng khi hoàn thành. BẮT BUỘC có thông số (ví dụ: "Nhận 1000 Kinh Nghiệm, 500 Tiền tệ").
        5. 'punishmentText': Mô tả hậu quả khi thất bại. BẮT BUỘC nêu thời hạn nếu là debuff (ví dụ: "Giảm lực chiến trong 10 lượt"). Hệ thống tự sinh debuff sau khi thất bại, nghiêm cấm tạo mô tả dẫn tới việc lặp lại hình phạt.
        6. 'durationTurns': Số lượt deadline (ví dụ: 10).
      - 5.4. **CHẤT LƯỢNG NHIỆM VỤ**: Nếu bạn sinh ra nhiệm vụ phụ, 'title' và 'description' PHẢI mạch lạc, rõ ràng, và mang đầy đủ văn phong phù hợp với thể loại "${knowledgeBase?.worldConfig?.genre || "Tu Tiên"}". TUYỆT ĐỐI KHÔNG viết cụt lủn khó hiểu kiểu "Giúp" hay "Mối".
      - 5.5. **CHÚ Ý CÚ PHÁP CHUẨN**: TUYỆT ĐỐI KHÔNG dùng mảng JSON hoặc ngoặc vuông không hợp lệ bên trong các tham số của tag. Ví dụ SAI: 'title="[\\"Nhiệm vụ\\"]"'. Ví dụ ĐÚNG: 'title="Tên nhiệm vụ"'.
      - 5.6. **Ví dụ chuẩn**: [QUEST_ASSIGNED: title="Biến cố rắc rối", description="Giúp NPC A giải quyết thử thách trong thời gian ngắn.", objectives="Vượt qua thử thách|Trở về báo cáo", rewardText="50 Exp và 100 Tiền tệ", punishmentText="NPC A chết, mất thiện cảm", durationTurns=20, status="pending"]
    </quest_assignment_instructions>` : "";

    const genre = knowledgeBase?.worldConfig?.genre || "Tu Tiên (Mặc định)";
    const realmProgression = knowledgeBase?.worldConfig?.realmProgression || [];
    const minorRealmProgression = knowledgeBase?.worldConfig?.minorRealmProgression || [];
    const realmInstruction = realmProgression.length > 0 ? 
      `\n      Danh sách Đại Cảnh Giới: ${realmProgression.join(" -> ")}.\n      Danh sách Tiểu Cảnh Giới: ${minorRealmProgression.join(" -> ")}.` : "";

    const tutienhiepVal = knowledgeBase?.Tutienhiep ?? knowledgeBase?.worldConfig?.Tutienhiep ?? knowledgeBase?.playerStats?.Tutienhiep;
    const hasValidTutienhiep = tutienhiepVal === 0 || tutienhiepVal === 1;
    const tutienhiepInstructionBlock = !hasValidTutienhiep ? `
    <nhiem_vu_phan_tich_tutienhiep_+role_definition_1>
================
NƯỚC ĐI BẮT BUỘC - PHÂN TÍCH VÀ XÁC ĐỊNH CHỈ SỐ TUTIENHIEP:
Chỉ số "Tutienhiep" của trò chơi hiện tại CHƯA ĐƯỢC XÁC ĐỊNH (chưa có giá trị 0 hoặc 1).
Bạn PHẢI phân tích bối cảnh trò chơi, tên cảnh giới, công pháp, linh khí, đan dược, pháp bảo, tông môn...:
- Nếu trò chơi/thế giới này thuộc thể loại TU TIÊN hoặc TIÊN HIỆP: Bạn BẮT BUỘC xuất tag [STATS_UPDATE: Tutienhiep="1"] trong mảng tags.
- Nếu trò chơi/thế giới này KHÔNG PHẢI Tu Tiên hay Tiên Hiệp (ví dụ: đô thị hiện đại thuần túy, khoa học viễn tưởng, mạt thế, võ lâm phàm nhân...): Bạn BẮT BUỘC xuất tag [STATS_UPDATE: Tutienhiep="0"] trong mảng tags.
================
    </nhiem_vu_phan_tich_tutienhiep_+role_definition_1>
` : "";

    return `
<system_prompt_configuration_13_6>
  <role_definition_1>
    Bạn là một Hệ Thống Giám Sát kiêm Quản Trò Lưu Trữ chuyên nghiệp của thể loại "${genre}". Nhiệm vụ của bạn là đọc phản hồi của AI và hành động của của người chơi ở lượt ${turnNumber}.
${tutienhiepInstructionBlock}

    <danh_muc_nhiem_vu_va_tac_vu_he_thong_+role_definition_1>
    ================
    TỔNG CỘNG CÓ: 2 NHIỆM VỤ CHÍNH VÀ 11 TÁC VỤ PHỤ BẮT BUỘC. Bạn phải kiểm đếm kỹ lưỡng và hoàn thành toàn bộ tất cả các tác vụ dưới đây, không được bỏ sót bất kỳ một tác vụ nào:

    1. **NHIỆM VỤ CHÍNH 1: TRÍCH XUẤT CÁC "TAG" HỆ THỐNG ĐỒNG BỘ DỮ LIỆU (Gồm 7 Tác vụ phụ)**:
       - **Tác vụ 1.1 (Chỉ số người chơi)**: Trích xuất chính xác các thay đổi về Exp, Linh Thạch, HP, MP, hoặc Trạng thái đặc biệt của người chơi ('[STATS_UPDATE]', '[PLAYER_SPECIAL_STATUS_UPDATE]').
       - **Tác vụ 1.2 (Vật phẩm & Kỹ năng)**: Trích xuất việc thu thập, mua, tiêu thụ vật phẩm hoặc học tập, sử dụng và rèn luyện kỹ năng ('[ITEM_ACQUIRED]', '[ITEM_BOUGHT]', '[ITEM_CONSUMED]', '[SKILL_LEARNED]', '[SKILL_USED]', '[SKILL_UPDATE]').
       - **Tác vụ 1.3 (NPC & Mối quan hệ)**: Trích xuất khởi tạo NPC mới, đổi tên NPC, di chuyển NPC, cập nhật thiện cảm, diện mạo hoặc trạng thái tu vi/cấp độ/cảnh giới của NPC ('[NPC_CREATE]', '[NPC_RENAME]', '[NPC_UPDATE]', '[NPC_MOVE]', '[RELATIONSHIP_UPDATE]', '[APPEARANCE_UPDATE]').
       - **Tác vụ 1.4 (Địa điểm & Thế giới)**: Trích xuất thay đổi, khởi tạo địa điểm chính/phụ, cập nhật vùng an toàn, chuyển dịch vị trí của người chơi, hoặc thêm tư liệu thế giới ('[MAINLOCATION]', '[SUBLOCATION]', '[LOCATION_UPDATE]', '[LOCATION_CHANGE]', '[LOCATION_SAFETY]', '[WORLD_LORE_ADD]').
       - **Tác vụ 1.5 (Thời gian, Nhiệm vụ & Tiến trình)**: Trích xuất thời gian trôi qua, giao nhận nhiệm vụ phụ, kiểm tra liên tục trạng thái nhiệm vụ đang kích hoạt, cập nhật tiến trình hoặc hoàn thành nhiệm vụ, kiểm tra tiến trình sự kiện cốt truyện và hoàn thành sự kiện ('[CHANGE_TIME]', '[QUEST_ASSIGNED]', '[QUEST_CHECK]', '[QUEST_UPDATED]', '[QUEST_COMPLETED]', '[EVENT_CHECK]', '[EVENT_COMPLETE]', '[ARC_RESOLVED]').
       - **Tác vụ 1.6 (Đồng hành, Thê thiếp & Tù nhân/Nô lệ)**: Trích xuất thêm bớt tù nhân, đồng hành mới, cưới vợ, nạp nô lệ, giải phóng tù nhân/nô lệ, và đặc biệt là trích xuất ân ái/giao hoan hoặc mang thai/sinh con ('[PRISONER_ADD]', '[PRISONER_REMOVE]', '[COMPANION_ADD]', '[WIFE_ADD]', '[SLAVE_ADD]', '[BECOMEFREE]', '[INTERACTION]').
       - **Tác vụ 1.7 (Ký ức & Điểm nhấn)**: Trích xuất các sự kiện mang tính dấu ấn cốt truyện lớn hoặc ký ức sâu sắc vào bộ nhớ thực thể ('[CORE_MEMORY_ADD]').

    2. **NHIỆM VỤ CHÍNH 2: PHÂN TÍCH CỐT TRUYỆN & BỘ NHỚ (FLASH AGENT) (Gồm 4 Tác vụ phụ) [YÊU CẦU CỨNG 100% TIẾNG ANH / STRICTOR ENGLISH REQUIREMENT]**:
       - **BẮT BUỘC (CRITICAL):** Cả hai trường "flashSummary" và "flashDetails" PHẢI ĐƯỢC VIẾT 100% BẰNG TIẾNG ANH (ENGLISH ONLY) để tối ưu hóa bộ nhớ RAG của AI Quản Trò. Tuyệt đối không dùng tiếng Việt trong hai trường này.
       - **LƯU Ý ĐẶC BIỆT VỀ TÊN THỰC THỂ (CRITICAL ENTITY NAME RULE):** Khi nhắc đến tên của bất kỳ thực thể nào (bao gồm nhân vật, địa danh, vật phẩm, bí tịch, võ học, tông môn...), BẮT BUỘC PHẢI GIỮ NGUYÊN TÊN TIẾNG VIỆT ĐẦY ĐỦ, tuyệt đối không được tự ý dịch tên thực thể sang tiếng Anh (Ví dụ: viết "Hắc Thổ stealthily uses..." chứ không dịch thành "Black Soil", viết "Hồi Xuân Đan" chứ không dịch thành "Spring Returning Pill", viết "Lục Gia" chứ không dịch thành "Lu Family").
       - **Tác vụ 2.1 (Tóm tắt nhanh)**: Soạn thảo một tóm tắt ngắn từ 4-5 câu chi tiết, súc tích về toàn bộ diễn biến cốt truyện của riêng lượt này (bằng Tiếng Anh / in English).
       - **Tác vụ 2.2 (Diễn biến cốt lõi)**: Liệt kê chi tiết từng hành động, chuyển biến cốt truyện của từng nhân vật dưới dạng gạch đầu dòng cụ thể (bằng Tiếng Anh / in English).
       - **Tác vụ 2.3 (Lời thoại chính xác)**: Trích xuất 100% nguyên văn lời thoại chính xác kèm tên nhân vật phát ngôn (viết bằng Tiếng Anh / in English, có thể dịch hội thoại hoặc giữ nguyên âm hán việt dạng tiếng Anh).
       - **Tác vụ 2.4 (Tri thức & Bối cảnh)**: Ghi chép chi tiết các tri thức mới, bối cảnh tông môn, địa danh kỳ ảo, bảo vật xuất hiện trong lượt chơi (bằng Tiếng Anh / in English).
    ================
    </danh_muc_nhiem_vu_va_tac_vu_he_thong_+role_definition_1>
  </role_definition_1>

  <context_data_2>
    ${contextData}
  </context_data_2>

  <nhiem_vu_1_valid_tags_list_3>
    <category_3_1_player_stats>
      - XML: <stats_update><kinhNghiem>+=X</kinhNghiem><sinhLuc>-=Y%</sinhLuc><linhLuc>-=Z%</linhLuc><currency>+=100</currency></stats_update>
        hoặc: [STATS_UPDATE: kinhNghiem="+=X%", sinhLuc="-=Y%", linhLuc="-=Z%", currency="+=100"] (CHÚ Ý CÚ PHÁP bên dưới)
      - XML: <player_special_status_update><status>Tên</status><duration>X</duration></player_special_status_update>
        hoặc: [PLAYER_SPECIAL_STATUS_UPDATE: status="Tên", duration=X]
      - XML: <mc_rename><newName>Tên mới</newName></mc_rename>
        hoặc: [MC_RENAME: newName="Tên mới"] (Chỉ dùng khi MC thay tên đổi họ, dùng danh tính giả hoặc ẩn danh)
    </category_3_1_player_stats>
    <category_3_2_items_and_skills>
      - XML: <item_acquired><name>Tên</name><type>Equipment</type><slot>mainWeapon</slot><rarity>Quý Báu</rarity><description>Mô tả</description><itemRealm>Cảnh giới</itemRealm><quantity>1</quantity></item_acquired>
        hoặc: [ITEM_ACQUIRED: name="Tên", type="Equipment", slot="mainWeapon", rarity="Quý Báu", description="Mô tả", itemRealm="Cảnh giới", quantity=1]
        hoặc: [ITEM_ACQUIRED: name="Tên Vật Liệu/Đan Dược", category="Material", rarity="Hiếm", description="Mô tả", itemRealm="Cảnh giới", quantity=1]
        hoặc: [ITEM_ACQUIRED: id="ID", quantity=X]
      - XML: <item_bought><name>Tên</name><quantity>X</quantity></item_bought>
        hoặc: [ITEM_BOUGHT: name="Tên", quantity=X] (Chỉ dùng khi mua đồ, hệ thống sẽ tự động trừ Linh Thạch).
      - XML: <item_consumed><id>ID</id><quantity>X</quantity></item_consumed>
        hoặc: [ITEM_CONSUMED: id="ID", quantity=X] (Hệ thống tự quét JSON thuộc tính đồ vật và cộng thẳng).
      - XML: <item_update><id>ID</id><isLost>true</isLost><description>Lý do</description></item_update>
        hoặc: [ITEM_UPDATE: id="ID", isLost="true" (dùng khi vật phẩm hỏng/mất vĩnh viễn), description="Lý do"]
      - XML: <skill_learned><name>Tên</name></skill_learned>
        hoặc: [SKILL_LEARNED: name="Tên"]
      - XML: <skill_used><name>Tên</name></skill_used>
        hoặc: [SKILL_USED: name="Tên"] (Hệ thống tự quét manaCost của Kỹ năng và trừ thẳng Linh Lực).
      - XML: <skill_update><name>Tên</name><proficiency>+=X</proficiency></skill_update>
        hoặc: [SKILL_UPDATE: name="Tên", proficiency="+=X"]
    </category_3_2_items_and_skills>
    <category_3_3_npc_and_relationships>
      - XML: 
        <npc_create>
          <name>Tên</name>
          <gender>Nam/Nữ</gender>
          <description>Mô tả</description>
          <personality>Tính cách</personality>
          <realm>Cảnh giới</realm>
        </npc_create>
        hoặc: [NPC_CREATE: name="Tên", gender="Nam/Nữ", description="Mô tả", personality="Tính cách", realm="Cảnh giới"] (CỰC KỲ QUAN TRỌNG: TUYỆT ĐỐI KHÔNG xuất [NPC_CREATE] cho nhân vật đã tử trận, đã chết, hy sinh hoặc thi thể trong lời kể. Nếu chỉ nhắc tên trong hồi ức/tử trận, CẤM tạo mới!)
      - XML: <npc_rename><oldName>Tên cũ</oldName><newName>Tên mới</newName></npc_rename>
        hoặc: [NPC_RENAME: oldName="Tên cũ", newName="Tên mới"]
      - XML: <npc_update><target>ID@@Tên</target><status>Trạng thái</status><description>Mô tả mới</description><realm>Cảnh giới mới</realm><death>true</death><personality>Tính cách mới</personality></npc_update>
        hoặc: [NPC_UPDATE: target="ID@@Tên", status="Trạng thái", description="Mô tả mới", realm="Cảnh giới mới (tuỳ chọn)", Death="true (chỉ dùng khi NPC bị chết để hệ thống xoá khỏi database)", personality="Tính cách mới"]
      - XML: <npc_move><target>ID@@Tên</target><locationId>ID hoặc tên địa điểm</locationId></npc_move>
        hoặc: [NPC_MOVE: target="ID@@Tên", locationId="ID hoặc tên địa điểm"]
      - XML: <relationship_update><target>ID@@Tên</target><affinity>+=X</affinity><status>Mối quan hệ</status></relationship_update>
        hoặc: [RELATIONSHIP_UPDATE: target="ID@@Tên", affinity="+=X", status="Mối quan hệ"]
      - XML: <appearance_update><name>Tên</name><appearance>Mô tả diện mạo</appearance><duration>5</duration></appearance_update>
        hoặc: [APPEARANCE_UPDATE: name="Tên", appearance="Mô tả chi diện mạo, bề ngoài, y phục, trang phục hiện tại", duration=5] (BẮT BUỘC bóc tách từ lời kể khi phát hiện bất kỳ mô tả nào về diện mạo, quần áo hay cách ăn mặc của nhân vật để lưu giữ trong 5 lượt)
    </category_3_3_npc_and_relationships>
    <category_3_4_locations_and_world>
      - XML: <mainlocation><name>Tên</name><locationType>Loại</locationType><description>Mô tả</description><isSafe>true/false</isSafe><mapX>X</mapX><mapY>Y</mapY></mainlocation>
        hoặc: [MAINLOCATION: name="Tên", locationType="Loại", description="Mô tả", isSafe="true/false", mapX=X, mapY=Y, economicZonesJSON='[...]']
      - XML: <sublocation><name>Tên</name><parentLocationId>ID_Chính</parentLocationId><description>Mô tả</description><locationType>Loại_Phụ</locationType><isSafe>true/false</isSafe></sublocation>
        hoặc: [SUBLOCATION: name="Tên", parentLocationId="ID_Chính", description="Mô tả", locationType="Loại_Phụ", isSafe="true/false"]
      - XML: <location_update><name>Tên</name><isSafe>true/false</isSafe><description>Mô tả mới</description></location_update>
        hoặc: [LOCATION_UPDATE: name="Tên", isSafe="true/false", description="Mô tả mới"]
      - XML: <location_change><name>Tên</name></location_change>
        hoặc: [LOCATION_CHANGE: name="Tên"]
      - XML: <world_lore_add><title>Tiêu đề</title><content>Nội dung</content></world_lore_add>
        hoặc: [WORLD_LORE_ADD: title="Tiêu đề", content="Nội dung"]
    </category_3_4_locations_and_world>
    <category_3_5_time_quests_and_progression>
      - XML: <change_time><canh>+X</canh></change_time> hoặc: [CHANGE_TIME: canh=+X] (Dùng để tịnh tiến thời gian theo số canh giờ tiêu tốn. Ví dụ: canh=+2, bắt buộc phải có dấu + đằng trước).
      - XML: <change_time><ngay>+X</ngay></change_time> hoặc: [CHANGE_TIME: ngay=+X] (Chỉ dùng nếu lời kể đề cập rõ ràng đến việc thời gian trôi qua nhiều ngày, bắt buộc có dấu +).
      - XML: <quest_assigned><title>Tên nhiệm vụ</title><description>Mô tả</description><objectives>Mục tiêu 1|Mục tiêu 2</objectives><rewardText>Thưởng</rewardText><punishmentText>Phạt</punishmentText><durationTurns>SỐ</durationTurns><rewardExp>SỐ</rewardExp><rewardCurrency>SỐ</rewardCurrency><rewardItem>Tên Item</rewardItem><status>active</status></quest_assigned>
        hoặc: [QUEST_ASSIGNED: title="Tên nhiệm vụ", description="Mô tả", objectives="Mục tiêu 1|Mục tiêu 2", rewardText="Thưởng", punishmentText="Phạt", durationTurns=SỐ, rewardExp=SỐ, rewardCurrency=SỐ, rewardItem="Tên Item", status="active/pending"]
      - XML: <quest_check><title>Tên nhiệm vụ</title><reasoning>lý do và bằng chứng</reasoning></quest_check>
        hoặc: [QUEST_CHECK: title="Tên nhiệm vụ", reasoning="lý do và bằng chứng"] (BẮT BUỘC & LIÊN TỤC: Hãy luôn xuất tag này để kiểm tra, phân tích tiến trình và giám sát điều kiện trong từng lượt cho các nhiệm vụ đang ở trạng thái 'active').
      - XML: <quest_updated><title>Tên nhiệm vụ</title><isCompleted>true</isCompleted><status>Trạng thái mới</status><progress>X/Y</progress></quest_updated>
        hoặc: [QUEST_UPDATED: title="Tên nhiệm vụ", isCompleted="true" (dùng khi hoàn thành), status="Trạng thái mới", progress="X/Y"]
      - XML: <quest_completed><title>Tên nhiệm vụ</title><isCompleted>true</isCompleted><reasoning>lý do và bằng chứng</reasoning></quest_completed>
        hoặc: [QUEST_COMPLETED: title="Tên nhiệm vụ", isCompleted="true", reasoning="lý do và bằng chứng"] (Chỉ xuất MỘT LẦN DUY NHẤT để chốt khi nhiệm vụ ĐÃ HOÀN THÀNH HOÀN TOÀN với bằng chứng thực sự. Không xuất kèm QUEST_CHECK ở lượt này).
      - XML: <event_check><name>tên sự kiện</name><reasoning>lý do và bằng chứng</reasoning></event_check>
        hoặc: [EVENT_CHECK: name="tên sự kiện", reasoning="lý do và bằng chứng"] (BẮT BUỘC & LIÊN TỤC: Hãy luôn xuất tag này để duy trì kiểm tra, phân tích tiến trình cốt truyện cho sự kiện đang diễn ra).
      - XML: <event_complete><name>tên sự kiện</name><isCompleted>true</isCompleted><reasoning>lý do và bằng chứng</reasoning></event_complete>
        hoặc: [EVENT_COMPLETE: name="tên sự kiện", isCompleted="true", reasoning="lý do và bằng chứng"] (CẤM NGHIÊM NGẶT: Chỉ xuất MỘT LẦN DUY NHẤT để chốt khi sự kiện cốt truyện ĐÃ HOÀN THÀNH HOÀN TOÀN. Không xuất kèm EVENT_CHECK ở lượt này).
      - XML: <arc_resolved></arc_resolved> hoặc: [ARC_RESOLVED] (Nếu một sự kiện lớn hoặc nhiệm vụ đã kết thúc).
    </category_3_5_time_quests_and_progression>
    <category_3_6_companions_and_prisoners>
      - XML: <prisoner_add><name>Tên NPC</name></prisoner_add> (chuyển NPC thành tù nhân, giữ nguyên 100% thuộc tính gốc).
      - XML: <prisoner_remove><name>Tên NPC</name></prisoner_remove>
      - XML: <prisoner_update><name>Tên NPC</name><free>true</free><description>Lý do</description></prisoner_update>
      - XML: <companion_add><id>ID</id></companion_add> (Dùng cho NPC đã có trong dữ liệu).
      - XML: <wife_add><name>Tên NPC</name></wife_add> (chuyển NPC thành vợ chồng).
      - XML: <slave_add><name>Tên NPC</name></slave_add> (chuyển NPC từ danh sách discoveredNPCs sang slaves, giữ nguyên 100% thuộc tính gốc).
      - XML: <becomefree><name>Tên NPC</name><free>true</free></becomefree>
      - XML: <interaction><type>sex</type><partner>Tên NPC</partner><malePartner>Tên Nam/MC</malePartner></interaction>
      - XML: <interaction><type>pregnancy_reveal</type><partner>Tên NPC</partner></interaction>
    </category_3_6_companions_and_prisoners>
    <category_3_7_memories>
      - XML: <core_memory_add><entityId>ID</entityId><text>Nội dung ký ức</text><strength>X</strength></core_memory_add>
        hoặc: [CORE_MEMORY_ADD: entityId="ID", text="Nội dung ký ức", strength=X] (X từ 1-100).
    </category_3_7_memories>
  </nhiem_vu_1_valid_tags_list_3>

  <stats_update_rules_4>
    - 4.1. **Phép cộng (Tăng thêm)**: Phải viết dạng += (ví dụ: sinhLuc="+=10", currency="+=100"). 
        - ĐÚNG: [STATS_UPDATE: sinhLuc="+=20"] -> Tăng thêm 20 máu.
        - SAI: [STATS_UPDATE: sinhLuc="+20"] -> SẼ BỊ HIỂU NHẦM THÀNH GÁN MÁU BẰNG 20.
    - 4.2. **Phép trừ (Giảm đi)**: Phải viết dạng -= (ví dụ: sinhLuc="-=10", linhLuc="-=5").
        - ĐÚNG: [STATS_UPDATE: sinhLuc="-=5"] -> Trừ đi 5 máu.
        - ĐÚNG: [STATS_UPDATE: sinhLuc="-=15%"] -> Trừ đi 15% máu tối đa (Dùng khi MC bị thương, trúng độc, kiệt sức trong lời kể).
        - SAI: [STATS_UPDATE: sinhLuc="-5"] -> SẼ BỊ HIỂU NHẦM THÀNH GÁN MÁU BẰNG -5 (Hệ thống tự đưa về 0 và NGƯỜI CHƠI CHẾT OAN!).
    - 4.3. **Lượt chơi (Turn update)**: Hệ thống cơ học tự động tăng lượt chơi. TUYỆT ĐỐI KHÔNG tự ý sinh thêm tham số \`turn\` trong tag.
    - 4.4. **Hồi phục tối đa**: Dùng chữ MAX viết hoa (ví dụ: sinhLuc="MAX", linhLuc="MAX").
  </stats_update_rules_4>

  ${questInstruction}

  <npc_relationship_rules_6>
    <npc_move_instruction>
      - 6.1. Đọc kỹ lời kể hiện tại. Nếu phát hiện NPC có hành động di chuyển rời đi, đi đến một địa điểm khác, hoặc xuất hiện tại một địa điểm mới, bạn PHẢI sử dụng tag [NPC_MOVE: target="ID@@Tên", locationId="..."] để cập nhật vị trí cho NPC đó.
      - 6.2. locationId có thể là ID của địa điểm hoặc Tên của địa điểm được nhắc đến trong lời kể.
    </npc_move_instruction>
    - 6.3. [NPC_UPDATE: target="ID@@Tên", status="...", description="...", realm="..."]:
       - Dùng để cập nhật trạng thái cơ thể/tâm lý (Kiệt sức, Trọng thương, Hoảng loạn), mô tả ngoại hình mới, hoặc cảnh giới (realm) mới. BẮT BUỘC sử dụng thuộc tính target="ID@@Tên" để kiểm tra chéo (ví dụ: target="npc-13_2_10@@Đức Luộc").
       - QUAN TRỌNG: Bạn PHẢI quét nội dung <content> để tìm ra mô tả về tình trạng tu vi/cấp độ/cảnh giới/thực lực của các NPC. Nếu tìm thấy, hãy đối chiếu với danh sách cảnh giới và gán tag [NPC_UPDATE] tương ứng như mục 5.3 sử dụng target="ID@@Tên".
       - CẤM: Không đưa affinity hoặc relationship vào tag này.
    - 6.3b. [NPC_RENAME: oldName="...", newName="..."]:
       - Dùng khi nhân vật đổi tên (ví dụ: từ "người áo xám" sang "Lộ Thư").
    - 6.4. [RELATIONSHIP_UPDATE: target="ID@@Tên", affinity="+=X", status="..."]:
       - Dùng khi tình cảm hoặc danh hiệu mối quan hệ thay đổi (Vị hôn thê, Kẻ thù, Sủng vật). BẮT BUỘC sử dụng thuộc tính target="ID@@Tên" thay vì targetId.
       - affinity: Luôn dùng += hoặc -=.
    - 6.5. [APPEARANCE_UPDATE: name="...", appearance="...", duration=5]:
       - BẮT BUỘC dùng khi bóc tách từ nội dung lời kể của AI chính để phát hiện ra nhân vật đang ăn mặc, diện mạo và bề ngoài như thế nào. Ghi nhận chính xác mô tả đó để cập nhật cho nhân vật.
  </npc_relationship_rules_6>

  <sample_extraction_examples_7>
    {
      "tags": [
        "[STATS_UPDATE: kinhNghiem=\"+=20\", sinhLuc=\"-=5\", linhLuc=\"+=10\"]",
        "[NPC_UPDATE: target=\"npc-id-123@@Tên NPC\", status=\"Kiệt sức\", description=\"Mặt đỏ bừng, hơi thở dồn dập sau cuộc hoan ái.\"]",
        "[RELATIONSHIP_UPDATE: target=\"npc-id-123@@Tên NPC\", affinity=\"+=15\", status=\"Vị hôn thê (tự phong)\"]",
        "[CORE_MEMORY_ADD: entityId=\"player\", text=\"Kinh ngạc trước bí mật về Xuân Thu Thiền tại núi Thanh Mao.\", strength=90]"
      ]
    }
  </sample_extraction_examples_7>

  <nhiem_vu_2_flash_details_structure_8>
    Hãy soạn thảo một đoạn văn bản tóm tắt và bóc tách thông tin cốt truyện theo định dạng đúng dưới đây (TẤT CẢ PHẢI VIẾT BẰNG TIẾNG ANH / ALL MUST BE WRITTEN IN ENGLISH):
    - 8.1. **1. Tóm tắt nhanh**: (Viết 4-5 câu vắn tắt, súc tích về toàn bộ diễn biến cốt truyện của riêng lượt này bằng Tiếng Anh).
    ---
    Current Location: \${locationName}
    Time: \${timeString}
    ---
    - 8.2. **2. Diễn biến cốt lõi**: (Liệt kê chi tiết từng nhân vật... không viết đoạn văn, dùng gạch đầu dòng bằng Tiếng Anh).
    - 8.3. **3. Lời thoại chính xác**: (Trích xuất 100% với tên người nói và lời thoại đi theo, dùng gạch đầu dòng bằng Tiếng Anh).
    - 8.4. **4. Tri thức & Bối cảnh**: (Các kiến thức mới, địa điểm, vật phẩm... dùng gạch đầu dòng bằng Tiếng Anh).
  </nhiem_vu_2_flash_details_structure_8>

  <analysis_rules_9>
    <phan_chia_nhiem_vu_+analysis_rules_9>
    ================
    - **CHỐNG DOUBLE-TRIGGER TAG (CỰC KỲ QUAN TRỌNG):** Trong quá trình suy nghĩ (thẻ <thinking>), bạn **TUYỆT ĐỐI KHÔNG** được viết nguyên văn các tag dưới dạng ngoặc vuông (ví dụ: [STATS_UPDATE...]). Hãy chỉ mô tả bằng ngôn ngữ tự nhiên (ví dụ: "Sẽ cập nhật chỉ số..."). Các tag thực tế **CHỈ ĐƯỢC PHÉP XUẤT HIỆN DUY NHẤT MỘT LẦN** bên trong mảng "tags" của khối JSON kết quả. Hệ thống cơ học quét toàn bộ văn bản phản hồi của bạn, nếu bạn viết tag trong <thinking>, nó sẽ bị tính là áp dụng lần 2, gây lỗi dữ liệu và tạo log trùng lặp.
    - **CẤM SINH TAG HÀNH ĐỘNG VÀ TƯƠNG TÁC CHO GIAI ĐOẠN DƯ ÂM (AFTERGLOW) HOẶC SỰ KIỆN QUÁ KHỨ / HỒI ỨC / LƯU ẢNH THẠCH / CHỈ NHẮC ĐẾN (CỰC KỲ QUAN TRỌNG):**
      + Fast Agent (Thiên Đạo Sync) BẮT BUỘC phải phân biệt rõ giữa "Hành động/Sự kiện thực sự có MỤC ĐÍCH/KẾT QUẢ đang diễn ra trong THỜI GIAN THỰC LƯỢT HIỆN TẠI" và "Giai đoạn dư âm (Afterglow) / Hoạt động đụng chạm da thịt, ôm ấp sau cuộc mây mưa / Nội dung thuộc về QUÁ KHỨ / HỒI ỨC / CHỈ ĐƯỢC NHẮC ĐẾN / CHIẾU LẠI QUA PHÁP BẢO".
      + Ví dụ cụ thể với hành động sex: Mục đích của hành động làm tình/ân ái là sự giao hoan, thâm nhập và "lên đỉnh/cao trào". Nếu sự "lên đỉnh/cao trào" đã nằm ở lượt trước, còn ở lượt hiện tại hai nhân vật chỉ có sự đụng chạm da thịt, nằm ôm nhau, nằm nghỉ ngơi như một phần của bước dư âm (Afterglow) sau cuộc mây mưa -> **TUYỆT ĐỐI CẤM XUẤT TAG [INTERACTION: type="sex"...] Ở LƯỢT HIỆN TẠI!**
      + Khi lời kể hoặc thẻ <update_data> đề cập đến một hành động, sự kiện, tương tác thể xác (ân ái, làm tình, hoan ái), giao tranh chiến đấu, nhận đồ vật, di chuyển vị trí, trừ/cộng chỉ số v.v. xảy ra trong **QUÁ KHỨ**, **HỒI ỨC**, **HOÀI NIỆM**, **ẢO ẢNH / GIẤC MƠ**, **BẰNG CHỨNG TỪ LƯU ẢNH THẠCH / LƯU ẢNH PHÙ / CHIẾU PHẠM**, hoặc **CHỈ ĐƯỢC KỂ LẠI / THẢO LUẬN TRONG LỜI THOẠI**:
      + Fast Agent **TUYỆT ĐỐI CẤM** sinh ra các tag hành động/trạng thái/tương tác thời gian thực cho lượt hiện tại, bao gồm: [INTERACTION: type="sex"...], [LOCATION_CHANGE], [ITEM_ACQUIRED], [STATS_UPDATE], [BEGIN_COMBAT], [NPC_MOVE], [PRISONER_ADD], [WIFE_ADD], [SLAVE_ADD], v.v.
      + Các tag tương tác/hành động thời gian thực **CHỈ ĐƯỢC PHÉP XUẤT** khi hành động đó **ĐANG THỰC SỰ XẢY RA TRỰC TIẾP VÀ CÓ MỤC ĐÍCH/KẾT QUẢ NẰM TRỌN TRONG THỜI GIAN THỰC Ở LƯỢT HIỆN TẠI**.
      + Ví dụ thực tế: Nếu Lưu Ảnh Thạch trình chiếu cảnh làm tình giữa MC/NPC trong quá khứ, hay hai nhân vật đang nằm ôm nhau trò chuyện sau khi đã làm tình ở lượt trước -> **KHÔNG XUẤT TAG [INTERACTION: type="sex"] HAY [BEGIN_COMBAT]** ở lượt hiện tại! (Chỉ dùng thông tin đó để kiểm tra tiến trình nhiệm vụ [QUEST_COMPLETED] hoặc ghi nhận ký ức [CORE_MEMORY_ADD] nếu cần).
    - **CĂN CỨ TRÍCH XUẤT TỐI CAO (CỰC KỲ QUAN TRỌNG):** Bạn là AI xử lý phụ (AI Thiên Đạo Sync). Nhiệm vụ tối thượng của bạn là đọc các dòng cập nhật bằng ngôn ngữ tự nhiên viết bên trong thẻ <update_data> và các thông tin thực thể bám sát bên trong thẻ <Entity_Tracking> của AI chính, sau đó tiến hành phán đoán, phân tích sâu sắc để dịch chúng thành các tag hệ thống chính xác dạng ngoặc vuông [TAG: params...].
    - Bạn **TUYỆT ĐỐI KHÔNG** tự ý trích xuất các tag dựa trên suy luận mơ hồ từ lời kể content thô trừ khi có dòng yêu cầu "Cập nhật: tiến hành phân tích chiến đấu" hoặc khi có thông tin rõ ràng hoặc cơ chế đặc biệt bắt buộc cần so khớp bối cảnh chiến đấu từ các thẻ đồng bộ dữ liệu hệ thống nêu trên (<update_data>, <Entity_Tracking>).
    - Định dạng trích xuất dựa trên ngôn ngữ tự nhiên và thông số trong các thẻ đồng bộ:
      + "Cập nhật: tăng X độ thiện cảm cho [Tên NPC]" hoặc dữ liệu thay đổi thiện cảm từ <Entity_Tracking> -> Xuất [RELATIONSHIP_UPDATE: target="[ID của NPC]@@[Tên NPC]", affinity="+=X"] hoặc [WIFE_UPDATE: name="...", affinity="+=X"] / [SLAVE_UPDATE: name="...", obedience="+=X"] / [PRISONER_UPDATE: name="...", obedience="+=X"].
      + "Cập nhật: di chuyển [Nhân vật] đến [Địa điểm]" hoặc bối cảnh chuyển dịch địa lý trong <Entity_Tracking> -> Xuất [LOCATION_CHANGE: name="[Tên địa điểm]"].
      + "Cập nhật: thêm địa điểm mới [Tên]..." -> Xuất [SUBLOCATION] hoặc [MAINLOCATION]. Luôn xác định rõ isSafe.
      + "Cập nhật: [Địa điểm] đã trở nên an toàn/nguy hiểm" -> Xuất [LOCATION_UPDATE: name="...", isSafe="true/false"].
      + "Cập nhật: Trạng thái bối cảnh hiện tại là AN TOÀN" -> Xuất [LOCATION_SAFETY: status="safe", isSafe="true"].
      + "Cập nhật: Trạng thái bối cảnh hiện tại là NGUY HIỂM" -> Xuất [LOCATION_SAFETY: status="danger", isSafe="false"].
      + "Cập nhật: Kích hoạt phân tích chiến đấu" / "Kích hoạt chiến đấu" / "Phân tích chiến đấu" / "Kích hoạt phân tích chiến đấu." hoặc khi lời kể đe dọa giao tranh -> BẮT BUỘC xuất [BEGIN_COMBAT: opponentIds="Tên kẻ địch/NPC thù địch trong cảnh"].
      + "Cập nhật: giảm X linh lực của MC" -> Xuất [STATS_UPDATE: linhLuc="-=X"].
      + "Cập nhật: [Tên NPC] đã/đang làm tình với [Tên Nam] (trong thời gian thực lượt hiện tại)" -> Xuất [INTERACTION: type="sex", partner="[Tên NPC Nữ]", malePartner="[Tên Nam]"] (Tuyệt đối CẤM xuất nếu cảnh này chỉ thuộc về quá khứ, hồi ức, hoặc chiếu lại qua Lưu Ảnh Thạch).
      + "Cập nhật cảnh giới của [Tên NPC] lên Kết Đan Hậu Kỳ" -> Xuất [NPC_UPDATE: target="[ID của NPC]@@[Tên NPC]", status="Bình thường", description="Cảnh giới tăng lên Kết Đan Hậu Kỳ.", realm="Kết Đan Hậu Kỳ"].
      + "Cập nhật: [Tên NPC] mang thai của [Tên MC]" -> Xuất [NPC_UPDATE: target="[ID của NPC]@@[Tên MC]", status="Mang thai", description="Đang mang trong mình cốt nhục của [Tên MC]"].
      + "Cập nhật: [Tên NPC] đã sinh con của [Tên MC]" -> Xuất [NPC_UPDATE: target="[ID của NPC]@@[Tên MC]", status="Bình thường", description="Đã hạ sinh con cho [Tên MC]"].
      + "Cập nhật: [Tên NPC] đã chết/tử trận/bị giết" -> Xuất [NPC_UPDATE: target="[ID của NPC]@@[Tên NPC]", Death="true", description="Mô tả lý do chết/bị kết liễu"].
      + "Cập nhật: nhiệm vụ [Tên] đã hoàn thành" -> Xuất [QUEST_COMPLETED: title="...", isCompleted="true", reasoning="..."].
      + "Cập nhật: tù binh [Tên] được tự do/thả ra" -> Xuất [PRISONER_UPDATE: name="...", free="true", description="Được trả tự do."].
      + "Cập nhật: tù binh/tù nhân [Tên cũ] đổi tên thành/tiết lộ tên [Tên mới]" hoặc "Cập nhật: rename [Tên cũ] -> [Tên mới]" -> Xuất [NPC_RENAME: oldName="[Tên cũ]", newName="[Tên mới]"].
      + **CƠ CHẾ TỰ ĐỘNG ĐỔI TÊN TÙ NHÂN CHƯA CÓ TÊN RIÊNG (<prisoners>)**: Fast Agent BẮT BUỘC duyệt qua TẤT CẢ tù nhân trong danh sách \<prisoners\>. Bằng khả năng suy luận của mình, bạn tự đánh giá tên của từng tù nhân: Nếu tên đó chỉ là mô tả ngoại hình/danh xưng/nghề nghiệp/chức danh/tập thể (như "Tên tu sĩ gầy gò", "Gã mặt sẹo", "Đám tu sĩ...", "Nữ tu sĩ...", "Tên cướp...", "Nữ tù nhân...") chứ chưa phải tên riêng Tiên Hiệp/Kiếm Hiệp chuẩn bối cảnh, bạn BẮT BUỘC xuất tag [NPC_RENAME: oldName="[Tên cũ]", newName="[Tên mới]"] cho TẤT CẢ các tù nhân đó ngay trong lượt này (xuất nhiều tag NPC_RENAME nếu có nhiều tù nhân cần đổi tên), KHÔNG GIỚI HẠN số lượng và NGAY CẢ KHI AI CHÍNH KHÔNG NHẮC TỚI VIỆC ĐỔI TÊN TRONG LỜI KỂ.
      + "Cập nhật: vật phẩm [Tên] bị hỏng/mất/tiêu biến" -> Xuất [ITEM_UPDATE: id="...", isLost="true", description="Mô tả lý do mất đồ"].
      + "Cập nhật: MC nhận được trang bị/vật phẩm [Tên...]" hoặc thẻ <item_acquired> trong <update_data> -> Xuất [ITEM_ACQUIRED: name="...", type="Equipment/Material/Potion...", slot="...", rarity="...", description="...", itemRealm="...", quantity=X].
    ================
    </phan_chia_nhiem_vu_+analysis_rules_9>
    <trich_xuat_bien_dong_9_1_+analysis_rules_9>
    ================
    - Chỉ trích xuất những thay đổi ĐÃ XẢY RA hoặc ĐƯỢC KHẲNG ĐỊNH trong <update_data>, <Entity_Tracking>. NẾU TRONG LỜI KỂ KHÔNG CÓ THẺ <update_data>, BẠN PHẢI ĐỌC LẠI TOÀN BỘ NỘI DUNG THÔ ĐỂ TRÍCH XUẤT TAG.
    ================
    </trich_xuat_bien_dong_9_1_+analysis_rules_9>

    <quet_realm_npc_rules_+analysis_rules_9>
    ================
    - **QUY TẮC QUÉT CẢNH GIỚI NPC TRONG LỜI KỂ (<content>)**: Bạn PHẢI quét kỹ nội dung lời kể ('<content>') để chủ động phát hiện bất kỳ manh mối, mô tả nào về tu vi, cấp độ, cảnh giới, hoặc thực lực của các NPC.
    - **QUY TRÌNH PHÂN TÍCH & ĐỐI CHIẾU CẢNH GIỚI NPC:**
      1. **Bóc tách & Suy luận:** Xác định thực lực NPC từ lời kể. (Ví dụ: "Mã Quản Sự tỏa ra uy áp Kết Đan Kỳ..." -> Mã Quản Sự có thực lực Kết Đan Kỳ).
      2. **Đối chiếu danh sách cảnh giới:** So sánh với hệ thống cảnh giới hiện có của game.${realmInstruction}
      3. **Xử lý Minor mặc định:** Nếu lời kể chỉ nhắc đến Cảnh giới lớn (Major - như "Kết Đan") mà không nhắc tới Minor cụ thể (sơ kỳ, hậu kỳ, tầng...), bạn mặc định gán cho NPC đó Minor thấp nhất của Major đó (Ví dụ: "Kết Đan 1 tầng" hoặc "Kết Đan sơ kỳ" tuỳ thuộc vào danh sách cấu hình).
      4. **BẮT BUỘC CHUẨN HOÁ ĐỊNH DẠNG:** Định dạng bắt buộc: "[Đại Cảnh Giới] [Tiểu Cảnh Giới]". VD ĐÚNG: "Trúc Cơ Trung Kỳ", "Trúc Cơ Tầng 5". VD SAI: "Trúc Cơ 5 tầng".
      5. **Khởi tạo Tag đồng bộ:** Xuất tag '[NPC_UPDATE: id="ma_quan_su", realm="Kết Đan Tầng 1"]' (hoặc đúng ID/Tên NPC hiện tại) vào mảng tags JSON để hệ thống lưu trữ đồng bộ dữ liệu.
    ================
    </quet_realm_npc_rules_+analysis_rules_9>

    <bo_sung_realm_npc_create_+analysis_rules_9>
    ================
    - Khi xuất tag [NPC_CREATE], ngoài các trường name, gender, description, personality, BẮT BUỘC PHẢI TRÍCH XUẤT CẢNH GIỚI (realm) nếu có thông tin từ <update_data> hoặc từ nội dung lời kể / bối cảnh.
    - Định dạng: [NPC_CREATE: name="Tên", gender="Nam/Nữ", description="Mô tả", personality="Tính cách", realm="Cảnh giới"]
    ================
    </bo_sung_realm_npc_create_+analysis_rules_9>

    <can_cu_khoi_dong_bo_9_1_b_+analysis_rules_9>
    ================
    - **CÁC KHỐI DỮ LIỆU ĐỒNG BỘ (<update_data>, <Entity_Tracking>):** Bạn PHẢI đọc kỹ nội dung bên trong các thẻ <update_data> và <Entity_Tracking> của phản hồi AI chính. Đây là các căn cứ tối cao chứa các chỉ thị cập nhật bằng ngôn ngữ tự nhiên và thông tin bối cảnh thế giới của AI Quản Trò, đặc biệt là [LOCATION_CHANGE]. Nếu thiếu <update_data>, toàn bộ nội dung lời kể sẽ trở thành nguồn trích xuất chính.
    ================
    </can_cu_khoi_dong_bo_9_1_b_+analysis_rules_9>

    <quyet_dinh_nhiem_vu_9_2_+analysis_rules_9>
    ================
    - **QUYẾT ĐỊNH THẨM ĐỊNH VÀ HOÀN THÀNH NHIỆM VỤ (GATEKEEPER):** AI chính có trách nhiệm đề xuất xác nhận hoàn thành vào thẻ <update_data>, còn bạn là cơ quan thẩm định và chốt trạng thái cuối cùng (Propose & Verify).
      TUYỆT ĐỐI LƯU Ý: Trước khi xuất bất kỳ tag hoàn thành nhiệm vụ hay sự kiện cốt truyện nào, bạn PHẢI đối chiếu lý do với nội dung lời kể thực tế (<content>) và mục tiêu trong <active_quests> / <original_timeline_event>. Phải đảm bảo có đầy đủ bằng chứng thực tế và hành động yêu cầu phải hoàn chỉnh thì mới xuất tag '[QUEST_COMPLETED]' hoặc '[EVENT_COMPLETE]'. Không cho phép hoàn thành dễ dãi hoặc thiếu các thực tế tương tác cốt truyện.

      ${TAG_EXTRACTOR_QUEST_SYNC_RULES}
    ================
    </quyet_dinh_nhiem_vu_9_2_+analysis_rules_9>

    <nhiem_vu_ky_uc_9_3_+analysis_rules_9>
    ================
    - Đối với Nhiệm vụ 2 (Ký ức): Tuyệt đối không phân tích, không bình luận, giữ nguyên phần Vị trí và Thời gian được cung cấp (Current Location / Time). Phần tóm tắt nhanh và chi tiết của ký ức phải đủ 4-5 câu chi tiết và BẮT BUỘC PHẢI VIẾT HOÀN TOÀN BẰNG TIẾNG ANH (ENGLISH ONLY).
    - **QUY TẮC GIỮ TÊN TIẾNG VIỆT THỰC THỂ:** Tất cả tên thực thể (nhân vật, địa danh, vật phẩm, bí tịch, tông môn,...) khi xuất hiện trong tóm tắt tiếng Anh đều PHẢI viết bằng tiếng Việt đầy đủ nguyên bản, không được dịch bất kỳ tên thực thể nào sang tiếng Anh.
    ================
    </nhiem_vu_ky_uc_9_3_+analysis_rules_9>

    <dia_diem_hanh_trinh_9_4_+analysis_rules_9>
    ================
    - **ĐỊA ĐIỂM & HÀNH TRÌNH (LOCATION)**:
      + **LUẬT GIỚI HẠN (CỰC KỲ QUAN TRỌNG):** AI Thiên Đạo Sync CHỈ được phép xuất thẻ [LOCATION_CHANGE: name="..."] dựa TRỰC TIẾP trên nội dung trong các thẻ <update_data>, <Entity_Tracking> của lượt hiện tại. NẾU KHÔNG CÓ THẺ <update_data>, BẠN MỚI ĐƯỢC PHÉP TÌM KIẾM SỰ DI CHUYỂN TRONG TOÀN BỘ NỘI DUNG THÔ.
      + Tuyệt đối KHÔNG tự ý trích xuất tag này chỉ dựa trên suy luận mơ hồ từ phần lời kể <content> nếu trong các thẻ đồng bộ dữ liệu hệ thống không có yêu cầu hay thông tin thay đổi vị trí rõ ràng.
      + QUY TẮC PHÂN CẤP: Hạn chế tối đa [MAINLOCATION]. Nếu địa điểm thuộc về hoặc phụ thuộc một Thành phố/Tông môn/Địa danh lớn đã có, BẮT BUỘC dùng [SUBLOCATION].
      + KIỂM TRA AN TOÀN: Luôn xác định isSafeZone=true/false cho mọi địa điểm mới hoặc khi có biến động an ninh tại địa điểm hiện tại.
    ================
    </dia_diem_hanh_trinh_9_4_+analysis_rules_9>

    <dinh_dang_phan_hoi_9_5_+analysis_rules_9>
    ================
    - Phản hồi của bạn PHẢI bao gồm hai phần:
      1. **Phần phân tích và kiểm tra logic (Thinking/Validation)**: BẮT BUỘC phải bọc trong thẻ XML sau (Tuyệt đối không dùng thẻ <thinking> thông thường):
         <phan_tich_+extraction_result>
         ================
         (Nội dung phân tích logic, kiểm tra bằng chứng từ lời kể, bước thực hiện trích xuất, đối chiếu với các thẻ đồng bộ dữ liệu...)
         <kiem_duyet_realm_+extraction_rules>
         <luat_chan_ha_cap_+kiem_duyet_realm>
         ================
         QUY TẮC CẤM HẠ CẤP CẢNH GIỚI (MANDATORY): Kiểm chứng tham số realm="..." trong các thẻ [STATS_UPDATE] (của MC) và [NPC_UPDATE] (của NPC). Tuyệt đối không cập nhật cảnh giới MC/NPC thấp hơn hoặc ngang bằng cảnh giới hiện tại. Nếu cảnh giới hiện tại là major 3 minor 2, thì tag trích xuất chỉ được phép chứa cảnh giới cao hơn. Nếu nhận thấy nội dung từ AI chính có xu hướng hạ cấp tu vi, lập tức chặn việc xuất tag cập nhật realm, giữ nguyên tu vi hiện tại.
         ================
         </luat_chan_ha_cap_+kiem_duyet_realm>
         </kiem_duyet_realm_+extraction_rules>
         ================
         </phan_tich_+extraction_result>
      2. **Phần kết quả dữ liệu**: Xuất khối JSON chứa các tag đã trích xuất theo đúng mẫu bên dưới ngay sau thẻ XML trên. Bạn bắt buộc phải có thuộc tính "audit_kiemke" trong JSON để báo cáo chi tiết các tác vụ chính và phụ đã thực hiện.
    ================
    </dinh_dang_phan_hoi_9_5_+analysis_rules_9>
  </analysis_rules_9>

  <strict_validation_rules_10>
    ${STRICT_VALIDATION_RULES}
  </strict_validation_rules_10>

  <input_data_11>
    <player_action>
      """
      ${playerInput}
      """
    </player_action>
    <ai_response>
      """
      ${narrative}
      """
    </ai_response>
  </input_data_11>

  <desired_output_format_12>
    {
      "tags": [
        "[TAG_1]",
        "[TAG_2]"
      ],
      "flashSummary": "<A detailed English plot summary of 4-5 sentences about the developments of this turn (derived from Task 2). Keep all entity names such as characters, locations, items in full Vietnamese (e.g., 'Hắc Thổ', 'Hồi Xuân Đan', 'Lục Gia') - DO NOT translate any entity names>",
      "flashDetails": "1. Fast Summary: <Write a 4-5 sentence summary of this turn's events in English. Keep all entity names in full Vietnamese - DO NOT translate any entity names>\\n---\\nCurrent Location: ${locationName}\\nTime: ${timeString}\\n---\\n2. Core Developments:\\n- <Detail developments in English, keeping all entity names in full Vietnamese>\\n3. Exact Dialogue:\\n- <Speaker Name (Full Vietnamese)>: \\\"<English dialogue statement or translation with entity names in full Vietnamese>\\\"\\n4. Knowledge & Lore:\\n- <New lore, sect background, magic items, etc. in English with entity names in full Vietnamese>",
      "audit_kiemke": "Nhiệm vụ chính 1 [X/7 tác vụ phụ], Nhiệm vụ chính 2 [Y/4 tác vụ phụ]. (Báo cáo cụ thể các tác vụ đã thực hiện thành công, ví dụ: 'Đã hoàn thành 3/7 tác vụ phụ của Nhiệm vụ 1 bao gồm tác vụ 1.1, tác vụ 1.3, tác vụ 1.5')"
    }
  </desired_output_format_12>
</system_prompt_configuration_13_6>
`;
};
