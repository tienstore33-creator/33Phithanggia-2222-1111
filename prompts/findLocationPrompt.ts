
import { KnowledgeBase, FindLocationParams } from '../types';
import * as GameTemplates from '../templates';

export const generateFindLocationPrompt = (
    kb: KnowledgeBase,
    params: FindLocationParams,
    currentPageMessagesLog: string,
    previousPageSummaries: string[],
    lastNarrationFromPreviousPage?: string
): string => {
    const { playerStats, worldConfig, discoveredLocations, currentLocationId } = kb;
    const currentLocation = discoveredLocations.find(loc => loc.id === currentLocationId);

    const mainLocations = discoveredLocations.filter(loc => 
        Object.values(GameTemplates.LocationType).includes(loc.locationType as any)
    );

    const context = `
**BỐI CẢNH HIỆN TẠI:**
- **Thế giới:** Chủ đề "${worldConfig?.theme}", thể loại "${worldConfig?.genre}".
- **Người Chơi:** ${worldConfig?.playerName || 'Người Chơi'}, cảnh giới/cấp độ: ${playerStats.realm}.
- **Vị Trí Hiện Tại:** ${currentLocation?.name || 'Không rõ'} (Tọa độ: ${currentLocation?.mapX}, ${currentLocation?.mapY}).
- **Danh sách CÁC ĐỊA ĐIỂM CHÍNH đã biết (Dùng để phân định):**
${mainLocations.length > 0 ? mainLocations.map(loc => `  - ${loc.name} (${loc.locationType}) tại (${loc.mapX}, ${loc.mapY})`).join('\n') : '  Chưa có địa điểm chính nào.'}

- **Các địa điểm phụ/khác ở gần:**
${discoveredLocations
    .filter(loc => !mainLocations.includes(loc))
    .slice(0, 5)
    .map(loc => `  - ${loc.name} (${loc.locationType})`)
    .join('\n')}

**DIỄN BIẾN CÂU CHUYỆN GẦN ĐÂY (Để AI hiểu tại sao người chơi tìm kiếm):**
- **Tóm tắt các trang trước:**
${previousPageSummaries.join("\n\n") || "Không có."}
- **Diễn biến gần nhất (lượt trước):**
${lastNarrationFromPreviousPage || "Không có."}
- **Diễn biến chi tiết trang hiện tại:**
${currentPageMessagesLog || "Không có."}
`;

    const request = `
**YÊU CẦU TÌM KIẾM CỦA NGƯỜI CHƠI:**
- **Phương thức tìm kiếm:** "${params.searchMethod}"
- **Loại địa điểm mong muốn:** ${params.locationTypes.length > 0 ? params.locationTypes.join(', ') : 'Bất kỳ'}
- **Đặc tính:** ${params.isSafeZone === null ? 'Bất kỳ' : (params.isSafeZone ? 'Phải là khu an toàn' : 'Không phải là khu an toàn')}
- **Từ khóa mô tả:** "${params.keywords}"

**CÂU HỎI TƯ DUY (BẮT BUỘC TRẢ LỜI TRONG <thinking>):**
"Địa điểm của mc có phải là địa điểm phụ của địa điểm chính nào đó không??"
`;

    const instructions = `
**NHIỆM VỤ CỦA BẠN (AI):**
Bạn là một AI kể chuyện kiêm người dẫn đường, giúp người chơi khám phá thế giới game. Dựa vào yêu cầu của người chơi, hãy thực hiện hai việc sau:

1.  **VIẾT LỜI KỂ (BẮT BUỘC):**
    *   Mô tả quá trình tìm kiếm dựa trên phương thức "${params.searchMethod}".
    *   Lời kể này nên được trả về dưới dạng văn bản bình thường (narration).

2.  **TẠO ĐỊA ĐIỂM (QUY TẮC CỰC KỲ KHẮT KHE):**
    *   **HẠN CHẾ ĐỊA ĐIỂM CHÍNH:** AI đang sinh ra quá nhiều địa điểm chính (Thành phố, Thị trấn) làm loãng bản đồ. Hãy cực kỳ tiết chế.
    *   **PHÂN CẤP ĐỊA ĐIỂM:** 
        - Nếu người chơi đang ở TRONG hoặc GẦN một địa điểm chính (Thành phố, Môn phái), hãy ưu tiên tạo **Địa Điểm Phụ** (SUBLOCATION) như: Quán trọ, Tiệm thuốc, Phủ đệ, Ngõ nhỏ, v.v.
        - Chỉ tạo **Địa Điểm Chính** (MAINLOCATION) mới nếu người chơi đang ở vùng hoang dã hoặc thực sự di chuyển ra xa khu vực hiện tại.
    *   **Số lượng:** Tạo tối đa **1 đến 2** địa điểm (có thể là 1 chính 1 phụ, hoặc 2 phụ). KHÔNG bắt buộc lúc nào cũng phải tạo 2 địa điểm chính.
    *   **Thẻ [MAINLOCATION]:** Chỉ dùng cho địa điểm cấp cao (vùng đất lớn, thành phố, đại môn phái).
    *   **Thẻ [SUBLOCATION]:** Dùng cho địa điểm nằm bên trong hoặc thuộc về một địa điểm chính. 
        - Cú pháp: \`[SUBLOCATION: name="Tên", parentLocationId="${currentLocation?.id}", locationType="${Object.values(GameTemplates.SubLocationType).join('|')}"]\`
    *   **KHU VỰC KINH TẾ:** Chỉ [MAINLOCATION] (Thành phố/Thị trấn) mới cần \`economicZonesJSON\`.

**VÍ DỤ HOÀN CHỈNH (Tìm thấy địa điểm phụ):**
Sau một hồi dò hỏi dân làng, bạn biết được ở sâu trong con hẻm phía sau chợ có một tiệm thuốc cũ của một lão y sư kỳ dị.

[SUBLOCATION: name="Tiệm Thuốc Lão Quái", parentLocationId="${currentLocation?.id}", description="Một hiệu thuốc nồng nặc mùi dược liệu khô, treo đầy những bình gốm lạ mắt.", locationType="${GameTemplates.SubLocationType.OTHER}"]
`;

    return `
${context}
${request}
${instructions}
`;
};
