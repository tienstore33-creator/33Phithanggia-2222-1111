
type FallbackState = {
    isProcessing: boolean;
    failedModel: string | null;
    currentModel: string | null;
    attempt: number;
    total: number;
    startTime: number | null;
    error: string | null;
};

type Listener = (state: FallbackState) => void;

class FallbackEventService {
    private state: FallbackState = {
        isProcessing: false,
        failedModel: null,
        currentModel: null,
        attempt: 0,
        total: 0,
        startTime: null,
        error: null
    };

    private listeners: Set<Listener> = new Set();

    subscribe(listener: Listener) {
        this.listeners.add(listener);
        listener(this.state);
        return () => this.listeners.delete(listener);
    }

    private notify() {
        this.listeners.forEach(l => l({ ...this.state }));
    }

    start(total: number, initialModel: string) {
        this.state = {
            isProcessing: true,
            failedModel: null,
            currentModel: initialModel,
            attempt: 1,
            total: total,
            startTime: Date.now(),
            error: null
        };
        this.notify();
    }

    nextAttempt(failedModel: string, nextModel: string, error: string) {
        this.state = {
            ...this.state,
            failedModel,
            currentModel: nextModel,
            attempt: this.state.attempt + 1,
            error
        };
        this.notify();
    }

    stop() {
        this.state = {
            ...this.state,
            isProcessing: false,
            failedModel: null,
            currentModel: null,
            startTime: null
        };
        this.notify();
    }

    getState() {
        return { ...this.state };
    }
}

export const fallbackEventService = new FallbackEventService();
