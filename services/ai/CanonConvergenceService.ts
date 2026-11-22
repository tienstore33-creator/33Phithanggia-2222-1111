export const getCanonConvergencePrompt = (work: string, realm: string) => {
  return `
### NARRATIVE CONVERGENCE PROTOCOL (BẮT BUỘC):
Bạn phải thực hiện bước so sánh nguyên tác trong thẻ <thinking> như sau:

- **Bước 3 (Canon Recall):** Dựa trên tri thức về "${work}", xác định nhân vật chính (Canon Protagonist) đang làm gì khi ở cảnh giới "${realm}".
  *Ví dụ: Nếu trong "${work}", khi nhân vật chính ở cảnh giới "${realm}" đang tham gia một đại hội võ thuật, thì bạn cần đối chiếu xem MC có đang ở gần sự kiện đó không.*
  
- **Bước 4 (Alignment Analysis):** 
  * So sánh vị trí/hoàn cảnh của MC hiện tại với Canon.
  * Tính Similarity Index (%).
  * Convergence Strategy: Đề xuất 1 sự kiện lớn trong nguyên tác để MC "va chạm". 
  * Vai trò của MC: (Người thay thế / Đồng đội / Đối thủ / Kẻ quan sát biến số).

- **Mục tiêu:** Điều hướng để trong 5-10 lượt tới, MC phải tham gia vào "Sự kiện trọng đại" của nguyên tác.
  `;
};
