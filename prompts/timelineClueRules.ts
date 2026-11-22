export const generateTimelineCluePrompt = (currentTurn: number, currentEvent: any, nextEvent: any): string => {
  if (!currentEvent) return "";

  const currentEventName = currentEvent.eventName || "Sự kiện hiện tại";
  const nextEventName = nextEvent ? nextEvent.eventName : null;

  if (currentTurn > 0 && currentTurn % 2 === 0) {
    return `
<quy_tac_manh_moi_timeline>
   <luat_nhip_do_hai_luot_+quy_tac_manh_moi_timeline>
================
LƯỢT HIỆN TẠI (Lượt ${currentTurn}) LÀ LƯỢT ĐIỂM RƠI CHU KỲ 2 LƯỢT:
Bạn BẮT BUỘC phải lồng ghép khéo léo vào lời kể:
1. MANH MỐI SỰ KIỆN ĐANG LÀM: Xuất hiện ít nhất một manh mối trực quan (vết tích, vật phẩm rơi lại, lời nói lỡ miệng của NPC, hoặc biến cố tại hiện trường) thúc đẩy MC giải quyết sự kiện "${currentEventName}".
2. ĐIỀM BÁO SỰ KIỆN SẮP TỚI: ${nextEventName ? `Xuất hiện một chi tiết hé lộ xa xôi (tin đồn từ người qua đường, dị tượng thiên nhiên, chuyển động bất thường của thế lực khác) dự báo trước cho sự kiện sắp tới: "${nextEventName}".` : "Không có sự kiện sắp tới tiếp theo, hãy tập trung hoàn toàn vào việc giải quyết dứt điểm sự kiện hiện tại."}
3. NGUYÊN TẮC KHÁCH QUAN: Manh mối phải xuất hiện tự nhiên qua giác quan MC (nhìn thấy, nghe thấy, phát hiện), tuyệt đối cấm tự ý cấy suy nghĩ vô cớ thẳng vào đầu MC.
================
   </luat_nhip_do_hai_luot_+quy_tac_manh_moi_timeline>
</quy_tac_manh_moi_timeline>
`;
  }

  return `
<quy_tac_manh_moi_timeline>
   <luat_tiet_che_mach_truyen_+quy_tac_manh_moi_timeline>
================
LƯỢT HIỆN TẠI (Lượt ${currentTurn}): Tập trung giải quyết hành động chi tiết của người chơi và tương tác vi mô tại chỗ, tiết chế không tung thêm manh mối lớn để mạch truyện phát triển tự nhiên.
================
   </luat_tiet_che_mach_truyen_+quy_tac_manh_moi_timeline>
</quy_tac_manh_moi_timeline>
`;
};
