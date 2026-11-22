import { callGeminiAPI } from "../apiService";
import { KnowledgeBase } from "../../types";

export const generateSeclusionNarrative = async (
  kb: KnowledgeBase,
  days: number,
  months: number,
  years: number,
  previousContext: string,
  deadNpcs?: string[],
  mcDied?: boolean
): Promise<string> => {
  const timeStr = `${years > 0 ? years + ' năm ' : ''}${months > 0 ? months + ' tháng ' : ''}${days > 0 ? days + ' ngày' : ''}`;
  
  const currentLocationName = (kb.discoveredLocations || []).find(l => l.id === kb.currentLocationId)?.name || 'Không rõ';
  
  let deathContext = '';
  if (mcDied) {
    deathContext += `\n- CẢNH BÁO THỌ NGUYÊN MC: Nhân vật chính ${kb.worldConfig?.playerName || 'Vô Danh'} trong quá trình bế quan ${timeStr} đã cạn kiệt thọ nguyên (< 1 năm) và tọa hóa qua đời trong đại định! Hãy mô tả khoảnh khắc trút hơi thở cuối cùng, tọa hóa quy tiên.`;
  }
  if (deadNpcs && deadNpcs.length > 0) {
    deathContext += `\n- BẾN CỐ TỌA HÓA NPC: Trong thời gian ${timeStr} bế quan, các NPC sau đã cạn kiệt thọ nguyên (< 1 năm) và tọa hóa qua đời: ${deadNpcs.join(', ')}. Hãy lồng ghép thông tin/tin đồn về sự ra đi của họ khi xuất quan.`;
  }

  const prompt = `Bạn là một đại văn hào tiên hiệp. Hãy viết một lượt truyện đặc biệt mô tả quá trình bế quan của nhân vật.

DỰA TRÊN NGỮ CẢNH TRƯỚC ĐÓ:
"${previousContext}"

Thông tin nhân vật:
- Tên: ${kb.worldConfig?.playerName || 'Vô Danh'}
- Cảnh giới: ${kb.playerStats.realm}
- Vị trí hiện tại: ${currentLocationName}
${deathContext}

YÊU CẦU NỘI DUNG GỒM 3 PHẦN LIỀN MẠCH:
1. DẪN NHẬP: Kết nối với sự kiện vừa xảy ra ở trên. Nhân vật chính nhận ra nhu cầu đột phá hoặc cần tịnh tâm, thu xếp hành trang/tâm thế và bước vào nơi tu luyện (${currentLocationName}).
2. QUÁ TRÌNH: Mô tả sự tĩnh lặng, những chuyển biến tinh tế của linh lực và cảm giác thời gian ${timeStr} trôi qua nhanh như cái chớp mắt nhưng cũng dài tựa thiên thu. Mô tả cảnh vật nơi bế quan thay đổi theo thời gian (bụi bặm, rêu phong, cỏ cây xung quanh đại thụ...).
3. XUẤT QUAN: Cảnh nhân vật mở mắt (hoặc trút hơi thở cuối cùng nếu hết thọ nguyên). Cảm nhận về cơ thể mới, sức mạnh mới và sự thay đổi của thế giới bên ngoài sau ${timeStr}. Có thể là những tin đồn hoặc biến cố sự ra đi của các NPC tọa hóa do hết thọ nguyên.

PHONG CÁCH:
- Huyền ảo, giàu tính hình tượng, sử dụng nhiều từ Hán Việt phù hợp tiên hiệp.
- Ngôn từ trang trọng nhưng vẫn đầy cảm xúc.
- Tuyệt đối không giải thích thêm, chỉ trả về văn bản truyện.`;

  try {
    const { text } = await callGeminiAPI(prompt, undefined, 'main');
    return text || "";
  } catch (error) {
    console.error("Error generating seclusion narrative:", error);
    return `Bạn đã kết thúc quá trình bế quan kéo dài ${timeStr}. Tu vi có chút tinh tiến.`;
  }
};
