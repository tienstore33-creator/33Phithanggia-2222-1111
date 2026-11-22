
import { KnowledgeBase, GameLocation, EconomicZoneType } from '../types';
import * as GameTemplates from '../templates';
import { TU_CHAT_TIERS, SUB_REALM_NAMES } from '../constants';
import { getThematicEconomySuggestion, getPreferredNpcTitles } from '../utils/economy/EcoThematicRegistry';

export const generateEconomyLocationsPrompt = (city: GameLocation, kb: KnowledgeBase): string => {
    const { worldConfig, playerStats, realmProgressionList } = kb;
    const currencyName = worldConfig?.currencyName || "Tiền";

    // Xác định loại địa điểm để văn bản prompt linh hoạt hơn
    let locationTypeString = "địa điểm";
    const locType = city.locationType || GameTemplates.LocationType.DEFAULT;

    if (locType === GameTemplates.LocationType.TOWN) {
        locationTypeString = "thị trấn";
    } else if (locType === GameTemplates.LocationType.CITY) {
        locationTypeString = "thành phố";
    } else if (locType === GameTemplates.LocationType.CAPITAL) {
        locationTypeString = "thủ đô";
    } else if (locType === GameTemplates.LocationType.VILLAGE) {
        locationTypeString = "làng mạc";
    } else if (locType === GameTemplates.LocationType.SECT_CLAN) {
        locationTypeString = "tông môn/gia tộc";
    } else if (locType === GameTemplates.EconomyLocationType.SHOP) {
        locationTypeString = "cửa hàng";
    } else if (locType === GameTemplates.SubLocationType.INN) {
        locationTypeString = "quán trọ/tửu điếm";
    }

    // Gợi ý quy mô kinh tế linh hoạt dựa trên Registry
    const thematicSuggestion = getThematicEconomySuggestion(locType);
    const preferredTitles = getPreferredNpcTitles(locType);
    
    let economySuggestion = `Dựa trên loại địa điểm là ${locationTypeString}, hãy tạo ra ${thematicSuggestion}`;
    
    if (locType === GameTemplates.EconomyLocationType.SHOP || locType === GameTemplates.SubLocationType.INN) {
        economySuggestion = `Vì đây là một cửa hàng hoặc quán trọ, hãy tạo ngay ít nhất một NPC thương nhân (chủ quán) và các mặt hàng họ bán.`;
    }
    
    const cultivationSystemContext = `
**BỐI CẢNH HỆ THỐNG TU LUYỆN (CỰC KỲ QUAN TRỌNG):**
- **Các Hệ Thống Tu Luyện Theo Chủng Tộc:**
${worldConfig?.raceCultivationSystems.map(s => `  - ${s.raceName}: ${s.realmSystem}`).join('\n') || '  Không có'}
- **Hệ Thống Tiểu Cảnh Giới:** Mỗi cảnh giới lớn (ví dụ: Luyện Khí, Trúc Cơ) đều có 10 tiểu cảnh giới, theo thứ tự sau: ${SUB_REALM_NAMES.join(', ')}.
- **QUY TẮC BẮT BUỘC:** Khi bạn tạo bất kỳ NPC hoặc Nô Lệ nào, thuộc tính \`realm\` của họ **PHẢI** là sự kết hợp của một "Cảnh Giới Lớn" và một "Tiểu Cảnh Giới".
  - **VÍ DỤ ĐÚNG:** \`realm="Kim Đan Cửu Trọng"\`, \`realm="Nguyên Anh Đỉnh Phong"\`.
  - **VÍ DỤ SAI:** \`realm="Kim Đan"\`, \`realm="Nguyên Anh Kỳ"\`.
Việc tuân thủ quy tắc này là BẮT BUỘC để hệ thống game có thể tính toán chỉ số chính xác.
`;

    const nsfwInstructions = worldConfig?.nsfwMode ? `
**YÊU CẦU ĐẶC BIỆT (CHẾ ĐỘ 18+ ĐANG BẬT):**
*   **Tạo Địa Điểm Nhạy Cảm:** Ngoài các địa điểm kinh tế thông thường, hãy tạo ra các địa điểm như **"${GameTemplates.EconomyLocationType.SLAVE_MARKET}"** và **"${GameTemplates.EconomyLocationType.SLAVE_AUCTION}"**.
    *   Sử dụng tag \`[ECON_ZONE: ...]\` với \`type="${GameTemplates.EconomyLocationType.SLAVE_MARKET}"\` hoặc \`type="${GameTemplates.EconomyLocationType.SLAVE_AUCTION}"\`.
*   **Tạo NPC Đặc Thù:**
    *   Trong "Chợ Nô Lệ", hãy tạo các NPC thương nhân có \`vendorType="SlaveTrader"\`. Họ sẽ là người mua bán nô lệ.
*   **Tạo "Hàng Hóa" Đặc Biệt (Nô lệ & Tù nhân):**
    *   Sử dụng tag **[SLAVE_FOR_SALE: ...]** để thêm nô lệ (đã bị khuất phục) vào danh sách bán.
    *   Sử dụng tag **[PRISONER_FOR_SALE: ...]** để thêm tù nhân (còn bất kham) vào danh sách bán.
    *   **Tham số (chung cho cả hai):** Cung cấp đầy đủ các thuộc tính như một NPC thông thường.
        *   **Bắt Buộc:** \`parentId\` (tên của SlaveTrader), \`name\`, \`description\`, \`gender\`, \`race\`, \`realm\`, \`value=SỐ\`.
        *   **Khuyến Khích:** \`title\`, \`affinity\`, \`willpower\`, \`obedience\`, \`resistance\` (đặc biệt quan trọng với tù nhân), \`tuChat\`, \`spiritualRoot\`, \`specialPhysique\`, \`statsJSON='{"thoNguyen":X, "maxThoNguyen":Y}'\`.
    *   \`value\`: Giá trị mà bạn đề xuất. Hệ thống sẽ tính toán lại giá cuối cùng.
    *   **Ví dụ Nô lệ:** \`[SLAVE_FOR_SALE: parentId="Mụ Tú Bà", name="A Liên", description="...", gender="Nữ", race="Yêu Tộc", realm="Trúc Cơ Đỉnh Phong", willpower=40, obedience=90, value=5000, tuChat="Thượng Phẩm"]\`
    *   **Ví dụ Tù nhân:** \`[PRISONER_FOR_SALE: parentId="Mụ Tú Bà", name="Chiến Binh Bị Bắt", description="...", gender="Nam", race="Nhân Tộc", realm="Kim Đan Nhất Trọng", willpower=80, resistance=75, obedience=20, value=12000, tuChat="Trung Phẩm"]\`
` : '';

    const itemTagInstructions = `
**3. Tag Vật Phẩm Cửa Hàng \`[SHOP_ITEM: ...]\` (Mới):**
    *   **CẤM TUYỆT ĐỐI VỀ VẬT PHẨM TIỀN TỆ:** Đơn vị tiền tệ của thế giới là "${worldConfig.currencyName}". Bạn **TUYỆT ĐỐI KHÔNG** được tạo ra bất kỳ vật phẩm nào có chức năng tương tự tiền tệ (ví dụ: "Linh Thạch Hạ Phẩm", "Túi Vàng", "Ngân Phiếu") bằng tag \`[ITEM_ACQUIRED]\`. Việc này sẽ phá vỡ hệ thống kinh tế của game.
    *   **Tham số Bắt Buộc:** \`parentId\`, \`name\`, \`type\`, \`description\`, \`quantity\`, \`rarity\`, \`value\`, \`itemRealm\`.
    *   **QUAN TRỌNG:** \`parentId\` PHẢI là tên chính xác của NPC thương nhân mà bạn đã tạo ở trên.
    *   \`type\`: Phải bao gồm **Loại Chính** và **Loại Phụ** (nếu có).
        *   **Loại Chính Hợp Lệ:** ${Object.values(GameTemplates.ItemCategory).join(' | ')}.
        *   Nếu Loại Chính là \`${GameTemplates.ItemCategory.EQUIPMENT}\`, Vị Trí (\`slot\`) PHẢI là một trong: "Vũ Khí Chính" | "Vũ Khí Phụ" | "Giáp Đầu" | "Giáp Thân" | "Giáp Tay" | "Giáp Chân" | "Trang Sức" | "Pháp Bảo".
            *   **Tham số RIÊNG \`slot\` cũng BẮT BUỘC** (ví dụ: \`slot="Vũ Khí Chính"\`).
            *   **Tham số RIÊNG \`statBonusesJSON\` BẮT BUỘC** (nếu không có, dùng \`statBonusesJSON='{}'\`). JSON phải hợp lệ.
            *   **Tham số RIÊNG \`uniqueEffectsList\` BẮT BUỘC** (nếu không có, dùng \`uniqueEffectsList="Không có gì đặc biệt"\`).
        *   Nếu Loại Chính là \`${GameTemplates.ItemCategory.POTION}\`, Loại Phụ (\`potionType\`) PHẢI là một trong: ${Object.values(GameTemplates.PotionType).join(' | ')}.
            *   **Tham số RIÊNG \`potionType\` cũng BẮT BUỘC**.
            *   **Tham số RIÊNG \`effectsList\` BẮT BUỘC**.
        *   Nếu Loại Chính là \`${GameTemplates.ItemCategory.MATERIAL}\`, Loại Phụ (\`materialType\`) PHẢI là một trong: ${Object.values(GameTemplates.MaterialType).join(' | ')}.
            *   **Tham số RIÊNG \`materialType\` cũng BẮT BUỘC**.
        *   Nếu Loại Chính là \`${GameTemplates.ItemCategory.CONG_PHAP}\`, thêm tham số bắt buộc \`congPhapType\` và \`expBonusPercentage\`.
        *   Nếu Loại Chính là \`${GameTemplates.ItemCategory.LINH_KI}\`, thêm tham số bắt buộc \`skillToLearnJSON\`.
        *   Nếu Loại Chính là \`${GameTemplates.ItemCategory.PROFESSION_SKILL_BOOK}\`, thêm tham số bắt buộc \`professionToLearn\`.
        *   Nếu Loại Chính là \`${GameTemplates.ItemCategory.PROFESSION_TOOL}\`, thêm tham số bắt buộc \`professionRequired\`.
    *   \`itemRealm\`: BẮT BUỘC. Cảnh giới của vật phẩm. PHẢI là một trong các cảnh giới lớn của thế giới: \`${realmProgressionList.join(' | ')}\`.
    `;

    return `
Bạn là một AI kiến tạo thế giới game nhập vai, chuyên xây dựng các khu vực kinh tế sống động.
Người chơi vừa đến ${locationTypeString} tên là **${city.name}**. Hãy tạo ra các địa điểm kinh tế, các thương nhân, và các mặt hàng họ bán cho nơi này.

**BỐI CẢNH:**
- **Địa điểm:** ${city.name} (ID: ${city.id}, Loại: ${city.locationType || 'Không rõ'}, Mô tả: ${city.description})
- **Thế giới:** Chủ đề "${worldConfig?.theme}", thể loại "${worldConfig?.genre}".
- **Tiền tệ:** ${currencyName}
${cultivationSystemContext}

**YÊU CẦU:**
1.  **Tạo các Khu Vực Kinh Tế (Economic Zones) Mới:**
    *   Tạo ra các khu vực chuyên biệt bên trong ${city.name}. ${economySuggestion}
    *   Sử dụng tag **[ECON_ZONE: ...]**.
    <quy_tac_gan_dia_diem_+generateEconomyLocationsPrompt>================
    *   **CỰC KỲ QUAN TRỌNG:** Thuộc tính \`parentLocationId\` PHẢI sử dụng giá trị chính xác sau đây: \`parentLocationId="${city.id}"\` hoặc \`parentLocationId="${city.name}"\`. **KHÔNG** được tự ý đoán hay tạo mới chuỗi ID ngẫu nhiên không có trong ngữ cảnh.
    ================</quy_tac_gan_dia_diem_+generateEconomyLocationsPrompt>
    *   **BẮT BUỘC** phải có thuộc tính \`type\` là một trong các loại sau: \`${Object.values(EconomicZoneType).join(' | ')}\`.
    
2.  **Tạo các NPC Thương Nhân Đa Dạng (QUY TẮC BẮT BUỘC):**
    <qui_tac_khu_vuc_kinh_te>
        <luat_bat_buoc_chu_sap_+qui_tac_khu_vuc_kinh_te>
        ================
        *   **QUY TẮC 1-1 (QUYẾT ĐỊNH):** Với MỖI địa điểm kinh tế bạn tạo ở bước 1 (Phường Thị, Thương Thành, v.v.), bạn **BẮT BUỘC** phải tạo ít nhất MỘT NPC thương nhân quản lý địa điểm đó.
        *   **LIÊN KẾT ĐỊA ĐIỂM:** Trong tag \`[NPC]\`, thuộc tính \`locationId\` **PHẢI** trùng khớp chính xác với tên (\`name\`) của địa điểm phụ hoặc khu vực kinh tế mà NPC đó thuộc về. Ví dụ: nếu tạo \`[ECON_ZONE: name="Phường Thị Nam Thành"...]\`, thì NPC phải có \`locationId="Phường Thị Nam Thành"\`.
        *   Sử dụng tag **[NPC: ...]**.
        *   **BẮT BUỘC** phải có các thuộc tính: \`vendorType\` (\`MarketStall\` hoặc \`SpecializedShop\` hoặc \`SlaveTrader\`), \`vendorSlogan\`, \`vendorBuysCategories\`, \`name\`, \`gender\`, \`race\`, và \`realm\`.
        ================
        </luat_bat_buoc_chu_sap_+qui_tac_khu_vuc_kinh_te>
        <luat_dong_bo_hang_hoa_+qui_tac_khu_vuc_kinh_te>
        ================
        *   **QUY TẮC ĐỔ ĐẦY KHO HÀNG:** Với MỖI NPC thương nhân được tạo ra ở trên, bạn **PHẢI** sinh kèm tối thiểu 2-3 tag \`[SHOP_ITEM]\` có thuộc tính \`parentId\` trùng khớp chính xác với tên (\`name\`) của NPC đó để sạp hàng của họ không bị trống rỗng.
        ================
        </luat_dong_bo_hang_hoa_+qui_tac_khu_vuc_kinh_te>
    </qui_tac_khu_vuc_kinh_te>
    *   **DANH XƯNG (TITLE):** Hãy sử dụng các danh xưng phù hợp với bối cảnh ${locationTypeString} như: ${preferredTitles.join(', ')}.

${itemTagInstructions}

**4. TẠO CỬA HÀNG VẬT PHẨM "CHIẾN ĐẤU THỬ" (BẮT BUỘC):**
    *   Bạn **BẮT BUỘC** phải tạo ra MỘT NPC thương nhân đặc biệt có \`vendorType="CombatSupplyShop"\`.
    *   Đặt tên cho NPC này là "Thương Nhân Đạo Cụ Chiến Đấu" hoặc một cái tên tương tự.
    *   Đặt NPC này vào một trong các địa điểm phụ bạn đã tạo (ví dụ: Phường Thị).
    *   NPC này CHỈ bán các vật phẩm và kỹ năng cơ bản dành cho chế độ 'Chiến Đấu Thử'.
    *   Hãy sử dụng tag \`[SHOP_ITEM]\` để bày bán các vật phẩm và kỹ năng sau đây (bạn có thể tự do đặt số lượng và giá trị):
        *   **VẬT PHẨM:**
            *   \`combat Hồi Khí Đan\` (Hồi 200 HP)
            *   \`combat Hồi Linh Tán\` (Hồi 100 MP)
            *   \`combat Độc Dược\` (Gây hiệu ứng Độc)
            *   \`combat Thiết Bì Tán\` (Tăng phòng thủ vật lý)
        *   **KỸ NĂNG (dưới dạng vật phẩm để học):**
            *   \`combat Hỏa Cầu Thuật\`
            *   \`combat Băng Phong Châm\`
            *   \`combat Lạc Lôi Thuật\`
            *   \`combat Trị Liệu Thuật\`
            *   \`combat Hút Máu Thuật\` (Hút HP yếu)
    *   **Ví dụ tag (BẮT BUỘC TUÂN THEO ĐỊNH DẠNG):**
        *   \`[SHOP_ITEM: parentId="Tên Thương Nhân", name="combat Hồi Khí Đan", type="Potion Hồi Phục", potionType="Hồi Phục", description="Hồi 200 HP cho một mục tiêu trong chế độ chiến đấu thử nghiệm.", quantity=20, rarity="Phổ Thông", value=50, itemRealm="Phàm Nhân", effectsList="Hồi 200 HP"]\`
        *   \`[SHOP_ITEM: parentId="Tên Thương Nhân", name="combat Độc Dược", type="Potion Đặc Biệt", potionType="Đặc Biệt", description="Ném vào kẻ địch để gây hiệu ứng Độc trong 3 lượt.", quantity=10, rarity="Phổ Thông", value=75, itemRealm="Phàm Nhân", effectsList="Gây Độc 3 lượt"]\`
        *   \`[SHOP_ITEM: parentId="Tên Thương Nhân", name="Ngọc Giản: combat Hút Máu Thuật", type="LinhKi", description="Ghi lại Hút Máu Thuật cơ bản, hút một lượng HP nhỏ từ kẻ địch.", quantity=5, rarity="Phổ Thông", value=200, itemRealm="Phàm Nhân", skillToLearnJSON='{"name":"combat Hút Máu Thuật", "description":"Hút một lượng HP nhỏ từ kẻ địch.", "skillType":"Linh Kĩ", "manaCost":8, "detailedEffect":"Hút một lượng HP nhỏ từ kẻ địch."}']\`

${nsfwInstructions}

**VÍ DỤ KẾT QUẢ:**

[ECON_ZONE: parentLocationId="${city.id}", name="Phường Thị Nam Thành", description="Một khu chợ trời nhộn nhịp ở phía nam ${locationTypeString} ${city.name}, nơi các thương nhân nhỏ lẻ tụ tập.", type="${EconomicZoneType.MARKET}"]
[NPC: name="Lão Trương Bán Tạp Hóa", gender="Nam", race="Nhân Tộc", realm="Phàm Nhân Nhất Trọng", description="Một lão nông khắc khổ chuyên bán các loại linh thảo bình dân và vật phẩm thông dụng.", personality="Thật thà, Hiền lành", affinity=10, locationId="Phường Thị Nam Thành", vendorType="MarketStall", vendorSlogan="Hàng hóa đa dạng, giá cả phải chăng!", vendorBuysCategories="Material"]
[SHOP_ITEM: parentId="Lão Trương Bán Tạp Hóa", name="Huyết Tinh Thảo", type="${GameTemplates.ItemCategory.MATERIAL} ${GameTemplates.MaterialType.LINH_THAO}", materialType="${GameTemplates.MaterialType.LINH_THAO}", description="Loại linh thảo sơ cấp dùng để luyện chế đan dược hồi máu.", quantity=20, rarity="${GameTemplates.ItemRarity.PHO_THONG}", value=15, itemRealm="Luyện Khí"]

${worldConfig?.nsfwMode ? `
[ECON_ZONE: parentLocationId="${city.id}", name="Chợ Nô Lệ Hắc Ám", description="Một góc khuất của thành phố, nơi những món hàng sống được mua bán.", type="${EconomicZoneType.SLAVE_MARKET}"]
[NPC: name="Mụ Tú Bà", gender="Nữ", race="Nhân Tộc", realm="Kim Đan Nhất Trọng", description="Một người phụ nữ trung niên với ánh mắt sắc như dao, chuyên buôn bán nô lệ.", personality="Tàn nhẫn, Mưu mô", affinity=-20, locationId="Chợ Nô Lệ Hắc Ám", vendorType="SlaveTrader", vendorSlogan="Hàng tuyển, đảm bảo khiến các đại gia hài lòng.", vendorBuysCategories=""]
[SLAVE_FOR_SALE: parentId="Mụ Tú Bà", name="Tiểu Thúy", description="Một thiếu nữ 16 tuổi, dung mạo thanh tú nhưng ánh mắt luôn sợ sệt.", gender="Nữ", race="Nhân Tộc", realm="Phàm Nhân Cửu Trọng", affinity=-50, willpower=20, obedience=80, value=1000, tuChat="Hạ Phẩm", spiritualRoot="Phàm Căn", specialPhysique="Bình thường", statsJSON='{"thoNguyen": 64, "maxThoNguyen": 80}']
` : ''}

**LƯU Ý QUAN TRỌNG:**
- TRẢ VỀ ĐẦY ĐỦ: Cấu trúc gồm [ECON_ZONE] cho khu vực, [NPC] cho thương nhân cư ngụ tại đó, và [SHOP_ITEM]/[SLAVE_FOR_SALE] cho hàng hóa của họ.
- LIÊN KẾT: \`locationId\` của NPC phải trùng với \`name\` của \`ECON_ZONE\`. \`parentId\` của vật phẩm phải trùng với \`name\` của NPC.
- CHỈ TRẢ VỀ CÁC TAG, KHÔNG CÓ LỜI DẪN HAY GIẢI THÍCH GÌ THÊM.
`;
};
