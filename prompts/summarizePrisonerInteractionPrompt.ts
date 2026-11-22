
export const generateSummarizePrisonerInteractionPrompt = (log: string[]): string => {
    const logString = log.join('\n---\n');

    return `
You are a professional summary AI, specializing in distilling key events from a series of interactions with a character.
Below is a detailed log of an interaction session with a prisoner.

**DETAILED LOG:**
${logString}

**REQUIREMENTS:**
Based on the log above, write a **short paragraph** (about 2-3 sentences) summarizing the main outcome of the interaction. Focus on:
1.  The primary goal of the actions (interrogation, persuasion, punishment...).
2.  The general outcome (e.g., "the prisoner's will was shaken", "the relationship became more strained", "some useful information was obtained").

**IMPORTANT:**
- The summary MUST BE WRITTEN IN ENGLISH to ensure the AI understands the context perfectly in future turns.
- Target a concise summary to be recorded in the player's main log.
- Write ONLY the summary paragraph, do not add any intros, outros, or other tags.

**EXAMPLE:**
After a session of persuasion and care, the prisoner's attitude changed slightly; his resistance decreased and his affinity for you increased a bit, though he has not yet revealed any secrets.
`;
};
