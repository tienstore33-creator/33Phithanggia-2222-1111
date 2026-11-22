// utils/avatarPromptGen.ts
export const WUXIA_PROMPT_SUFFIX = 
  ", 16-bit pixel art RPG portrait, clean pixel lines, 2D sprite style, " +
  "Wuxia martial hero aesthetic, traditional Chinese ancient attire, " +
  "weathered hero look, sword on back, dusty martial arts vibe, " +
  "East Asian facial features, detailed but minimalist, highly atmospheric.";

export const generateWuxiaAvatarPrompt = (characterDetails: string): string => {
  return `${characterDetails}${WUXIA_PROMPT_SUFFIX}`;
};
