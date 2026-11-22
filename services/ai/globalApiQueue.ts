export type ApiTask<T = any> = () => Promise<T>;

interface QueueItem {
  id: string;
  task: ApiTask;
  priority: number; // 0 = Cao nhất (Main loop, user actions), 1 = Trung bình (Economy, setup), 2 = Thấp (Flash agent, RAG)
  resolve: (value: any) => void;
  reject: (reason: any) => void;
  timestamp: number;
}

/**
 * Hệ thống Hàng đợi API Toàn cục (Global API Queue) và Khóa độc quyền (Mutex Lock).
 * Giúp điều hướng và kiểm soát mọi luồng request gửi lên AI, ngăn chặn triệt để lỗi 429 do Spike Traffic.
 */
export class GlobalApiQueue {
  private static instance: GlobalApiQueue;
  private queue: QueueItem[] = [];
  private isProcessing = false;
  private lastExecutedTime = 0;
  private minInterval = 1000; // Khoảng cách tối thiểu giữa 2 request (ms) để đảm bảo an toàn

  private constructor() {}

  public static getInstance(): GlobalApiQueue {
    if (!GlobalApiQueue.instance) {
      GlobalApiQueue.instance = new GlobalApiQueue();
    }
    return GlobalApiQueue.instance;
  }

  /**
   * Đưa một tác vụ gọi API vào hàng đợi với mức độ ưu tiên xác định.
   * @param task Hàm thực thi API bất đồng bộ
   * @param priority Độ ưu tiên (0 = Cao nhất, 1 = Bình thường, 2 = Chạy ngầm)
   */
  public enqueue<T>(task: ApiTask<T>, priority: number = 1): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      const id = Math.random().toString(36).substring(2, 9);
      const item: QueueItem = {
        id,
        task,
        priority,
        resolve,
        reject,
        timestamp: Date.now()
      };

      this.queue.push(item);
      
      // Sắp xếp hàng đợi theo:
      // 1. Độ ưu tiên (nhỏ hơn = ưu tiên cao hơn, ví dụ 0 trước 1, 1 trước 2)
      // 2. Thời gian đưa vào hàng đợi (timestamp cũ hơn chạy trước)
      this.queue.sort((a, b) => {
        if (a.priority !== b.priority) {
          return a.priority - b.priority;
        }
        return a.timestamp - b.timestamp;
      });

      this.processQueue();
    });
  }

  /**
   * Xử lý hàng đợi
   */
  private async processQueue() {
    if (this.isProcessing || this.queue.length === 0) {
      return;
    }

    this.isProcessing = true;

    while (this.queue.length > 0) {
      const currentItem = this.queue.shift();
      if (!currentItem) continue;

      // Tính toán khoảng thời gian cần chờ để đảm bảo khoảng cách an toàn (minInterval)
      const now = Date.now();
      const timeSinceLastCall = now - this.lastExecutedTime;
      if (timeSinceLastCall < this.minInterval) {
        const delay = this.minInterval - timeSinceLastCall;
        await new Promise(resolve => setTimeout(resolve, delay));
      }

      try {
        const result = await currentItem.task();
        currentItem.resolve(result);
      } catch (error) {
        currentItem.reject(error);
      } finally {
        this.lastExecutedTime = Date.now();
      }
    }

    this.isProcessing = false;
  }

  /**
   * Trả về số lượng tác vụ đang chờ trong hàng đợi.
   */
  public getQueueLength(): number {
    return this.queue.length;
  }
}

export const globalApiQueue = GlobalApiQueue.getInstance();
