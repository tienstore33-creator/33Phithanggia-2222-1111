
export const generateSummarizeCompanionInteractionPrompt = (log: string[]): string => {
    const logString = log.join('\n---\n');

    return `
You are a professional summary AI, specializing in distilling key events from a series of social and emotional interactions.
Below is a detailed log of an interaction session with a companion (spouse/slave).

**DETAILED LOG:**
${logString}

**REQUIREMENTS:**
Based on the log above, write a **short paragraph** (about 2-3 sentences) summarizing the main outcome of the interaction. Focus on:
1.  The nature of the actions (confiding, gift-giving, intimacy...).
2.  Changes in the relationship (e.g., "the bond grew deeper", "better mutual understanding", "a hint of mild jealousy").

**IMPORTANT:**
- The summary MUST BE WRITTEN IN ENGLISH to ensure the AI understands the context perfectly in future turns.
- Target a concise summary to be recorded in the player's main log.
- Write ONLY the summary paragraph, do not add any intros, outros, or other tags.

**EXAMPLE:**
You spent a warm moment with your companion, talking and sharing gifts, which further strengthened the bond between both of you.
`;
};
