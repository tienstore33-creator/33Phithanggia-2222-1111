import React, { useState, useEffect, ChangeEvent } from 'react';
import { StyleSettings, StyleSettingProperty, GameScreen, TurnResponseMode } from '../types';
import Button from './ui/Button';
import Modal from './ui/Modal'; // Corrected import path
import { VIETNAMESE, AVAILABLE_FONTS, AVAILABLE_FONT_SIZES, DEFAULT_STYLE_SETTINGS } from '../constants';
import { useGame } from '../hooks/useGame';
import InputField from './ui/InputField';
import { RefreshCw } from 'lucide-react';

interface StyleSettingsModalProps {
  initialSettings: StyleSettings;
  onSave: (newSettings: StyleSettings) => void;
  onClose: () => void;
}

const StyleSettingsModal: React.FC<StyleSettingsModalProps> = ({ initialSettings, onSave, onClose }) => {
  const [currentStyles, setCurrentStyles] = useState<StyleSettings>(initialSettings);
  const [uiScale, setUiScale] = useState(initialSettings.uiScale || 1.0);
  const [avatarScale, setAvatarScale] = useState(initialSettings.avatarScale || 1.0);
  const [avatarFaceScale, setAvatarFaceScale] = useState(initialSettings.avatarFaceScale || 1.0);
  const [turnResponseMode, setTurnResponseMode] = useState<TurnResponseMode>(initialSettings.turnResponseMode || 'streaming');
  const { setCurrentScreen, isApiVerified, checkApiConnection } = useGame();
  const [isCheckingApi, setIsCheckingApi] = useState(false);

  useEffect(() => {
    setCurrentStyles(initialSettings);
    setUiScale(initialSettings.uiScale || 1.0);
    setAvatarScale(initialSettings.avatarScale || 1.0);
    setAvatarFaceScale(initialSettings.avatarFaceScale || 1.0);
    setTurnResponseMode(initialSettings.turnResponseMode || 'streaming');
  }, [initialSettings]);

  useEffect(() => {
    // Apply scale change live to the root element
    document.documentElement.style.fontSize = `${70 * uiScale}%`;
  }, [uiScale]);

  const handleStyleChange = (
    section: keyof StyleSettings,
    property: keyof StyleSettingProperty,
    value: string
  ) => {
    setCurrentStyles(prev => ({
      ...prev,
      [section]: {
        ...prev[section],
        [property]: value === 'inherit' || value === '' ? undefined : value, // Store undefined for inheritance
      },
    }));
  };

  const handleResetSection = (section: keyof StyleSettings) => {
    setCurrentStyles(prev => ({
      ...prev,
      [section]: DEFAULT_STYLE_SETTINGS[section],
    }));
  };
  
  const handleResetAll = () => {
    setCurrentStyles(DEFAULT_STYLE_SETTINGS);
    setUiScale(DEFAULT_STYLE_SETTINGS.uiScale || 1.0);
    setAvatarScale(DEFAULT_STYLE_SETTINGS.avatarScale || 1.0);
    setAvatarFaceScale(DEFAULT_STYLE_SETTINGS.avatarFaceScale || 1.0);
    setTurnResponseMode(DEFAULT_STYLE_SETTINGS.turnResponseMode || 'streaming');
  };

  const handleApply = () => {
    onSave({ ...currentStyles, uiScale, avatarScale, avatarFaceScale, turnResponseMode });
  };

  const handleGoToApiSettings = () => {
    onClose(); // Close the current modal
    setCurrentScreen(GameScreen.ApiSettings); // Navigate to API settings
  };

  const handlePingApi = async () => {
    setIsCheckingApi(true);
    try {
      await checkApiConnection(true);
    } finally {
      setIsCheckingApi(false);
    }
  };

  const renderStyleSection = (sectionKey: keyof StyleSettings, sectionLabel: string) => {
    const sectionStyles = currentStyles[sectionKey];
    if (typeof sectionStyles !== 'object' || sectionStyles === null) return null;
    
    const isKeywordSection = sectionKey === 'keywordHighlight';
    const isDialogueSection = sectionKey === 'dialogueHighlight';

    return (
      <fieldset className="border border-gray-700 p-4 rounded-md mb-6 bg-gray-800/30">
        <legend className="text-lg font-semibold text-indigo-300 px-2 flex justify-between items-center w-full">
          <span>{sectionLabel}</span>
          <Button 
            type="button" 
            variant="ghost" 
            size="sm" 
            onClick={() => handleResetSection(sectionKey)}
            className="text-xs text-amber-400 hover:text-amber-300 border-amber-500"
          >
            Khôi phục mục này
          </Button>
        </legend>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-3">
          {/* Font family and size only if not keyword or dialogue section */}
          {(!isKeywordSection && !isDialogueSection) && ( 
            <>
              <div>
                <label htmlFor={`${sectionKey}-fontFamily`} className="block text-sm font-medium text-gray-300 mb-1">{VIETNAMESE.fontFamilyLabel}</label>
                <select
                  id={`${sectionKey}-fontFamily`}
                  value={sectionStyles.fontFamily || 'inherit'}
                  onChange={(e) => handleStyleChange(sectionKey, 'fontFamily', e.target.value)}
                  className="w-full p-2 bg-gray-700 border border-gray-600 rounded-md focus:ring-indigo-500 focus:border-indigo-500 text-gray-100"
                >
                  {AVAILABLE_FONTS.map(font => <option key={font} value={font}>{font === 'inherit' ? 'Kế thừa' : font}</option>)}
                </select>
              </div>
              <div>
                <label htmlFor={`${sectionKey}-fontSize`} className="block text-sm font-medium text-gray-300 mb-1">{VIETNAMESE.fontSizeLabel}</label>
                <select
                  id={`${sectionKey}-fontSize`}
                  value={sectionStyles.fontSize || 'inherit'}
                  onChange={(e) => handleStyleChange(sectionKey, 'fontSize', e.target.value)}
                  className="w-full p-2 bg-gray-700 border border-gray-600 rounded-md focus:ring-indigo-500 focus:border-indigo-500 text-gray-100"
                >
                  {AVAILABLE_FONT_SIZES.map(size => <option key={size} value={size}>{size === 'inherit' ? 'Kế thừa' : size}</option>)}
                </select>
              </div>
            </>
          )}
          <div>
            <label htmlFor={`${sectionKey}-textColor`} className="block text-sm font-medium text-gray-300 mb-1">{VIETNAMESE.textColorLabel}</label>
            <input
              type="color"
              id={`${sectionKey}-textColor`}
              value={sectionStyles.textColor || '#FFFFFF'} 
              onChange={(e) => handleStyleChange(sectionKey, 'textColor', e.target.value)}
              className="w-full h-10 p-1 bg-gray-700 border border-gray-600 rounded-md cursor-pointer"
            />
          </div>
          {/* Background color only if not keyword or dialogue section */}
          {(!isKeywordSection && !isDialogueSection) && ( 
            <div>
              <label htmlFor={`${sectionKey}-backgroundColor`} className="block text-sm font-medium text-gray-300 mb-1">{VIETNAMESE.backgroundColorLabel}</label>
              <input
                type="color"
                id={`${sectionKey}-backgroundColor`}
                value={sectionStyles.backgroundColor || '#000000'} // Default to black if undefined for picker
                onChange={(e) => handleStyleChange(sectionKey, 'backgroundColor', e.target.value)}
                className="w-full h-10 p-1 bg-gray-700 border border-gray-600 rounded-md cursor-pointer"
              />
            </div>
          )}
        </div>
      </fieldset>
    );
  };

  return (
    <Modal isOpen={true} onClose={onClose} title={VIETNAMESE.displaySettingsTitle}>
      <div className="space-y-4 max-h-[60vh] overflow-y-auto custom-scrollbar pr-2">
        <fieldset className="border border-gray-700 p-4 rounded-md mb-6 bg-gray-800/30">
            <legend className="text-lg font-semibold text-cyan-300 px-2 animate-pulse">Giao Diện Tổng Thể</legend>
            <div className="mt-3">
                <label htmlFor="ui-scale-slider" className="block text-sm font-medium text-gray-300 mb-2">
                    Phóng to / Thu nhỏ chữ & giao diện: <span className="font-bold text-white">{(uiScale * 100).toFixed(0)}%</span>
                </label>
                <div className="flex items-center gap-4">
                    <span className="text-xs text-gray-400">Nhỏ</span>
                    <input
                        type="range"
                        id="ui-scale-slider"
                        min="0.7"
                        max="1.5"
                        step="0.05"
                        value={uiScale}
                        onChange={(e) => setUiScale(parseFloat(e.target.value))}
                        className="w-full h-2 bg-gray-600 rounded-lg appearance-none cursor-pointer"
                    />
                    <span className="text-xs text-gray-400">Lớn</span>
                </div>
            </div>

            <div className="mt-5 pt-4 border-t border-gray-700/50">
                <label htmlFor="avatar-scale-slider" className="block text-sm font-medium text-gray-300 mb-2">
                    Kích thước Avatar nhân vật: <span className="font-bold text-white">{(avatarScale * 100).toFixed(0)}%</span>
                </label>
                <div className="flex items-center gap-4">
                    <span className="text-xs text-gray-400">Nhỏ</span>
                    <input
                        type="range"
                        id="avatar-scale-slider"
                        min="0.5"
                        max="2.0"
                        step="0.05"
                        value={avatarScale}
                        onChange={(e) => setAvatarScale(parseFloat(e.target.value))}
                        className="w-full h-2 bg-gray-600 rounded-lg appearance-none cursor-pointer"
                    />
                    <span className="text-xs text-gray-400">Lớn</span>
                </div>
            </div>

            <div className="mt-5 pt-4 border-t border-gray-700/50">
                <label htmlFor="avatar-face-scale-slider" className="block text-sm font-medium text-gray-300 mb-2">
                    Thu phóng gương mặt (trong hội thoại): <span className="font-bold text-white">{(avatarFaceScale * 100).toFixed(0)}%</span>
                </label>
                <div className="flex items-center gap-4">
                    <span className="text-xs text-gray-400">Nhỏ</span>
                    <input
                        type="range"
                        id="avatar-face-scale-slider"
                        min="0.5"
                        max="2.0"
                        step="0.05"
                        value={avatarFaceScale}
                        onChange={(e) => setAvatarFaceScale(parseFloat(e.target.value))}
                        className="w-full h-2 bg-gray-600 rounded-lg appearance-none cursor-pointer"
                    />
                    <span className="text-xs text-gray-400">Lớn</span>
                </div>
                <p className="text-[11px] text-gray-400 mt-1 leading-relaxed">
                    * Phóng to hoặc thu nhỏ tiêu điểm gương mặt bên trong khung tròn (Áp dụng cho cả Avatar ảnh tải lên và Avatar động).
                </p>
            </div>

            {/* Tùy Chọn Co Dãn Màn Hình Giải Quyết Lỗi Tràn/Khuất Nút */}
            <div className="mt-5 pt-4 border-t border-gray-700/50">
                <label htmlFor="screen-stretch-mode" className="block text-sm font-medium text-gray-300 mb-2 font-semibold">
                    Thuật toán Co Dãn Khung Game (Sửa lỗi che khuất):
                </label>
                <select
                    id="screen-stretch-mode"
                    value={currentStyles.screenStretchMode || 'none'}
                    onChange={(e) => {
                        const val = e.target.value as any;
                        setCurrentStyles(prev => ({
                            ...prev,
                            screenStretchMode: val
                        }));
                    }}
                    className="w-full p-2 bg-gray-700 border border-gray-600 rounded-md focus:ring-indigo-500 focus:border-indigo-500 text-gray-100 text-sm"
                >
                    <option value="none">Mặc định (Dàn trang tự do / Responsive)</option>
                    <option value="stretch">Co giãn khít màn hình (Méo dạng Retro 📺 - Khuyên dùng)</option>
                    <option value="fit-uniform">Giữ nguyên tỉ lệ khít màn hình (Bo viền đen ⭐️)</option>
                </select>
                <p className="text-[11px] text-gray-400 mt-2 leading-relaxed">
                    * <strong>Co giãn khít (Retro Stretch):</strong> Tự bóp méo, giãn rộng dẹp toàn bộ giao diện game khít 100% màn hình hiển thị. Loại bỏ hoàn toàn thanh cuộn khó chịu và <span className="text-amber-400">sửa triệt để lỗi khuất các nút bấm ở mép dưới điện thoại</span>.
                </p>
            </div>
        </fieldset>

        <fieldset className="border border-gray-700 p-4 rounded-md mb-6 bg-gray-800/30">
          <legend className="text-lg font-semibold text-cyan-300 px-2 flex items-center gap-2">
            <span>⚡ Chế độ Phản hồi Lượt chơi</span>
          </legend>
          <div className="mt-3 p-3 rounded-md bg-indigo-950/40 border border-indigo-700/60 flex items-start gap-3">
            <span className="text-xl shrink-0">🚀</span>
            <div className="text-sm">
              <span className="font-bold text-indigo-200">Streaming Tức Thì 0ms (Cố định duy nhất)</span>
              <p className="text-gray-300 text-xs mt-1 leading-relaxed">
                Nội dung lời kể từ AI được hiển thị trực tiếp theo từng ký tự ngay khi API vừa phản hồi (0ms render). Chế độ này đã được áp dụng cố định làm mặc định duy nhất cho toàn bộ hệ thống.
              </p>
            </div>
          </div>
        </fieldset>
        
        {renderStyleSection('narration', VIETNAMESE.narrationStylesLabel)}
        {renderStyleSection('playerAction', VIETNAMESE.playerActionStylesLabel)}
        {renderStyleSection('choiceButton', VIETNAMESE.choiceButtonStylesLabel)}
        {renderStyleSection('keywordHighlight', VIETNAMESE.keywordHighlightStylesLabel)}
        {renderStyleSection('dialogueHighlight', VIETNAMESE.dialogueHighlightStylesLabel || "Kiểu Chữ Hội Thoại Đặc Biệt")}
      </div>
      <div className="mt-6 pt-4 border-t border-gray-700 flex flex-col sm:flex-row justify-between items-center space-y-3 sm:space-y-0">
        <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
            <Button 
                type="button" 
                variant="danger" 
                onClick={handleResetAll}
                className="w-full sm:w-auto"
            >
              {VIETNAMESE.resetToDefaultsButton}
            </Button>
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <Button 
                  type="button" 
                  variant="ghost" 
                  onClick={handleGoToApiSettings}
                  className={`flex-grow sm:flex-initial border border-cyan-500 text-cyan-300 hover:bg-cyan-700 ${isApiVerified ? 'bg-green-600/20 text-green-400 border-green-500/50' : ''}`}
              >
                Thiết lập Key Gemini
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="md"
                className={`w-10 h-10 flex items-center justify-center border border-gray-700 ${isApiVerified ? 'text-green-400 border-green-500/50' : ''}`}
                onClick={handlePingApi}
                disabled={isCheckingApi}
                title="Kiểm tra kết nối API"
              >
                <RefreshCw size={16} className={isCheckingApi ? 'animate-spin' : ''} />
              </Button>
            </div>
        </div>
        <div className="flex space-x-3 w-full sm:w-auto">
            <Button 
                type="button" 
                variant="secondary" 
                onClick={onClose}
                className="flex-1 sm:flex-auto"
            >
            {VIETNAMESE.closeButton}
            </Button>
            <Button 
                type="button" 
                variant="primary" 
                onClick={handleApply}
                className="flex-1 sm:flex-auto"
            >
            {VIETNAMESE.applySettingsButton}
            </Button>
        </div>
      </div>
    </Modal>
  );
};

export default StyleSettingsModal;