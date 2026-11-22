
import { generateCompletionForWorldDetails } from './geminiService';
import { WorldSettings } from '../types';
import { fetchRawCanonData } from '../utils/rawFetcher';

export interface StressTestResult {
    iteration: number;
    success: boolean;
    duration: number;
    modelUsed?: string;
    error?: string;
    rawText?: string;
}

export const runWorldGenStressTest = async (
    settings: WorldSettings,
    iterations: number = 10,
    onProgress?: (current: number, total: number, lastResult: StressTestResult) => void
): Promise<StressTestResult[]> => {
    const results: StressTestResult[] = [];

    let canonData: string | undefined = undefined;
    if (settings.isStrictGrounding && settings.remoteCanonUrl) {
        canonData = await fetchRawCanonData(settings.remoteCanonUrl) || undefined;
    }

    for (let i = 1; i <= iterations; i++) {
        const startTime = Date.now();
        let modelUsed = "";
        try {
            const { response, rawText, constructedPrompt } = await generateCompletionForWorldDetails(
                settings,
                undefined,
                (m) => modelUsed = m,
                canonData
            );
            
            const duration = Date.now() - startTime;
            const result: StressTestResult = {
                iteration: i,
                success: true,
                duration,
                modelUsed,
                rawText: rawText.substring(0, 100) + "..." // Just a snippet
            };
            results.push(result);
            if (onProgress) onProgress(i, iterations, result);
        } catch (error: any) {
            const duration = Date.now() - startTime;
            const result: StressTestResult = {
                iteration: i,
                success: false,
                duration,
                modelUsed,
                error: error.message || String(error)
            };
            results.push(result);
            if (onProgress) onProgress(i, iterations, result);
        }
        
        // Small delay between iterations to avoid hitting rate limits too fast
        await new Promise(resolve => setTimeout(resolve, 1000));
    }

    return results;
};
