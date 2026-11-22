import { KnowledgeBase, GameMessage } from '../types';

export interface CharRef {
  type: 'player' | 'npc';
  ref: any;
  listName?: string;
}

export class SexOverExertionService {
  /**
   * CƠ CHẾ LÀM TÌNH QUÁ ĐỘ (SEX OVER-EXERTION MECHANICS)
   * 1. Giảm 5% Sinh lực hiện tại (dựa trên Max HP đầy đủ) cho cả nam và nữ.
   * 2. Nhận Kinh nghiệm = 5% tổng chỉ số Max HP cơ bản của cả 2 nhân vật.
   * 3. Tử vong nếu HP < 1 (giữ nguyên).
   * 4. Ghi nhận tin nhắn hệ thống vào Game Messages ngay bên dưới dòng [Thiên đạo] ... đã làm tình với ...
   */
  public static processSexOverExertion(
    workingKb: KnowledgeBase,
    allSystemMessages: GameMessage[],
    turnForSystemMessages: number
  ): void {
    const processedPairs = new Set<string>();

    const findChar = (name: string): CharRef | null => {
      const cleanName = name.trim().toLowerCase();
      const pName = (workingKb.playerStats?.name || 'Người chơi').trim().toLowerCase();
      if (cleanName === pName || cleanName === 'mc' || cleanName === 'player' || cleanName === 'người chơi') {
        return { type: 'player', ref: workingKb.playerStats };
      }

      const lists = ['discoveredNPCs', 'wives', 'slaves', 'prisoners', 'companions'];
      for (const listName of lists) {
        const list = (workingKb as any)[listName];
        if (list && Array.isArray(list)) {
          const found = list.find((n: any) => n.name && n.name.trim().toLowerCase() === cleanName);
          if (found) {
            return { type: 'npc', ref: found, listName };
          }
        }
      }
      return null;
    };

    const getBaseMaxHp = (char: CharRef): number => {
      if (char.type === 'player') {
        return char.ref.baseMaxSinhLuc || char.ref.maxSinhLuc || 100;
      }
      return char.ref.baseStatOverrides?.baseMaxSinhLuc || char.ref.stats?.baseMaxSinhLuc || char.ref.stats?.maxSinhLuc || 100;
    };

    const getMaxHp = (char: CharRef): number => {
      if (char.type === 'player') {
        return char.ref.maxSinhLuc || char.ref.baseMaxSinhLuc || 100;
      }
      if (!char.ref.stats) char.ref.stats = {};
      return char.ref.stats.maxSinhLuc || char.ref.baseStatOverrides?.baseMaxSinhLuc || 100;
    };

    for (let i = 0; i < allSystemMessages.length; i++) {
      const msg = allSystemMessages[i];
      if (!msg || !msg.content || !msg.content.includes('đã làm tình với')) continue;

      const match = msg.content.match(/(?:\[(?:HỆ THỐNG|Thiên đạo)\]\s+)?(.+?)\s+đã làm tình với\s+(.+)$/i);
      if (!match) continue;

      const maleName = match[1].trim();
      const femaleName = match[2].trim();
      const pairKey = `${maleName.toLowerCase()}||${femaleName.toLowerCase()}||${turnForSystemMessages}`;

      if (processedPairs.has(pairKey)) continue;
      processedPairs.add(pairKey);

      console.log(`[CƠ CHẾ LÀM TÌNH]: Tìm thấy sự kiện giữa '${maleName}' và '${femaleName}'`);

      const maleChar = findChar(maleName);
      const femaleChar = findChar(femaleName);

      if (!maleChar && !femaleChar) continue;

      // Tính tổng chỉ số Max HP cơ bản của cả 2 nhân vật
      const baseHpMale = maleChar ? getBaseMaxHp(maleChar) : 0;
      const baseHpFemale = femaleChar ? getBaseMaxHp(femaleChar) : 0;
      const totalBaseMaxHp = baseHpMale + baseHpFemale;
      const sharedExp = Math.max(1, Math.floor(totalBaseMaxHp * 0.05));

      const generatedMessages: GameMessage[] = [];
      const participants = [maleChar, femaleChar].filter((c): c is CharRef => c !== null);

      participants.forEach((char) => {
        const maxHp = getMaxHp(char);
        const charName = char.type === 'player' ? (char.ref.name || 'Người chơi') : char.ref.name;

        // 1. Giảm 5% Sinh lực hiện tại dựa trên MaxHP đầy đủ
        const reduceAmount = Math.floor(maxHp * 0.05);

        if (char.type === 'player') {
          char.ref.sinhLuc = Math.max(0, (char.ref.sinhLuc || 0) - reduceAmount);
        } else {
          char.ref.stats.sinhLuc = Math.max(0, (char.ref.stats.sinhLuc || 0) - reduceAmount);
        }

        const currentHp = char.type === 'player' ? char.ref.sinhLuc : char.ref.stats.sinhLuc;

        // 2. Nếu Sinh lực hiện tại dưới 1 HP -> Tử vong
        if (currentHp < 1) {
          generatedMessages.push({
            id: `sex-death-${charName}-${Date.now()}-${Math.random()}`,
            type: 'system',
            content: `[HỆ THỐNG] ${charName} do làm tình quá độ mà chết.`,
            timestamp: Date.now(),
            turnNumber: turnForSystemMessages
          });

          if (char.type === 'player') {
            char.ref.isDead = true;
            char.ref.sinhLuc = 0;
          } else {
            char.ref.isDead = true;
            char.ref.status = '[ĐÃ CHẾT]';
            const list = (workingKb as any)[char.listName!];
            if (list && Array.isArray(list)) {
              const idx = list.indexOf(char.ref);
              if (idx > -1) {
                list.splice(idx, 1);
                console.log(`[CƠ CHẾ LÀM TÌNH]: Đã xóa NPC '${charName}' khỏi danh sách '${char.listName}' do tử vong.`);
              }
            }
          }
        } else {
          // 3. Nhận Kinh nghiệm = 5% tổng chỉ số Max HP cơ bản của cả 2 người
          if (char.type === 'player') {
            char.ref.kinhNghiem = (char.ref.kinhNghiem || 0) + sharedExp;
          } else {
            char.ref.stats.kinhNghiem = (char.ref.stats.kinhNghiem || 0) + sharedExp;
          }

          generatedMessages.push({
            id: `sex-stat-change-${charName}-${Date.now()}-${Math.random()}`,
            type: 'system',
            content: `[HỆ THỐNG] ${charName} bị giảm ${reduceAmount} Sinh lực (còn ${currentHp}/${maxHp}) và nhận thêm ${sharedExp} kinh nghiệm.`,
            timestamp: Date.now(),
            turnNumber: turnForSystemMessages
          });

          console.log(`[CƠ CHẾ LÀM TÌNH]: '${charName}' bị giảm ${reduceAmount} Sinh lực hiện tại (còn ${currentHp}/${maxHp}) và nhận thêm ${sharedExp} kinh nghiệm.`);
        }
      });

      // 4. Chèn các tin nhắn vào ngay bên dưới dòng [Thiên đạo] ... đã làm tình với ...
      if (generatedMessages.length > 0) {
        allSystemMessages.splice(i + 1, 0, ...generatedMessages);
        i += generatedMessages.length;
      }
    }
  }
}
