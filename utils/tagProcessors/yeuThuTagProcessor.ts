
import React from 'react';
import { KnowledgeBase, GameMessage, YeuThu, VectorMetadata, PlayerStats } from '../../types';
import { MALE_AVATAR_PLACEHOLDER_URL, DEFAULT_MORTAL_STATS } from '../../constants';
import { getApiSettings, generateImageUnified } from '../../services/geminiService';
import { uploadImageToCloudinary } from '../../services/cloudinaryService';
import { formatYeuThuForEmbedding } from '../ragUtils';
import { generateYeuThuFromDB } from '../yeuThuUtils';
import { calculateRealmBaseStats, updateEntityStatsFromRealm } from '../statsCalculationUtils';
import { RealmParserService } from '../../services/RealmParserService';

export const processYeuThuAppear = async (
    currentKb: KnowledgeBase,
    tagParams: Record<string, string>,
    turnForSystemMessages: number,
    logNpcAvatarPromptCallback?: (prompt: string) => void,
    context?: { groupSize?: number }
): Promise<{ updatedKb: KnowledgeBase; systemMessages: GameMessage[]; newVectorMetadata?: VectorMetadata; }> => {
    const newKb = currentKb;
    const systemMessages: GameMessage[] = [];
    let newVectorMetadata: VectorMetadata | undefined = undefined;

    const name = tagParams.name;
    if (!name) {
        console.warn("YEUTHU_APPEAR: Missing name parameter.");
        return { updatedKb: newKb, systemMessages };
    }

    // Check if already exists to avoid duplicates in the same location
    if (newKb.discoveredYeuThu.some(yt => yt.name === name && yt.locationId === newKb.currentLocationId)) {
        // Already there, maybe just moved? For now, ignore.
        return { updatedKb: newKb, systemMessages };
    }

    // --- THE SECRETARY AT WORK ---
    // Use the utility function to generate the monster with full stats logic
    const newYeuThu = generateYeuThuFromDB(name, newKb, context);

    if (!newYeuThu) {
        console.warn(`YEUTHU_APPEAR: Could not generate YeuThu "${name}" from DB. It might not exist in the database.`);
        // Fallback: Create a generic one if not found in DB (shouldn't happen if AI follows prompt)
        // ... generic creation logic logic ...
         systemMessages.push({
            id: `yeuthu-error-${Date.now()}`,
            type: 'system',
            content: `[DEBUG] Không tìm thấy dữ liệu cho yêu thú "${name}".`,
            timestamp: Date.now(),
            turnNumber: turnForSystemMessages
        });
        return { updatedKb: newKb, systemMessages };
    }

    newKb.discoveredYeuThu.push(newYeuThu);
    newVectorMetadata = { entityId: newYeuThu.id, entityType: 'yeuThu', text: formatYeuThuForEmbedding(newYeuThu) };

    // Trigger Avatar Generation (Async)
    const apiSettings = getApiSettings();
    if (apiSettings.autoGenerateNpcAvatars) {
        systemMessages.push({
            id: `yeuthu-avatar-gen-${newYeuThu.id}`, type: 'system',
            content: `Đang tạo ảnh minh họa cho ${name} từ Sơn Hải Kinh...`,
            timestamp: Date.now(),
            turnNumber: turnForSystemMessages
        });

        (async () => {
            try {
                const prompt = `Một bức tranh thủy mặc cổ trang hoặc fantasy art chi tiết về quái vật ${name} trong truyền thuyết Sơn Hải Kinh. Mô tả: ${newYeuThu.description}. Phong cách: Huyền bí, cổ đại.`;
                if (logNpcAvatarPromptCallback) logNpcAvatarPromptCallback(prompt);
                
                const b64 = await generateImageUnified(prompt);
                if (b64) {
                    const finalUrl = b64.startsWith("data:image")
                        ? b64
                        : `data:image/png;base64,${b64}`;
                    newYeuThu.avatarUrl = finalUrl;
                }
            } catch (e) {
                console.error("Avatar gen failed", e);
            }
        })();
    } else {
         newYeuThu.avatarUrl = MALE_AVATAR_PLACEHOLDER_URL;
    }
    
    // System notification
    systemMessages.push({
        id: `yeuthu-appear-${newYeuThu.id}`,
        type: 'system',
        content: `Yêu thú xuất hiện: ${newYeuThu.name} (${newYeuThu.realm})!`,
        timestamp: Date.now(),
        turnNumber: turnForSystemMessages
    });

    return { updatedKb: newKb, systemMessages, newVectorMetadata };
};


export const processYeuThu = async (
    currentKb: KnowledgeBase,
    tagParams: Record<string, string>,
    turnForSystemMessages: number,
    logNpcAvatarPromptCallback?: (prompt: string) => void
): Promise<{ updatedKb: KnowledgeBase; systemMessages: GameMessage[]; newVectorMetadata?: VectorMetadata; }> => {
    const newKb = currentKb;
    const systemMessages: GameMessage[] = [];
    let newVectorMetadata: VectorMetadata | undefined = undefined;

    const name = tagParams.name;
    const species = tagParams.species;
    const description = tagParams.description;
    const isHostile = tagParams.isHostile?.toLowerCase() === 'true';
    let realm = tagParams.realm ? RealmParserService.cleanRealmString(tagParams.realm) : undefined;
    const aiSuggestedAvatarUrl = tagParams.avatarUrl;

    if (!name || !species || !description) {
        console.warn("YEUTHU: Missing required parameters (name, species, description).", tagParams);
        return { updatedKb: newKb, systemMessages };
    }

    if (newKb.discoveredYeuThu.find(yt => yt.name === name)) {
        // console.warn(`YEUTHU: A beast with name "${name}" already exists. Skipping creation.`);
        return { updatedKb: newKb, systemMessages };
    }

    // --- REALM SYNC LOGIC for YEUTHU ---
    const worldBase = newKb.worldRealmBase || (newKb.worldConfig?.canhGioiKhoiDau) || "Phàm Nhân Nhất Trọng";
    if (!realm || realm === "Không rõ") {
        realm = worldBase;
        systemMessages.push({
            id: `yeuthu-sync-${Date.now()}`,
            type: "system",
            content: `Yêu thú "${name}" được đồng bộ hóa với cảnh giới nền "${worldBase}".`,
            timestamp: Date.now(),
            turnNumber: turnForSystemMessages,
        });
    }

    let skills = [];
    if (tagParams.skillsJSON) {
        try {
            const parsedSkills = JSON.parse(tagParams.skillsJSON);
            if (Array.isArray(parsedSkills)) skills = parsedSkills;
        } catch (e) {}
    }

    const newYeuThu: YeuThu = {
        id: `yeuthu-${name.replace(/\s+/g, '-')}-${Date.now()}`,
        name: name,
        species: species,
        description: description,
        isHostile: isHostile,
        realm: realm || (newKb.worldConfig?.isCultivationEnabled ? 'Không rõ' : 'Người Thường'),
        avatarUrl: aiSuggestedAvatarUrl,
        stats: {},
        skills: skills,
        locationId: tagParams.locationId,
    };
    
    // Stats calculation
    updateEntityStatsFromRealm(newYeuThu, newKb);
    
    newKb.discoveredYeuThu.push(newYeuThu);
    newVectorMetadata = { entityId: newYeuThu.id, entityType: 'yeuThu', text: formatYeuThuForEmbedding(newYeuThu) };

    systemMessages.push({
        id: `yeuthu-discovered-${newYeuThu.id}`,
        type: 'system',
        content: `Bạn đã phát hiện ra một yêu thú: ${name} (${species})!`,
        timestamp: Date.now(),
        turnNumber: turnForSystemMessages
    });

    return { updatedKb: newKb, systemMessages, newVectorMetadata };
};

export const processYeuThuRemove = (
    currentKb: KnowledgeBase,
    tagParams: Record<string, string>,
    turnForSystemMessages: number
): { updatedKb: KnowledgeBase; systemMessages: GameMessage[] } => {
    const newKb = currentKb;
    const systemMessages: GameMessage[] = [];
    const name = tagParams.name;

    if (!name) {
        return { updatedKb: newKb, systemMessages };
    }

    const indexToRemove = newKb.discoveredYeuThu.findIndex(yt => yt.name === name);

    if (indexToRemove > -1) {
        const removed = newKb.discoveredYeuThu[indexToRemove];
        newKb.discoveredYeuThu.splice(indexToRemove, 1);
        systemMessages.push({
            id: `yeuthu-removed-${removed.id}`,
            type: 'system',
            content: `Yêu thú ${removed.name} đã bị tiêu diệt hoặc biến mất.`,
            timestamp: Date.now(),
            turnNumber: turnForSystemMessages
        });
    }

    return { updatedKb: newKb, systemMessages };
};

