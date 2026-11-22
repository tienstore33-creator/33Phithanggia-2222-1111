import { STORAGE_SETTINGS_STORAGE_KEY, DEFAULT_STORAGE_SETTINGS } from '../constants';
import { StorageSettings } from '../types';

export const getStorageSettings = (): StorageSettings => {
  const stored = localStorage.getItem(STORAGE_SETTINGS_STORAGE_KEY);
  if (stored) {
    try {
      // Merge with defaults to ensure all fields exist even if stored data is old
      return { ...DEFAULT_STORAGE_SETTINGS, ...JSON.parse(stored) };
    } catch (e) {
      console.error("Failed to parse storage settings", e);
    }
  }
  return DEFAULT_STORAGE_SETTINGS;
};