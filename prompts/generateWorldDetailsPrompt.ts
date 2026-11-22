
import { SUB_REALM_NAMES, ALL_FACTION_ALIGNMENTS, AVAILABLE_GENRES, VIETNAMESE, CUSTOM_GENRE_VALUE, DEFAULT_VIOLENCE_LEVEL, DEFAULT_STORY_TONE, VIOLENCE_LEVELS, STORY_TONES, DEFAULT_NSFW_DESCRIPTION_STYLE, NSFW_DESCRIPTION_STYLES, WEAPON_TYPES_FOR_VO_Y, STAT_POINT_VALUES, SPECIAL_EFFECT_KEYWORDS } from '../constants';
import * as GameTemplates from '../templates';
import { GenreType, ViolenceLevel, StoryTone, NsfwDescriptionStyle, TuChatTier, TU_CHAT_TIERS, WorldSettings } from '../types';
import { CONG_PHAP_GRADES, LINH_KI_CATEGORIES, LINH_KI_ACTIVATION_TYPES, PROFESSION_GRADES } from '../templates';
import { CULTIVATION_FORMAT_RULES } from '../constants/cultivationRules';
import { WORLD_GEN_TAG_TEMPLATES } from './worldGenTemplates';

export const generateWorldDetailsPrompt = (
    storyIdea: string,
    worldSettings: WorldSettings,
    canonData?: string
): string => {
  const { 
    nsfwMode: isNsfwIdea, 
    genre, 
    isCultivationEnabled, 
    violenceLevel, 
    storyTone, 
    customGenreName, 
    nsfwDescriptionStyle,
    storyMode,
  } = worldSettings;

  const effectiveGenreDisplay = (genre === CUSTOM_GENRE_VALUE && customGenreName) ? customGenreName : genre;
  const genreForTag = (genre === CUSTOM_GENRE_VALUE && customGenreName) ? CUSTOM_GENRE_VALUE : genre;
  const customGenreNameForTag = (genre === CUSTOM_GENRE_VALUE && customGenreName) ? customGenreName : "";
  const currentViolenceLevel = violenceLevel || DEFAULT_VIOLENCE_LEVEL;
  const currentStoryTone = storyTone || DEFAULT_STORY_TONE;
  const currentNsfwStyle = nsfwDescriptionStyle || DEFAULT_NSFW_DESCRIPTION_STYLE;
  
  const mainQuestInstruction = storyMode === 'focusedStoryteller' ? `
    *   **Tạo Mạch Truyện Chính (BẮT BUỘC VÌ ĐÃ CHỌN LỐI CHƠI TUYẾN TÍNH):**
        *   Dựa trên ý tưởng, hãy tạo ra một mạch truyện chính hấp dẫn, có khởi đầu, diễn biến và kết thúc.
        *   Sử dụng tag **[MAIN_QUEST_SETUP: title="Tên Mạch Truyện", chaptersJSON='[...]']**.
` : '';


  const cultivationSystemInstructions = isCultivationEnabled ? `
    *   **Tạo Hệ Thống Cảnh Giới Hợp Nhất (MANDATORY UNIFIED):**
        *   Dựa trên **Ý Tưởng Cốt Truyện**, tạo ra MỘT hệ thống cảnh giới duy nhất dùng chung cho TẤT CẢ chủng tộc (Nhân, Yêu, Ma...).
        *   Sử dụng tag **[GENERATED_UNIFIED_SYSTEM: system="Tên Cảnh Giới | Số Cấp | Mô tả\nTên Cảnh Giới | Số Cấp | Mô tả..."]**.
        *   Giới hạn tối đa 15 cảnh giới chính.
    *   **HỆ THỐNG CẢNH GIỚI (CỰC KỲ QUAN TRỌNG):**
        ${CULTIVATION_FORMAT_RULES}
        - Danh sách Đại cảnh giới: ${worldSettings.cultivationSystem.majorRealmsRaw || "Chưa thiết lập"}
        - Danh sách Tiểu cảnh giới: ${worldSettings.cultivationSystem.minorRealmsRaw || "Chưa thiết lập"}
        
        **CẤM TUYỆT ĐỐI (NEGATIVE CONSTRAINTS):**
        - KHÔNG sử dụng dấu ngoặc đơn '()' trong tên cảnh giới.
        - KHÔNG sử dụng dấu gạch ngang '-' hoặc dấu hai chấm ':'.
        - SAI: "Luyện Khí (Tầng 1)" -> ĐÚNG: "Luyện Khí 1 Tầng".
        
    *   **CẤU TRÚC ĐỊA ĐIỂM & KINH TẾ (NEW):**
        *   Mỗi địa điểm (Location) phải được gán các khu vực kinh tế (Economic Zones) phù hợp thông qua thuộc tính \`economicZonesJSON\`.
        *   **QUY TẮC LAZY LOADING:** Chỉ tạo STUB (Tên, Loại, Mô tả sơ lược). KHÔNG tạo vật phẩm hay NPC bên trong lúc này.
        *   Các loại zone: \`marketplace\` (Chợ/Tạp hoá), \`blacksmith\` (Rèn), \`apothecary\` (Dược), \`inn\` (Nhà trọ/Điểm dừng chân), \`faction_specific\` (Đặc thù môn phái).
        *   Ví dụ: Thôn nhỏ có thể có 1 \`inn\` và 1 \`marketplace\`. Thành lớn có đủ các loại.

    *   **VẬT PHẨM & TRANG BỊ (BẮT BUỘC ĐỦ TRƯỜNG):**
        *   Mỗi trang bị (\`Category="Equipment"\`) PHẢI có: \`slot\` (Vị trí - PHẢI ĐA DẠNG: Vũ Khí Chính | Giáp Thân | Giáp Đầu | Pháp Bảo | Trang Sức...), \`equipmentType\`, \`itemRealm\` (Cảnh giới), \`statBonusesJSON\` (BẮT BUỘC - CHỈ DÙNG 4 KHÓA: maxSinhLuc, maxLinhLuc, sucTanCong, phongNgu), \`uniqueEffectsList\` (Danh sách hiệu ứng cách nhau bởi dấu ;).
        *   **CÔNG THỨC CHỈ SỐ CƠ HỌC:**
            - Base (Phàm nhân): ~10 stat points.
            - Mỗi đại cảnh giới tiếp theo: x1.8 chỉ số.
            - Rarity multiplier: Phổ thông (x1), Hiếm (x1.5), Quý Báu (x2.5), Cực Phẩm (x4), Thần Thoại (x7), Chí Tôn (x12).
            - Ví dụ: Một thanh kiếm Quý Báu ở cảnh giới thứ 2 sẽ có stats khoảng: 10 * 1.8 * 2.5 = 45 điểm SucTanCong.

    *   **KIỂM TOÁN CÚ PHÁP (SYNTAX AUDIT):**
        Trước khi xuất tag, AI hãy tự nhẩm: "Cảnh giới có dấu ngoặc không? Nếu có, hãy xóa ngay".

    *   **NPC VIP (Lãnh đạo phe phái, Đại năng):** Những nhân vật này thường có thực lực vượt trội so với mặt bằng chung. Hãy lưu ý điều này khi thiết lập cảnh giới cho các NPC quan trọng ngay từ đầu.
` : '';
    
  const lifespanInstruction = isCultivationEnabled ? `
**HƯỚN DẪN VỀ THỌ NGUYÊN (TUỔI THỌ):**
Tuổi thọ tối đa (\`maxThoNguyen\`) tăng mạnh theo từng đại cảnh giới.
*   **Công thức:** \`maxThoNguyen = 120 + 100 * (1.8 ^ (Thứ tự đại cảnh giới - 1))\`.
` : '';

  const npcRealmInstruction = isCultivationEnabled
    ? `, realm="Cảnh giới NPC (BẮT BUỘC). Nếu không rõ, hãy đặt ở mức tương đương theo tính toán hoặc thấp nhất hệ thống (VD: Tầng 1)." tuChat="CHỌN MỘT TRONG: ${TU_CHAT_TIERS.join(' | ')}" spiritualRoot="Linh căn", specialPhysique="Thể chất", thoNguyen=X, maxThoNguyen=Y`
    : `, thoNguyen=X, maxThoNguyen=Y`;

  let nsfwGuidanceForWorldGen = "";
  if (isNsfwIdea) {
    nsfwGuidanceForWorldGen = `
- **Yêu cầu nội dung 18+:** BẬT. 
- **Phong Cách:** ${currentNsfwStyle}.
- **Mức Độ Bạo Lực:** ${currentViolenceLevel}.
- **Tông Màu:** ${currentStoryTone}.
[GENERATED_NSFW_DESCRIPTION_STYLE: text="${currentNsfwStyle}"]
[GENERATED_VIOLENCE_LEVEL: text="${currentViolenceLevel}"]
[GENERATED_STORY_TONE: text="${currentStoryTone}"]`;
  } else {
    nsfwGuidanceForWorldGen = "- **Yêu cầu nội dung 18+:** TẮT. Tạo các yếu tố phù hợp với mọi lứa tuổi.";
  }

return `
Bạn là một chuyên gia sáng tạo thế giới cho game nhập vai thể loại "${effectiveGenreDisplay}" bằng tiếng Việt.
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
Dựa trên mô tả ý tưởng cốt truyện sau đây, hãy tạo ra các yếu tố khởi đầu.

**Mô tả ý tưởng:**
"${storyIdea}"

**CHẾ ĐỘ NỘI DUNG:**
${nsfwGuidanceForWorldGen}
- Hệ Thống Tu Luyện: ${isCultivationEnabled ? "BẬT" : "TẮT"}

${lifespanInstruction}

**YÊU CẦU ĐẦU RA (OUTPUT RULES):**
1. CHỈ TRẢ VỀ CÁC TAG. Không lời dẫn, không giải thích.
2. BẮT BUỘC điền đầy đủ thông tin theo mẫu template dưới đây. Đặc biệt là NPC phải có đầy đủ cảnh giới (realm) và chi tiết (details).
3. Đảm bảo tính nhất quán: Nếu thế giới là "Đô thị", NPC không được mặc "Giáp trụ cổ đại".

**MẪU ĐỊNH DẠNG TAG (MANDATORY TEMPLATES):**
${WORLD_GEN_TAG_TEMPLATES}

${cultivationSystemInstructions}
${mainQuestInstruction}

**BẮT ĐẦU TẠO DỮ LIỆU THẾ GIỚI (CHỈ TRẢ VỀ TAG):**
`;
};

