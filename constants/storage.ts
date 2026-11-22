import { StorageType, StorageSettings } from '../types';

export const STORAGE_SETTINGS_STORAGE_KEY = 'daoDoAiStorageSettings_v2';
export const DISABLE_SEX_INTERACTION_STORAGE_KEY = 'disable_sex_interaction_tag';
export const DEFAULT_STORAGE_TYPE: StorageType = 'local';
export const DEFAULT_STORAGE_SETTINGS: StorageSettings = {
  storageType: DEFAULT_STORAGE_TYPE,
};