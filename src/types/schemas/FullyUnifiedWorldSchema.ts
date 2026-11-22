import { Type } from "@google/genai";

export const FullyUnifiedWorldSchema = {
  type: Type.OBJECT,
  properties: {
    // 1. Khối thông tin Nhân vật & Cốt truyện khởi đầu (Tương tự UnifiedWorldSchema cũ)
    characterPlot: {
      type: Type.OBJECT,
      properties: {
        mainCharacterName: { type: Type.STRING, description: "Tên Nhân Vật chính" },
        mainCharacterGender: { type: Type.STRING, description: "Giới Tính nhân vật chính" },
        mainCharacterRace: { type: Type.STRING, description: "Chủng Tộc nhân vật chính" },
        mainCharacterPersonality: { type: Type.STRING, description: "Tính Cách nhân vật chính" },
        mainCharacterBiography: { type: Type.STRING, description: "Tiểu Sử nhân vật chính" },
        initialContext: { type: Type.STRING, description: "Bối cảnh ban đầu" },
        goal: { type: Type.STRING, description: "Mục Tiêu nhân vật chính" },
        startingLocationType: { type: Type.STRING, description: "Loại Địa Điểm Bắt Đầu" },
        generalStartingTraits: { type: Type.STRING, description: "Đặc Điểm Khởi Đầu Chung" },
        currencyName: { type: Type.STRING, description: "Tên Tiền Tệ" },
        startingMoneyAmount: { type: Type.NUMBER, description: "Số Tiền Khởi Đầu" },
        spiritualRoot: { type: Type.STRING, description: "Linh Căn (hoặc ưu điểm sức mạnh)" },
        specialPhysique: { type: Type.STRING, description: "Thể Chất Đặc Biệt" },
        remainingLifespan: { type: Type.NUMBER, description: "Thọ Nguyên Còn Lại" },
        maxLifespan: { type: Type.NUMBER, description: "Thọ Nguyên Tối Đa" }
      },
      required: [
        "mainCharacterName", "mainCharacterGender", "mainCharacterRace",
        "mainCharacterPersonality", "mainCharacterBiography", "initialContext",
        "goal", "startingLocationType", "generalStartingTraits", "currencyName",
        "startingMoneyAmount", "spiritualRoot", "specialPhysique",
        "remainingLifespan", "maxLifespan"
      ]
    },
    // 2. Khối bối cảnh & cấu hình chỉ số game (Tương tự L05_FormattingSchema)
    formattedData: {
      type: Type.OBJECT,
      properties: {
        worldTheme: { type: Type.STRING, description: "Tông giọng bối cảnh thế giới" },
        worldSettingDescription: { type: Type.STRING, description: "Mô tả sâu bối cảnh thế giới" },
        genre: { type: Type.STRING, description: "Thể loại chính (ví dụ: Tu Tiên, Kiếm Hiệp...)" },
        isCultivationEnabled: { type: Type.BOOLEAN, description: "Có bật hệ thống tu luyện hay không" },
        startingNPCs: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              name: { type: Type.STRING, description: "Tên nhân vật phụ" },
              gender: { type: Type.STRING, description: "Giới tính (Nam/Nữ)" },
              personality: { type: Type.STRING, description: "Tính cách" },
              details: { type: Type.STRING, description: "Vai trò, quan hệ với nhân vật chính và bối cảnh" },
              realm: { type: Type.STRING, description: "Cảnh giới sức mạnh/Võ học hiện tại" }
            },
            required: ["name", "gender", "personality", "details", "realm"]
          }
        },
        startingItems: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              name: { type: Type.STRING, description: "Tên vật phẩm" },
              description: { type: Type.STRING, description: "Mô tả chuẩn công năng" },
              quantity: { type: Type.NUMBER, description: "Số lượng ban đầu" },
              category: { type: Type.STRING, description: "Phân loại: Equipment (trang bị), Potion (dược phẩm), Material (nguyên liệu)" },
              rarity: { type: Type.STRING, description: "Độ hiếm: Phổ Thông, Hiếm, Quý Báu, Cực Phẩm, Thần Thoại, Chí Tôn" },
              itemRealm: { type: Type.STRING, description: "Cảnh giới tương ứng của vật phẩm" },
              value: { type: Type.NUMBER, description: "Giá trị tiền tệ ước tính" },
              equipmentDetails: {
                type: Type.OBJECT,
                properties: {
                  slot: { type: Type.STRING, description: "Vị trí trang bị: mainWeapon, body, head, artifact, necklace..." },
                  statBonusesJSON: { type: Type.STRING, description: "Chuỗi JSON chứa tối đa 4 thuộc tính: maxSinhLuc, maxLinhLuc, sucTanCong, phongNgu. Ví dụ: '{\"sucTanCong\": 15, \"maxSinhLuc\": 50}'" },
                  uniqueEffectsList: { type: Type.STRING, description: "Danh sách hiệu ứng độc bản phân cách bởi dấu chấm phẩy" }
                }
              },
              potionDetails: {
                type: Type.OBJECT,
                properties: {
                  type: { type: Type.STRING, description: "Hồi Phục, Tăng Cường, Đột Phá" },
                  effectsString: { type: Type.STRING, description: "Mô tả hiệu ứng khi sử dụng" }
                }
              }
            },
            required: ["name", "description", "quantity", "category", "rarity", "itemRealm", "value"]
          }
        },
        startingLocations: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              name: { type: Type.STRING, description: "Tên địa điểm" },
              description: { type: Type.STRING, description: "Mô tả không gian và khí quyển" },
              category: { type: Type.STRING, description: "Thể loại địa điểm" }
            },
            required: ["name", "description", "category"]
          }
        },
        startingFactions: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              name: { type: Type.STRING, description: "Tên phe phái/Thế lực" },
              description: { type: Type.STRING, description: "Mô tả tôn chỉ và sức mạnh thế lực" },
              alignment: { type: Type.STRING, description: "Thiên hướng hoạt động" }
            },
            required: ["name", "description", "alignment"]
          }
        },
        startingSkills: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              name: { type: Type.STRING, description: "Tên kỹ năng/Võ công khởi đầu" },
              description: { type: Type.STRING, description: "Mô tả chiêu thức" },
              rarity: { type: Type.STRING, description: "Phẩm cấp võ công" }
            },
            required: ["name", "description", "rarity"]
          }
        },
        startingYeuThu: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              name: { type: Type.STRING, description: "Tên Linh thú/Yêu thú khởi đầu" },
              species: { type: Type.STRING, description: "Chủng loài yêu thú" },
              description: { type: Type.STRING, description: "Mô tả ngoại hình/tính cách" },
              realm: { type: Type.STRING, description: "Cảnh giới thực lực yêu thú" }
            },
            required: ["name", "species", "description", "realm"]
          }
        },
        startingLore: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              title: { type: Type.STRING, description: "Tiêu đề ghi chép bí mật/Lịch sử thế giới" },
              content: { type: Type.STRING, description: "Nội dung ghi chép truyền thuyết" }
            },
            required: ["title", "content"]
          }
        }
      },
      required: [
        "worldTheme", "worldSettingDescription", "genre", "isCultivationEnabled",
        "startingNPCs", "startingItems", "startingLocations", "startingFactions",
        "startingSkills", "startingYeuThu", "startingLore"
      ]
    }
  },
  required: ["characterPlot", "formattedData"]
};
