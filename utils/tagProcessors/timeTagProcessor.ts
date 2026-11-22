import { KnowledgeBase, GameMessage } from '../../types';

import { grantPassiveExp } from '../npcProgressionService';
import { applyLifespanDeduction } from '../statsCalculationUtils';
import { advanceTime } from '../timeUtils';

export const processChangeTime = (
    currentKb: KnowledgeBase,
    tagParams: Record<string, string>,
    turnForSystemMessages: number
): { updatedKb: KnowledgeBase; systemMessages: GameMessage[] } => {
    const newKb = currentKb;
    const systemMessages: GameMessage[] = [];

    const parseTimeVal = (val: string | undefined): number => {
        if (!val) return 0;
        const num = parseFloat(val.replace(/[^\d.+-]/g, ''));
        return isNaN(num) ? 0 : Math.max(0, num);
    };

    let safeYears = parseTimeVal(tagParams.nam);
    let safeMonths = parseTimeVal(tagParams.thang);
    let safeDays = parseTimeVal(tagParams.ngay);
    let safeCanh = parseTimeVal(tagParams.canh);
    let safeMinutes = parseTimeVal(tagParams.phut);

    // Chuẩn hóa thác đổ cho năm, tháng, ngày
    safeMonths += (safeYears % 1) * 12;
    safeYears = Math.floor(safeYears);

    safeDays += (safeMonths % 1) * 30;
    safeMonths = Math.floor(safeMonths);

    // Không tự quy đổi canh ra phút ở đây để tránh nhân đôi hệ số!
    safeCanh = Math.floor(safeCanh); 
    safeMinutes = Math.round(safeMinutes);

    if (safeDays <= 0 && safeMonths <= 0 && safeYears <= 0 && safeCanh <= 0 && safeMinutes <= 0) {
        console.warn("CHANGE_TIME: Invalid or no time change specified.", tagParams);
        return { updatedKb: newKb, systemMessages };
    }

    let { day, month, year, hour, minute, canh } = newKb.worldDate;
    const oldYear = year;

    // Gọi trực tiếp advanceTime với tham số canh nguyên bản
    if (safeCanh > 0 || safeMinutes > 0 || safeDays > 0) {
        const advanced = advanceTime(newKb.worldDate, safeCanh, 0, safeMinutes);
        day = advanced.day;
        month = advanced.month;
        year = advanced.year;
        hour = advanced.hour;
        minute = advanced.minute;
        canh = advanced.canh;
    }

    // Add years and months first
    year += safeYears;
    month += safeMonths;

    // Add days
    day += safeDays;

    // Normalize months and years from day overflow
    if (day > 30) {
        const extraMonths = Math.floor((day - 1) / 30);
        month += extraMonths;
        day = ((day - 1) % 30) + 1;
    }

    // Normalize years from month overflow
    if (month > 12) {
        const extraYears = Math.floor((month - 1) / 12);
        year += extraYears;
        month = ((month - 1) % 12) + 1;
    }

    // Tính toán chính xác tổng thời gian trôi qua quy đổi ra năm (hỗ trợ đầy đủ năm, tháng, ngày, canh giờ, phút)
    const yearsPassed = safeYears + (safeMonths / 12) + (safeDays / 360) + (safeCanh / 4320) + (safeMinutes / 518400);
    if (yearsPassed > 0) {
        const lifespanRes = applyLifespanDeduction(newKb, yearsPassed, turnForSystemMessages);
        systemMessages.push(...lifespanRes.systemMessages);
    }
    
    // Format the passed duration for the system message
    let displayYears = safeYears;
    let displayMonths = safeMonths;
    let displayDays = safeDays;

    if (displayDays >= 30) {
        displayMonths += Math.floor(displayDays / 30);
        displayDays %= 30;
    }

    if (displayMonths >= 12) {
        displayYears += Math.floor(displayMonths / 12);
        displayMonths %= 12;
    }
    
    const timePassedParts: string[] = [];
    if (displayYears > 0) timePassedParts.push(`${displayYears} năm`);
    if (displayMonths > 0) timePassedParts.push(`${displayMonths} tháng`);
    if (displayDays > 0) timePassedParts.push(`${displayDays} ngày`);
    if (safeCanh > 0) timePassedParts.push(`${safeCanh} canh giờ`);
    if (safeMinutes > 0) timePassedParts.push(`${safeMinutes} phút`);
    
    const timePassedMessage = timePassedParts.length > 0 ? timePassedParts.join(', ') : 'không đáng kể';

    systemMessages.push({
        id: `time-changed-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
        type: 'system',
        content: `⌛ 【HỒI ĐẦU】Thời gian trôi qua: ${timePassedMessage}.`,
        timestamp: Date.now(),
        turnNumber: turnForSystemMessages
    });

    const timeOfDay = hour !== undefined ? (hour >= 6 && hour < 12 ? 'Sáng' : hour >= 12 && hour < 18 ? 'Chiều' : 'Đêm') : (safeDays > 0 || safeMonths > 0 || safeYears > 0) ? 'Sáng' : newKb.worldDate.timeOfDay;
    newKb.worldDate = { day, month, year, timeOfDay, hour, minute, canh };

    const totalDaysPassed = (safeYears * 12 * 30) + (safeMonths * 30) + safeDays;
    if (totalDaysPassed > 0) {
        const progResult = grantPassiveExp(newKb, 0, totalDaysPassed);
        Object.assign(newKb, progResult.updatedKb);
        systemMessages.push(...progResult.systemMessages);

        // Expire status effects based on time passed
        if (newKb.playerStats.activeStatusEffects) {
            const expiredEffects: string[] = [];
            newKb.playerStats.activeStatusEffects = newKb.playerStats.activeStatusEffects
                .map(eff => {
                    if (eff.durationTurns !== undefined && eff.durationTurns > 0) {
                        eff.durationTurns = Math.max(0, eff.durationTurns - totalDaysPassed);
                        if (eff.durationTurns === 0) {
                            expiredEffects.push(eff.name);
                        }
                    }
                    return eff;
                })
                .filter(eff => eff.durationTurns === undefined || eff.durationTurns > 0);

            expiredEffects.forEach(name => {
                systemMessages.push({
                    id: `status-effect-expired-${name}-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
                    type: 'system',
                    content: `Hiệu ứng "${name}" đã hết hạn và biến mất.`,
                    timestamp: Date.now(),
                    turnNumber: turnForSystemMessages
                });
            });
        }
    }

    return { updatedKb: newKb, systemMessages };
};
