import { LustModeFlavor, NpcMindset } from '../../types';
import { applyErythriteBraking } from '../erythrite/brakingLogic';
import { ERYTHRITE_MASTER_PROMPT } from '../erythrite/corePrompts';
import { getNpcMindsetInstructions } from './npcMindsetRules';
import { NSFW_CORE_RULES, NSFW_ACTION_OVERRIDE_MODULE } from '../../../constants/nsfw';

// Mảng Regex dùng để nhận diện ý định hoặc bối cảnh nhạy cảm từ hành động của người chơi
const NSFW_TRIGGER_KEYWORDS = [
    /quan hệ/i, /làm tình/i, /chịch/i, /nện/i, /xoạc/i, /phịch/i,
    /cởi/i, /khỏa thân/i, /nude/i, /sờ/i, /bú/i, /liếm/i, /mút/i,
    /âm hộ/i, /dương vật/i, /ngực/i, /mông/i, /vú/i, /cậu nhỏ/i, /cô bé/i,
    /tinh dịch/i, /xuất tinh/i, /lên đỉnh/i, /khoái cảm/i, /dục vọng/i,
    /cưỡng ép/i, /hiếp/i, /bạo dâm/i, /khổ dâm/i, /bdsm/i, /địt/i, /đụ/i,
    /lồn/i, /cặc/i, /nắc/i, /giao hợp/i
];

/**
 * Kiểm tra xem hành động của người chơi có chứa các từ khóa kích hoạt NSFW hay không
 */
export function detectNsfwIntent(playerAction: string): boolean {
    if (!playerAction) return false;
    return NSFW_TRIGGER_KEYWORDS.some(regex => regex.test(playerAction));
}

export function getSituationalRules(
    choice: string,
    isConscienceModeOn: boolean,
    lustModeFlavor: LustModeFlavor | null,
    npcMindset: NpcMindset,
    npcStats: any,
    isCorrection: boolean
): string {
    const ruleModules: string[] = [];
    
    // Phát hiện hành động 18+ ngầm sử dụng hàm quét rộng regex mới
    const isExplicitlyNSFW = detectNsfwIntent(choice);

    if (isExplicitlyNSFW) {
        ruleModules.push(NSFW_ACTION_OVERRIDE_MODULE);
        ruleModules.push(NSFW_CORE_RULES);
    }

    if (isExplicitlyNSFW || lustModeFlavor) {
        // Áp dụng bộ hãm phanh Erythrite
        const brakingResult = applyErythriteBraking(choice, npcStats);
        const activeFlavor = brakingResult || lustModeFlavor || 'TEASING';

        ruleModules.push(ERYTHRITE_MASTER_PROMPT);
        
        if (activeFlavor === 'TEASING') {
            ruleModules.push(`**CHẾ ĐỘ HIỆN TẠI: TEASING (HÃM PHANH).** Chỉ mô tả sự khiêu khích, đụng chạm và khao khát. Không đi đến hành vi giao hợp cuối cùng.`);
        } else {
            ruleModules.push(`**CHẾ ĐỘ HIỆN TẠI: ${activeFlavor}.** Mô tả trần trụi và trực diện theo phong cách Erythrite.`);
        }
    }

    if (isCorrection) {
        ruleModules.push(`**MỆNH LỆNH CHỈNH LỐI:** Bạn đã lặp lại hoặc đình trệ. Hãy viết một đoạn truyện HOÀN TOÀN MỚI.`);
    }

    ruleModules.push(getNpcMindsetInstructions(npcMindset, npcStats?.Corruption || 0));

    return ruleModules.join('\n\n---\n\n');
}
