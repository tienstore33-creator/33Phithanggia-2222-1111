import { getAllVectors, getPalace, getDb, VECTOR_STORE_NAME, PALACE_STORE_NAME } from './indexedDBService';

export class MigrationService {
  static async exportFullMemory() {
    const vectors = await getAllVectors();
    const palace = await getPalace();
    
    const data = {
      appName: "DaoDoAI",
      version: "2.1", 
      palace,
      vectors: vectors.map(({id, ...v}) => v)
    };
    return JSON.stringify(data);
  }

  static async importFullMemory(json: string) {
    const data = JSON.parse(json);
    if (!data.vectors || !Array.isArray(data.vectors)) throw new Error("File không hợp lệ.");

    const db = await getDb();
    // Sử dụng duy nhất 1 Transaction cho cả quá trình Xóa và Nạp
    const tx = db.transaction([VECTOR_STORE_NAME, PALACE_STORE_NAME], 'readwrite');
    
    const vectorStore = tx.objectStore(VECTOR_STORE_NAME);
    const palaceStore = tx.objectStore(PALACE_STORE_NAME);

    // Bước 1: Xóa sạch dữ liệu cũ trong cùng transaction
    vectorStore.clear();
    palaceStore.clear();

    // Bước 2: Nạp Palace
    if (data.palace) {
      palaceStore.put({ id: 'current_palace', ...data.palace });
    }

    // Bước 3: Nạp Vectors hàng loạt
    data.vectors.forEach(v => vectorStore.add(v));

    return new Promise((resolve, reject) => {
      tx.oncomplete = () => resolve(true);
      tx.onerror = () => {
        console.error("Transaction error during import:", tx.error);
        reject(tx.error);
      };
      tx.onabort = () => reject(new Error("Quá trình nhập liệu bị hủy bỏ."));
    });
  }
}
