import { Type } from "@google/genai";

export const L0_ExtractionSchema = {
  type: Type.OBJECT,
  properties: {
    summary: { type: Type.STRING, description: "Tóm tắt bối cảnh thế giới" },
    characters: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          name: { type: Type.STRING },
          gender: { type: Type.STRING },
          age: { type: Type.STRING },
          personality: { type: Type.STRING },
          background: { type: Type.STRING },
          appearance: { type: Type.STRING },
          skills: { type: Type.STRING },
          goal: { type: Type.STRING },
          role: { type: Type.STRING }
        },
        required: ["name", "gender", "age", "personality", "background", "appearance", "skills", "goal", "role"]
      },
      minItems: 10
    },
    locations: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          name: { type: Type.STRING },
          description: { type: Type.STRING },
          significance: { type: Type.STRING }
        },
        required: ["name", "description", "significance"]
      },
      minItems: 5
    },
    items: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          name: { type: Type.STRING },
          description: { type: Type.STRING },
          rarity: { type: Type.STRING }
        },
        required: ["name", "description", "rarity"]
      },
      minItems: 4
    },
    factions: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          name: { type: Type.STRING },
          description: { type: Type.STRING },
          leader: { type: Type.STRING },
          alignment: { type: Type.STRING }
        },
        required: ["name", "description", "leader", "alignment"]
      }
    }
  },
  required: ["summary", "characters", "locations", "items", "factions"]
};

export const L05_FormattingSchema = {
  type: Type.OBJECT,
  properties: {
    worldTheme: { type: Type.STRING },
    worldSettingDescription: { type: Type.STRING },
    genre: { type: Type.STRING },
    isCultivationEnabled: { type: Type.BOOLEAN },
    startingNPCs: { type: Type.ARRAY, items: { type: Type.OBJECT } },
    startingItems: { 
      type: Type.ARRAY, 
      items: { 
        type: Type.OBJECT,
        properties: {
          name: { type: Type.STRING },
          description: { type: Type.STRING },
          category: { type: Type.STRING },
          rarity: { type: Type.STRING },
          itemRealm: { type: Type.STRING },
          equipmentDetails: {
            type: Type.OBJECT,
            properties: {
              slot: { type: Type.STRING },
              statBonusesJSON: { type: Type.STRING, description: "BẮT BUỘC CHỈ DÙNG 4 KHÓA: maxSinhLuc, maxLinhLuc, sucTanCong, phongNgu" }
            }
          }
        }
      } 
    },
    startingLocations: { type: Type.ARRAY, items: { type: Type.OBJECT } }
  },
  required: ["worldTheme", "worldSettingDescription", "genre", "isCultivationEnabled", "startingNPCs", "startingItems", "startingLocations"]
};

export const L0_CharacterPlotSchema = {
  type: Type.OBJECT,
  properties: {
    mainCharacterName: { type: Type.STRING, description: "Tên Nhân Vật chính là gì?" },
    mainCharacterGender: { type: Type.STRING, description: "Giới Tính của nhân vật chính là gì?" },
    mainCharacterRace: { type: Type.STRING, description: "Chủng Tộc của nhân vật chính là gì?" },
    mainCharacterPersonality: { type: Type.STRING, description: "Tính Cách của nhân vật chính như thế nào?" },
    mainCharacterBiography: { type: Type.STRING, description: "Tiểu Sử của nhân vật chính ra sao?" },
    initialContext: { type: Type.STRING, description: "Bối cảnh ban đầu sẽ như thế nào?" },
    goal: { type: Type.STRING, description: "Mục Tiêu là gì?" },
    startingLocationType: { type: Type.STRING, description: "Loại Địa Điểm Bắt Đầu là gì?" },
    generalStartingTraits: { type: Type.STRING, description: "Đặc Điểm Khởi Đầu Chung là gì?" },
    currencyName: { type: Type.STRING, description: "Tên Tiền Tệ là gì?" },
    startingMoneyAmount: { type: Type.NUMBER, description: "Số Tiền Khởi Đầu bao nhiêu?" },
    spiritualRoot: { type: Type.STRING, description: "Linh Căn (ưu điểm sức mạnh) của nhân vật chính là gì?" },
    specialPhysique: { type: Type.STRING, description: "Thể Chất Đặc Biệt của nhân vật chính là gì?" },
    remainingLifespan: { type: Type.NUMBER, description: "Thọ Nguyên Còn Lại trong nguyên tác bao nhiêu?" },
    maxLifespan: { type: Type.NUMBER, description: "Thọ Nguyên Tối Đa nguyên tác bao nhiêu?" }
  },
  required: [
    "mainCharacterName", "mainCharacterGender", "mainCharacterRace",
    "mainCharacterPersonality", "mainCharacterBiography", "initialContext",
    "goal", "startingLocationType", "generalStartingTraits", "currencyName",
    "startingMoneyAmount", "spiritualRoot", "specialPhysique", 
    "remainingLifespan", "maxLifespan"
  ]
};
