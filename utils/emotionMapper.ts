export const EMOJI_TO_FACE_INDEX: Record<string, number> = {
  // === ROW 0 (Indices 0 - 4) ===
  // Index 0: Confident Wink & Smirk
  "😉": 0, "😏": 0,
  
  // Index 1: Serene, Calm default face (Mặt số #2 - default fallback)
  "😐": 1, "😶": 1, "😑": 1, "😶‍🌫️": 1, "🤐": 1, "😇": 1, "😌": 1, "😷": 1, "🥸": 1,

  // Index 2: Surprised, wide eyes, open mouth "O" shape
  "😮": 2, "😯": 2, "😲": 2, "😧": 2, "😦": 2,

  // Index 3: Cute Flustered / Shy Anger with heavily blushed cheeks
  "😡": 3, "😠": 3, "🤬": 3,

  // Index 4: Firm Stern Frown, determined/serious
  "😤": 4, "😣": 4,


  // === ROW 1 (Indices 5 - 9) ===
  // Index 5: Annoyed sidelong glance, grumpy
  "😒": 5, "🙄": 5, "🧐": 5, "🤨": 5,

  // Index 6: Polite dimple smile
  "😊": 6, "🙂": 6, "☺️": 6, "🤭": 6,

  // Index 7: Nervous/embarrassed blush smile with sweat
  "😅": 7, "😬": 7, "🥵": 7, "😰": 7, "😖": 7,

  // Index 8: Cool side squint / badass glare
  "😎": 8, "🤠": 8,

  // Index 9: Playful cat smirk / teasing grin
  "🤪": 9, "😜": 9, "😛": 9, "😝": 9, "🤥": 9,


  // === ROW 2 (Indices 10 - 14) ===
  // Index 10: Intellectual confident smirk
  "🤔": 10,

  // Index 11: Sleepy drool / fatigued listless face
  "🤤": 11, "🥱": 11, "😪": 11, "🥴": 11, "🤮": 11,

  // Index 12: Joyful eyes-closed big laugh
  "😄": 12, "😆": 12, "😂": 12, "🤣": 12, "🥳": 12,

  // Index 13: Sad downcast pout, pleading puppy eyes
  "😔": 13, "🥺": 13, "☹️": 13, "🙁": 13, "😕": 13, "😟": 13, "😞": 13, "😩": 13, "😫": 13, "🥲": 13,

  // Index 14: Dark circles, furious vengeance glare
  "👿": 14,


  // === ROW 3 (Indices 15 - 19) ===
  // Index 15: Evil maniac grin, bared teeth
  "😈": 15, "👹": 15, "👺": 15, "👾": 15,

  // Index 16: Heartbroken crying, streams of tears
  "😭": 16, "😢": 16, "😥": 16,

  // Index 17: Cute bashful surprise, round-eyed blush
  "😳": 17, "🤫": 17,

  // Index 18: Loving romance smile, deep affection
  "🥰": 18, "😍": 18, "😘": 18, "😗": 18, "😙": 18, "😚": 18,

  // Index 19: Bored/fatigued dry deadpan eyes
  "😴": 19, "🤒": 19, "🤕": 19, "💀": 19, "☠️": 19,


  // === ROW 4 (Indices 20 - 24) ===
  // Index 20: Panic shocked screaming with sweat
  "😨": 20,

  // Index 21: Joyful winking big-mouthed laugh
  "😀": 21, "😃": 21, "😁": 21, "🤩": 21,

  // Index 22: Universal warm gentle smile
  "🤗": 22,

  // Index 23: Worried / cold sweat / guilty glance
  "😓": 23, "🥶": 23, "🤧": 23,

  // Index 24: Horrified screaming, pure psychotic shock
  "😱": 24, "🤯": 24, "😵": 24, "😵‍💫": 24, "🤡": 24, "💩": 24, "ghost": 24, "🤖": 24, "👽": 24, "☃️": 24, "⛄": 24
};

export const getFaceIndexFromEmoji = (emoji: string): number | null => {
  if (!emoji) return null;
  
  // Try to find exact match
  if (EMOJI_TO_FACE_INDEX[emoji] !== undefined) {
    return EMOJI_TO_FACE_INDEX[emoji];
  }

  // Fallback for compound emojis or variations if needed.
  // "Nếu có emoji nào không phù hợp thì hãy để mặt số #2 làm mặc định"
  // Mặt số #2: Hàng 0, Cột 1 (Index 1) - Khuôn mặt điềm tĩnh, xinh đẹp.
  return 1;
};

export const cleanEmojiString = (rawEmojiStr: string): string => {
  if (!rawEmojiStr) return "";
  
  const validEmojis = Object.keys(EMOJI_TO_FACE_INDEX).sort((a, b) => b.length - a.length);
  const regex = new RegExp(`(${validEmojis.join('|')})`, 'g');
  
  const matches = rawEmojiStr.match(regex);
  if (matches && matches.length > 0) {
    return matches.join('');
  }
  
  return rawEmojiStr;
};
