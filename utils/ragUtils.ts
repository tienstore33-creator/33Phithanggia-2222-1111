import { NPC, Wife, Slave, Prisoner, Master, Item, Skill, Quest, GameLocation, Faction, WorldLoreEntry, YeuThu } from '../types';
import * as GameTemplates from '../templates';

/**
 * Creates a descriptive string for an NPC/Person for embedding.
 */
export const formatPersonForEmbedding = (person: NPC | Wife | Slave | Prisoner | Master): string => {
    const entityType = 'entityType' in person ? (person as Wife | Slave | Prisoner).entityType : ('mood' in person ? 'master' : 'npc');
    
    let details = `Nhân vật (${entityType}): ${person.name} (ID: ${person.id}).`;
    details += ` Mô tả hiện tại: ${person.description}.`;
    
    // OPTIMIZATION: Only include recent history in the main profile vector.
    // Older history is chunked separately in vectorizeKnowledgeBase to avoid diluting the main vector.
    if (person.history && person.history.length > 0) {
        const recentHistory = person.history.slice(-3); // Only last 3 entries
        details += ` Sự kiện/Lịch sử gần đây: ${recentHistory.join(" | ")}.`;
    }

    if ('personalityTraits' in person && person.personalityTraits) {
        details += ` Tính cách nổi bật: ${person.personalityTraits.join(', ')}.`;
    }

    if ('currentGoal' in person && person.currentGoal) {
        details += ` Mục tiêu hiện tại: ${person.currentGoal}.`;
    }
    
    details += ` Chức danh: ${person.title || 'Không'}.`;
    details += ` Giới tính: ${person.gender || 'Không rõ'}.`;
    details += ` Chủng tộc: ${person.race || 'Không rõ'}.`;
    details += ` Cảnh giới: ${person.realm || 'Không rõ'}.`;
    
    if ('relationshipToPlayer' in person) {
        details += ` Mối quan hệ với người chơi: ${(person as NPC).relationshipToPlayer || 'Chưa rõ'}.`;
    }
    
    // NEW: Include NpcRelationship data
    if (person.relationships && person.relationships.length > 0) {
        const relStrings = person.relationships.map(r => `${r.type} của ${r.targetName}`);
        details += ` Các mối quan hệ xã hội khác: ${relStrings.join(', ')}.`;
    }

    details += ` Thiện cảm: ${person.affinity}.`;
    if ('pride' in person && person.pride !== undefined) {
        details += ` Kiêu hãnh (Pride): ${person.pride}/100.`;
    }
    if ('survivalInstinct' in person && person.survivalInstinct) {
        details += ` Bản năng sinh tồn: ${person.survivalInstinct}.`;
    }
    if ('resentmentCounter' in person && person.resentmentCounter !== undefined) {
        details += ` Nuôi hận (Resentment): ${person.resentmentCounter}.`;
    }
    details += ` Linh căn: ${person.spiritualRoot || 'Không rõ'}.`;
    details += ` Thể chất: ${person.specialPhysique || 'Không rõ'}.`;
    details += ` Tư chất: ${person.tuChat || 'Không rõ'}.`;

    if (person.stats) {
        let statsParts: string[] = [];
        if (person.stats.maxSinhLuc) statsParts.push(`HP ${person.stats.sinhLuc}/${person.stats.maxSinhLuc}`);
        if (person.stats.maxLinhLuc) statsParts.push(`MP ${person.stats.linhLuc}/${person.stats.maxLinhLuc}`);
        if (person.stats.sucTanCong) statsParts.push(`ATK ${person.stats.sucTanCong}`);
        if (person.stats.maxThoNguyen) statsParts.push(`Thọ nguyên ${Math.floor(person.stats.thoNguyen || 0)}/${person.stats.maxThoNguyen}`);
        if (statsParts.length > 0) details += ` Chỉ số: ${statsParts.join(', ')}.`;
    }
    
    if (entityType === 'prisoner') {
        const prisoner = person as Prisoner;
        details += ` Trạng thái tù nhân: Ý chí ${prisoner.willpower}, Phản kháng ${prisoner.resistance}, Phục tùng ${prisoner.obedience}.`;
    } else if (entityType === 'wife' || entityType === 'slave') {
        const companion = person as Wife | Slave;
        details += ` Trạng thái bạn đồng hành: Ý chí ${companion.willpower}, Phục tùng ${companion.obedience}.`;
    } else if (entityType === 'master') {
        const master = person as Master;
        details += ` Trạng thái chủ nhân: Tâm trạng ${master.mood}, Mục tiêu ${master.currentGoal}, Sủng ái ${master.favor || 0}.`;
    }
    
    if (person.isFollowingPlayer) {
        details += ` Hiện đang theo sau để bảo vệ người chơi.`;
    }
    
    return details;
};

/**
 * Creates a descriptive string for an Item for embedding.
 */
export const formatItemForEmbedding = (item: Item): string => {
    let details = `Vật phẩm: ${item.name} (Loại: ${item.category}).`;
    details += ` Mô tả: ${item.description}.`;
    details += ` Độ hiếm: ${item.rarity}.`;
    details += ` Cảnh giới vật phẩm: ${item.itemRealm || 'Không rõ'}.`;
    
    if (item.category === GameTemplates.ItemCategory.EQUIPMENT) {
        const equip = item as GameTemplates.EquipmentTemplate;
        if (equip.slot) details += ` Vị trí trang bị: ${equip.slot}.`;
        if (equip.statBonuses) details += ` Chỉ số cộng thêm: ${JSON.stringify(equip.statBonuses)}.`;
        if (equip.uniqueEffects && equip.uniqueEffects.length > 0) details += ` Hiệu ứng đặc biệt: ${equip.uniqueEffects.join(', ')}.`;
    } else if (item.category === GameTemplates.ItemCategory.POTION) {
        const potion = item as GameTemplates.PotionTemplate;
        details += ` Loại đan dược: ${potion.potionType}.`;
        if (potion.effects && potion.effects.length > 0) details += ` Tác dụng: ${potion.effects.join(', ')}.`;
    } else if (item.category === GameTemplates.ItemCategory.CONG_PHAP) {
         const cp = item as GameTemplates.CongPhapTemplate;
         // Fix: Removed incorrect property access 'congPhapDetails'
         details += ` Loại công pháp: ${cp.congPhapType}. Thưởng kinh nghiệm: ${cp.expBonusPercentage}%.`;
    }

    return details;
};

/**
 * Creates a descriptive string for a Skill for embedding.
 */
export const formatSkillForEmbedding = (skill: Skill): string => {
    let details = `Kỹ năng: ${skill.name} (Loại: ${skill.skillType}).`;
    details += ` Mô tả: ${skill.description}.`;
    details += ` Hiệu ứng chi tiết: ${skill.detailedEffect}.`;
    
    if (skill.manaCost) details += ` Tiêu hao: ${skill.manaCost} linh lực.`;
    if (skill.cooldown) details += ` Hồi chiêu: ${skill.cooldown} lượt.`;
    
    if (skill.baseDamage) details += ` Sát thương cơ bản: ${skill.baseDamage}.`;
    if (skill.healingAmount) details += ` Hồi phục cơ bản: ${skill.healingAmount}.`;
    
    if (skill.congPhapDetails) {
        details += ` Chi tiết công pháp: Loại ${skill.congPhapDetails.type}, Phẩm chất ${skill.congPhapDetails.grade}.`;
    }
    if (skill.linhKiDetails) {
        details += ` Chi tiết linh kĩ: Loại ${skill.linhKiDetails.category}, Kích hoạt ${skill.linhKiDetails.activation}.`;
    }
    
    return details;
};

/**
 * Creates a descriptive string for a Quest for embedding.
 */
export const formatQuestForEmbedding = (quest: Quest): string => {
    let details = `Nhiệm vụ: ${quest.title} (Trạng thái: ${quest.status}).`;
    details += ` Mô tả: ${quest.description}.`;
    
    const objectives = quest.objectives.map(obj => `${obj.text} (${obj.completed ? 'Hoàn thành' : 'Chưa hoàn thành'})`).join('; ');
    details += ` Mục tiêu: ${objectives}.`;
    
    if (quest.rewardText) details += ` Phần thưởng: ${quest.rewardText}.`;
    if (quest.punishmentText) details += ` Trừng phạt: ${quest.punishmentText}.`;
    
    return details;
};

/**
 * Creates a descriptive string for a Location for embedding.
 */
export const formatLocationForEmbedding = (location: GameLocation): string => {
    let details = `Địa điểm: ${location.name} (Loại: ${location.locationType || 'Không rõ'}).`;
    details += ` Mô tả: ${location.description}.`;
    details += ` Khu vực an toàn: ${location.isSafeZone ? 'Có' : 'Không'}.`;
    if (location.regionId) details += ` Thuộc vùng: ${location.regionId}.`;
    
    return details;
};

/**
 * Creates a descriptive string for a Faction for embedding.
 */
export const formatFactionForEmbedding = (faction: Faction): string => {
    let details = `Phe phái: ${faction.name} (Chính tà: ${faction.alignment}).`;
    details += ` Mô tả: ${faction.description}.`;
    details += ` Uy tín với người chơi: ${faction.playerReputation}.`;
    
    return details;
};

/**
 * Creates a descriptive string for World Lore for embedding.
 */
export const formatLoreForEmbedding = (lore: WorldLoreEntry): string => {
    return `Tri thức thế giới: ${lore.title}. Nội dung: ${lore.content}`;
};

/**
 * Creates a descriptive string for YeuThu for embedding.
 */
export const formatYeuThuForEmbedding = (yeuThu: YeuThu): string => {
    let details = `Yêu thú: ${yeuThu.name} (Loài: ${yeuThu.species}).`;
    details += ` Mô tả: ${yeuThu.description}.`;
    details += ` Cảnh giới: ${yeuThu.realm || 'Không rõ'}.`;
    details += ` Thái độ: ${yeuThu.isHostile ? 'Thù địch' : 'Trung lập'}.`;
    return details;
};