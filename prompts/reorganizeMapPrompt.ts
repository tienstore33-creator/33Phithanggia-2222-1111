
import { KnowledgeBase, GameLocation } from '../types';

export const reorganizeMapPrompt = (locations: GameLocation[], kb: KnowledgeBase): string => {
    const mainLocations = locations.filter(loc => !loc.parentLocationId);
    
    return `Bạn là một chuyên gia địa lý và kiến trúc sư bản đồ thế giới chuyên nghiệp.
Nhiệm vụ của bạn là tối ưu hóa bản đồ bằng cách xác định các "Địa điểm chính" nào nên trở thành "Địa điểm phụ" của một địa điểm khác để bản đồ gọn gàng và logic hơn.

**DANH SÁCH ĐỊA ĐIỂM CHÍNH HIỆN TẠI:**
${mainLocations.map(loc => `- ${loc.name} (ID: ${loc.id}, Loại: ${loc.locationType}, Mô tả: ${loc.description})`).join('\n')}

**QUY TẮC PHÂN CẤP:**
1. Một địa điểm nên là địa điểm phụ nếu nó nằm trong, thuộc quyền quản lý, hoặc là một phần nhỏ của một địa điểm lớn hơn. 
   - Ví dụ: "Rìa Thái Nhạc Sơn Mạch" nên là con của "Thái Nhạc Sơn Mạch".
   - Ví dụ: "Dược Viên" nên là con của "Hoàng Phong Cốc".
   - Ví dụ: "Quảng trường trung tâm" nên là con của "Thành phố/Tông môn".
2. Khuyến khích gộp các địa điểm có tên tương tự hoặc có quan hệ logic chặt chẽ.
3. Khi một địa điểm trở thành địa điểm phụ, toàn bộ các "Khu vực kinh tế" (Shops/Zones) của nó sẽ được tự động gộp và xuất hiện tại địa điểm cha để người chơi dễ dàng tiếp cận.
4. Chỉ thực hiện nếu bạn chắc chắn 100% về quan hệ phụ thuộc.

**YÊU CẦU ĐẦU RA:**
- Liệt kê các thay đổi dưới dạng tag: **[LOCATION_REPARENT: childId="ID_CON", parentId="ID_CHA"]**
- Chỉ trả về các tag, không giải thích gì thêm.
- Nếu không có gì cần thay đổi, hãy trả về: "Bản đồ đã tối ưu, không cần thay đổi."

**VÍ DỤ:**
[LOCATION_REPARENT: childId="loc_123", parentId="loc_456"]
[LOCATION_REPARENT: childId="loc_789", parentId="loc_456"]
`;
};
