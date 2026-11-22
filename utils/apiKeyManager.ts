
const invalidKeys = new Set<string>();

export const apiKeyManager = {
  markAsInvalid: (key: string) => {
    if (key && key.trim() !== '') {
      invalidKeys.add(key);
      console.warn(`[apiKeyManager] Key blacklisted: ${key.slice(-4)}`);
    }
  },
  isInvalid: (key: string) => {
    if (!key) return false;
    return invalidKeys.has(key);
  },
  filterValidKeys: (keys: string[]) => {
    if (!keys) return [];
    return keys.filter(k => k && k.trim() !== '' && !invalidKeys.has(k));
  },
  getInvalidKeysCount: () => invalidKeys.size,
  clearBlacklist: () => invalidKeys.clear()
};
