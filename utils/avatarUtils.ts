
import { MALE_AVATAR_PLACEHOLDER_URL, FEMALE_AVATAR_BASE_URL, MAX_FEMALE_AVATAR_INDEX } from '../constants';

/**
 * A simple hashing function to convert a string (like a character ID or Name) into a number.
 * This is used to deterministically pick an avatar.
 * @param str The input string.
 * @returns A non-negative integer hash.
 */
function simpleHash(str: string): number {
  let hash = 0;
  if (!str || str.length === 0) {
    return hash;
  }
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash |= 0; // Convert to 32bit integer
  }
  return Math.abs(hash);
}

/**
 * Gets a deterministic avatar source URL for a character.
 * If a valid avatarUrl is provided, it's used directly.
 * Otherwise, a "random" but consistent avatar is chosen based on the character's ID and/or Name and Gender.
 * This allows showing a consistent default avatar even during character creation before an ID is assigned.
 * @param person An object with optional id, name, avatarUrl, and gender.
 * @returns The source URL for the avatar image.
 */
export const getDeterministicAvatarSrc = (person: { id?: string, name?: string, avatarUrl?: string, gender?: string }): string => {
    // 1. Prioritize a valid, existing avatar URL.
    if (person.avatarUrl && (person.avatarUrl.startsWith('http://') || person.avatarUrl.startsWith('https://') || person.avatarUrl.startsWith('data:image'))) {
      return person.avatarUrl;
    }
  
    // 2. Fallback to a deterministic "random" avatar based on ID or Name.
    // Use Name as the primary seed if ID is generic (e.g., "player") or missing, to ensure variety during setup.
    let seed = person.id || "";
    if (!seed || seed === 'player' || seed.startsWith('temp-')) {
        seed = person.name || seed || "default";
    }

    const hash = simpleHash(seed);
    
    if (person.gender === 'Nam') {
      return MALE_AVATAR_PLACEHOLDER_URL;
    }

    if (person.gender === 'Nữ' || hash % 2 === 0) {
      const randomIndex = (hash % MAX_FEMALE_AVATAR_INDEX) + 1;
      return `${FEMALE_AVATAR_BASE_URL}${randomIndex}.png`;
    }
    
    // 3. Default to a male placeholder for any other case.
    return MALE_AVATAR_PLACEHOLDER_URL;
};
