import { WorldDate } from '../types';

/**
 * Lấy giờ mặc định dựa trên canh hoặc timeOfDay nếu chưa có hour
 */
export function getDefaultHour(currentDate: WorldDate): { hour: number; minute: number } {
  if (currentDate.hour !== undefined) {
    return { hour: currentDate.hour, minute: currentDate.minute ?? 0 };
  }
  
  if (currentDate.canh !== undefined) {
    // Canh 1: 7:00, Canh 2: 9:00, ..., Canh 12: 5:00
    const hour = ((currentDate.canh - 1) * 2 + 7) % 24;
    return { hour, minute: 0 };
  }

  switch (currentDate.timeOfDay) {
    case 'Sáng':
      return { hour: 7, minute: 0 };
    case 'Chiều':
      return { hour: 14, minute: 0 };
    case 'Đêm':
      return { hour: 21, minute: 0 };
    default:
      return { hour: 8, minute: 0 };
  }
}

/**
 * Xác định timeOfDay dựa trên giờ (0-23)
 */
export function getTimeOfDayFromHour(hour: number): 'Sáng' | 'Chiều' | 'Đêm' {
  if (hour >= 6 && hour < 12) {
    return 'Sáng';
  } else if (hour >= 12 && hour < 18) {
    return 'Chiều';
  } else {
    return 'Đêm';
  }
}

/**
 * Format chuỗi giờ:phút dạng HH:MM
 */
export function formatTimeString(worldDate: WorldDate): string {
  const { hour, minute } = getDefaultHour(worldDate);
  const hStr = String(hour).padStart(2, '0');
  const mStr = String(minute).padStart(2, '0');
  return `${hStr}:${mStr}`;
}

/**
 * Tịnh tiến thời gian theo số canh giờ (canh), giờ (addedHours), hoặc phút (addedMinutes) tăng thêm.
 */
export function advanceTime(
  currentDate: WorldDate, 
  addedCanh: number = 0,
  addedHours: number = 0,
  addedMinutes: number = 0
): WorldDate {
  const initial = getDefaultHour(currentDate);
  
  // Quy chuẩn chính xác: 1 canh = 2 giờ = 120 phút
  let totalMinutes = initial.minute + addedMinutes + (addedCanh * 120);
  let totalHours = initial.hour + addedHours + Math.floor(totalMinutes / 60);
  
  const newMinute = ((totalMinutes % 60) + 60) % 60;
  const daysToAdd = Math.floor(totalHours / 24);
  const newHour = ((totalHours % 24) + 24) % 24;

  const currentCanh = currentDate.canh ?? 1;
  const totalCanh = currentCanh + addedCanh;
  const newCanh = (((totalCanh - 1) % 12) + 12) % 12 + 1;

  let newDay = currentDate.day + daysToAdd;
  let newMonth = currentDate.month;
  let newYear = currentDate.year;

  // Quy ước mỗi tháng có 30 ngày
  while (newDay > 30) {
    newDay -= 30;
    newMonth += 1;
  }
  // Quy ước mỗi năm có 12 tháng
  while (newMonth > 12) {
    newMonth -= 1;
    newYear += 1;
  }

  const timeOfDay = getTimeOfDayFromHour(newHour);

  return {
    day: newDay,
    month: newMonth,
    year: newYear,
    timeOfDay,
    canh: newCanh,
    hour: newHour,
    minute: newMinute
  };
}

