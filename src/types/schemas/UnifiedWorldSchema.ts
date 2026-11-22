import { Type } from "@google/genai";

export const UnifiedWorldSchema = {
  type: Type.OBJECT,
  properties: {
    // 1. Khối thông tin Nhân vật & Cốt truyện khởi đầu
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
    // 2. Khối bối cảnh thế giới L0
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
  required: ["characterPlot", "summary", "characters", "locations", "items", "factions"]
};
