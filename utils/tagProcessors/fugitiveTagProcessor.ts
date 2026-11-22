import { KnowledgeBase, GameMessage } from '../../types';

export const processBecomeFugitive = (
    currentKb: KnowledgeBase,
    tagParams: Record<string, string>,
    turnForSystemMessages: number
): { updatedKb: KnowledgeBase; systemMessages: GameMessage[] } => {
    const newKb = currentKb;
    const systemMessages: GameMessage[] = [];

    const reason = tagParams.reason || "Nguyên nhân không rõ";
    const factionName = tagParams.factionName;

    if (newKb.huntedState?.isActive) {
        console.warn("BECOME_FUGITIVE: Player is already being hunted. Overwriting reason.");
    }

    newKb.huntedState = {
        isActive: true,
        reason: reason,
        lastAttackTurn: turnForSystemMessages
    };
    
    // Make them an enemy of all factions
    newKb.discoveredFactions.forEach(faction => {
        faction.playerReputation = -200;
    });

    const messageContent = factionName
        ? `Hành vi của bạn đã bị coi là phản bội! Bạn đã trở thành kẻ thù của ${factionName} và tin tức đã lan ra. Giờ đây, cả thế giới đang truy lùng bạn vì "${reason}".`
        : `Tin tức về hành động của bạn đã lan truyền khắp nơi. Bạn đã trở thành kẻ bị truy nã vì "${reason}". Hãy cẩn thận!`;

    systemMessages.push({
        id: `become-fugitive-${Date.now()}`,
        type: 'system',
        content: `*** BỊ TRUY NÃ ***\n${messageContent}`,
        timestamp: Date.now(),
        turnNumber: turnForSystemMessages
    });

    return { updatedKb: newKb, systemMessages };
};
