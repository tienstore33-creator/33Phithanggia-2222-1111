import { StyleSettings } from '../types';

export const STYLE_SETTINGS_STORAGE_KEY = 'daoDoAiStyleSettings_v1';
export const READER_MODE_STORAGE_KEY = 'daoDoAiReaderMode';
export const AVAILABLE_FONTS = ['Bookerly', 'Inter', 'Arial', 'Verdana', 'Times New Roman', 'Courier New', 'Georgia', 'Comic Sans MS', 'inherit'];
export const AVAILABLE_FONT_SIZES = ['12px', '13px', '14px', '15px', '16px', '17px', '18px', '20px', '22px', '24px', 'inherit'];

export const DEFAULT_STYLE_SETTINGS: StyleSettings = {
  uiScale: 1.0,
  avatarScale: 1.0,
  avatarFaceScale: 1.0,
  screenStretchMode: 'none',
  narration: {
    fontFamily: 'Inter, sans-serif',
    fontSize: '16px',
    textColor: '#F3F4F6',
    backgroundColor: '#374151',
  },
  playerAction: {
    fontFamily: 'Inter, sans-serif',
    fontSize: '16px',
    textColor: '#FFFFFF', // Changed from #FACC15 (yellow) to White
    backgroundColor: '#4F46E5',
  },
  choiceButton: {
    fontFamily: 'Inter, sans-serif',
    fontSize: '14px',
    textColor: '#D1D5DB',
    backgroundColor: 'transparent',
  },
  keywordHighlight: {
    fontFamily: undefined,
    fontSize: undefined,
    textColor: '#FACC15',  // yellow-400
    backgroundColor: undefined,
  },
  dialogueHighlight: {
    fontFamily: undefined,
    fontSize: undefined,
    textColor: '#4ADE80', // green-400 (Updated from Purple)
    backgroundColor: undefined, // Will be handled dynamically in rendering
  },
  turnResponseMode: 'streaming',
};