
type Task = () => Promise<any>;

class BackgroundTaskManager {
  private queue: Task[] = [];
  private isProcessing = false;
  private listeners: ((count: number) => void)[] = [];

  addTask(task: Task) {
    this.queue.push(task);
    this.notifyListeners();
    if (!this.isProcessing) {
      this.processQueue();
    }
  }

  private async processQueue() {
    if (this.queue.length === 0) {
      this.isProcessing = false;
      this.notifyListeners();
      return;
    }

    this.isProcessing = true;
    const task = this.queue.shift();
    
    if (task) {
      try {
        await task();
      } catch (error) {
        console.error("Background task failed:", error);
      }
      
      // Giãn cách 500ms giữa các tác vụ để ổn định hệ thống
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    this.processQueue();
  }

  subscribe(listener: (count: number) => void) {
    this.listeners.push(listener);
    listener(this.queue.length + (this.isProcessing ? 1 : 0));
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener);
    };
  }

  private notifyListeners() {
    const count = this.queue.length + (this.isProcessing ? 1 : 0);
    this.listeners.forEach(l => l(count));
  }

  getTaskCount() {
    return this.queue.length + (this.isProcessing ? 1 : 0);
  }
}

export const backgroundTaskManager = new BackgroundTaskManager();
