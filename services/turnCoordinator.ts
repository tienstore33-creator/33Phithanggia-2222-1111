
import { AiChoice, ParsedAiResponse } from '../types';
import { extractSuperManualTurnData } from './superManualExtractor';

interface TurnResult {
    narrativeResult: {
        response: ParsedAiResponse;
        rawText: string;
    };
    extractedTags: string[];
    flashSummary?: string;
    flashDetails?: string;
}

interface TurnParams {
    callNarrative: () => Promise<{
        response: any;
        rawText: string;
    }>;
    callExtraction: (rawText: string) => Promise<{
        tags: string[];
        flashSummary?: string;
        flashDetails?: string;
    }>;
    callThienDaoSync: (rawText: string, extractionResult?: { tags: string[]; flashSummary?: string; flashDetails?: string }) => Promise<void>;
    onNarrativeReady?: (result: { response: ParsedAiResponse; rawText: string }) => void;
    onStepChange?: (step: 'narrative' | 'delay' | 'syncing') => void;
    isSuperManualMode?: boolean;
    locationName?: string;
    timeString?: string;
    onNarrativeFailed?: (errInfo: { reason: string; partialText: string }) => void;
    onCheckIncomplete?: (result: { response: ParsedAiResponse; rawText: string }) => Promise<{ response: ParsedAiResponse; rawText: string }>;
}

/**
 * TurnCoordinator manages the three-step AI generation process (Narrative -> Delay -> Syncing)
 * Syncing now includes both Data Extraction and Flash Agent (Memory Generation & Vectorization).
 */
export const TurnCoordinator = {
    async runFullTurn(params: TurnParams): Promise<TurnResult> {
        // 1. Narrative Step
        if (params.onStepChange) params.onStepChange('narrative');
        const narrativeResult = await params.callNarrative();

        // Thêm ngay chốt chặn Gatekeeper phía sau:
        const rawText = narrativeResult?.rawText?.trim() || "";
        if (!narrativeResult || rawText === "" || rawText.length < 5) {
            console.warn("[TurnCoordinator] Ngắt chuỗi tác vụ: Lời kể trống hoặc bị lỗi.");
            if (params.onNarrativeFailed) {
                params.onNarrativeFailed({
                    reason: "EMPTY_OR_FAILED_NARRATION",
                    partialText: rawText
                });
            }
            // Ném lỗi định danh để Game Loop hiển thị UI thông báo bắt đầu lại
            throw new Error("NARRATIVE_GENERATION_FAILED");
        }

        // New: Immediate callback for UI to show narrative
        if (params.onNarrativeReady) {
            params.onNarrativeReady(narrativeResult);
        }

        // Kiểm tra và xử lý bù đắp nếu lời kể bị đứt đoạn trước khi chuyển sang bước trích xuất
        let finalNarrativeResult = narrativeResult;
        if (params.onCheckIncomplete) {
            finalNarrativeResult = await params.onCheckIncomplete(narrativeResult);
        }

        // 2. Delay Step (1.2 second)
        // This allows the UI to render the narrative and the browser to breathe
        if (params.onStepChange) params.onStepChange('delay');
        await new Promise(resolve => setTimeout(resolve, 1200));

        // 3. Syncing Step (Extraction + Thien Dao / Flash Agent)
        if (params.onStepChange) params.onStepChange('syncing');
        
        let extractionResult: { tags: string[]; flashSummary?: string; flashDetails?: string };

        if (params.isSuperManualMode) {
            console.log("[TurnCoordinator] Super Manual Mode active. Extracting offline tags, dialogue and memory details directly.");
            extractionResult = extractSuperManualTurnData(
                finalNarrativeResult.rawText,
                params.locationName || "Không rõ",
                params.timeString || "Không rõ"
            );
        } else {
            // Run extraction which combined both system tags & memory details in a single API call
            extractionResult = await params.callExtraction(finalNarrativeResult.rawText);
        }
        
        await new Promise(resolve => setTimeout(resolve, 500));
        
        // Pass extractionResult to the sync callback to save memory offline
        await params.callThienDaoSync(finalNarrativeResult.rawText, extractionResult);

        return {
            narrativeResult: finalNarrativeResult,
            extractedTags: extractionResult.tags,
            flashSummary: extractionResult.flashSummary,
            flashDetails: extractionResult.flashDetails
        };
    }
};
