
import { WorldSettings, StartingSkill, StartingItem, StartingNPC, StartingLore, StartingLocation, StartingFaction, GenreType, ViolenceLevel, StoryTone, NsfwDescriptionStyle, TuChatTier, StartingYeuThu } from '../types';
import { SUB_REALM_NAMES, ALL_FACTION_ALIGNMENTS, AVAILABLE_GENRES, VIETNAMESE, CUSTOM_GENRE_VALUE, DEFAULT_VIOLENCE_LEVEL, DEFAULT_STORY_TONE, VIOLENCE_LEVELS, STORY_TONES, DEFAULT_NSFW_DESCRIPTION_STYLE, NSFW_DESCRIPTION_STYLES, WEAPON_TYPES_FOR_VO_Y, STAT_POINT_VALUES, SPECIAL_EFFECT_KEYWORDS, TU_CHAT_TIERS } from '../constants';
import * as GameTemplates from '../templates';
import { CONG_PHAP_GRADES, LINH_KI_CATEGORIES, LINH_KI_ACTIVATION_TYPES, PROFESSION_GRADES } from '../templates';

// Helper to determine if a field is empty or at its default state.
// We are hardcoding default values to avoid circular dependencies with constants.ts.
const isFieldEmptyForCompletion = (fieldName: keyof WorldSettings, value: any): boolean => {
    if (value === undefined || value === null) return true;
    if (Array.isArray(value)) return value.length === 0;
    if (typeof value === 'string') return value.trim() === '';

    // Specific default value checks for numbers that have non-zero defaults
    // These values are from `constants/world.ts`
    switch(fieldName) {
        case 'startingCurrency':
            return value === 10;
        case 'playerThoNguyen':
            return value === 100;
        case 'playerMaxThoNguyen':
            return value === 100;
        default:
            // For other numbers, consider 0 as potentially empty unless it's a valid setting.
            // For booleans (like nsfwMode), !value works correctly (false is considered "empty"/default).
            return !value; 
    }
};

// Helper to determine if a field is empty or at its default state, or if it needs more items.
const describeField = (label: string, fieldName: keyof WorldSettings, value: any, minCount?: number): string => {
    if (isFieldEmptyForCompletion(fieldName, value)) {
        return `  - ${label}: **CẦN TẠO**${minCount ? ` (Tạo ít nhất ${minCount} mục)` : ''}`;
    }
    
    if (Array.isArray(value) && minCount && value.length < minCount) {
        const missingCount = minCount - value.length;
        return `  - ${label}: ĐÃ CÓ ${value.length} mục. **CẦN TẠO THÊM ÍT NHẤT ${missingCount} MỤC NỮA ĐỂ ĐỦ ${minCount} MỤC**`;
    }

    return `  - ${label}: ĐÃ CÓ (Giá trị hiện tại: ${JSON.stringify(value)}) - **CHỈ THAY ĐỔI NẾU CÓ YÊU CẦU TỪ Ý TƯỞNG NGƯỜI CHƠI**`;
};


export const generateCompletionPrompt = (
    settings: WorldSettings,
    isNsfwIdea: boolean,
    genre: GenreType,
    isCultivationEnabled: boolean,
    violenceLevel: ViolenceLevel, 
    storyTone: StoryTone,       
    customGenreName?: string,
    nsfwStyle?: NsfwDescriptionStyle,
    canonData?: string 
): string => {

    const effectiveGenreDisplay = (genre === CUSTOM_GENRE_VALUE && customGenreName) ? customGenreName : genre;
    const currentViolenceLevel = violenceLevel || DEFAULT_VIOLENCE_LEVEL;
    const currentStoryTone = storyTone || DEFAULT_STORY_TONE;
    const currentNsfwStyle = nsfwStyle || DEFAULT_NSFW_DESCRIPTION_STYLE;

    const isFanfic = !!settings.originalStorySummary;

    const genreMappingInstruction = `
**QUY TẮC CHUYỂN ĐỔI THUẬT NGỮ THEO THỂ LOẠI (CỰC KỲ QUAN TRỌNG):**
Nếu thể loại không phải là "Tu Tiên", bạn PHẢI sử dụng các trường dữ liệu hiện có để mô tả các khái niệm tương đương trong thể loại đó. KHÔNG ĐƯỢC để trống chỉ vì tên trường mang tính tu tiên.
*   **Linh Căn (Spiritual Root):** Chuyển thành "Năng khiếu đặc biệt", "Hệ điều hành/Cyberdeck" (Cyberpunk), "Dòng máu/Hệ ma pháp" (Fantasy), "Gen đột biến" (Mạt thế), v.v.
*   **Thể Chất Đặc Biệt (Special Physique):** Chuyển thành "Cấu trúc cơ thể đặc biệt", "Mod cơ thể/Cyberware" (Cyberpunk), "Chủng tộc đặc biệt", "Năng lực thức tỉnh", v.v.
*   **Cảnh Giới (Realm):** Chuyển thành "Cấp độ", "Bậc", "Tier", "Level", "Danh hiệu sức mạnh", v.v.
*   **Tư Chất (Tu Chất):** Chuyển thành "Tiềm năng", "Độ tương thích hệ thống", "Chỉ số IQ/Thể lực", v.v.
*   **Yêu Thú (Beasts):** Chuyển thành "Quái vật", "Robot chiến đấu", "Sinh vật đột biến", "Cổ thần", v.v.
*   **Công Pháp/Linh Kỹ:** Chuyển thành "Kỹ năng phần mềm", "Ma pháp", "Chiêu thức võ thuật", "Công nghệ chiến đấu", v.v.
`;

    const cultivationSystemInstructions = isCultivationEnabled ? `
    *   **KIẾN TẠO HỆ THỐNG CẤP BẬC SỨC MẠNH (NHIỆM VỤ TRỌNG TÂM):**
        *   Dựa trên Thể Loại "${effectiveGenreDisplay}" và Chủ Đề "${settings.theme}", bạn PHẢI tự suy diễn hoặc tìm hiểu hệ thống cấp bậc phù hợp.
        *   KHÔNG ĐƯỢC mặc định dùng các thuật ngữ Tu Tiên trừ khi thể loại là Tu Tiên.
        *   Ví dụ: 
            - Cyberpunk: Tier 1 -> Tier 10 hoặc Cấp độ cấy ghép Chrome.
            - Harry Potter: Năm 1 -> Năm 7 -> Pháp sư trưởng.
            - Marvel: Street Level -> City -> Planetary -> Cosmic.
        *   BẮT BUỘC tạo tag [GENERATED_RACE_SYSTEM: race="Tên Chủng Tộc", system="Hệ thống cấp bậc, phân cách bằng ' - '"] với ít nhất 10 cấp bậc rõ ràng.
    *   **YÊU CẦU TỐI CAO VỀ CẢNH GIỚI (SUPREME REQUIREMENT):**
        *   Danh sách Đại cảnh giới hợp lệ: ${settings.cultivationSystem.majorRealmsRaw || "Chưa thiết lập"}
        *   Danh sách Tiểu cảnh giới hợp lệ: ${settings.cultivationSystem.minorRealmsRaw || "Chưa thiết lập"}
        *   KHI TẠO NHÂN VẬT/NPC: Cảnh giới PHẢI tuân thủ cấu trúc: "Tên Đại Cảnh Giới Tên Tiểu Cảnh Giới".
        *   Ví dụ: Nếu Đại cảnh giới là "Luyện Khí" và Tiểu cảnh giới là "Tầng 1", thì cảnh giới hợp lệ là "Luyện Khí Tầng 1".
        *   TUYỆT ĐỐI KHÔNG sáng tạo thêm cảnh giới nằm ngoài danh sách trên.
    *   **Tạo Hệ Thống Cấp Bậc Quái Vật/Sinh Vật Nguy Hiểm:**
        *   Tạo hệ thống riêng cho sinh vật nguy hiểm trong thế giới này phù hợp với thể loại.
        *   Định dạng: [GENERATED_YEUTHU_SYSTEM: system="Hệ thống cấp bậc, phân cách bằng ' - '"]
    *   **Tạo Cấp Độ Khởi Đầu:**
        *   Định dạng: [GENERATED_CANH_GIOI_KHOI_DAU: text="Cấp độ cụ thể"]. BẮT BUỘC phải là bậc thấp nhất (Bậc 1) trong hệ thống sức mạnh bạn vừa tạo ở trên.
` : ``;
    
    const lifespanInstruction = isCultivationEnabled ? `
**HƯỚN DẪN VỀ THỌ NGUYÊN (TUỔI THỌ):**
Tuổi thọ tối đa (\`maxThoNguyen\`) tăng mạnh theo từng đại cảnh giới. Đây là quy tắc BẮT BUỘC bạn phải tuân theo khi tạo người chơi và NPC.
*   **Công thức tính:**
    1.  **Thọ nguyên gốc (Phàm Nhân):** 120 năm.
    2.  **Thọ nguyên cộng thêm mỗi đại cảnh giới:** \`Thọ nguyên cộng thêm = 100 * (1.8 ^ (Thứ tự đại cảnh giới - 1))\`.
*   **Cách áp dụng:**
    *   **\`maxThoNguyen\`:** PHẢI được tính theo công thức trên dựa vào cảnh giới của nhân vật.
    *   **\`thoNguyen\` (số năm còn lại):** PHẢI nhỏ hơn \`maxThoNguyen\`.
` : '';

    const npcRealmInstruction = isCultivationEnabled
    ? `, realm="Cấp độ/Cảnh giới của NPC (BẮT BUỘC). Phải sử dụng thuật ngữ phù hợp với thể loại '${effectiveGenreDisplay}'. Ví dụ: 'Tier 3', 'Mage Rank 2', 'Luyện Khí Tầng 5'. Tuyệt đối không để trống." tuChat="CHỌN MỘT TRONG: ${TU_CHAT_TIERS.join(' | ')} (Đại diện cho tiềm năng của NPC)" spiritualRoot="Năng khiếu/Linh căn (BẮT BUỘC, ví dụ: 'Neural Link 90%', 'Hỏa Hệ', 'Gen X'). Nếu không có thì ghi 'Không có'", specialPhysique="Thể chất/Biến đổi cơ thể (BẮT BUỘC, ví dụ: 'Sandevistan Mk.4', 'Tiên Thiên Đạo Thể'). Nếu không có thì ghi 'Không có'", thoNguyen=X, maxThoNguyen=Y (BẮT BUỘC. Tính toán logic dựa trên tuổi tác và cấp độ sức mạnh.)`
    : `, thoNguyen=X, maxThoNguyen=Y (BẮT BUỘC. Tính toán logic dựa trên tuổi tác.)`;

    const tagGenerationInstructions = `
**HƯỚN DẪN VỀ ĐỊNH DẠNG TAG (Sử dụng các tag này để trả về dữ liệu):**

*   **Thông Tin Thế Giới:**
    *   [GENERATED_GENRE: text="..."]
    *   [GENERATED_WORLD_THEME: text="..."]
    *   [GENERATED_WORLD_SETTING_DESCRIPTION: text="..."]
    *   [GENERATED_WORLD_WRITING_STYLE: text="..."]
    *   [GENERATED_CURRENCY_NAME: name="..."]
    *   [GENERATED_STARTING_CURRENCY: value=X]
*   **Thông Tin Nhân Vật:**
    *   [GENERATED_PLAYER_NAME: name="..."]
    *   [GENERATED_PLAYER_GENDER: text="..."]
    *   [GENERATED_PLAYER_RACE: text="..."]
    *   [GENERATED_PLAYER_PERSONALITY: text="..."]
    *   [GENERATED_PLAYER_BACKSTORY: text="..."]
    *   [GENERATED_PLAYER_GOAL: text="..."]
    *   [GENERATED_PLAYER_SPIRITUAL_ROOT: text="..."]
    *   [GENERATED_PLAYER_SPECIAL_PHYSIQUE: text="..."]
*   **Hệ Thống Sức Mạnh:**
    *   [GENERATED_RACE_SYSTEM: race="...", system="..."]
    *   [GENERATED_YEUTHU_SYSTEM: system="..."]
    *   [GENERATED_CANH_GIOI_KHOI_DAU: text="..."]
*   **Yếu Tố Khởi Đầu:**
    *   [GENERATED_NPC: name="...", gender="...", race="...", personality="...", initialAffinity=0, details="...", relationshipToPlayer="..."${npcRealmInstruction}].
    *   [GENERATED_ITEM: name="...", description="...", category="...", rarity="...", itemRealm="..."]
    *   [GENERATED_SKILL: name="...", description="...", skillType="...", otherEffects="..."]
`;

    let nsfwGuidanceForWorldGen = "";
    if (isNsfwIdea) {
        const violenceGuidanceText = VIETNAMESE[`violenceLevelGuidance${currentViolenceLevel.replace(/\s+/g, '')}` as keyof typeof VIETNAMESE] || VIETNAMESE.violenceLevelGuidanceThucTe;
        const storyToneGuidanceText = VIETNAMESE[`storyToneGuidance${currentStoryTone.replace(/\s+/g, '')}` as keyof typeof VIETNAMESE] || VIETNAMESE.storyToneGuidanceTrungTinh;
        let nsfwStyleSpecificGuidance = "";
        switch(currentNsfwStyle) {
            case 'Hoa Mỹ': nsfwStyleSpecificGuidance = VIETNAMESE.nsfwGuidanceHoaMy; break;
            case 'Trần Tục': nsfwStyleSpecificGuidance = VIETNAMESE.nsfwGuidanceTranTuc; break;
            case 'Gợi Cảm': nsfwStyleSpecificGuidance = VIETNAMESE.nsfwGuidanceGoiCam; break;
            case 'Mạnh Bạo (BDSM)': nsfwStyleSpecificGuidance = VIETNAMESE.nsfwGuidanceManhBaoBDSM; break;
            default: nsfwStyleSpecificGuidance = VIETNAMESE.nsfwGuidanceHoaMy;
        }


        nsfwGuidanceForWorldGen = `
- **Yêu cầu nội dung 18+:** BẬT. Hãy chủ động, ưu tiên và tích cực tạo ra các tên gọi, mô tả, tính cách, chi tiết NPC, kỹ năng, vật phẩm, và tri thức thế giới mang tính chất người lớn, nhạy cảm, và tình dục.
- **Phong Cách Miêu Tả Tình Dục (Người dùng chọn):** ${currentNsfwStyle}.
  ${nsfwStyleSpecificGuidance}
- **Mức Độ Bạo Lực (Người dùng chọn):** ${currentViolenceLevel}.
  ${violenceGuidanceText}
- **Tông Màu Câu Chuyện (Người dùng chọn):** ${currentStoryTone}.
  ${storyToneGuidanceText}
[GENERATED_NSFW_DESCRIPTION_STYLE: text="${currentNsfwStyle}"]
[GENERATED_VIOLENCE_LEVEL: text="${currentViolenceLevel}"]
[GENERATED_STORY_TONE: text="${currentStoryTone}"]`;
    } else {
        nsfwGuidanceForWorldGen = "- **Yêu cầu nội dung 18+:** TẮT. Vui lòng tạo các yếu tố phù hợp với mọi lứa tuổi, tập trung vào phiêu lưu và phát triển nhân vật.";
    }

return `
Bạn là một AI hỗ trợ viết lách và sáng tạo thế giới game nhập vai thể loại "${effectiveGenreDisplay}".
${canonData ? `
[CHỈ THỊ TỐI CAO - STRICT GROUNDING]
DỮ LIỆU NGUYÊN TÁC DƯỚI ĐÂY LÀ CHUẨN MỰC DUY NHẤT VÀ CAO NHẤT. 
1. Bạn phải ưu tiên dữ liệu này hơn bất kỳ kiến thức nền nào của bạn. 
2. Mọi tình tiết, nhân vật, và hệ thống phải khớp 100% với dữ liệu này. 
3. Nếu có sự mâu thuẫn giữa nguyên tác và ý tưởng người chơi, hãy ưu tiên ý tưởng người chơi TUY NHIÊN vẫn phải giữ hồn cốt của dữ liệu này.

<CANON_DATA>
${canonData}
</CANON_DATA>
` : ""}
${isFanfic ? `Đây là một dự án **ĐỒNG NHÂN (FANFICTION)** dựa trên tác phẩm: "${settings.theme}". Hãy sử dụng Tóm tắt cốt truyện nguyên tác để đảm bảo tính nhất quán cao nhất.` : `Người dùng đã điền một vài thông tin cho thế giới của họ và cần bạn giúp đỡ để hoàn thiện những phần còn trống.`}
${isFanfic ? `**YÊU CẦU ĐẶC BIỆT CHO ĐỒNG NHÂN:** Bạn **BẮT BUỘC PHẢI SỬ DỤNG CƠ CHẾ GOOGLE SEARCH GROUNDING (TÌM KIẾM TRÊN MẠNG)** để tra cứu thông tin chính xác nhất về các thực thể (nhân vật, địa điểm, kỹ năng, vật phẩm) trong nguyên tác. Khi tạo một thực thể thuộc nguyên tác, thông tin của nó (bề ngoài, tính cách, bối cảnh, sức mạnh) PHẢI được lấy từ nguồn thông tin thực tế trên mạng, không được tự bịa ra.` : ''}

**NHIỆM VỤ:**
1.  **Đọc kỹ** các thông tin đã có trong phần "THÔNG TIN HIỆN TẠI". Các thông tin này là bối cảnh chính.
2.  **ƯU TIÊN TUYỆT ĐỐI Ý TƯỞNG CỦA NGƯỜI CHƠI (BẮT BUỘC):** Nếu trong phần "**Ý TƯỞNG ĐỒNG NHÂN CỦA NGƯỜI CHƠI**" có yêu cầu cụ thể (ví dụ: "Nhân vật chính là Văn Thánh", "Hệ thống tu luyện là Kiếm Lai"), bạn **PHẢI** tuân theo yêu cầu đó ngay cả khi nó mâu thuẫn với thông tin nguyên tác hoặc thông tin hiện tại. 
    *   **Ví dụ:** Nếu nguyên tác là "Kiếm Lai" nhưng người chơi ghi "Nhân vật chính là Văn Thánh", bạn PHẢI tạo tag [GENERATED_PLAYER_NAME: name="Văn Thánh"] và KHÔNG ĐƯỢC để là "Trần Bình An".
    *   **Ví dụ:** Nếu người chơi yêu cầu một hệ thống tu luyện khác, bạn PHẢI tạo lại các tag [GENERATED_RACE_SYSTEM: ...] để ghi đè.
3.  Dựa vào các thông tin đó, hãy **sáng tạo** và điền vào các mục được đánh dấu là "**CẦN TẠO**".
4.  **QUY TẮC TỐI THƯỢNG:** Chỉ trả về các tag [GENERATED_...] cho những mục được đánh dấu là '**CẦN TẠO**' hoặc khi cần ghi đè theo ý tưởng người chơi. **TUYỆT ĐỐI KHÔNG** tạo lại tag cho những mục đã được đánh dấu là "ĐÃ CÓ" trừ khi có yêu cầu ghi đè từ người chơi.
5.  **MÔ TẢ CHI TIẾT (BẮT BUỘC):** Mọi vật phẩm và kỹ năng PHẢI có mô tả chi tiết (ít nhất 2 câu), không được để trống thuộc tính \`description\`.
6.  **HỆ THỐNG TU LUYỆN (KIẾM LAI):** Nếu tác phẩm là "Kiếm Lai", hệ thống tu luyện PHẢI là: "Luyện Khí - Trúc Cơ - Kim Đan - Nguyên Anh - Ngọc Phác - Tiên Nhân - Phi Thăng - Thất Hải - Hợp Đạo - Thập Ngũ Cảnh". Hãy đảm bảo các NPC và người chơi được gán cảnh giới phù hợp trong hệ thống này.
7.  **SỐ LƯỢNG:** Đảm bảo tạo đủ số lượng tối thiểu được yêu cầu (ví dụ: 10 NPC, 3 kỹ năng, 3 vật phẩm).
8.  **TRÁNH TRÙNG LẶP:** Tuyệt đối không tạo NPC có tên trùng với tên Nhân Vật Chính (Player Name). Nếu nhân vật đó có trong nguyên tác, hãy ưu tiên để người chơi nhập vai nhân vật đó nếu họ yêu cầu, và loại bỏ khỏi danh sách NPC.

---
**THÔNG TIN HIỆN TẠI (LÀM BỐI CẢNH ĐỂ SÁNG TẠO):**

**Thiết Lập Thế Giới:**
${describeField("Chủ Đề Thế Giới", 'theme', settings.theme)}
${describeField("Bối Cảnh Chi Tiết", 'settingDescription', settings.settingDescription)}
${describeField("Tóm Tắt Cốt Truyện Nguyên Tác", 'originalStorySummary', settings.originalStorySummary)}
${describeField("Văn Phong AI", 'writingStyle', settings.writingStyle)}
${describeField("Tên Tiền Tệ", 'currencyName', settings.currencyName)}
${describeField("Tên Tùy Chỉnh Cho Thể Loại", 'customGenreName', settings.customGenreName)}
${isCultivationEnabled ? describeField("Hệ Thống Sức Mạnh Chủng Tộc", 'raceCultivationSystems', settings.raceCultivationSystems) : "  - Hệ Thống Sức Mạnh: ĐÃ TẮT"}
${isCultivationEnabled ? describeField("Hệ Thống Cấp Bậc Quái Vật", 'yeuThuRealmSystem', settings.yeuThuRealmSystem) : ""}
${isCultivationEnabled ? describeField("Cấp Độ Sức Mạnh Khởi Đầu", 'canhGioiKhoiDau', settings.canhGioiKhoiDau) : ""}

**Nhân Vật Chính:**
${describeField("Tên Nhân Vật", 'playerName', settings.playerName)}
${describeField("Giới Tính", 'playerGender', settings.playerGender)}
${describeField("Chủng Tộc", 'playerRace', settings.playerRace)}
${describeField("Tính Cách", 'playerPersonality', settings.playerPersonality)}
${describeField("Tiểu Sử", 'playerBackstory', settings.playerBackstory)}
${describeField("Mục Tiêu", 'playerGoal', settings.playerGoal)}
${describeField("Loại Địa Điểm Khởi Đầu", 'playerStartingLocationType', settings.playerStartingLocationType)}
${describeField("Đặc Điểm Khởi Đầu Chung", 'playerStartingTraits', settings.playerStartingTraits)}
${isCultivationEnabled ? describeField("Linh Căn", 'playerSpiritualRoot', settings.playerSpiritualRoot) : ""}
${isCultivationEnabled ? describeField("Thể Chất Đặc Biệt", 'playerSpecialPhysique', settings.playerSpecialPhysique) : ""}
${isCultivationEnabled ? describeField("Thọ Nguyên Còn Lại", 'playerThoNguyen', settings.playerThoNguyen) : ""}
${isCultivationEnabled ? describeField("Thọ Nguyên Tối Đa", 'playerMaxThoNguyen', settings.playerMaxThoNguyen) : ""}
${describeField("Số Tiền Khởi Đầu", 'startingCurrency', settings.startingCurrency)}

**Yếu Tố Khởi Đầu:**
${describeField("Kỹ Năng Khởi Đầu", 'startingSkills', settings.startingSkills, 3)}
${describeField("Vật Phẩm Khởi Đầu", 'startingItems', settings.startingItems, 3)}
${describeField("NPC Khởi Đầu", 'startingNPCs', settings.startingNPCs, 10)}
${describeField("Yêu Thú Khởi Đầu", 'startingYeuThu', settings.startingYeuThu, 3)}
${describeField("Tri Thức Khởi Đầu", 'startingLore', settings.startingLore, 1)}
${describeField("Địa Điểm Khởi Đầu", 'startingLocations', settings.startingLocations, 4)}
${describeField("Phe Phái Khởi Đầu", 'startingFactions', settings.startingFactions, 3)}

---
**CHẾ ĐỘ NỘI DUNG:**
${nsfwGuidanceForWorldGen}
- Thể loại game: ${effectiveGenreDisplay}
- Hệ Thống Tu Luyện/Sức Mạnh Đặc Thù: ${isCultivationEnabled ? "BẬT" : "TẮT"}

---
${genreMappingInstruction}
---
${lifespanInstruction}
---
${tagGenerationInstructions}
---
**LỜI NHẮC CUỐI CÙNG:** Hãy dùng sự sáng tạo của bạn để làm cho các yếu tố mới này khớp một cách liền mạch với những gì người chơi đã cung cấp. Chỉ tạo tag cho các mục **CẦN TẠO**. Không thêm bất kỳ lời dẫn, giải thích, hay văn bản nào khác ngoài các tag được yêu cầu.
`;
};

