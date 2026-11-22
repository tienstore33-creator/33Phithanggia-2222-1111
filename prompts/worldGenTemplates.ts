
export const WORLD_GEN_TAG_TEMPLATES = `
[HƯỚNG DẪN ĐỊNH DẠNG TAG - AI PHẢI ĐIỀN ĐỦ CÁC THÔNG SỐ - KHÔNG ĐƯỢC THIẾU]:

1. THÔNG TIN NGƯỜI CHƠI (PLAYER):
[GENERATED_PLAYER_NAME: name="..."]
[GENERATED_PLAYER_GENDER: gender="Nam/Nữ"]
[GENERATED_PLAYER_RACE: race="..."]
[GENERATED_PLAYER_PERSONALITY: personality="..."]
[GENERATED_PLAYER_BACKSTORY: backstory="..."]
[GENERATED_PLAYER_GOAL: goal="..."]
[GENERATED_PLAYER_STARTING_TRAITS: traits="..."]
[GENERATED_PLAYER_SPIRITUAL_ROOT: spiritualRoot="..."]
[GENERATED_PLAYER_SPECIAL_PHYSIQUE: specialPhysique="..."]
[GENERATED_CANH_GIOI_KHOI_DAU: realm="Phàm Nhân 1 Tầng"]
[GENERATED_PLAYER_THO_NGUYEN: value=20]
[GENERATED_PLAYER_MAX_THO_NGUYEN: value=100]

2. QUẦN THỂ NPC (BẮT BUỘC TẠO ÍT NHẤT 10 NPC ĐA DẠNG):
- Quy tắc: 7 NPC Phổ thông (Cảnh giới = Nền), 3 NPC VIP (Cảnh giới = Nền + 1 Đại cảnh giới).
[GENERATED_NPC: name="...", gender="...", race="...", realm="Luyện Khí 1 Tầng", personality="...", details="...", initialAffinity=0, relationshipToPlayer="..."]

3. KỸ NĂNG & VẬT PHẨM (TỐI THIỂU 5 MỖI LOẠI):
[GENERATED_SKILL: name="...", description="...", skillType="Công Pháp/Linh Kĩ", manaCost=10, cooldown=5, baseDamage=20]
[GENERATED_ITEM: name="...", description="...", quantity=1, category="Equipment", rarity="Common/Rare", itemRealm="Luyện Khí 1 Tầng", value=100, equipmentType="Weapon/Armor", slot="mainWeapon/body/head/artifact", statBonusesJSON='{"sucTanCong": 10, "maxSinhLuc": 50, "phongNgu": 5}', uniqueEffectsList="Tăng 5% bạo kích; Hồi 1% máu mỗi giây"]
[GENERATED_ITEM: name="...", description="...", quantity=5, category="Potion", rarity="Common", value=50, potionType="Hồi Phục", effectsList="Hồi 20% máu"]

4. CẤU TRÚC THẾ GIỚI:
[GENERATED_LOCATION: name="...", description="...", locationType="Thành thị/Sơn động", isSafeZone=true, mapX=0, mapY=0, economicZonesJSON='[{"id":"zone_1","name":"Tên Khu Vực","type":"marketplace/blacksmith/apothecary/inn/faction_specific","description":"Mô tả ngắn gọn"}]']
[GENERATED_FACTION: name="...", description="...", alignment="Chính Đạo/Tà Đạo", initialPlayerReputation=0]
[GENERATED_YEUTHU: name="...", species="...", description="...", realm="Luyện Khí 1 Tầng", loyalty=50]
[GENERATED_LORE: title="Lịch sử thế giới", content="..."]
[QUEST_ASSIGNED: title="Khởi đầu nan", description="...", rewardText="...", durationTurns=0]
`;
