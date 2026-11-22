import { KnowledgeBase, EconomicZoneStub, GameLocation } from '../types';
import * as GameTemplates from '../templates';
import { SUB_REALM_NAMES } from '../constants';

export const generateEcoZoneJsonPrompt = (
    knowledgeBase: KnowledgeBase,
    zoneStub: EconomicZoneStub
): string => {
    const { worldConfig, playerStats, realmProgressionList, currentLocationId, discoveredLocations } = knowledgeBase;
    const parentLocation = discoveredLocations.find(l => l.id === currentLocationId);
    const currencyName = worldConfig?.currencyName || "Tiền";

    const cultivationSystemContext = `
**BỐI CẢNH HỆ THỐNG TU LUYỆN:**
- **Tiểu Cảnh Giới:** ${SUB_REALM_NAMES.join(', ')}.
- **QUY TẮC:** NPC/Nô lệ thuộc tính \`realm\` PHẢI là sự kết hợp "Cảnh Giới Lớn" + "Tiểu Cảnh Giới" (VD: "Kim Đan Cửu Trọng").
`;

    const nsfwInstructions = worldConfig?.nsfwMode ? `
**CHẾ ĐỘ NHẠY CẢM (NSFW ON):**
- Cho phép tạo nô lệ (slaves) và tù nhân (prisoners) trong thuộc tính tương ứng của thương nhân thuộc loại \`SlaveTrader\`.
` : '';

    return `
BẠN LÀ HỆ THỐNG KIẾN TẠO DỮ LIỆU KINH TẾ (TAWA-ECONOMY-JSON-ENGINE).
Người chơi vừa tiến vào **${zoneStub.name}** (Loại: ${zoneStub.type}) tại ${parentLocation?.name || 'địa điểm hiện tại'}.

**YÊU CẦU CỐT LÕI (BẮT BUỘC):**
1. **PHẢI XUẤT RA JSON HỢP LỆ 100%**: Chỉ xuất dữ liệu ở định dạng JSON duy nhất. Không viết lời dẫn hay giải thích.
2. **SUY LUẬN LOGIC TỪ TÊN VÀ LOẠI HÌNH**: Phân tích bối cảnh để tạo mặt hàng và NPC phù hợp nhất.
3. **KHÔNG ĐƯỢC BỎ TRỐNG**: Cửa hàng phải đầy đủ NPC và tối thiểu từ 5-10 mặt hàng phong phú.

**HỆ THỐNG PHÂN LOẠI VẬT PHẨM (itemCategory):**
- **Potion**: Cần thuộc tính \`potionType\` (Hồi Phục, Tăng Cường, Đột Phá, Khác), và mảng \`effects: string[]\`.
- **Equipment**: Cần thuộc tính \`slot\` (mainWeapon, offHandWeapon, head, body, hands, legs, accessory1, accessory2, artifact, pet), đối tượng \`statBonuses: Record<string, number>\`, và mảng \`uniqueEffects: string[]\`.
- **Material**: Cần thuộc tính \`materialType\` (Linh Thảo, Linh Khoáng, Thú Liệu, Trận Pháp Nguyên Liệu, Khác).
- **LinhKi**: Cần thuộc tính \`skillToLearnJSON: string\` (Chuỗi JSON chứa thông tin kỹ năng học được).
- **CongPhap**: Cần thuộc tính \`congPhapType\` (Chủ Động, Bị Động), \`expBonusPercentage: number\`.

**YÊU CẦU CẤU TRÚC JSON:**
Xuất ra một đối tượng JSON khớp chính xác với Schema sau:

<cau_truc_json_bat_buoc>
{
  "sublocation": {
    "name": "Tên địa điểm (bằng chính xác: \\"${zoneStub.name}\\")",
    "locationType": "Loại địa điểm (ví dụ: Phường Thị, Chợ Đen, Thương Điếm)",
    "description": "Mô tả sinh động không khí buôn bán tại đây"
  },
  "vendors": [
    {
      "name": "Tên thương nhân nổi bật (Ví dụ: Đại Chưởng Quỹ Trương Tam, Lão Thiết)",
      "gender": "Nam" | "Nữ",
      "race": "Nhân Tộc" | "Yêu Tộc" | "Ma Tộc",
      "realm": "Cảnh giới tu vi (ví dụ: Trúc Cơ Tam Trọng)",
      "description": "Mô tả ngoại hình, tính cách của thương nhân",
      "personalityTraits": ["Đặc điểm tính cách 1", "Đặc điểm tính cách 2"],
      "affinity": 0,
      "vendorType": "MarketStall" | "SpecializedShop" | "SlaveTrader",
      "vendorSlogan": "Slogan bán hàng đặc trưng",
      "vendorBuysCategories": ["Potion", "Equipment", "Material", "LinhKi"],
      "shopInventory": [
        {
          "name": "Tên vật phẩm",
          "description": "Mô tả vật phẩm",
          "category": "Potion" | "Equipment" | "Material" | "LinhKi" | "CongPhap",
          "rarity": "Phổ Thông" | "Hiếm" | "Quý Báu" | "Cực Phẩm",
          "value": 100, // Giá cơ bản (số nguyên dương)
          "quantity": 10, // Số lượng có sẵn
          "itemRealm": "${realmProgressionList[0]}", // Phù hợp bối cảnh cảnh giới thế giới
          
          // Các thuộc tính bổ sung dựa theo loại:
          "potionType": "Hồi Phục", // Chỉ dùng khi category = Potion
          "effects": ["Hồi phục 100 HP"], // Chỉ dùng khi category = Potion
          
          "slot": "mainWeapon", // Chỉ dùng khi category = Equipment
          "statBonuses": {}, // Chỉ dùng khi category = Equipment (Ví dụ: {"atk": 10})
          "uniqueEffects": [], // Chỉ dùng khi category = Equipment
          
          "materialType": "Linh Thảo", // Chỉ dùng khi category = Material
          
          "skillToLearnJSON": "" // Chuỗi JSON chứa thông tin kỹ năng học được nếu là LinhKi
        }
      ],
      // Các thuộc tính sau chỉ xuất hiện nếu chế độ NSFW bật và vendorType = SlaveTrader:
      "slavesForSale": [
        {
          "name": "Tên nô lệ",
          "gender": "Nữ",
          "race": "Nhân Tộc",
          "description": "Mô tả nô lệ sơ lược",
          "personalityTraits": ["Ngoan ngoãn"],
          "willpower": 30,
          "obedience": 70,
          "value": 500,
          "tuChat": "Trung Phẩm",
          "spiritualRoot": "Thủy Căn",
          "specialPhysique": "Không",
          "realm": "Phàm Nhân Tam Trọng"
        }
      ],
      "prisonersForSale": [
        {
          "name": "Tên tù nhân",
          "gender": "Nam",
          "race": "Ma Tộc",
          "description": "Mô tả tù nhân",
          "personalityTraits": ["Cố chấp"],
          "willpower": 80,
          "resistance": 60,
          "value": 800,
          "tuChat": "Hạ Phẩm",
          "spiritualRoot": "Hỏa Căn",
          "specialPhysique": "Không",
          "realm": "Luyện Khí Ngũ Trọng"
        }
      ]
    }
  ]
}
</cau_truc_json_bat_buoc>

${cultivationSystemContext}
${nsfwInstructions}

Bạn CHỈ ĐƯỢC PHÉP trả về duy nhất chuỗi JSON thuần túy nằm trong cặp thẻ <update_data>...</update_data> để hệ thống tự động bóc tách. Không kèm lời mở đầu hay kết luận.
`;
};
