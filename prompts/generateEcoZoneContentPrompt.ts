
import { KnowledgeBase, EconomicZoneStub, GameLocation } from '../types';
import * as GameTemplates from '../templates';
import { SUB_REALM_NAMES } from '../constants';

export const generateEcoZoneContentPrompt = (
    knowledgeBase: KnowledgeBase,
    zoneStub: EconomicZoneStub,
    currentPageMessagesLog: string,
    previousPageSummaries: string[]
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
**YÊU CẦU ĐẶC BIỆT (NSFW ON):**
*   Nếu khu vực này là Chợ Nô Lệ, hãy tạo NPC \`vendorType="SlaveTrader"\` và các nô lệ (\`[SLAVE_FOR_SALE: ...]\`) hoặc tù nhân (\`[PRISONER_FOR_SALE: ...]\`).
` : '';

    return `
BẠN LÀ HỆ THỐNG KIẾN TẠO DỮ LIỆU KINH TẾ (TAWA-ECONOMY-ENGINE).
Người chơi vừa tiến vào **${zoneStub.name}** (Loại: ${zoneStub.type}) tại ${parentLocation?.name || 'địa điểm hiện tại'}.

**YÊU CẦU CỐT LÕI (CỰC KỲ QUAN TRỌNG):**
1. **KHÔNG ĐƯỢC PHÉP VIẾT LỜI DẪN TRUYỆN (NO NARRATION):** Tuyệt đối không viết bất kỳ đoạn văn mô tả nào. 
2. **SUY LUẬN LOGIC TỪ TÊN VÀ LOẠI HÌNH (CONTEXTUAL ANALYSIS):** 
    - Phải phân tích **toàn bộ** tên "${zoneStub.name}" và bối cảnh xung quanh.
    - **Archetype 1: Hoang dã/Hang động** -> Nếu ở nơi hẻo lánh: NPC nên là ẩn sĩ, thợ săn, quái nhân. Hàng hóa là thảo dược thô, nguyên liệu quái vật, bí tịch rách nát.
    - **Archetype 2: Đô thị/Thành trấn** -> Nếu ở nơi sầm uất: NPC là thương nhân, tiểu nhị chuyên nghiệp. Hàng hóa đa dạng, tinh xảo, có nguồn gốc rõ ràng.
    - **Archetype 3: Khu vực riêng tư** -> Nếu tên có "Động phủ của...", "Nơi ở của..." -> Chủ nhân hoặc gia nhân. Hàng hóa là trang bị cá nhân, tài sản tích lũy.
    - Tuyệt đối không được để hàng hóa chung chung hoặc không hợp logic bối cảnh.
3. **KHÔNG ĐƯỢC BỎ TRỐNG:** Cửa hàng phải có đầy đủ NPC và Hàng hóa (7-12 mục).

**YÊU CẦU TAG THỰC THI (MANDATORY):**
*   **SUBLOCATION:** Tạo địa điểm phụ: \`[SUBLOCATION: name="${zoneStub.name}", parentLocationId="${parentLocation?.id}", locationType="..."]\`.
*   **NPC:** Tạo ít nhất 1-2 NPC (chủ nhân hoặc phục vụ): \`[NPC: locationId="${zoneStub.name}", ...]\`.
*   **VẬT PHẨM (SHOP_ITEM):** Tạo chính xác 7-12 mặt hàng logic với tên địa điểm: \`[SHOP_ITEM: parentId="Tên NPC vừa tạo", ...]\`.
    - Phải phản ánh đúng đặc thù tài sản của tên địa điểm "${zoneStub.name}".

**DANH SÁCH TAGS:**
- \`[NPC: name, sex, race, realm, description, personality, affinity, locationId, vendorType, vendorSlogan, vendorBuysCategories]\`
- \`[SHOP_ITEM: parentId, name, type, description, quantity, rarity, value, itemRealm, ...]\`
${worldConfig?.nsfwMode ? '- `[SLAVE_FOR_SALE: ...]`\n- `[PRISONER_FOR_SALE: ...]`' : ''}

${cultivationSystemContext}
${nsfwInstructions}

**CẤU TRÚC PHẢN HỒI:**
- Trả về rỗng (Empty string) cho phần nội dung văn bản.
- Chỉ trả về các TAG nằm trong thẻ \`<update_data>\` (nếu có hệ thống bọc) hoặc ghi trực tiếp ở cuối.
- TRÁNH lời dẫn giải.
`;
};
