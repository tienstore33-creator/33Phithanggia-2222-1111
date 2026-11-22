import { GoogleGenAI } from "@google/genai";

async function test() {
    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
    const response = await ai.models.generateContent({
        model: "gemini-2.5-pro",
        contents: "Xin chào, hãy giải thích thuyết tương đối trong 100 chữ.",
        config: {
            thinkingConfig: { thinkingBudget: 1024 }
        }
    });

    console.log(JSON.stringify(response.candidates?.[0]?.content?.parts, null, 2));
}

test().catch(console.error);
