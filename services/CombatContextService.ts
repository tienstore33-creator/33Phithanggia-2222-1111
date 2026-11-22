import { useLogStore } from '../src/store/logStore';

export const getStoryContext = (limit: number = 5): string => {
    const history = useLogStore.getState().history;
    
    // Lọc lấy các tin nhắn là lời dẫn (narration) hoặc hành động người chơi (player_action)
    // để làm bối cảnh bám sát truyện nhất
    const narrativeMessages = history
        .filter(msg => msg.type === 'narration' || msg.type === 'player_action')
        .slice(-limit);
    
    if (narrativeMessages.length === 0) return "Không có dữ liệu bối cảnh truyện.";
    
    return narrativeMessages
        .map(msg => `[${msg.type === 'narration' ? 'Dẫn truyện' : 'Hành động'}]: ${msg.content}`)
        .join('\n\n');
};
