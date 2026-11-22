/**
 * Configuration for Tribunal AI Inspectors mapped to Greek and Norse Gods
 */

export interface GodInspectorConfig {
  name: string;
  oldName: string;
  pantheon: 'Greek' | 'Norse';
  role: string;
}

export const GODS_INSPECTORS: Record<string, GodInspectorConfig> = {
  ODIN: { name: "Odin", oldName: "Sáng Đại Tiên", pantheon: "Norse", role: "Nhất quán không gian & Chỉ tiêu độ dài" },
  HEIMDALL: { name: "Heimdall", oldName: "Davoth", pantheon: "Norse", role: "Kiểm soát bản ngã MC & Grounding" },
  ATHENA: { name: "Athena", oldName: "Adidada", pantheon: "Greek", role: "Logic Razor & Cân bằng Nash" },
  TYR: { name: "Tyr", oldName: "Ngã Huynh", pantheon: "Norse", role: "Ranh giới cá nhân & Dã tâm NPC" },
  URD: { name: "Urd", oldName: "Dino", pantheon: "Norse", role: "Nhân quả & Tác động hành động" },
  ARES: { name: "Ares", oldName: "Thanh Hải", pantheon: "Greek", role: "Giọng văn trần trụi & Thực tế" },
  BALDR: { name: "Baldr", oldName: "Pine", pantheon: "Norse", role: "Chống độc hại hóa động cơ" },
  HERMES: { name: "Hermes", oldName: "Tino", pantheon: "Greek", role: "Giới hạn thông tin & Nguồn tin" },
  THOR: { name: "Thor", oldName: "Thiên Ngỗng Phi Tiên", pantheon: "Norse", role: "Vật lý môi trường & Ma sát" },
  HEPHAESTUS: { name: "Hephaestus", oldName: "Hoxilo", pantheon: "Greek", role: "Kết thúc thô & Tránh triết lý" },
  HADES: { name: "Hades", oldName: "3107", pantheon: "Greek", role: "Tâm lý ngầm & Cảm xúc" },
  LOKI: { name: "Loki", oldName: "Phatsiz", pantheon: "Norse", role: "Thực tế sinh học & Nhược điểm" },
  APOLLO: { name: "Apollo", oldName: "Rondamduc", pantheon: "Greek", role: "Chống từ ngữ rập khuôn" },
  ARTEMIS: { name: "Artemis", oldName: "Phong", pantheon: "Greek", role: "Cá nhân hóa biểu hiện tâm lý" },
  CRONUS: { name: "Cronus", oldName: "Tà Đế", pantheon: "Greek", role: "Chống bi lụy vô lý" },
  NEMESIS: { name: "Nemesis", oldName: "Khoi", pantheon: "Greek", role: "Khóa tôn ti trật tự xưng hô" },
  FREYR: { name: "Freyr", oldName: "Longvuuuu", pantheon: "Norse", role: "Ưu tiên thoại đi trước" },
  EROS: { name: "Eros", oldName: "log_djtmethinking", pantheon: "Greek", role: "Khóa nhịp độ Stage NSFW" },
  FREYA: { name: "Freya", oldName: "hamrexpp", pantheon: "Norse", role: "ASMR & Nhịp thở vòm" },
  DIONYSUS: { name: "Dionysus", oldName: "amazingpost", pantheon: "Greek", role: "Thực tế sinh học NSFW" },
  APHRODITE: { name: "Aphrodite", oldName: "lilith6334", pantheon: "Greek", role: "Điều hành lò phản ứng NSFW" },
  SKADI: { name: "Skadi", oldName: "Naru Jaoma", pantheon: "Norse", role: "Giải phẫu động tác" },
  IRIS: { name: "Iris", oldName: "bao8839", pantheon: "Greek", role: "State Machine cảm xúc" }
};
