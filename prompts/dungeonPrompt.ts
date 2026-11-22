
import { KnowledgeBase, PlayerActionInputType, ResponseLength } from '../types';
import { VIETNAMESE } from '../constants';

export const generateDungeonPrompt = (
  knowledgeBase: KnowledgeBase,
  playerActionText: string,
  inputType: PlayerActionInputType,
  responseLength: ResponseLength,
  currentPageMessagesLog: string,
  previousPageSummaries: string[],
  lastNarrationFromPreviousPage?: string,
  retrievedContext?: string
): string => {
    const { dungeonCrawlState, worldConfig, playerStats } = knowledgeBase;
    
    if (!dungeonCrawlState || !dungeonCrawlState.isActive) {
        // Fallback to a simple continue prompt if somehow called incorrectly
        return `Bạn đang ở ${dungeonCrawlState?.dungeonName || 'một nơi không xác định'}. Bạn làm gì tiếp theo?`;
    }

    let stageInstructions = '';
    const { stage, dungeonName, objective } = dungeonCrawlState;
    const player = worldConfig?.playerName || 'Người Chơi';

    switch (stage) {
        case 'setup':
            stageInstructions = `
**GIAI ĐOẠN 1: TẬP HỢP**
Bối cảnh: Một bí cảnh/động phủ tên là "${dungeonName}" vừa xuất hiện.
Nhiệm vụ của bạn:
1.  **Mô tả phản ứng:** Viết một đoạn văn mô tả các phe phái lớn trong thế giới phản ứng với tin tức này. Họ có thể cử người đi thám thính, chuẩn bị lực lượng, v.v.
2.  **Tạo đội thám hiểm cho người chơi:**
    *   **Tạo Lãnh Đội:** Dùng tag [NPC:...] để tạo một NPC lãnh đội. Cảnh giới của họ PHẢI cao hơn người chơi MỘT đại cảnh giới. Nếu người này mạnh hơn cả tông chủ/phe chủ hiện tại, hãy thêm vào mô tả rằng họ là "Trưởng lão ẩn thế" hoặc "người của thế lực cấp trên".
    *   **Tạo Đồng Đội:** Dùng tag [NPC:...] để tạo 2-3 NPC đồng đội. Cảnh giới của họ PHẢI cùng đại cảnh giới với người chơi (có thể cao hoặc thấp hơn vài tiểu cảnh giới).
    *   **Vai Trò Người Chơi:** Mô tả lý do người chơi được tham gia (bị ép, được mời, được thuê).
3.  **Kết Thúc:** Đưa ra lựa chọn cho người chơi: đồng ý tham gia hay từ chối.
    *   Nếu người chơi đồng ý, bạn PHẢI dùng tag [PROGRESS_DUNGEON_STAGE].
    *   Nếu người chơi từ chối, bạn PHẢI dùng tag [END_DUNGEON_CRAWL].
`;
            break;
        case 'entry':
            stageInstructions = `
**GIAI ĐOẠN 2: TIẾN VÀO & CHIA CẮT**
Bối cảnh: Người chơi đã đồng ý tham gia đội thám hiểm đến "${dungeonName}".
Nhiệm vụ của bạn:
1.  **Mô tả di chuyển & họp mặt:** Kể ngắn gọn cảnh đội di chuyển đến lối vào bí cảnh. Mô tả các đội thám hiểm của phe phái khác cũng đã có mặt.
2.  **Lãnh đội phổ biến:** Mô tả các lãnh đội (của tất cả các phe) phổ biến quy tắc và mục tiêu, sau đó tuyên bố họ sẽ không vào trong vì một lý do hợp lý (ví dụ: bí cảnh có cấm chế, các phe đã ước định).
3.  **Chia cắt & Gặp nguy:** Mô tả cảnh các đội bước vào và ngay lập tức bị một sức mạnh bí ẩn nào đó chia cắt, mỗi người bị dịch chuyển đến một nơi khác nhau. Người chơi tỉnh dậy một mình và ngay lập tức phải đối mặt với một thử thách đầu tiên.
4.  **Kích hoạt chiến đấu:** Sử dụng tag [BEGIN_COMBAT: opponentIds="Tên quái vật/NPC thù địch"] để bắt đầu trận chiến đầu tiên này.
5.  **Mô tả song song:** Sau khi trận chiến kết thúc (hệ thống sẽ xử lý), hãy mô tả ngắn gọn cảnh 4 NPC khác (từ các đội khác nhau) cũng đã vượt qua thử thách đầu tiên của họ. Ví dụ: "Ở một nơi khác, A đang nghỉ bên xác quái thú. B thì đang thu thập chiến lợi phẩm..."
6.  **Kết Thúc:** Đưa ra các lựa chọn hành động cho người chơi sau trận chiến. Sau đó, dùng tag [PROGRESS_DUNGEON_STAGE].
`;
            break;
        case 'puzzle':
            stageInstructions = `
**GIAI ĐOẠN 3: CÂU ĐỐ & PHỤC KÍCH**
Bối cảnh: Người chơi đã vượt qua thử thách đầu tiên và tiến vào sâu hơn trong "${dungeonName}".
Nhiệm vụ của bạn:
1.  **Tạo câu đố:** Mô tả một căn phòng hoặc khu vực có một câu đố/cơ quan cần giải quyết để mở đường đi tiếp. Câu đố không cần quá phức tạp.
2.  **Phục kích:** Ngay khi người chơi giải xong câu đố hoặc tương tác với cơ quan, một nhóm NPC thù địch (từ phe phái đối địch) sẽ xuất hiện và phục kích.
3.  **Kích hoạt chiến đấu:** Sử dụng tag [BEGIN_COMBAT: opponentIds="..."] để bắt đầu trận phục kích.
4.  **Kết Thúc:** Sau khi trận chiến kết thúc, hãy mô tả lối đi mới được mở ra và đưa ra các lựa chọn. Sau đó, dùng tag [PROGRESS_DUNGEON_STAGE].
`;
            break;
        case 'reunion':
             stageInstructions = `
**GIAI ĐOẠN 4: HỘI NGỘ**
Bối cảnh: Người chơi đã vượt qua cuộc phục kích và tiến vào một khu vực trung tâm rộng lớn.
Nhiệm vụ của bạn:
1.  **Mô tả cảnh hội ngộ:** Kể lại cảnh người chơi gặp lại các đồng đội của mình và cả thành viên của các đội khác. Bầu không khí căng thẳng, nghi kỵ lẫn nhau.
2.  **Tạo lựa chọn:** Đưa ra các lựa chọn cho người chơi:
    *   Đề nghị liên minh với đội của mình.
    *   Đề nghị liên minh với một đội khác.
    *   Hành động một mình.
    *   Tấn công một đội khác ngay lập tức.
3.  **Kết quả:** Dựa trên lựa chọn của người chơi, mô tả kết quả. Cuộc chiến hoặc sự liên minh này sẽ vô tình kích hoạt một cơ quan, mở ra con đường cuối cùng. Dùng tag [PROGRESS_DUNGEON_STAGE].
`;
            break;
        case 'boss':
             stageInstructions = `
**GIAI ĐOẠN 5: TRÙM CUỐI**
Bối cảnh: Người chơi đã đến được tầng cuối cùng của "${dungeonName}".
Nhiệm vụ của bạn:
1.  **Dựng bối cảnh:** Mô tả một cảnh tượng hoành tráng. Có thể là một con quái vật bị phong ấn, một cỗ quan tài cổ, một tàn hồn đang lơ lửng, hoặc một con thú đang canh giữ bảo vật. Mô tả rõ bảo vật cuối cùng là gì.
2.  **Kích hoạt trận chiến:** Vì một lý do nào đó (phong ấn vỡ, có kẻ cướp bảo vật, ...), trùm cuối thức tỉnh và tấn công tất cả mọi người.
3.  **Kích hoạt chiến đấu:** Sử dụng tag [BEGIN_COMBAT: opponentIds="Tên Trùm Cuối", isDungeonBossFight=true]. Tham số \`isDungeonBossFight=true\` là BẮT BUỘC.
4.  **QUAN TRỌNG:** KHÔNG tạo lựa chọn hay tag nào khác sau tag [BEGIN_COMBAT]. Hệ thống sẽ tự xử lý hậu quả của trận chiến sinh tử này.
`;
            break;
        case 'report':
            stageInstructions = `
**GIAI ĐOẠN 6: BÁO CÁO & LỰA CHỌN**
Bối cảnh: Người chơi đã đánh bại trùm cuối và thoát ra khỏi "${dungeonName}", gặp lại lãnh đội đang chờ bên ngoài.
Nhiệm vụ của bạn:
1.  **Mô tả cảnh gặp lại:** Kể lại cảnh lãnh đội và các phe phái khác nhìn thấy người chơi (và những người sống sót khác) trở ra.
2.  **Yêu cầu giao nộp:** Lãnh đội sẽ hỏi về tình hình và yêu cầu người chơi giao nộp bảo vật quý giá nhất đã tìm thấy (mục tiêu chính của cuộc thám hiểm).
3.  **Tạo Lựa Chọn Sinh Tử:** Cung cấp cho người chơi các lựa chọn:
    *   Một lựa chọn để **Giao nộp bảo vật** một cách trung thực.
    *   Một lựa chọn để **Nói dối/Giấu bảo vật** (ví dụ: "Bẩm báo, bảo vật đã bị phá hủy trong trận chiến" hoặc "Con không tìm thấy gì cả").
4.  **Tạo Tag Hậu Quả (BẮT BUỘC):**
    *   Nếu người chơi chọn **Giao nộp**, bạn PHẢI kết thúc kịch bản bằng tag [END_DUNGEON_CRAWL]. Bạn cũng có thể thêm các tag phần thưởng như [ITEM_ACQUIRED], [GENERATE_EQUIPMENT] (nếu là trang bị cơ học), [STATS_UPDATE], v.v.
    *   Nếu người chơi chọn **Nói dối**, bạn PHẢI kích hoạt kịch bản Đào Vong bằng tag [BECOME_FUGITIVE: reason="Phản bội tông môn, độc chiếm bảo vật từ ${dungeonName}"]. Sau đó cũng kết thúc kịch bản bằng tag [END_DUNGEON_CRAWL].
`;
            break;
    }

    return `
**BẠN ĐANG TRONG KỊCH BẢN THÁM HIỂM HẦM NGỤC: "${dungeonName}"**
Giai đoạn hiện tại: ${stage}.
Mục tiêu hiện tại: ${objective}.
Lượt bắt đầu: ${dungeonCrawlState.startTurn}. Lượt hiện tại: ${playerStats.turn}.
**CẢNH BÁO: Nếu lượt chơi vượt quá ${dungeonCrawlState.startTurn + 100}, hầm ngục sẽ sụp đổ và nhân vật chính sẽ chết!**

**BỐI CẢNH NGƯỜI CHƠI & HÀNH ĐỘNG:**
- **Người chơi:** ${player}
- **Hành động:** "${playerActionText}"

---
${stageInstructions}
---

Hãy viết lời kể và tạo các tag theo đúng hướng dẫn cho giai đoạn hiện tại.
`;
};
