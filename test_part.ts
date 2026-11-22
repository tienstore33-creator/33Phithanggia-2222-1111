import { Part } from "@google/genai";

// This will just fail if Part doesn't exist, but we can look at the error.
const p: Part = {
    text: "hello",
    thought: true
};
