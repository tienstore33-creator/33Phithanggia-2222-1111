import worksData from '../../287_fanfic_works.txt?raw';
import { FanficWork, FanficCharacter } from '../types/fanfic';

export class FanficSourceService {
  private static works: FanficWork[] = [];
  private static isInitialized = false;

  static init() {
    if (this.isInitialized) return;
    try {
      // Loại bỏ các ký tự thừa nếu có và parse JSON
      const cleanData = worksData.trim();
      this.works = JSON.parse(cleanData);
      this.isInitialized = true;
      console.log(`[FanficSource] Đã tải ${this.works.length} tác phẩm từ nguồn.`);
    } catch (e) {
      console.error("[FanficSource] Lỗi parse dữ liệu nguồn:", e);
    }
  }

  private static normalize(str: string | undefined | null): string {
    if (!str) return '';
    return str.normalize('NFC').trim().toLowerCase();
  }

  static findWorkByTitle(title: string): FanficWork | undefined {
    this.init();
    const searchTitle = this.normalize(title);
    return this.works.find(w => {
      const workTitle = this.normalize(w.title);
      return searchTitle.includes(workTitle) || workTitle.includes(searchTitle);
    });
  }

  static findCharacterInWork(work: FanficWork, charName: string): FanficCharacter | undefined {
    const searchName = this.normalize(charName);
    return work.characters.find(c => {
      const charNameInFile = this.normalize(c.name);
      return searchName.includes(charNameInFile) || charNameInFile.includes(searchName);
    });
  }

  static getAllWorks(): FanficWork[] {
    this.init();
    return this.works;
  }
}
