
import { KnowledgeBase, CombatEndPayload, NPC, YeuThu, ItemCategoryValues, TU_CHAT_TIERS, GameMessage } from '../types';
import * as GameTemplates from '../templates';
import { STAT_POINT_VALUES, SPECIAL_EFFECT_KEYWORDS, WEAPON_TYPES_FOR_VO_Y } from '../constants';
import { CONG_PHAP_GRADES, LINH_KI_CATEGORIES, LINH_KI_ACTIVATION_TYPES, PROFESSION_GRADES } from '../templates';

// A local type to safely add entityType
// FIX: Changed to a discriminated union to allow for proper type narrowing.
type DefeatedEntity = (NPC & { entityType: 'npc' }) | (YeuThu & { entityType: 'yeuThu' });

export const generateVictoryConsequencePrompt = (
    kb: KnowledgeBase, 
    combatResult: CombatEndPayload,
    currentPageMessagesLog: string,
    previousPageSummaries: string[],
    lastNarrationFromPreviousPage: string | undefined,
    currentCombatSummary: string
): string => {
    const { summary, dispositions, opponentIds, lastCombatTurns, storyContext } = combatResult;

    const allDefeatedEntities: DefeatedEntity[] = opponentIds
        .map(id => 
            (kb.discoveredNPCs.find(n => n.id === id) as NPC | undefined) || 
            (kb.discoveredYeuThu.find(y => y.id === id) as YeuThu | undefined) ||
            (kb.wives?.find(w => w.id === id) as NPC | undefined) ||
            (kb.slaves?.find(s => s.id === id) as NPC | undefined) ||
            (kb.prisoners?.find(p => p.id === id) as NPC | undefined) ||
            (kb.pendingCombat?.temporaryEntities?.find(te => te.id === id) as NPC | undefined)
        )
        .filter((e): e is NPC | YeuThu => e !== undefined)
        .map((e): DefeatedEntity => ({ ...e, entityType: 'species' in e ? 'yeuThu' : 'npc' } as DefeatedEntity)); // Add entityType and assert the new type


    const normalizedDispositions: Record<string, string> = {};
    Object.entries(dispositions).forEach(([key, val]) => {
        const realId = key.replace(/^enemy_\d+_/, '');
        normalizedDispositions[realId] = val as string;
    });

    const killedEntities = allDefeatedEntities.filter(e => normalizedDispositions[e.id] === 'kill');
    const capturedEntities = allDefeatedEntities.filter(e => normalizedDispositions[e.id] === 'capture');
    const releasedNpcs = allDefeatedEntities.filter(e => e.entityType === 'npc' && normalizedDispositions[e.id] === 'release') as NPC[];
    const defeatedBeasts = allDefeatedEntities.filter(e => e.entityType === 'yeuThu') as YeuThu[]; // Beasts are always "defeated"
    
    // --- Lấy danh sách đồng minh gục ngã (HP = 0) ---
    const deadAlliesList = (combatResult.finalAlliesStatus || []).filter(a => a.hp <= 0);
    const deadAlliesNames = deadAlliesList.map(ally => {
        const found = kb.wives?.find(w => w.id === ally.id) ||
                      kb.slaves?.find(s => s.id === ally.id) ||
                      kb.discoveredNPCs?.find(n => n.id === ally.id) ||
                      kb.prisoners?.find(p => p.id === ally.id);
        return found ? found.name : ally.id;
    });

    // --- MILESTONE CHECK: FIRST VICTORY ---
    let firstVictoryInstruction = "";
    const hasFirstVictoryMilestone = kb.milestones && kb.milestones["first_victory"];
    
    if (!hasFirstVictoryMilestone) {
        firstVictoryInstruction = `
**CỘT MỐC QUAN TRỌNG: CHIẾN THẮNG ĐẦU TIÊN!**
Đây là lần đầu tiên người chơi chiến thắng một trận chiến. Bạn **BẮT BUỘC** phải:
1. Viết một đoạn văn ngắn nhưng hào hùng mô tả cảm giác chiến thắng lần đầu này.
2. Sử dụng tag: \`[UNLOCK_MILESTONE: id="first_victory", description="Chiến thắng đầu đời: Đánh bại ${allDefeatedEntities[0]?.name || 'kẻ thù'}."]\`
3. Tạo một ký ức cốt lõi mạnh mẽ: \`[CORE_MEMORY_ADD: text="Hương vị ngọt ngào của chiến thắng đầu tiên trước ${allDefeatedEntities[0]?.name || 'kẻ thù'}.", strength=60]\`
`;
    }
    // --- END MILESTONE CHECK ---

    // FIX: Add type guard to handle DefeatedEntity union type correctly.
    const capturedEntitiesContext = capturedEntities.length > 0
    ? `**CHI TIẾT VỀ CÁC KẺ ĐỊCH BỊ BẮT GIỮ (JSON - Dùng để sao chép vào tag PRISONER_ADD):**
${JSON.stringify(capturedEntities.map(e => {
    const base = {
        name: e.name,
        description: e.description,
        realm: e.realm,
    };
    if (e.entityType === 'npc') {
        return {
            ...base,
            gender: e.gender,
            race: e.race,
            tuChat: e.tuChat,
            spiritualRoot: e.spiritualRoot,
            specialPhysique: e.specialPhysique,
        };
    } else { // It's a YeuThu
        return {
            ...base,
            gender: 'Không rõ',
            race: e.species,
            // Other fields are intentionally omitted as they don't apply to YeuThu
        };
    }
}), null, 2)}`
    : '';

    const itemTagInstructions = `
*   **HỆ THỐNG SINH TRANG BỊ TỰ ĐỘNG (ƯU TIÊN CHO TRANG BỊ):**
    *   **Tag \`[GENERATE_EQUIPMENT: ...]\` (KHUYÊN DÙNG cho Vũ khí/Giáp/Trang sức):**
        *   Dùng tag này khi bạn muốn hệ thống tự động tính toán chỉ số (Sức tấn công, Sinh lực...) và các hiệu ứng passive (Hút máu, Phản đòn...) dựa trên Level và Độ hiếm. Bạn không cần phải viết tay JSON phức tạp.
        *   **Tham số:** \`name="Tên" city="số" rarity="Độ hiếm" type="Loại"\`.
        *   \`rarity\`: Phổ Thông | Hiếm | Quý Báu | Cực Phẩm | Thần Thoại | Truyền Thuyết.
        *   \`type\`: Vũ Khí | Giáp Thân | Giáp Đầu | Giáp Tay | Giáp Chân | Trang Sức | Pháp Bảo.
        *   **Ví dụ:** \`[GENERATE_EQUIPMENT: name="U Linh Đao", level="30", rarity="Hiếm", type="Vũ Khí"]\`

*   **Tag Vật Phẩm Nhận Được Cố Định \`[ITEM_ACQUIRED: ...]\` (Dùng cho Đan dược/Nguyên liệu/Trang bị đặc biệt):**
    *   Sử dụng tag này khi bạn muốn CHỈ ĐỊNH CHÍNH XÁC từng con số hoặc khi vật phẩm KHÔNG phải là trang bị cơ học (ví dụ: Đan dược, Bí tịch, Nguyên liệu).
    *   **Tham số Bắt Buộc:** \`name\`, \`type\`, \`description\`, \`quantity\`, \`rarity\`, \`itemRealm\`.
    *   \`type\`: Phải bao gồm **Loại Chính** và **Loại Phụ** (nếu có).
        *   **Loại Chính Hợp Lệ:** ${Object.values(GameTemplates.ItemCategory).join(' | ')}.
        *   Nếu Loại Chính là \`${GameTemplates.ItemCategory.EQUIPMENT}\`, Vị Trí (\`slot\`) PHẢI là một trong: "Vũ Khí Chính" | "Vũ Khí Phụ" | "Giáp Đầu" | "Giáp Thân" | "Giáp Tay" | "Giáp Chân" | "Trang Sức" | "Pháp Bảo".
            *   **Tham số RIÊNG \`slot\` cũng BẮT BUỘC** (ví dụ: \`slot="Vũ Khí Chính"\`).
            *   **Tham số RIÊNG \`statBonusesJSON\` BẮT BUỘC** (nếu không có, dùng \`statBonusesJSON='{}'\`).
            *   **Tham số RIÊNG \`uniqueEffectsList\` BẮT BUỘC** (nếu không có, dùng \`uniqueEffectsList="Không có gì đặc biệt"\`).
        *   Nếu Loại Chính là \`${GameTemplates.ItemCategory.POTION}\`, Loại Phụ (\`potionType\`) PHẢI là một trong: ${Object.values(GameTemplates.PotionType).join(' | ')}.
            *   **Tham số RIÊNG \`potionType\` cũng BẮT BUỘC**.
            *   **Tham số RIÊNG \`effectsList\` BẮT BUỘC**.
        *   Nếu Loại Chính là \`${GameTemplates.ItemCategory.MATERIAL}\`, Loại Phụ (\`materialType\`) PHẢI là một trong: ${Object.values(GameTemplates.MaterialType).join(' | ')}.
            *   **Tham số RIÊNG \`materialType\` cũng BẮT BUỘC**.
    *   \`itemRealm\`: BẮT BUỘC. Cảnh giới của vật phẩm. PHẢI là một trong các cảnh giới lớn của thế giới: \`${kb.realmProgressionList.join(' | ')}\`.
    `;

    const contextBlock = `
# BỐI CẢNH CÂU CHUYỆN (NHẬT KÝ CHI TIẾT GẦN NHẤT):
${currentPageMessagesLog || storyContext || "Không có dữ liệu bối cảnh truyện."}

# DIỄN BIẾN KỸ THUẬT CỦA TRẬN CHIẾN (Dữ liệu tham khảo):
${lastCombatTurns?.join('\n') || "Không có dữ liệu lượt đánh gần đây."}

# TÓM TẮT DIỄN BIẾN TRẬN CHIẾN VỪA XONG:
${currentCombatSummary || summary}

# TÓM TẮT LỊCH SỬ CŨ HƠN:
${previousPageSummaries.join("\n\n") || "Không có."}
`;


    const mcInfo = `
# THÔNG TIN NHÂN VẬT CHÍNH (MC):
- **Họ Tên:** ${kb.worldConfig?.playerName || 'Người chơi'}
- **Giới Tính:** ${kb.worldConfig?.playerGender || 'Không rõ'}
- **Chủng Tộc:** ${kb.worldConfig?.playerRace || 'Nhân Tộc'}
- **Cảnh Giới:** ${kb.playerStats.realm}
- **Tính Cách:** ${kb.worldConfig?.playerPersonality || 'Chưa rõ'}
- **Bối Cảnh:** ${kb.worldConfig?.playerBackstory || 'Chưa rõ'}
`;

    const pronounGuidance = `
# HƯỚNG DẪN XƯNG HÔ (QUAN TRỌNG):
- Dựa trên Giới Tính của MC là **${kb.worldConfig?.playerGender}**:
  - Nếu là **Nam**: Sử dụng đại từ "hắn", "y", "chàng", "anh", "tên này".
  - Nếu là **Nữ**: Sử dụng đại từ "nàng", "ả", "cô ta", "thiếu nữ này".
  - Tuyệt đối không nhầm lẫn giới tính trong lời dẫn.
- Xưng hô của NPC đối với MC phải phản ánh đúng mối quan hệ và tính cách.
`;

    // --- [THIÊN ĐẠO SYNC] Xác định MVP và thông tin chi tiết ---
    const mvpDetails = (combatResult as any).mvpDetails;
    let mvpInfo = "";
    if (mvpDetails) {
        const mvpEntity = [
            ...kb.wives,
            ...kb.slaves,
            ...kb.prisoners,
            ...kb.discoveredNPCs
        ].find(a => a.id === mvpDetails.id || a.name === mvpDetails.name);

        mvpInfo = `
# THÔNG TIN NHÂN VẬT XUẤT SẮC NHẤT (MVP):
- **Họ Tên:** ${mvpDetails.name}
- **Thành tích:** ${mvpDetails.kills} kills, ${mvpDetails.damage} sát thương.
- **Mô tả nhân vật:** ${mvpEntity?.description || "Một chiến binh dũng mãnh của phe ta."}
- **Cảnh giới:** ${mvpEntity?.realm || "Không rõ"}
- **Pháp bảo/Trang bị:** ${mvpEntity?.equippedItems ? Object.values(mvpEntity.equippedItems).filter(Boolean).join(', ') : 'Không rõ'}
`;
    }

    const defeatedEntitiesInfo = allDefeatedEntities.length > 0
    ? `
# DANH SÁCH ĐỐI THỦ BẠI TRẬN VÀ GIỚI TÍNH:
${allDefeatedEntities.map(e => {
    const lastHitInfo = (combatResult as any).lastHits?.[e.id] || (combatResult as any).lastHits?.[`enemy_${allDefeatedEntities.indexOf(e)}`];
    const killerName = lastHitInfo ? lastHitInfo.sourceName : 'Không rõ';
    const killerId = lastHitInfo ? lastHitInfo.sourceId : 'unknown';
    const isPlayerKiller = killerId === 'player' || killerName === kb.worldConfig?.playerName;

    return `- **Họ Tên:** ${e.name} | **Giới Tính:** ${e.entityType === 'npc' ? (e as NPC).gender : 'Không rõ'} | **Cảnh Giới:** ${e.realm || 'Không rõ'} | **Người dứt điểm:** ${killerName}${isPlayerKiller ? ' (Chính là MC)' : ''} | **Trạng Thái/Quyết Định:** ${normalizedDispositions[e.id] === 'kill' ? 'Kết liễu (Sẽ chết)' : normalizedDispositions[e.id] === 'capture' ? 'Bắt giữ' : 'Thả đi'}`;
}).join('\n')}
`
    : '';

    // [THIÊN ĐẠO SYNC] Xác định xem MC có tham gia chiến đấu tích cực không
    const playerName = kb.worldConfig?.playerName || 'Người chơi';
    const playerGotLastHit = Object.values((combatResult as any).lastHits || {}).some((lh: any) => 
        lh.sourceId === 'player' || 
        lh.sourceName === playerName || 
        lh.sourceName === 'Người chơi'
    );
    
    const isPlayerMvp = mvpDetails?.id === 'player' || 
                        mvpDetails?.name === playerName || 
                        mvpDetails?.name === 'Người chơi';
                        
    const playerHasKillsOrDmg = (mvpDetails?.id === 'player' && ((mvpDetails?.kills || 0) > 0 || (mvpDetails?.damage || 0) > 0)) || 
                                (mvpDetails?.name === playerName && ((mvpDetails?.kills || 0) > 0 || (mvpDetails?.damage || 0) > 0));

    // Fallback: Nếu không có đồng minh, MC buộc phải là người chiến đấu
    const hasNoAllies = (combatResult.finalAlliesStatus || []).length === 0;

    const isPlayerActiveAndHeroic = playerGotLastHit || isPlayerMvp || playerHasKillsOrDmg || hasNoAllies;

    const promptText = `
Bạn là một AI quản trò, có nhiệm vụ kể lại hậu quả sau một trận chiến mà người chơi đã chiến thắng.

${mcInfo}
${mvpInfo}
${defeatedEntitiesInfo}
${pronounGuidance}

${contextBlock}

**QUYẾT ĐỊNH CỦA NGƯỜI CHƠI SAU TRẬN ĐẤU:**
- **Kết liễu (Sẽ chết):** ${killedEntities.length > 0 ? killedEntities.map(n => `${n.name} (${n.entityType === 'yeuThu' ? n.species : n.realm || 'Không rõ'})`).join(', ') : 'Không có ai.'}
- **Bắt giữ (Sẽ còn sống và bị bắt làm tù binh):** ${capturedEntities.length > 0 ? capturedEntities.map(n => `${n.name} (${n.entityType === 'yeuThu' ? n.species : n.realm || 'Không rõ'})`).join(', ') : 'Không có ai.'}
- **Thả đi (Chỉ NPC - Sẽ còn sống và rời đi):** ${releasedNpcs.length > 0 ? releasedNpcs.map(n => n.name).join(', ') : 'Không có ai.'}

**TÌNH TRẠNG NPC/ĐỒNG MINH PHE TA SAU CHIẾN ĐẤU:**
- **Đồng minh tử trận (Có HP = 0, đã chết hẳn/hy sinh vĩnh viễn):** ${deadAlliesNames.length > 0 ? deadAlliesNames.join(', ') : 'Không có đồng minh nào bị tử trận.'}

**YÊU CẦU ĐẶC BIỆT VỀ LỜI KỂ (BẮT BUỘC):**
1. **Dáng vẻ hào hùng của người dứt điểm:** Với mỗi kẻ địch bị hạ gục, hãy mô tả dáng vẻ hào hùng, áp đảo và chiêu thức đẹp mắt của nhân vật đã tung đòn dứt điểm (Last Hit) dựa trên danh sách "Người dứt điểm" ở trên.
2. **Thể hiện vai trò của MC:** ${isPlayerActiveAndHeroic ? 'MC đã tham gia chiến đấu tích cực (là MVP, có sát thương, hoặc tự mình chiến đấu), hãy mô tả sự uy dũng, kiên cường và sức mạnh của MC trong và sau trận đấu. Ngay cả khi MC không tung đòn dứt điểm, hãy kể về đóng góp to lớn của MC trong việc áp chế kẻ thù.' : 'CẢNH BÁO: MC HOÀN TOÀN KHÔNG tham gia chiến đấu hay gây sát thương/dứt điểm trong trận này (chỉ có đồng minh đánh). Bạn hãy mô tả MC núp sau lưng đồng minh, không dám ra mặt chiến đấu trực diện.'}

${capturedEntitiesContext}

**YÊU CẦU DÀNH CHO BẠN (AI):**
Dựa trên kết quả của trận chiến vừa xong, hãy viết tiếp lời dẫn cho hành động tiếp theo của người chơi.
- Lời kể phải liền mạch với nội dung lời dẫn truyện trước khi vào combat (Ví dụ: Nếu nãy giờ đang tả trời mưa, thì hậu quả cũng phải có mưa).
- Sử dụng **DIỄN BIẾN KỸ THUẬT** chỉ để biết người chơi đã thắng thế nào (ai bị thương nặng, ai bị kết liễu bằng chiêu gì).
- Lời kể phải logic với trạng thái cuối cùng của nhân vật trong bối cảnh câu chuyện.

1.  **VIẾT LỜI KỂ (BẮT BUỘC):**
    Hãy trình bày theo cấu trúc sau:
    *   **Kết quả trận chiến:** Mô tả ngắn gọn (1-3 câu) về kết cục cuối cùng (ai thắng, ai bại, tình trạng sơ bộ của các bên), TUYỆT ĐỐI KHÔNG liệt kê chi tiết diễn biến từng lượt đánh.
    *   **Hậu quả trận chiến:** Đoạn văn kể lại chi tiết những gì xảy ra tiếp theo:
        *   Mô tả cảnh người chơi xử lý các đối thủ theo QUYẾT ĐỊNH CỦA NGƯỜI CHƠI ở trên.
        *   **LƯU Ý CỰC KỲ QUAN TRỌNG:** 
            *   Nếu kẻ địch nằm trong danh sách **"Bắt giữ"**, bạn **TUYỆT ĐỐI KHÔNG** được kể rằng họ bị giết. Họ phải còn sống, có thể bị thương hoặc bị khống chế, và bị người chơi bắt làm tù binh.
            *   Nếu kẻ địch nằm trong danh sách **"Kết liễu"**, hãy mô tả cái chết của họ và thu thập chiến lợi phẩm.
            *   Nếu có danh sách **"Đồng minh tử trận"** ở trên, bạn **BẮT BUỘC** phải mô tả một cách bi tráng chi tiết cái chết của họ, sự hy sinh anh dũng và biến mất vĩnh viễn khỏi cuộc đời người chơi. Tuyệt đối không được tả họ còn sống hoặc chỉ bất tỉnh, hãy tuyên bố và xác nhận họ đã chết hẳn để nhất quán với việc họ bị xóa khỏi nhóm.
        *   Mô tả việc thu thập chiến lợi phẩm từ những kẻ bị giết.
        *   Kể về cảm xúc của người chơi hoặc bất kỳ diễn biến nào sau trận chiến (ví dụ: một người qua đường chứng kiến, hoặc tìm thấy một vật phẩm lạ trên người kẻ địch).
        *   **QUY TẮC CẤM EXP (MỚI):** **TUYỆT ĐỐI KHÔNG** tạo ra bất kỳ tag \`[STATS_UPDATE: kinhNghiem=+=...]\` nào. Kinh nghiệm từ chiến đấu sẽ được hệ thống tự động tính toán (10% tổng HP địch) và cộng vào. Bạn chỉ tập trung vào trang bị và lời kể.

2.  **TẠO TAGS HỆ THỐNG (BẮT BUỘC):**
    ${firstVictoryInstruction}
    *   **Với mỗi kẻ địch bị giết (Kết liễu):** Hệ thống đã tự động xóa dữ liệu của họ. Bạn **TUYỆT ĐỐI KHÔNG** dùng tag \`NPC_REMOVE\` hay \`YEUTHU_REMOVE\`. Tuy nhiên, bạn VẪN PHẢI tạo ra các tag thưởng vật phẩm.
        *   **QUY TẮC PHẦN THƯỞNG MỚI (BẮT BUỘC):** 
            *   **Để tặng TRANG BỊ (Vũ khí/Giáp...):** PHẢI ưu tiên sử dụng tag \`[GENERATE_EQUIPMENT: name="Tên", level="X", rarity="Y", type="Z"]\` để đảm bảo chỉ số cân bằng với hệ thống chiến đấu.
            *   **Để tặng ĐAN DƯỢC/NGUYÊN LIỆU/BÍ TỊCH:** Sử dụng tag \`[ITEM_ACQUIRED: ...]\`.
            *   **TIỀN TỆ:** Người chơi đã nhận được một lượng tiền (Linh Thạch/Credit) từ Loot Box trong game. Bạn có thể tặng thêm một lượng nhỏ nếu thấy MC xứng đáng, dùng tag \`[STATS_UPDATE: currency="+=X"]\`.
            *   **CHỈ ĐƯỢC RƠI RA TRANG BỊ & VẬT PHẨM QUÝ:** Vũ khí, giáp trụ, pháp bảo, vật phẩm tiêu hao (đan dược), bí tịch công pháp hoặc nguyên liệu trân quý (như Yêu Đan, Linh Dược).
            *   **CHẤT LƯỢNG & SỐ LƯỢNG:** Phải tỉ lệ thuận với cảnh giới/sức mạnh của kẻ địch. Kẻ địch càng mạnh, trang bị phải có thuộc tính càng cao và phẩm cấp càng hiếm. Thường rơi 1-3 món tùy độ khó.
    *   **Với mỗi kẻ địch bị bắt giữ (Bắt giữ):** Hệ thống đã tự động thêm họ vào danh sách Tù Binh. Bạn **TUYỆT ĐỐI KHÔNG** dùng tag \`PRISONER_ADD\`. Chỉ cần mô tả việc họ bị bắt trói an toàn.
        *   **MÔ TẢ VÀ TIỂU SỬ TÙ BÌNH MỚI (BẮT BUỘC):** Hãy viết 1-2 đoạn văn mô tả rõ ràng về tên gọi (hoặc xưng hô ban đầu), diện mạo, phong thái và sơ qua tiểu sử/nguồn gốc lai lịch của tù nhân vừa bị bắt giữ này để người chơi nắm rõ thông tin của tù nhân mới trong ngục.
    *   **KHÔNG tạo tag** cho những kẻ bị thả.
    *   **Phần thưởng nhiệm vụ (Nếu trận chiến này là một phần của nhiệm vụ):** Ngoài các chiến lợi phẩm thông thường, bạn có thể trao thưởng thêm các vật phẩm hoặc kỹ năng đặc biệt cho chế độ "Chiến Đấu Thử". Các vật phẩm/kỹ năng này BẮT BUỘC phải có tiền tố "combat ".
        *   **Ví dụ vật phẩm:** \`[ITEM_ACQUIRED: name="combat Phượng Hoàng Lệ", type="Potion Đặc Biệt", potionType="Đặc Biệt", description="Hồi sinh một đồng minh đã gục ngã với 25% HP trong chế độ chiến đấu thử nghiệm.", quantity=1, rarity="Quý Báu", value=5000, itemRealm="Nguyên Anh", effectsList="Hồi sinh 25% HP"]\`
        *   **Ví dụ kỹ năng (dưới dạng vật phẩm ngọc giản):** \`[ITEM_ACQUIRED: name="Ngọc Giản: combat Liệt Hỏa Phần Thiên", type="LinhKi", description="Ghi lại Linh Kĩ 'combat Liệt Hỏa Phần Thiên', gây sát thương lửa mạnh lên tất cả kẻ địch trong chế độ chiến đấu thử nghiệm.", quantity=1, rarity="Hiếm", value=3000, itemRealm="Kim Đan", skillToLearnJSON='{"name":"combat Liệt Hỏa Phần Thiên", "description":"Gây sát thương lửa mạnh lên tất cả kẻ địch.", "skillType":"Linh Kĩ", "manaCost":25, "baseDamage":220, "otherEffects":"Gây sát thương lửa mạnh lên tất cả kẻ địch."}']\`

3.  **HƯỚN DẪN TAG VẬT PHẨM:**
    ${itemTagInstructions}

4.  **TẠO LỰA CHỌN MỚI (BẮT BUỘC):**
    *   Sau khi mô tả xong hậu quả, cung cấp 3-4 lựa chọn \`[CHOICE: "..."]\` để người chơi tiếp tục cuộc phiêu lưu.

5.  **LƯỢT CHƠI (TỰ ĐỘNG CẬP NHẬT):**
    *   Lượt chơi sẽ được hệ thống phần mềm tự động tăng cơ học, bạn TUYỆT ĐỐI CẤM tự ý sinh thêm tag STATS_UPDATE: turn=+1.

**VÍ DỤ (Người chơi giết 1 Yêu Thú, bắt giữ 1 tên cướp):**
(Lời kể bạn viết ra sẽ nằm ở đây)
Bạn lạnh lùng kết liễu con Hỏa Lang, thu lấy yêu đan và bộ da của nó. Tên cướp còn lại run rẩy xin tha, bạn quyết định trói hắn lại và áp giải về.
[ITEM_ACQUIRED: name="Yêu Đan Hỏa Lang", type="Material Yêu Đan", materialType="Yêu Đan", description="Yêu đan chứa hỏa linh lực của Hỏa Lang.", quantity=1, rarity="Hiếm", value=250, itemRealm="Trúc Cơ"]
[CHOICE: "Kiểm tra Yêu Đan vừa nhặt được."]
[CHOICE: "Tra hỏi tên tù binh về sào huyệt của chúng."]
[CHOICE: "Rời khỏi nơi này và tìm một chỗ nghỉ ngơi."]
`;
    return promptText;
};
