import { GoogleGenAI, HarmCategory, HarmBlockThreshold } from '@google/genai';
import { getTaskModel } from '../../../services/apiService';

const nsfwSafetySettings = [
    { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_NONE },
    { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_NONE },
    { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_NONE },
    { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_NONE },
];

export async function callJsonAI(prompt: string, schema: any, geminiService: GoogleGenAI, isNsfw: boolean) {
    const result = await geminiService.models.generateContent({
        model: getTaskModel('economy'),
        contents: prompt,
        config: {
            responseMimeType: "application/json",
            responseSchema: schema as any,
        },
        // safetySettings not directly supported in this syntax or handled globally
    });
    return result;
}

export function parseAndValidateJsonResponse(text: string): any {
    try {
        return JSON.parse(text);
    } catch (e) {
        console.error("JSON Parse Error:", text);
        return {};
    }
}
