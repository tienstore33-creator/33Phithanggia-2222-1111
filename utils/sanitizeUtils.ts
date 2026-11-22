/**
 * Utility giúp kiểm tra và loại bỏ các dữ liệu rác, chỉ chứa dấu ba chấm (...) hoặc rỗng.
 */

export const isDotsOrEmpty = (str?: string | null): boolean => {
    if (!str) return true;
    const trimmed = str.trim();
    if (trimmed === '' || trimmed === '...' || trimmed === '…' || trimmed === 'null' || trimmed === 'undefined') return true;
    // Xóa tất cả các khoảng trắng, dấu chấm, dấu ba chấm, dấu gạch ngang, gạch dưới, hai chấm
    const cleaned = trimmed.replace(/[\s\.\…\-\_\:]/g, '');
    return cleaned.length === 0;
};

/**
 * Kiểm tra xem một Timeline Event có phải là sự kiện hợp lệ không.
 * Nếu eventName hoặc tất cả các trường cốt lõi đều chỉ chứa dấu ba chấm (...) hoặc rỗng, trả về false.
 */
export const isValidTimelineEvent = (evt: any): boolean => {
    if (!evt) return false;
    const eventName = evt.eventName || evt.name || '';
    const description = evt.description || evt.text || '';
    const periodName = evt.periodName || evt.era || '';
    const requiredAction = evt.requiredAction || evt.action || '';

    // Nếu tên sự kiện bị rỗng hoặc chỉ toàn ba chấm -> loại bỏ
    if (isDotsOrEmpty(eventName)) return false;

    // Nếu cả tên, mô tả, thời kỳ, và hành động cốt lõi đều bị rỗng/ba chấm -> loại bỏ
    if (isDotsOrEmpty(eventName) && isDotsOrEmpty(description) && isDotsOrEmpty(periodName) && isDotsOrEmpty(requiredAction)) {
        return false;
    }

    return true;
};

/**
 * Kiểm tra xem một Nhiệm vụ (Quest / Chapter / InitialQuest) có phải là hợp lệ không.
 * Nếu tiêu đề hoặc cả tiêu đề lẫn mô tả chỉ chứa dấu ba chấm (...) hoặc rỗng, trả về false.
 */
export const isValidQuest = (quest: any): boolean => {
    if (!quest) return false;
    const title = quest.title || quest.name || '';
    if (isDotsOrEmpty(title)) return false;
    return true;
};

/**
 * Lọc mảng Timeline Events chỉ giữ lại các sự kiện hợp lệ không bị ba chấm.
 */
export const sanitizeTimelineEvents = <T = any>(events: T[]): T[] => {
    if (!Array.isArray(events)) return [];
    return events.filter(isValidTimelineEvent);
};

/**
 * Lọc mảng Quests chỉ giữ lại các nhiệm vụ hợp lệ không bị ba chấm.
 */
export const sanitizeQuests = <T = any>(quests: T[]): T[] => {
    if (!Array.isArray(quests)) return [];
    return quests.filter(isValidQuest);
};
