import { KnowledgeBase, GameMessage } from '../../types';

/**
 * Xử lý tag biến động tài chính [MONEY_CHANGE: amount="...", reason="..."]
 */
export const processMoneyChange = (
    currentKb: KnowledgeBase,
    tagParams: Record<string, string>,
    turnForSystemMessages: number
): { updatedKb: KnowledgeBase; systemMessages: GameMessage[] } => {
    const newKb = currentKb;
    const systemMessages: GameMessage[] = [];

    // Lấy giá trị amount từ tagParams (hỗ trợ các key amount, value, quantity, position_var_0)
    const amountStr = tagParams.amount || tagParams.value || tagParams.quantity || tagParams.position_var_0 || '0';
    let parsedAmount = 0;

    const cleanedStr = amountStr.trim();
    if (cleanedStr.startsWith('+=')) {
        parsedAmount = parseInt(cleanedStr.substring(2), 10);
    } else if (cleanedStr.startsWith('-=')) {
        parsedAmount = -parseInt(cleanedStr.substring(2), 10);
    } else if (cleanedStr.startsWith('+')) {
        parsedAmount = parseInt(cleanedStr.substring(1), 10);
    } else if (cleanedStr.startsWith('-')) {
        parsedAmount = parseInt(cleanedStr, 10);
    } else {
        parsedAmount = parseInt(cleanedStr, 10);
    }

    if (isNaN(parsedAmount)) {
        console.warn(`[MONEY_CHANGE] Invalid amount value: "${amountStr}"`);
        return { updatedKb: newKb, systemMessages };
    }

    // Lấy số dư tài chính hiện tại của MC
    const currentCurrency = typeof newKb.playerStats.currency === 'number'
        ? newKb.playerStats.currency
        : (parseInt(newKb.playerStats.currency as any, 10) || 0);

    // Tính toán số dư mới: Math.max(0, currentCurrency + parsedAmount)
    const newCurrency = Math.max(0, currentCurrency + parsedAmount);
    newKb.playerStats.currency = newCurrency;
    if (typeof newKb.playerStats.linhThach === 'number' || typeof newKb.playerStats.linhThach !== 'undefined') {
        newKb.playerStats.linhThach = newCurrency;
    }

    const reason = tagParams.reason || tagParams.lyDo || tagParams.mota || tagParams.description || '';
    const currencyName = newKb.worldConfig?.currencyName || 'Linh Thạch';

    const changeSign = parsedAmount >= 0 ? '+' : '';
    const actionText = parsedAmount >= 0 ? 'Nhận được' : 'Tiêu hao';

    const messageContent = reason
        ? `💰 [GIAO DỊCH THÀNH CÔNG]\n- ${actionText}: ${changeSign}${parsedAmount} ${currencyName} (${reason})\n- Số dư hiện tại: ${newCurrency} ${currencyName}`
        : `💰 [GIAO DỊCH THÀNH CÔNG]\n- ${actionText}: ${changeSign}${parsedAmount} ${currencyName}\n- Số dư hiện tại: ${newCurrency} ${currencyName}`;

    systemMessages.push({
        id: `money-change-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
        type: 'system',
        content: messageContent,
        timestamp: Date.now(),
        turnNumber: turnForSystemMessages
    });

    return { updatedKb: newKb, systemMessages };
};
