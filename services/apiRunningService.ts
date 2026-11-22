export type ApiTask = {
    id: string;
    modelName: string;
    apiKeyLabel?: string | null;
    purpose?: string | null;
    startTime: number;
    requestNumber: number;
    caller: string;
    rawRequest?: string;
};

export type ApiTaskHistory = {
    id: string;
    modelName: string;
    apiKeyLabel?: string | null;
    purpose?: string | null;
    durationSeconds: number;
    requestNumber: number;
    caller: string;
    rawRequest?: string;
    rawResponse?: string;
};

export type ApiRunningState = {
    isProcessing: boolean;
    activeTasks: ApiTask[];
    currentModel?: string | null;
    startTime?: number | null;
    apiKeyLabel?: string | null;
    purpose?: string | null;
    currentTurnHistory: ApiTaskHistory[]; // Lưu trữ danh sách cuộc gọi của lượt vừa diễn ra
};

type Listener = (state: ApiRunningState) => void;

// Hàm tiện ích phân tích Stack Trace để tự động phát hiện Caller
function getCallerName(): string {
    try {
        const err = new Error();
        const stack = err.stack;
        if (!stack) return "Unknown";
        
        const lines = stack.split("\n");
        // Danh sách các file/hàm tiện ích nội bộ cần bỏ qua để tìm đến Caller thực sự
        const ignoreList = [
            "apiRunningService",
            "modelFallback",
            "apiService",
            "geminiStreamService",
            "executeWithFallback",
            "callGeminiAPI",
            "getCallerName"
        ];
        
        for (let i = 1; i < lines.length; i++) {
            const line = lines[i];
            const shouldIgnore = ignoreList.some(item => line.includes(item));
            if (shouldIgnore) continue;
            
            // Tìm định dạng đường dẫn file (ví dụ: /services/CombatTriggerAnalyst.ts)
            const match = line.match(/(?:\/|\\)([^/\\]+\.(?:ts|tsx|js|jsx))(?::|\?|\))/i);
            if (match && match[1]) {
                return match[1].replace(/\.(ts|tsx|js|jsx)$/, '');
            }
            
            // Fallback: Lấy tên hàm nếu đường dẫn lạ
            const funcMatch = line.match(/at\s+([^\s(]+)/);
            if (funcMatch && funcMatch[1] && !funcMatch[1].includes("anonymous")) {
                return funcMatch[1];
            }
        }
    } catch (e) {
        // Tránh gây lỗi hệ thống nếu trình duyệt không hỗ trợ stack trace chuẩn
    }
    return "Unknown";
}

class ApiRunningService {
    private tasksMap: Map<string, ApiTask> = new Map();
    private listeners: Set<Listener> = new Set();
    private currentTurnRequestCount = 0;
    private currentTurnHistory: ApiTaskHistory[] = []; // Biến lưu lịch sử cuộc gọi trong lượt

    resetTurnCounter() {
        this.currentTurnRequestCount = 0;
        this.currentTurnHistory = []; // Reset lịch sử khi người dùng bắt đầu lượt mới
        this.notify();
    }

    subscribe(listener: Listener) {
        this.listeners.add(listener);
        return () => this.listeners.delete(listener);
    }

    private notify() {
        Promise.resolve().then(() => {
            const state = this.getState();
            this.listeners.forEach(l => l(state));
        });
    }

    start(modelName: string, apiKeyLabel?: string | null, purpose?: string | null, rawRequest?: string): string {
        this.currentTurnRequestCount++;
        const id = `task_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
        
        // Tự động nhận diện file/service gọi API
        const caller = getCallerName();

        const task: ApiTask = {
            id,
            modelName,
            apiKeyLabel: apiKeyLabel || null,
            purpose: purpose || null,
            startTime: Date.now(),
            requestNumber: this.currentTurnRequestCount,
            caller,
            rawRequest: rawRequest || ''
        };
        this.tasksMap.set(id, task);
        this.notify();
        return id;
    }

    stop(taskId?: string, rawResponse?: string) {
        if (taskId) {
            const task = this.tasksMap.get(taskId);
            if (task) {
                // Lưu vào lịch sử trước khi xóa
                const durationSeconds = Math.round((Date.now() - task.startTime) / 1000);
                this.currentTurnHistory.push({
                    id: task.id,
                    modelName: task.modelName,
                    apiKeyLabel: task.apiKeyLabel,
                    purpose: task.purpose,
                    durationSeconds: Math.max(1, durationSeconds), // Tối thiểu hiển thị 1s
                    requestNumber: task.requestNumber,
                    caller: task.caller,
                    rawRequest: task.rawRequest,
                    rawResponse: rawResponse || ''
                });
            }
            this.tasksMap.delete(taskId);
        } else {
            if (this.tasksMap.size > 0) {
                const firstKey = this.tasksMap.keys().next().value;
                if (firstKey) {
                    const task = this.tasksMap.get(firstKey);
                    if (task) {
                        const durationSeconds = Math.round((Date.now() - task.startTime) / 1000);
                        this.currentTurnHistory.push({
                            id: task.id,
                            modelName: task.modelName,
                            apiKeyLabel: task.apiKeyLabel,
                            purpose: task.purpose,
                            durationSeconds: Math.max(1, durationSeconds),
                            requestNumber: task.requestNumber,
                            caller: task.caller,
                            rawRequest: task.rawRequest,
                            rawResponse: rawResponse || ''
                        });
                    }
                    this.tasksMap.delete(firstKey);
                }
            }
        }
        this.notify();
    }

    getState(): ApiRunningState {
        const activeTasks = Array.from(this.tasksMap.values());
        const latestTask = activeTasks.length > 0 ? activeTasks[activeTasks.length - 1] : null;
        return {
            isProcessing: activeTasks.length > 0,
            activeTasks,
            currentModel: latestTask ? latestTask.modelName : null,
            startTime: latestTask ? latestTask.startTime : null,
            apiKeyLabel: latestTask ? latestTask.apiKeyLabel : null,
            purpose: latestTask ? latestTask.purpose : null,
            currentTurnHistory: [...this.currentTurnHistory] // Gửi kèm lịch sử cuộc gọi về UI
        };
    }
}

export const apiRunningService = new ApiRunningService();
