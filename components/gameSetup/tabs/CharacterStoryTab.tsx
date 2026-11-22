import React, { ChangeEvent, useState, useEffect } from 'react';
import { WorldSettings, STARTING_LOCATION_TYPES } from '../../../types';
import { FanficWork } from '../../../src/types/fanfic';
import { useCharacterSuggestions } from '../../../hooks/useCharacterSuggestions';
import InputField from '../../ui/InputField';
import Button from '../../ui/Button';
import Spinner from '../../ui/Spinner';
import { Sparkles, PenTool } from 'lucide-react';
import { VIETNAMESE, FEMALE_AVATAR_BASE_URL, MAX_FEMALE_AVATAR_INDEX, MALE_AVATAR_PLACEHOLDER_URL, CLOUDINARY_CLOUD_NAME } from '../../../constants';
import { generateImageUnified } from '../../../services/geminiService'; 
import { uploadImageToCloudinary } from '../../../services/cloudinaryService';
import { isValidImageUrl } from '../../../utils/imageValidationUtils';
import { getDeterministicAvatarSrc } from '../../../utils/avatarUtils'; // Import the util
import CustomPromptModal from '../../ui/CustomPromptModal';
import { GuideMarker } from '../../guide/GuideSystem';

interface CharacterStoryTabProps {
  settings: WorldSettings;
  handleChange: (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => void;
  playerAvatarPreviewUrl: string | null; 
  setPlayerAvatarPreviewUrl: (url: string | null) => void; 
  onPlayerAvatarDataChange: (data: string | null) => void; 
  handleGenerateCharacterFromName?: (customPrompt?: string) => void;
  isGeneratingCharacter?: boolean;
  selectedWork: FanficWork | null;
  isGuideOverlayActive?: boolean;
  activeGuideId?: string | null;
  setActiveGuideId?: (id: string | null) => void;
}

const CharacterStoryTab: React.FC<CharacterStoryTabProps> = ({
  settings,
  handleChange,
  playerAvatarPreviewUrl, 
  setPlayerAvatarPreviewUrl, 
  onPlayerAvatarDataChange, 
  handleGenerateCharacterFromName,
  isGeneratingCharacter,
  selectedWork,
  isGuideOverlayActive,
  activeGuideId,
  setActiveGuideId
}) => {
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const [aiAvatarPrompt, setAiAvatarPrompt] = useState('');
  const [isGeneratingAiAvatar, setIsGeneratingAiAvatar] = useState(false);
  const [aiAvatarError, setAiAvatarError] = useState<string | null>(null);

  const { setSearchQuery, suggestions } = useCharacterSuggestions(selectedWork);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);

  // State for player avatar URL input during setup
  const [showPlayerSetupAvatarUrlInput, setShowPlayerSetupAvatarUrlInput] = useState(false);
  const [playerAvatarUrlInput, setPlayerAvatarUrlInput] = useState(''); 
  const [isPlayerAvatarUrlValidating, setIsPlayerAvatarUrlValidating] = useState(false);
  const [playerAvatarUrlError, setPlayerAvatarUrlError] = useState<string | null>(null);
  const [isCustomPromptModalOpen, setIsCustomPromptModalOpen] = useState(false);

  // Effect to set the initial input value
  useEffect(() => {
    if (playerAvatarPreviewUrl && playerAvatarPreviewUrl.startsWith('http')) {
      setPlayerAvatarUrlInput(playerAvatarPreviewUrl);
    } else {
      setPlayerAvatarUrlInput('');
    }
  }, [playerAvatarPreviewUrl]);

  // Effect to update the default avatar preview when Name or Gender changes, if no custom avatar is set
  useEffect(() => {
    // Only auto-update if the user hasn't explicitly uploaded/set a custom avatar URL
    // We check if settings.playerAvatarUrl is empty/undefined to know it's in "default" mode
    if (!settings.playerAvatarUrl) {
        const defaultSrc = getDeterministicAvatarSrc({
            name: settings.playerName,
            gender: settings.playerGender
        });
        setPlayerAvatarPreviewUrl(defaultSrc);
    }
  }, [settings.playerName, settings.playerGender, settings.playerAvatarUrl, setPlayerAvatarPreviewUrl]);

  // NEW: Effect to auto-generate a default AI avatar prompt based on character details.
  useEffect(() => {
    const defaultPrompt = `Masterpiece anime character portrait in the dynamic and highly detailed art style of Yusuke Murata (One-Punch Man, VERSUS). Character: ${settings.playerName || 'a character'}. Gender: ${settings.playerGender}. Personality: ${settings.playerPersonality || 'not specified'}. Appearance and key features: ${settings.playerStartingTraits || 'not specified'}. Emphasize clean lines, intricate details, and expressive, dramatic lighting. Key visual, official art.`;
    setAiAvatarPrompt(defaultPrompt);
  }, [settings.playerName, settings.playerGender, settings.playerPersonality, settings.playerStartingTraits]);


  const handleRandomAvatar = () => {
    const randomIndex = Math.floor(Math.random() * MAX_FEMALE_AVATAR_INDEX) + 1;
    const randomUrl = `${FEMALE_AVATAR_BASE_URL}${randomIndex}.png`;
    setPlayerAvatarPreviewUrl(randomUrl); 
    onPlayerAvatarDataChange(randomUrl);  
    handleChange({ target: { name: 'playerAvatarUrl', value: randomUrl } } as any); 
    setAiAvatarPrompt(''); 
    setAiAvatarError(null);
    setPlayerAvatarUrlError(null);
    setShowPlayerSetupAvatarUrlInput(false);
  };

  const handleAvatarUpload = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64String = reader.result as string;
        setPlayerAvatarPreviewUrl(base64String); 
        onPlayerAvatarDataChange(base64String); 
        handleChange({ target: { name: 'playerAvatarUrl', value: 'uploaded_via_file' } } as any); 
        setAiAvatarPrompt('');
        setAiAvatarError(null);
        setPlayerAvatarUrlError(null);
        setShowPlayerSetupAvatarUrlInput(false);
      };
      reader.readAsDataURL(file);
    }
  };
  
  const handleRemoveAvatar = () => {
    setPlayerAvatarPreviewUrl(null);
    onPlayerAvatarDataChange(null);
    handleChange({ target: { name: 'playerAvatarUrl', value: undefined } } as any);
    if(fileInputRef.current) fileInputRef.current.value = "";
    setAiAvatarPrompt('');
    setAiAvatarError(null);
    setPlayerAvatarUrlInput(''); 
    setPlayerAvatarUrlError(null);
    setShowPlayerSetupAvatarUrlInput(false);
  };

  const handleGenerateAiAvatar = async () => {
    if (!aiAvatarPrompt.trim()) {
      setAiAvatarError(VIETNAMESE.aiAvatarPromptRequiredError || "Vui lòng nhập mô tả cho ảnh đại diện.");
      return;
    }
    setIsGeneratingAiAvatar(true);
    setAiAvatarError(null);
    setPlayerAvatarUrlInput(''); 
    setPlayerAvatarUrlError(null);
    setShowPlayerSetupAvatarUrlInput(false); 
    try {
      const imageData = await generateImageUnified(aiAvatarPrompt); 
      if (!imageData) {
        throw new Error("Không nhận được dữ liệu ảnh từ AI.");
      }

      setPlayerAvatarPreviewUrl(imageData); 
      onPlayerAvatarDataChange(imageData); 
      handleChange({ target: { name: 'playerAvatarUrl', value: imageData } } as any);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      setAiAvatarError(`${VIETNAMESE.errorGeneratingAiAvatar} ${errorMessage}`);
    } finally {
      setIsGeneratingAiAvatar(false);
    }
  };

  const handlePlayerSetupAvatarUrlSubmit = async () => {
    if (!playerAvatarUrlInput.trim()) return;
    setIsPlayerAvatarUrlValidating(true);
    setPlayerAvatarUrlError(null);
    const isValid = await isValidImageUrl(playerAvatarUrlInput);
    setIsPlayerAvatarUrlValidating(false);
    if (isValid) {
      setPlayerAvatarPreviewUrl(playerAvatarUrlInput); 
      onPlayerAvatarDataChange(playerAvatarUrlInput);  
      handleChange({ target: { name: 'playerAvatarUrl', value: playerAvatarUrlInput } } as any); 
      setAiAvatarPrompt(''); 
      setAiAvatarError(null);
      if (fileInputRef.current) fileInputRef.current.value = ""; 
      setShowPlayerSetupAvatarUrlInput(false); 
    } else {
      setPlayerAvatarUrlError(VIETNAMESE.avatarUrlInvalid);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-2">
        <div className="flex flex-col gap-2 mb-2">
          <label className="text-sm font-medium text-gray-300">
            {VIETNAMESE.characterName}
          </label>
          <div className="relative">
            <input
              id="playerName"
              name="playerName"
              value={settings.playerName}
              onChange={(e) => {
                handleChange(e);
                setSearchQuery(e.target.value);
                setIsDropdownOpen(true);
              }}
              onFocus={() => setIsDropdownOpen(true)}
              onBlur={() => setTimeout(() => setIsDropdownOpen(false), 200)}
              className="w-full p-3 bg-gray-900 border border-gray-700 rounded-xl text-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all"
              placeholder={VIETNAMESE.characterName}
              autoComplete="off"
            />
            {isDropdownOpen && suggestions.length > 0 && (
              <div className="absolute z-20 w-full mt-1 bg-gray-800 border border-gray-700 rounded-xl shadow-2xl max-h-60 overflow-y-auto custom-scrollbar">
                {suggestions.map((char, idx) => (
                  <div
                    key={idx}
                    className="p-3 hover:bg-gray-700 cursor-pointer border-b border-gray-700 last:border-0 transition-colors"
                    onClick={() => {
                      // Update settings with character data
                      const updates = [
                        { name: 'playerName', value: char.name },
                        { name: 'playerGender', value: char.gender || settings.playerGender },
                        { name: 'playerPersonality', value: char.personality || settings.playerPersonality },
                        { name: 'playerBackstory', value: char.background || settings.playerBackstory },
                        { name: 'playerGoal', value: char.goal || settings.playerGoal },
                        { name: 'playerStartingTraits', value: char.appearance || settings.playerStartingTraits },
                      ];
                      
                      updates.forEach(upd => {
                        handleChange({ target: { name: upd.name, value: upd.value } } as any);
                      });
                      
                      setIsDropdownOpen(false);
                    }}
                  >
                    <div className="font-bold text-indigo-300">{char.name}</div>
                    {char.role && <div className="text-xs text-gray-400 italic">{char.role}</div>}
                  </div>
                ))}
              </div>
            )}
          </div>
          {handleGenerateCharacterFromName && (
            <div className="flex flex-col sm:flex-row gap-2 mt-1">
              <div className="relative flex-1">
                <button
                  type="button"
                  onClick={() => handleGenerateCharacterFromName()}
                  disabled={isGeneratingCharacter || !settings.playerName.trim()}
                  className={`
                    w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl font-bold text-xs sm:text-sm uppercase tracking-wider
                    transition-all duration-300 transform hover:-translate-y-1 active:translate-y-1 active:shadow-none
                    ${isGeneratingCharacter || !settings.playerName.trim() 
                      ? 'bg-slate-800 text-slate-600 cursor-not-allowed border-b-4 border-slate-900 opacity-70' 
                      : 'bg-gradient-to-r from-orange-500 to-yellow-500 text-white shadow-[0_4px_0_#9a3412,0_8px_15px_rgba(249,115,22,0.4)] hover:shadow-[0_4px_0_#9a3412,0_12px_20px_rgba(249,115,22,0.5)] border border-orange-400/30'}
                  `}
                >
                  {isGeneratingCharacter ? (
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    <Sparkles size={16} className="text-white animate-pulse" />
                  )}
                  <span className="drop-shadow-md whitespace-nowrap">
                    {isGeneratingCharacter ? 'ĐANG VIẾT...' : '✨ TỰ ĐỘNG THIẾT LẬP'}
                  </span>
                </button>
                {isGuideOverlayActive && setActiveGuideId && (
                  <GuideMarker id="setup-char-auto" index={11} text="AI sẽ tự động viết tiểu sử và thiết lập chỉ số dựa trên tên nhân vật bạn đã nhập." position="top" activeId={activeGuideId} onToggle={setActiveGuideId} />
                )}
              </div>

              <div className="relative flex-1">
                <button
                  type="button"
                  onClick={() => setIsCustomPromptModalOpen(true)}
                  disabled={isGeneratingCharacter || !settings.playerName.trim()}
                  className={`
                    w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl font-bold text-xs sm:text-sm uppercase tracking-wider
                    transition-all duration-300 transform hover:-translate-y-1 active:translate-y-1 active:shadow-none
                    ${isGeneratingCharacter || !settings.playerName.trim() 
                      ? 'bg-slate-800 text-slate-600 cursor-not-allowed border-b-4 border-slate-900 opacity-70' 
                      : 'bg-gradient-to-r from-emerald-500 to-teal-500 text-white shadow-[0_4px_0_#065f46,0_8px_15px_rgba(16,185,129,0.4)] hover:shadow-[0_4px_0_#065f46,0_12px_20px_rgba(16,185,129,0.5)] border border-emerald-400/30'}
                  `}
                >
                  <PenTool size={16} className="text-white" />
                  <span className="drop-shadow-md whitespace-nowrap">
                    ✍️ VIẾT THEO YÊU CẦU 🪄
                  </span>
                </button>
                {isGuideOverlayActive && setActiveGuideId && (
                  <GuideMarker id="setup-char-custom" index={12} text="Bạn có thể đưa ra yêu cầu cụ thể (ví dụ: 'Nhân vật là một kiếm khách mù') để AI viết theo." position="top" activeId={activeGuideId} onToggle={setActiveGuideId} />
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4">
        <InputField
          label={VIETNAMESE.gender}
          id="playerGender"
          name="playerGender"
          type="select"
          options={['Nam', 'Nữ', 'Khác']}
          value={settings.playerGender}
          onChange={handleChange}
        />
        <InputField
          label={VIETNAMESE.playerRaceLabel || "Chủng Tộc"}
          id="playerRace"
          name="playerRace"
          value={settings.playerRace}
          onChange={handleChange}
          placeholder="Nhân Tộc, Yêu Tộc, Ma Tộc..."
        />
        <InputField
          label={VIETNAMESE.personality}
          id="playerPersonality"
          name="playerPersonality"
          value={settings.playerPersonality}
          onChange={handleChange}
          textarea
        />
        <InputField
          label={VIETNAMESE.backstory}
          id="playerBackstory"
          name="playerBackstory"
          value={settings.playerBackstory}
          onChange={handleChange}
          textarea
          rows={3}
        />
        <InputField
          label="Bối cảnh ban đầu"
          id="initialContext"
          name="initialContext"
          value={settings.initialContext}
          onChange={handleChange}
          textarea
          rows={3}
          placeholder="Mô tả bối cảnh mà câu chuyện bắt đầu (vd: Bạn đang ở trong một hang động, hoặc vừa mới gia nhập tông môn...)"
        />
        <InputField
          label={VIETNAMESE.goal}
          id="playerGoal"
          name="playerGoal"
          value={settings.playerGoal}
          onChange={handleChange}
          textarea
          rows={3}
        />
        <InputField
            label={VIETNAMESE.playerStartingLocationTypeLabel || "Loại Địa Điểm Bắt Đầu"}
            id="playerStartingLocationType"
            name="playerStartingLocationType"
            type="select"
            options={[...STARTING_LOCATION_TYPES]}
            value={settings.playerStartingLocationType || 'Ngẫu nhiên'}
            onChange={handleChange}
        />
        <InputField
          label={VIETNAMESE.startingTraits}
          id="playerStartingTraits"
          name="playerStartingTraits"
          value={settings.playerStartingTraits}
          onChange={handleChange}
          textarea
          placeholder={VIETNAMESE.startingTraits}
        />
        <InputField
          label={VIETNAMESE.currencyName}
          id="currencyName"
          name="currencyName"
          value={settings.currencyName}
          onChange={handleChange}
        />
        <InputField
          label={VIETNAMESE.startingCurrencyLabel}
          id="startingCurrency"
          name="startingCurrency"
          type="number"
          value={settings.startingCurrency}
          onChange={handleChange}
          min={0}
        />
        {/* New fields for Spiritual Root and Special Physique */}
        {settings.isCultivationEnabled && (
          <>
            <InputField
              label={VIETNAMESE.spiritualRootLabel || "Linh Căn"}
              id="playerSpiritualRoot"
              name="playerSpiritualRoot"
              value={settings.playerSpiritualRoot || ''}
              onChange={handleChange}
              placeholder="Vd: Ngũ Hành Tạp Linh Căn, Thiên Linh Căn..."
              disabled={!settings.isCultivationEnabled}
            />
            <InputField
              label={VIETNAMESE.specialPhysiqueLabel || "Thể Chất Đặc Biệt"}
              id="playerSpecialPhysique"
              name="playerSpecialPhysique"
              value={settings.playerSpecialPhysique || ''}
              onChange={handleChange}
              placeholder="Vd: Phàm Thể, Tiên Thiên Đạo Thể..."
              disabled={!settings.isCultivationEnabled}
            />
            <InputField
              label={VIETNAMESE.playerThoNguyenLabel || "Thọ Nguyên Còn Lại"}
              id="playerThoNguyen"
              name="playerThoNguyen"
              type="number"
              value={settings.playerThoNguyen}
              onChange={handleChange}
              min={1}
              disabled={!settings.isCultivationEnabled}
            />
            <InputField
              label={VIETNAMESE.playerMaxThoNguyenLabel || "Thọ Nguyên Tối Đa"}
              id="playerMaxThoNguyen"
              name="playerMaxThoNguyen"
              type="number"
              value={settings.playerMaxThoNguyen}
              onChange={handleChange}
              min={1}
              disabled={!settings.isCultivationEnabled}
            />
          </>
        )}
      </div>

      <fieldset className="border border-gray-700 p-4 rounded-md mt-4">
        <legend className="text-md font-semibold text-gray-300 px-1">{VIETNAMESE.playerAvatarSectionTitle}</legend>
        <div className="mt-2 space-y-3">
          {playerAvatarPreviewUrl && (
            <div className="mb-3 text-center">
              <p className="text-sm text-gray-400 mb-1">{VIETNAMESE.avatarPreviewLabel}</p>
              <img src={playerAvatarPreviewUrl} alt="Player Avatar Preview" className="w-24 h-24 sm:w-32 sm:h-32 rounded-lg object-cover mx-auto border-2 border-indigo-500 shadow-lg" />
            </div>
          )}
          
          <p className="text-xs text-center text-gray-400 italic">
            Avatar mặc định (dựa trên Tên & Giới tính). Bạn có thể tùy chọn bên dưới:
          </p>
           
           <Button
            type="button"
            variant="ghost"
            onClick={() => {
              setShowPlayerSetupAvatarUrlInput(!showPlayerSetupAvatarUrlInput);
              if (!showPlayerSetupAvatarUrlInput && playerAvatarPreviewUrl?.startsWith('http')) {
                setPlayerAvatarUrlInput(playerAvatarPreviewUrl);
              } else if (!showPlayerSetupAvatarUrlInput) {
                setPlayerAvatarUrlInput('');
              }
              setPlayerAvatarUrlError(null);
            }}
            className="w-full text-sm border-cyan-600 hover:bg-cyan-700/50"
            aria-expanded={showPlayerSetupAvatarUrlInput}
            disabled={isGeneratingAiAvatar}
            >
            {showPlayerSetupAvatarUrlInput ? "Đóng Nhập URL" : VIETNAMESE.avatarUrlInputLabel.replace(":", "")}
          </Button>

          {showPlayerSetupAvatarUrlInput && (
            <div className="mt-1.5 p-2 border border-gray-600 rounded-md bg-gray-800/30">
                <InputField
                label=""
                id="playerAvatarUrlInputSetup"
                value={playerAvatarUrlInput} 
                onChange={(e) => setPlayerAvatarUrlInput(e.target.value)}
                placeholder={VIETNAMESE.avatarUrlInputPlaceholder}
                disabled={isGeneratingAiAvatar || isPlayerAvatarUrlValidating}
                className="!mb-1.5"
                />
                <Button
                    type="button"
                    variant="primary"
                    onClick={handlePlayerSetupAvatarUrlSubmit}
                    className="w-full text-xs !py-1"
                    isLoading={isPlayerAvatarUrlValidating}
                    disabled={isGeneratingAiAvatar || isPlayerAvatarUrlValidating || !playerAvatarUrlInput.trim()}
                    loadingText={VIETNAMESE.avatarUrlValidating}
                >
                    {VIETNAMESE.confirmUrlButton}
                </Button>
                {isPlayerAvatarUrlValidating && <Spinner size="sm" text={VIETNAMESE.avatarUrlValidating} className="mt-1 text-xs" />}
                {playerAvatarUrlError && <p className="text-xs text-red-400 mt-1">{playerAvatarUrlError}</p>}
            </div>
          )}


          <div className="space-y-2 pt-2 border-t border-gray-700/50">
            <InputField
              label={VIETNAMESE.aiAvatarPromptLabel}
              id="aiAvatarPrompt"
              value={aiAvatarPrompt}
              onChange={(e) => {
                setAiAvatarPrompt(e.target.value);
                if (aiAvatarError) setAiAvatarError(null);
              }}
              placeholder={VIETNAMESE.aiAvatarPromptPlaceholder}
              disabled={isGeneratingAiAvatar}
              textarea
              rows={4}
            />
            <Button 
              type="button" 
              variant="primary" 
              onClick={handleGenerateAiAvatar} 
              className="w-full bg-purple-600 hover:bg-purple-700 focus:ring-purple-500"
              isLoading={isGeneratingAiAvatar}
              disabled={isGeneratingAiAvatar || !aiAvatarPrompt.trim()}
              loadingText={VIETNAMESE.generatingAiAvatarMessage}
            >
              {VIETNAMESE.generateAiAvatarButtonLabel}
            </Button>
            {isGeneratingAiAvatar && <Spinner size="sm" className="mx-auto mt-2" />}
            {aiAvatarError && <p className="text-xs text-red-400 mt-1 text-center">{aiAvatarError}</p>}
          </div>

          <div className="flex flex-col sm:flex-row gap-2 pt-3 border-t border-gray-700/50 mt-3">
            <Button type="button" variant="secondary" onClick={handleRandomAvatar} className="w-full sm:flex-1" disabled={isGeneratingAiAvatar}>
              {VIETNAMESE.randomAvatarButtonLabel}
            </Button>
            <Button type="button" variant="secondary" onClick={() => fileInputRef.current?.click()} className="w-full sm:flex-1" disabled={isGeneratingAiAvatar}>
              {VIETNAMESE.uploadAvatarButtonLabel}
            </Button>
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleAvatarUpload}
              accept="image/png, image/jpeg, image/webp, image/gif"
              className="hidden"
              disabled={isGeneratingAiAvatar}
            />
          </div>
           {playerAvatarPreviewUrl && (
             <Button type="button" variant="danger" onClick={handleRemoveAvatar} className="w-full mt-2 text-xs" disabled={isGeneratingAiAvatar}>
              {VIETNAMESE.removeUploadedAvatarButtonLabel}
            </Button>
           )}
        </div>
      </fieldset>
      <CustomPromptModal
        isOpen={isCustomPromptModalOpen}
        onClose={() => setIsCustomPromptModalOpen(false)}
        onConfirm={(prompt) => {
          setIsCustomPromptModalOpen(false);
          handleGenerateCharacterFromName?.(prompt);
        }}
        title="Yêu cầu viết nhân vật"
        placeholder="Ví dụ: 'Nhân vật là một kiếm khách cô độc, có vết sẹo dài trên mặt, mục tiêu là báo thù cho gia tộc...'"
        isLoading={isGeneratingCharacter}
      />
    </div>
  );
};

export default CharacterStoryTab;