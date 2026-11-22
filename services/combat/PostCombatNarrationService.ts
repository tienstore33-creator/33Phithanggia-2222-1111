import { KnowledgeBase, GameMessage } from '../../types';

/**
 * Kiểm tra xem hành động của lượt chơi có phải là lượt kể hậu quả sau chiến đấu hay không
 */
export const isPostCombatAction = (action: string): boolean => {
    if (!action) return false;
    return (
        action.includes('<ket_qua_chien_dau>') ||
        action.includes('[HỆ THỐNG - KẾT QUẢ TRẬN CHIẾN]') ||
        action.includes('<hau_qua_chien_dau>') ||
        action.includes('su_kien_tu_sat_+ket_qua_chien_dau') ||
        action.includes('thong_tin_ket_qua_+ket_qua_chien_dau')
    );
};

/**
 * Tạo prompt hành động chuẩn hoá bọc thẻ XML cho lượt kể hậu quả chiến đấu
 */
export const buildPostCombatFormattedAction = (params: {
    outcomeText: string;
    npcFateText: string;
    lootText: string;
    last4Logs: string[];
    isPlayerSuicide?: boolean;
    mcName?: string;
}): string => {
    const { outcomeText, npcFateText, lootText, last4Logs, isPlayerSuicide, mcName } = params;

    if (isPlayerSuicide) {
        return `<ket_qua_chien_dau>
   <su_kien_tu_sat_+ket_qua_chien_dau>
================
[HỆ THỐNG - KẾT QUẢ TRẬN CHIẾN: TỰ SÁT TỬ VONG]
- Kết quả: Thất bại (Tự sát hoá đạo)
- Nhân vật chính: ${mcName || 'Nhân vật chính'} đã tự bạo/kết liễu nhục thân, Sinh Lực (HP) trở về 0, hoàn toàn tử vong tức tưởi.
- Số phận NPC: ${npcFateText}
- Diễn biến 4 lượt cuối:
${last4Logs.map(log => `  + ${log}`).join('\n')}
================
   </su_kien_tu_sat_+ket_qua_chien_dau>
   <yeu_cau_ke_chuyen_+ket_qua_chien_dau>
================
BẮT BUỘC: Hãy viết lời kể miêu tả chi tiết, bi tráng và tức tưởi về cảnh tượng cái chết của ${mcName || 'Nhân vật chính'} khi nhục thân bị hủy diệt hoàn toàn, tan biến vào hư vô hoặc ngã gục không còn sinh khí, linh hồn/tàn hồn lìa khỏi thể xác. Tuyệt đối KHÔNG ĐƯỢC miêu tả ${mcName || 'Nhân vật chính'} còn sống hay còn cử động nhục thân. Lượt kể này kết thúc tại cảnh tượng cái chết của ${mcName || 'Nhân vật chính'}.
================
   </yeu_cau_ke_chuyen_+ket_qua_chien_dau>
</ket_qua_chien_dau>`;
    }

    return `<ket_qua_chien_dau>
   <thong_tin_ket_qua_+ket_qua_chien_dau>
================
[HỆ THỐNG - KẾT QUẢ TRẬN CHIẾN: ĐÃ KẾT THÚC]
- Kết quả chung cuộc: ${outcomeText}
- Số phận đối thủ / NPC: ${npcFateText}
- Chiến lợi phẩm thu được: ${lootText}
- Diễn biến 4 lượt cuối của trận chiến vừa xong:
${last4Logs.map(log => `  + ${log}`).join('\n')}
================
   </thong_tin_ket_qua_+ket_qua_chien_dau>
   <yeu_cau_ke_chuyen_+ket_qua_chien_dau>
================
1. ĐÂY LÀ PHÂN CẢNH HẬU QUẢ CHIẾN ĐẤU: Trận chiến ĐÃ KẾT THÚC HOÀN TOÀN. 
2. TUYỆT ĐỐI CẤM KÍCH HOẠT CHIẾN ĐẤU MỚI: Không được tiếp tục mô tả tình huống giao tranh, không được xuất tag [BEGIN_COMBAT] hay kích hoạt COMBAT_CLIFFHANGER_PROTOCOL. 
3. Kẻ địch đã bị khuất phục, bắt làm tù binh, tử trận hoặc bỏ chạy theo đúng mục "Số phận đối thủ / NPC" ở trên.
4. Hãy tiếp tục viết lời kể miêu tả chi tiết hậu quả trận chiến, cảnh tượng sau khi tàn cuộc, cảm xúc và phản ứng của các nhân vật, thu dọn chiến trường hoặc áp giải/quản thúc tù binh.
================
   </yeu_cau_ke_chuyen_+ket_qua_chien_dau>
</ket_qua_chien_dau>`;
};

/**
 * Xử lý bỏ qua pendingCombat và tắt cơ chế trừ HP cơ học trong lượt hậu chiến
 */
export const applyPostCombatMechanicOverrides = (
    kb: KnowledgeBase,
    startKb: KnowledgeBase,
    actionText: string
): { updatedKb: KnowledgeBase; systemMessages: GameMessage[] } => {
    const updatedKb = kb;
    const systemMessages: GameMessage[] = [];

    if (!isPostCombatAction(actionText)) {
        return { updatedKb, systemMessages };
    }

    // 1. Tuyệt đối dẹp bỏ pendingCombat phát sinh nhầm trong lượt hậu chiến
    if (updatedKb.pendingCombat) {
        updatedKb.pendingCombat = null;
    }

    // 2. Bảo vệ Sinh Lực (HP) của người chơi: Tắt trừ HP cơ học phát sinh trong lượt này
    if (startKb?.playerStats?.sinhLuc !== undefined) {
        if (updatedKb.playerStats.sinhLuc < startKb.playerStats.sinhLuc && !updatedKb.playerStats.isDead) {
            updatedKb.playerStats.sinhLuc = startKb.playerStats.sinhLuc;
        }
    }

    // 3. Bảo vệ Sinh Lực (HP) của tất cả NPC / Đồng đội / Nô lệ / Tù binh: Không bị trừ máu cơ học thêm trong lượt này
    const restoreEntityHp = (currentList: any[], startList: any[]) => {
        if (!currentList || !startList) return;
        currentList.forEach(curr => {
            const original = startList.find((s: any) => s.id === curr.id || s.name === curr.name);
            if (original && original.stats && curr.stats) {
                if (curr.stats.sinhLuc !== undefined && original.stats.sinhLuc !== undefined) {
                    if (curr.stats.sinhLuc < original.stats.sinhLuc) {
                        curr.stats.sinhLuc = original.stats.sinhLuc;
                    }
                }
            }
        });
    };

    restoreEntityHp(updatedKb.discoveredNPCs, startKb.discoveredNPCs);
    restoreEntityHp(updatedKb.wives || [], startKb.wives || []);
    restoreEntityHp(updatedKb.slaves || [], startKb.slaves || []);
    restoreEntityHp(updatedKb.prisoners || [], startKb.prisoners || []);
    restoreEntityHp(updatedKb.companions || [], startKb.companions || []);

    return { updatedKb, systemMessages };
};
