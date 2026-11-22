import { ParsedApiError } from '../utils/apiErrorParser';

export interface FallbackPromptRequest {
    parsedError: ParsedApiError;
    availableModels: string[];
    onSelect: (selectedModel: string | null) => void;
}

type Listener = (request: FallbackPromptRequest | null) => void;

class FallbackPromptService {
    private listener: Listener | null = null;

    subscribe(listener: Listener) {
        this.listener = listener;
        return () => {
            if (this.listener === listener) {
                this.listener = null;
            }
        };
    }

    requestModelSelection(
        parsedError: ParsedApiError,
        availableModels: string[]
    ): Promise<string | null> {
        return new Promise((resolve) => {
            if (!this.listener) {
                resolve(null);
                return;
            }

            this.listener({
                parsedError,
                availableModels,
                onSelect: (selectedModel: string | null) => {
                    if (this.listener) {
                        this.listener(null);
                    }
                    resolve(selectedModel);
                }
            });
        });
    }
}

export const fallbackPromptService = new FallbackPromptService();
