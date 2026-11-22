import { KnowledgeBase, GameMessage } from '../../types';
import { PregnancyService } from '../../services/PregnancyService';
import { DISABLE_SEX_INTERACTION_STORAGE_KEY } from '../../constants';
import { NpcIntimacyDemandService } from '../../services/NpcIntimacyDemandService';

/**
 * Xử lý các tag tương tác đặc biệt [INTERACTION: type="sex", partner="Liễu Thanh Thanh"]
 * Thực hiện tính toán cơ học (xác suất mang thai) thay vì để AI quyết định.
 */
export const processInteraction = (
    kb: KnowledgeBase,
    params: Record<string, string>,
    turn: number
): { updatedKb: KnowledgeBase; systemMessages: GameMessage[]; errorReason?: string; } => {
    const updatedKb = { ...kb };
    const systemMessages: GameMessage[] = [];
    const { partner, type, malePartner } = params;

    if (!partner || !type) return { updatedKb, systemMessages, errorReason: "[INTERACTION] Thiếu tham số partner hoặc type." };

    // Tìm NPC partner trong tất cả các danh sách
    const findNpc = (name: string) => {
        if (!name) return undefined;
        const lowerName = name.toLowerCase().trim();
        return [
            ...(updatedKb.discoveredNPCs || []),
            ...(updatedKb.wives || []),
            ...(updatedKb.slaves || []),
            ...(updatedKb.prisoners || []),
            ...(updatedKb.companions || [])
        ].find(n => n.name.toLowerCase().trim() === lowerName);
    };

    let targetNpc = findNpc(partner);
    if (!targetNpc && updatedKb.playerStats && updatedKb.playerStats.name.toLowerCase().trim() === partner.toLowerCase().trim()) {
        targetNpc = { ...updatedKb.playerStats, id: 'player', gender: (updatedKb.playerStats as any).gender || 'Nam', affinity: 0 } as any;
    }

    if (!targetNpc) {
        return { updatedKb, systemMessages, errorReason: `[INTERACTION] Không tìm thấy NPC mang tên: "${partner}".` };
    }

    if (type.toLowerCase() === 'sex' || type.toLowerCase() === 'intimate') {
        // Kiểm tra nếu người dùng đã bật chế độ lờ đi thẻ sex
        if (typeof localStorage !== 'undefined' && localStorage.getItem(DISABLE_SEX_INTERACTION_STORAGE_KEY) === 'true') {
            console.log(`[INTERACTION] Đã lờ đi thẻ INTERACTION sex/intimate do cờ © đang kích hoạt.`);
            return { 
                updatedKb: kb, 
                systemMessages: [],
                errorReason: "[INTERACTION] Thẻ làm tình đã bị hệ thống lờ đi do chế độ © đang bật."
            };
        }

        let maleName = "";
        let femaleName = "";
        let fatherId = 'player';
        let fatherName = updatedKb.playerStats?.name || 'Người chơi';

        // Xác định giới tính của targetNpc (đối tượng A)
        const isTargetFemale = targetNpc.gender === 'Nữ';

        // Xác định đối tượng B (mặc định là MC)
        let otherNpc = undefined;
        let isOtherFemale = false;

        if (malePartner && malePartner.toLowerCase() !== 'mc' && malePartner.toLowerCase() !== 'player' && malePartner.toLowerCase() !== 'người chơi') {
            otherNpc = findNpc(malePartner);
            if (!otherNpc && updatedKb.playerStats && updatedKb.playerStats.name.toLowerCase().trim() === malePartner.toLowerCase().trim()) {
                otherNpc = { ...updatedKb.playerStats, id: 'player', gender: (updatedKb.playerStats as any).gender || 'Nam', affinity: 0 } as any;
            }
            isOtherFemale = otherNpc ? otherNpc.gender === 'Nữ' : false;
        }

        // Áp dụng cơ chế nhận diện giới tính
        if (isTargetFemale) {
            // partner (A) là Nữ
            femaleName = targetNpc.name;
            if (otherNpc && !isOtherFemale) {
                // malePartner là NPC Nam
                maleName = otherNpc.name;
                fatherId = otherNpc.id || `npc-${otherNpc.name.replace(/\s+/g, '-').toLowerCase()}`;
                fatherName = otherNpc.name;
            } else {
                // Mặc định người nam là MC
                maleName = updatedKb.playerStats?.name || 'Người chơi';
                fatherId = 'player';
                fatherName = maleName;
            }
        } else {
            // partner (A) là Nam -> Cần malePartner hoặc otherNpc là Nữ. Nếu không có NPC Nữ hợp lệ, bỏ qua tag do sai cú pháp.
            if (otherNpc && isOtherFemale) {
                maleName = targetNpc.name;
                fatherId = targetNpc.id || `npc-${targetNpc.name.replace(/\s+/g, '-').toLowerCase()}`;
                fatherName = targetNpc.name;
                femaleName = otherNpc.name;
            } else {
                // Tag thiếu/sai tham số NPC nữ -> Bỏ qua không chấp hành, không dùng fallback
                return { updatedKb, systemMessages, errorReason: `[INTERACTION] Thiếu đối tượng nữ hợp lệ cho sự kiện sex với "${partner}".` };
            }
        }

        // 1. Thêm tin nhắn hệ thống báo ai làm tình với ai đúng chuẩn cú pháp Nam -> Nữ
        systemMessages.push({
            id: `sex-event-${Date.now()}-${Math.random()}`,
            type: 'system',
            content: `[Thiên đạo] ${maleName} đã làm tình với ${femaleName}`,
            timestamp: Date.now(),
            turnNumber: turn
        });

        // 2. Chạy cơ chế thụ thai cho nhân vật Nữ
        const femaleNpcObj = findNpc(femaleName);
        if (femaleNpcObj) {
            // Ghi nhận hiệp mây mưa cơ học và nâng tổng số lần ân ái
            NpcIntimacyDemandService.recordSexRound(femaleNpcObj, turn);

            const pregnantResult = PregnancyService.checkConception(femaleNpcObj, fatherId, fatherName);
            if (pregnantResult) {
                console.log(`[DEV_LOG]: Interaction thụ thai thành công cho NPC Nữ ${femaleNpcObj.name}`);
                if (!femaleNpcObj.history) femaleNpcObj.history = [];
                femaleNpcObj.history.push(`[Lượt ${turn}] Sự kiện thụ thai cơ học xảy ra.`);
            }
        }
    } else if (type.toLowerCase() === 'pregnancy_reveal') {
        if (targetNpc.pregnancy?.isPregnant) {
            targetNpc.pregnancy.discoveredAtTurn = turn;
            systemMessages.push({
                id: `interaction-reveal-${targetNpc.id}-${turn}`,
                type: 'system',
                content: `[HỆ THỐNG] MC đã chính thức biết tin ${targetNpc.name} mang thai.`,
                timestamp: Date.now(),
                turnNumber: turn
            });
        }
    }

    return { updatedKb, systemMessages };
};
