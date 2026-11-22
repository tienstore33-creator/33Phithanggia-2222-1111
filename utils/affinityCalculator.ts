/**
 * File mới: /utils/affinityCalculator.ts
 * Chức năng: Tính toán kháng tính của việc tăng độ thiện cảm đối với NPC/Bạn đồng hành
 */

/**
 * Tính toán lượng điểm thiện cảm thực tế nhận được sau khi qua màng lọc kháng tính.
 * Kháng tính chỉ áp dụng cho việc tăng thiện cảm (delta > 0).
 * 
 * @param currentAffinity Độ thiện cảm hiện tại (-100 đến 100)
 * @param rawDelta Lượng điểm thiện cảm dự kiến thay đổi (đã được clamp giới hạn thô)
 * @returns Điểm thiện cảm thực tế được cộng/trừ (số nguyên)
 */
export const calculateDiminishingAffinity = (currentAffinity: number, rawDelta: number): number => {
  // Nếu là giảm thiện cảm, giữ nguyên 100% hình phạt
  if (rawDelta <= 0) return rawDelta;

  let multiplier = 1.0;

  // Áp dụng bảng kháng tính cơ học theo yêu cầu của người chơi
  if (currentAffinity >= 0 && currentAffinity <= 20) {
    multiplier = 1.0;   // Nhận 100% điểm
  } else if (currentAffinity >= 21 && currentAffinity <= 40) {
    multiplier = 0.70;  // Nhận 70% điểm
  } else if (currentAffinity >= 41 && currentAffinity <= 60) {
    multiplier = 0.45;  // Nhận 45% điểm
  } else if (currentAffinity >= 61 && currentAffinity <= 80) {
    multiplier = 0.20;  // Nhận 20% điểm
  } else if (currentAffinity >= 81) {
    multiplier = 0.05;  // Nhận 5% điểm
  } else {
    // Trường hợp độ thiện cảm âm (kẻ thù, thù hận dưới 0)
    multiplier = 1.0;   // Cho phép lấy lại thiện cảm dễ dàng hơn ở dải âm
  }

  // Tính toán điểm thực tế sau khi áp dụng hệ số
  const calculatedDelta = rawDelta * multiplier;

  // Làm tròn toán học thông thường
  let finalDelta = Math.round(calculatedDelta);

  // Cơ chế bảo hiểm tối thiểu: Nếu hành động gốc có điểm tăng lớn (>= 5) nhưng do kháng tính cực cao 
  // bị giảm về 0, hệ thống vẫn ưu ái tăng tối thiểu 1 điểm để người chơi không cảm thấy bị bế tắc hoàn toàn.
  if (rawDelta >= 5 && finalDelta === 0) {
    finalDelta = 1;
  }

  return finalDelta;
};

/**
 * Trả về thông tin chuỗi trạng thái kháng tính tương ứng với mức thiện cảm hiện tại
 * Phục vụ cho việc hiển thị trực quan trên giao diện người dùng (UI)
 */
export const getAffinityResistanceInfo = (affinity: number) => {
  if (affinity < 0) return { label: "Hận thù / Đang sửa chữa sai lầm", multiplier: 1.0, color: "text-red-400", level: "Cởi mở" };
  if (affinity <= 20) return { label: "Mới quen (Nhận đầy đủ thiện cảm)", multiplier: 1.0, color: "text-emerald-400", level: "Cởi mở" };
  if (affinity <= 40) return { label: "Thân thiện (Bắt đầu có chút đề phòng nhẹ)", multiplier: 0.70, color: "text-green-400", level: "Bình thường" };
  if (affinity <= 60) return { label: "Thân cận (Yêu cầu hành động chân thành hơn)", multiplier: 0.45, color: "text-yellow-400", level: "Kháng nhẹ" };
  if (affinity <= 80) return { label: "Gắn bó (Khó lòng lay chuyển bằng vật phàm)", multiplier: 0.20, color: "text-orange-400", level: "Kháng cao" };
  return { label: "Cực hạn hữu nghị (Chỉ chấp nhận kỳ ngộ hoặc thần vật)", multiplier: 0.05, color: "text-purple-400", level: "Kháng cực hạn" };
};
