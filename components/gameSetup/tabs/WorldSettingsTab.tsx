

import React, { ChangeEvent, useState } from 'react';
import { Sparkles, PenTool } from 'lucide-react';
import { WorldSettings, NsfwDescriptionStyle, ViolenceLevel, StoryTone, RaceCultivationSystem } from '../../../types'; // Adjusted path if needed
import InputField from '../../ui/InputField';
import Button from '../../ui/Button';
import CustomPromptModal from '../../ui/CustomPromptModal';
import { GuideMarker } from '../../guide/GuideSystem';
import { VIETNAMESE, AVAILABLE_GENRES, CUSTOM_GENRE_VALUE, NSFW_DESCRIPTION_STYLES, DEFAULT_NSFW_DESCRIPTION_STYLE, VIOLENCE_LEVELS, DEFAULT_VIOLENCE_LEVEL, STORY_TONES, DEFAULT_STORY_TONE } from '../../../constants'; // Adjusted path
import CollapsibleSection from './startingElements/CollapsibleSection';
import { parseRealmString } from '../../../utils/realmParser';
import { RealmSelector } from '../RealmSelector';
import CultivationAutoFiller from '../CultivationAutoFiller';
import { sanitizeTimelineEvents } from '../../../utils/sanitizeUtils';

interface WorldSettingsTabProps {
  settings: WorldSettings;
  handleChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => void;
  onNestedChange: (parent: keyof WorldSettings, field: string, value: any) => void;
  setSimpleField: (key: keyof WorldSettings, value: any) => void;
  handleSetupCultivation: (majors: string[], minors: string[]) => void;
  handleRaceSystemChange: (index: number, field: keyof Omit<RaceCultivationSystem, 'id'>, value: string) => void;
  addRaceSystem: () => void;
  removeRaceSystem: (id: string) => void;
  batchUpdateNPCs: (realmMap: Record<string, string>) => void;
  rawCanonData?: string | null;
  setRawCanonData?: (data: string | null) => void;
  originalStorySummary: string;
  handleOriginalStorySummaryChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
  showOriginalStorySummaryInput: boolean;
  setShowOriginalStorySummaryInput: (value: boolean) => void;
  handleGenerateTimelineEvents: () => void;
  handleAppendTimelineEvents?: () => void;
  isGeneratingTimeline: boolean;
  isAnalyzingWork: boolean;
  handleRewriteWorldSettings: (prompt: string) => void;
  isRewritingWorldSettings: boolean;
  isGuideOverlayActive?: boolean;
  activeGuideId?: string | null;
  setActiveGuideId?: (id: string | null) => void;
  setStreamingText?: (text: string) => void;
  setIsStreamingActive?: (active: boolean) => void;
}

const WorldSettingsTab: React.FC<WorldSettingsTabProps> = ({ 
  settings, 
  handleChange,
  onNestedChange,
  setSimpleField,
  handleSetupCultivation,
  handleRaceSystemChange,
  addRaceSystem,
  removeRaceSystem,
  batchUpdateNPCs,
  rawCanonData,
  setRawCanonData,
  originalStorySummary,
  handleOriginalStorySummaryChange,
  showOriginalStorySummaryInput,
  setShowOriginalStorySummaryInput,
  handleGenerateTimelineEvents,
  handleAppendTimelineEvents,
  isGeneratingTimeline,
  isAnalyzingWork,
  handleRewriteWorldSettings,
  isRewritingWorldSettings,
  isGuideOverlayActive,
  activeGuideId,
  setActiveGuideId,
  setStreamingText,
  setIsStreamingActive
}) => {
  const [isRaceSystemsOpen, setIsRaceSystemsOpen] = useState(true);
  const [isCustomPromptModalOpen, setIsCustomPromptModalOpen] = useState(false);

  // States for adding new timeline event manually
  const [newPeriod, setNewPeriod] = useState('');
  const [newEventName, setNewEventName] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [newLocation, setNewLocation] = useState('');
  const [newCharacters, setNewCharacters] = useState('');
  const [newRequiredAction, setNewRequiredAction] = useState('');

  // States for editing an event
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editPeriod, setEditPeriod] = useState('');
  const [editEventName, setEditEventName] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editLocation, setEditLocation] = useState('');
  const [editCharacters, setEditCharacters] = useState('');
  const [editRequiredAction, setEditRequiredAction] = useState('');

  // Logic handlers for Timeline Events
  const handleAddTimelineEvent = () => {
    if (!newEventName.trim() || !newDescription.trim()) return;
    const charsArray = newCharacters.trim() ? newCharacters.split(',').map(c => c.trim()).filter(Boolean) : [];
    const newEvent = {
      id: `manual_event_${Date.now()}`,
      periodName: newPeriod.trim() || 'Chưa phân loại',
      eventName: newEventName.trim(),
      description: newDescription.trim(),
      location: newLocation.trim() || undefined,
      characters: charsArray.length > 0 ? charsArray : undefined,
      requiredAction: newRequiredAction.trim() || undefined
    };
    const currentEvents = settings.timelineEvents || [];
    setSimpleField('timelineEvents', [...currentEvents, newEvent]);
    setNewPeriod('');
    setNewEventName('');
    setNewDescription('');
    setNewLocation('');
    setNewCharacters('');
    setNewRequiredAction('');
  };

  const handleDeleteTimelineEvent = (indexToDelete: number) => {
    const currentEvents = settings.timelineEvents || [];
    const updated = currentEvents.filter((_, idx) => idx !== indexToDelete);
    setSimpleField('timelineEvents', updated);
    if (editingIndex === indexToDelete) {
      setEditingIndex(null);
    } else if (editingIndex !== null && editingIndex > indexToDelete) {
      setEditingIndex(editingIndex - 1);
    }
  };

  const handleMoveTimelineEvent = (index: number, direction: 'up' | 'down') => {
    const currentEvents = settings.timelineEvents || [];
    if (direction === 'up' && index === 0) return;
    if (direction === 'down' && index === currentEvents.length - 1) return;
    
    const updated = [...currentEvents];
    const swapTarget = direction === 'up' ? index - 1 : index + 1;
    [updated[index], updated[swapTarget]] = [updated[swapTarget], updated[index]];
    
    setSimpleField('timelineEvents', updated);
    if (editingIndex === index) setEditingIndex(swapTarget);
    else if (editingIndex === swapTarget) setEditingIndex(index);
  };

  const handleStartEdit = (index: number) => {
    const event = (settings.timelineEvents || [])[index];
    if (!event) return;
    setEditingIndex(index);
    setEditPeriod(event.periodName);
    setEditEventName(event.eventName);
    setEditDescription(event.description);
    setEditLocation(event.location || '');
    setEditCharacters(event.characters ? event.characters.join(', ') : '');
    setEditRequiredAction(event.requiredAction || '');
  };

  const handleSaveEdit = (index: number) => {
    const currentEvents = settings.timelineEvents || [];
    if (!currentEvents[index]) return;
    if (!editEventName.trim() || !editDescription.trim()) return;
    
    const charsArray = editCharacters.trim() ? editCharacters.split(',').map(c => c.trim()).filter(Boolean) : [];
    const updated = [...currentEvents];
    updated[index] = {
      ...updated[index],
      periodName: editPeriod.trim() || 'Chưa phân loại',
      eventName: editEventName.trim(),
      description: editDescription.trim(),
      location: editLocation.trim() || undefined,
      characters: charsArray.length > 0 ? charsArray : undefined,
      requiredAction: editRequiredAction.trim() || undefined
    };
    
    setSimpleField('timelineEvents', updated);
    setEditingIndex(null);
  };

  // Helper to create options for select, ensuring labels are correctly fetched from VIETNAMESE
  const createSelectOptions = <T extends string>(
    stylesArray: readonly T[],
    defaultStyle: T,
    labelPrefixKey: 'nsfwStyle' | 'violenceLevel' | 'storyTone'
  ): Array<{ value: T; label: string }> => {
    return stylesArray.map(style => {
      // Construct the key for VIETNAMESE object, e.g., nsfwStyleHoaMy, violenceLevelNheNhang
      // Sanitize style string to match potential VIETNAMESE keys (remove spaces, parentheses, etc.)
      const styleKeyPart = style
        .normalize("NFD").replace(/[\u0300-\u036f]/g, "") // Remove diacritics
        .replace(/\s+/g, '') // Remove spaces
        .replace(/[()'+]/g, ''); // Remove parentheses and other special chars like +
      const labelKey = `${labelPrefixKey}${styleKeyPart}` as keyof typeof VIETNAMESE;
      const labelValue = VIETNAMESE[labelKey];
      return { value: style, label: (typeof labelValue === 'string' ? labelValue : style) };
    });
  };

  const nsfwStyleOptions = createSelectOptions(NSFW_DESCRIPTION_STYLES, DEFAULT_NSFW_DESCRIPTION_STYLE, 'nsfwStyle');
  const violenceLevelOptions = createSelectOptions(VIOLENCE_LEVELS, DEFAULT_VIOLENCE_LEVEL, 'violenceLevel');
  const storyToneOptions = createSelectOptions(STORY_TONES, DEFAULT_STORY_TONE, 'storyTone');

  const handleSetupCultivationAction = () => {
    // Chỉ cần gọi hàm handleSetupCultivation từ prop
    // Logic parsing và cập nhật state đã được hook useCultivationSystemActions xử lý
    handleSetupCultivation([], []); // Tham số truyền vào không còn quan trọng vì hook sẽ lấy trực tiếp từ settings
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row gap-3 mb-2">
        <div className="relative flex-1">
          <Button 
            variant="primary" 
            onClick={handleGenerateTimelineEvents} 
            disabled={isGeneratingTimeline || isRewritingWorldSettings}
            className="w-full h-12 shadow-lg shadow-indigo-500/20 active:translate-y-0.5 transition-all text-xs sm:text-sm font-bold uppercase tracking-wider"
            isLoading={isGeneratingTimeline}
          >
            <Sparkles className="w-4 h-4 mr-2" />
            ✨ Tự Động Phân Tích Timeline
          </Button>
          {isGuideOverlayActive && setActiveGuideId && (
            <GuideMarker id="setup-world-timeline" index={13} text="AI sẽ phân tích dữ liệu nguyên tác để tự động lập ra dòng thời gian các sự kiện chính." position="top" activeId={activeGuideId} onToggle={setActiveGuideId} />
          )}
        </div>

        <div className="relative flex-1">
          <Button 
            variant="secondary"
            onClick={() => setIsCustomPromptModalOpen(true)}
            disabled={isRewritingWorldSettings || isGeneratingTimeline}
            className="w-full h-12 border-2 border-purple-500/50 hover:border-purple-400 bg-purple-500/10 hover:bg-purple-500/20 text-purple-300 text-xs sm:text-sm font-bold uppercase tracking-wider transition-all"
          >
            <PenTool className="w-4 h-4 mr-2" />
            ✍️ Viết Theo Yêu Cầu 🪄
          </Button>
          {isGuideOverlayActive && setActiveGuideId && (
            <GuideMarker id="setup-world-custom" index={14} text="Bạn có thể yêu cầu AI viết lại bối cảnh thế giới theo ý muốn (ví dụ: 'Thế giới này là mạt thế')." position="top" activeId={activeGuideId} onToggle={setActiveGuideId} />
          )}
        </div>
      </div>

      <CustomPromptModal
        isOpen={isCustomPromptModalOpen}
        onClose={() => setIsCustomPromptModalOpen(false)}
        onConfirm={(prompt) => {
          setIsCustomPromptModalOpen(false);
          handleRewriteWorldSettings(prompt);
        }}
        title="✨ Viết Lại Thiết Lập Thế Giới 🌍"
        placeholder="Ví dụ: 'Thay đổi tông màu câu chuyện sang u tối hơn', 'Viết lại tóm tắt cốt truyện tập trung vào cuộc chiến giữa 2 bang hội', 'Thêm hệ thống tu luyện kiểu pháp sư phương tây'..."
        isLoading={isRewritingWorldSettings}
      />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4">
      <InputField
        label={VIETNAMESE.saveGameNameLabel}
        id="saveGameNameTabWorldSettings" // Unique ID
        name="saveGameName"
        value={settings.saveGameName}
        onChange={handleChange}
        placeholder={settings.playerName ? VIETNAMESE.saveGameNamePlaceholder.replace("[Tên Nhân Vật]", settings.playerName) : VIETNAMESE.saveGameNamePlaceholder.replace(" [Tên Nhân Vật]", "")}
      />
      <InputField 
        label={VIETNAMESE.worldTheme} 
        id="themeTabWorldSettings" // Unique ID
        name="theme" 
        value={settings.theme} 
        onChange={handleChange} 
      />
      <InputField 
        label={VIETNAMESE.genreLabel} 
        id="genreTabWorldSettings" // Unique ID
        name="genre" 
        type="select" 
        options={AVAILABLE_GENRES as unknown as string[]} 
        value={settings.genre} 
        onChange={handleChange} 
      />
      {settings.genre === CUSTOM_GENRE_VALUE && (
        <InputField
          label={VIETNAMESE.customGenreNameLabel}
          id="customGenreNameTabWorldSettings" // Unique ID
          name="customGenreName"
          value={settings.customGenreName || ''}
          onChange={handleChange}
          placeholder={VIETNAMESE.customGenreNamePlaceholder}
        />
      )}
      <InputField 
        label={VIETNAMESE.worldSetting} 
        id="settingDescriptionTabWorldSettings" // Unique ID
        name="settingDescription" 
        value={settings.settingDescription} 
        onChange={handleChange} 
        textarea 
        rows={3} 
      />
      <InputField 
        label={VIETNAMESE.writingStyle} 
        id="writingStyleTabWorldSettings" // Unique ID
        name="writingStyle" 
        value={settings.writingStyle || ''} 
        onChange={handleChange} 
        textarea 
        rows={3}
        placeholder="Ví dụ: Văn phong hào sảng, kiếm khí bức người, hoặc u ám, huyền bí..."
      />
      <InputField 
        label={VIETNAMESE.difficultyLabel} 
        id="difficultyTabWorldSettings" // Unique ID
        name="difficulty" 
        type="select" 
        options={['Dễ', 'Thường', 'Khó', 'Ác Mộng']} 
        value={settings.difficulty} 
        onChange={handleChange} 
      />
      
      {/* Starting Date */}
      <div className="md:col-span-2 grid grid-cols-3 gap-x-4 border-t border-gray-700 pt-4 mt-2">
        <InputField
            label="Ngày Bắt Đầu"
            id="startingDay"
            name="startingDate.day"
            type="number"
            value={settings.startingDate.day}
            onChange={handleChange}
            min={1}
            max={30}
        />
        <InputField
            label="Tháng Bắt Đầu"
            id="startingMonth"
            name="startingDate.month"
            type="number"
            value={settings.startingDate.month}
            onChange={handleChange}
            min={1}
            max={12}
        />
        <InputField
            label="Năm Bắt Đầu"
            id="startingYear"
            name="startingDate.year"
            type="number"
            value={settings.startingDate.year}
            onChange={handleChange}
            min={1}
        />
      </div>

      {/* NSFW Settings Section */}
      <div className="md:col-span-2 border-t border-gray-700 pt-4">
        <InputField
          label={VIETNAMESE.nsfwModeLabel}
          id="nsfwModeWorldSettingsTab" // Unique ID for this tab
          name="nsfwMode"
          type="checkbox"
          checked={settings.nsfwMode || false}
          onChange={handleChange}
          className="mb-3" // Add some margin below the checkbox
        />
        {settings.nsfwMode && (
          <div className="pl-4 mt-1 space-y-3 border-l-2 border-red-500/50 rounded-r-md bg-gray-800/20 py-3"> {/* Visual grouping for NSFW sub-settings */}
            <InputField
              label={VIETNAMESE.nsfwDescriptionStyleLabel}
              id="nsfwDescriptionStyleWorldSettingsTab"
              name="nsfwDescriptionStyle"
              type="select"
              options={nsfwStyleOptions.map(opt => opt.label)} // Pass labels for display
              value={nsfwStyleOptions.find(opt => opt.value === (settings.nsfwDescriptionStyle || DEFAULT_NSFW_DESCRIPTION_STYLE))?.label || nsfwStyleOptions[0].label}
              onChange={(e) => {
                const selectedLabel = e.target.value;
                // Find the actual value corresponding to the selected label
                const selectedValue = nsfwStyleOptions.find(opt => opt.label === selectedLabel)?.value || DEFAULT_NSFW_DESCRIPTION_STYLE;
                handleChange({ target: { name: 'nsfwDescriptionStyle', value: selectedValue } } as any);
              }}
            />
            <InputField
              label={VIETNAMESE.violenceLevelLabel}
              id="violenceLevelWorldSettingsTab"
              name="violenceLevel"
              type="select"
              options={violenceLevelOptions.map(opt => opt.label)}
              value={violenceLevelOptions.find(opt => opt.value === (settings.violenceLevel || DEFAULT_VIOLENCE_LEVEL))?.label || violenceLevelOptions[1].label}
              onChange={(e) => {
                  const selectedLabel = e.target.value;
                  const selectedValue = violenceLevelOptions.find(opt => opt.label === selectedLabel)?.value || DEFAULT_VIOLENCE_LEVEL;
                  handleChange({ target: { name: 'violenceLevel', value: selectedValue } } as any);
              }}
            />
            <InputField
              label={VIETNAMESE.storyToneLabel}
              id="storyToneWorldSettingsTab"
              name="storyTone"
              type="select"
              options={storyToneOptions.map(opt => opt.label)}
              value={storyToneOptions.find(opt => opt.value === (settings.storyTone || DEFAULT_STORY_TONE))?.label || storyToneOptions[1].label}
              onChange={(e) => {
                  const selectedLabel = e.target.value;
                  const selectedValue = storyToneOptions.find(opt => opt.label === selectedLabel)?.value || DEFAULT_STORY_TONE;
                  handleChange({ target: { name: 'storyTone', value: selectedValue } } as any);
              }}
            />
          </div>
        )}
      </div>
      
      <div className="md:col-span-2 border-t border-gray-700 pt-4 mt-2">
        <InputField 
          label={VIETNAMESE.enableCultivationSystemLabel} 
          id="isCultivationEnabledTabWorldSettings" // Unique ID
          name="isCultivationEnabled" 
          type="checkbox" 
          checked={settings.isCultivationEnabled} 
          onChange={handleChange} 
        />
        {settings.isCultivationEnabled && (
          <div className="space-y-4 pl-4 border-l-2 border-sky-700/50 mt-2">
            
            <div className="p-4 bg-indigo-900/10 border border-indigo-500/20 rounded-lg space-y-4 mb-4">
              <h4 className="text-sm font-bold text-indigo-400 uppercase tracking-wider">Thiết Lập Hệ Thống Tu Luyện</h4>
              
              <CultivationAutoFiller 
                worldContext={settings.settingDescription} 
                npcs={settings.startingNPCs || []}
                isStrictGrounding={settings.isStrictGrounding}
                remoteCanonUrl={settings.remoteCanonUrl}
                rawCanonData={rawCanonData}
                onGenerated={(major, minor) => {
                  onNestedChange('cultivationSystem', 'majorRealmsRaw', major);
                  onNestedChange('cultivationSystem', 'minorRealmsRaw', minor);
                  if (setSimpleField) {
                    setSimpleField('raceCultivationSystems', [
                      { id: 'human-default-' + Date.now(), raceName: 'Nhân Tộc', realmSystem: major },
                      ...(settings.raceCultivationSystems || []).filter(s => s.raceName !== 'Nhân Tộc')
                    ]);
                  }
                }}
                onNestedChange={onNestedChange}
                setSimpleField={setSimpleField}
                batchUpdateNPCs={batchUpdateNPCs}
                setStreamingText={setStreamingText}
                setIsStreamingActive={setIsStreamingActive}
              />

              <div className="space-y-2">
                <label className="block text-xs font-medium text-gray-400">Đại Cảnh Giới (VD: Luyện Khí - Trúc Cơ - Kim Đan)</label>
                <textarea
                  value={settings.cultivationSystem.majorRealmsRaw}
                  onChange={(e) => onNestedChange('cultivationSystem', 'majorRealmsRaw', e.target.value)}
                  className="w-full p-2 bg-gray-800 border border-gray-700 rounded text-sm text-gray-100 focus:border-indigo-500 focus:outline-none"
                  rows={2}
                  placeholder="Luyện Khí - Trúc Cơ - Kim Đan..."
                />
              </div>

              <div className="space-y-2">
                <label className="block text-xs font-medium text-gray-400">Tiểu Cảnh Giới (VD: 1 Tầng - 9 Tầng)</label>
                <input
                  type="text"
                  value={settings.cultivationSystem.minorRealmsRaw}
                  onChange={(e) => onNestedChange('cultivationSystem', 'minorRealmsRaw', e.target.value)}
                  className="w-full p-2 bg-gray-800 border border-gray-700 rounded text-sm text-gray-100 focus:border-indigo-500 focus:outline-none"
                  placeholder="1 Tầng - 9 Tầng hoặc Sơ Kỳ - Trung Kỳ - Hậu Kỳ"
                />
              </div>

              <Button 
                onClick={handleSetupCultivationAction}
                variant="primary"
                className="w-full"
                size="sm"
              >
                Thiết Lập & Cập Nhật Hệ Thống
              </Button>
            </div>

            <RealmSelector
              label={VIETNAMESE.startingRealmLabel}
              id="canhGioiKhoiDauTabWorldSettings"
              value={settings.canhGioiKhoiDau}
              onChange={(val) => handleChange({ target: { name: 'canhGioiKhoiDau', value: val } } as any)}
              majorOptions={settings.cultivationSystem.parsedMajors}
              minorOptions={settings.cultivationSystem.parsedMinors}
              isReady={settings.cultivationSystem.isReady}
            />
          </div>
        )}
        {!settings.isCultivationEnabled && (
          <p className="text-sm text-gray-400 italic">{VIETNAMESE.cultivationSystemDisabledNote}</p>
        )}
      </div>
      
      {/* Original story summary & Timeline (Lịch sử) */}
      <div className="md:col-span-2 border-t border-gray-700 pt-4 mt-2">
        <Button
          onClick={() => setShowOriginalStorySummaryInput(!showOriginalStorySummaryInput)}
          variant="ghost"
          className="text-sm text-gray-400 hover:text-gray-200 mb-2"
        >
          {showOriginalStorySummaryInput ? `Ẩn Tóm Tắt Cốt Truyện Nguyên Tác` : `Thêm/Sửa Tóm Tắt Cốt Truyện Nguyên Tác`}
        </Button>
        {showOriginalStorySummaryInput && (
          <>
            <InputField
              label={`${VIETNAMESE.originalStorySummaryLabel}${isAnalyzingWork && !originalStorySummary ? " (AI đang tạo...)" : ""}`}
              id="originalStorySummary"
              name="originalStorySummary"
              value={originalStorySummary}
              onChange={handleOriginalStorySummaryChange}
              textarea
              rows={8}
              placeholder={VIETNAMESE.originalStorySummaryPlaceholder}
              disabled={isAnalyzingWork && !originalStorySummary}
            />
            
            <div className="mt-4 p-4 border border-indigo-700/50 bg-indigo-900/10 rounded-lg">
               <div className="flex justify-between items-center mb-3">
                   <h4 className="text-md font-semibold text-indigo-300">Dòng Thời Gian Nguyên Tác (Lịch Sử)</h4>
                   <div className="flex items-center gap-2">
                       {handleAppendTimelineEvents && (
                           <Button
                              onClick={handleAppendTimelineEvents}
                              isLoading={isGeneratingTimeline}
                              disabled={isGeneratingTimeline || !settings.timelineEvents || settings.timelineEvents.length === 0}
                              size="sm"
                              variant="secondary"
                              className="bg-emerald-600 hover:bg-emerald-700 text-white font-medium border border-emerald-500/50"
                              title="Gửi 5 sự kiện cuối cùng để tạo nối tiếp 10 sự kiện tiếp theo"
                           >
                              Thêm Sự Kiện (+10)
                           </Button>
                       )}
                       <Button
                          onClick={handleGenerateTimelineEvents}
                          isLoading={isGeneratingTimeline}
                          disabled={isGeneratingTimeline || !originalStorySummary.trim()}
                          size="sm"
                          variant="primary"
                          className="bg-indigo-600 hover:bg-indigo-700"
                       >
                          Tạo Lại Lịch Sử Theo Nguyên Tác
                       </Button>
                   </div>
               </div>
               
               {settings.timelineEvents && settings.timelineEvents.length > 0 ? (
                  <div className="space-y-3 max-h-96 overflow-y-auto custom-scrollbar mb-4 pr-1">
                     {settings.timelineEvents.map((evt, idx) => (
                         <div key={evt.id || idx} className="p-3 bg-gray-800/80 rounded border border-gray-700 text-sm flex flex-col gap-2 relative">
                            {editingIndex === idx ? (
                                <div className="space-y-3 bg-gray-900/50 p-2 rounded border border-gray-700">
                                   <div className="grid grid-cols-2 gap-2">
                                      <div>
                                         <label className="text-xs text-gray-400 block mb-1">Thời kỳ</label>
                                         <input 
                                            type="text" 
                                            value={editPeriod} 
                                            onChange={(e) => setEditPeriod(e.target.value)}
                                            className="w-full bg-gray-800 text-gray-100 border border-gray-600 rounded px-2 py-1 text-xs focus:ring-1 focus:ring-indigo-500"
                                         />
                                      </div>
                                      <div>
                                         <label className="text-xs text-gray-400 block mb-1">Tên sự kiện</label>
                                         <input 
                                            type="text" 
                                            value={editEventName} 
                                            onChange={(e) => setEditEventName(e.target.value)}
                                            className="w-full bg-gray-800 text-gray-100 border border-gray-600 rounded px-2 py-1 text-xs focus:ring-1 focus:ring-indigo-500"
                                         />
                                      </div>
                                   </div>
                                   <div className="grid grid-cols-2 gap-2">
                                      <div>
                                         <label className="text-xs text-gray-400 block mb-1">📍 Địa điểm (tùy chọn)</label>
                                         <input 
                                            type="text" 
                                            value={editLocation} 
                                            onChange={(e) => setEditLocation(e.target.value)}
                                            className="w-full bg-gray-800 text-gray-100 border border-gray-600 rounded px-2 py-1 text-xs focus:ring-1 focus:ring-indigo-500"
                                         />
                                      </div>
                                      <div>
                                         <label className="text-xs text-gray-400 block mb-1">👥 Nhân vật (phân cách bằng dấu phẩy)</label>
                                         <input 
                                            type="text" 
                                            value={editCharacters} 
                                            onChange={(e) => setEditCharacters(e.target.value)}
                                            className="w-full bg-gray-800 text-gray-100 border border-gray-600 rounded px-2 py-1 text-xs focus:ring-1 focus:ring-indigo-500"
                                         />
                                      </div>
                                   </div>
                                   <div>
                                      <label className="text-xs text-gray-400 block mb-1">🎯 Hành động / mục tiêu mấu chốt để hệ thống chuyển cảnh (tùy chọn)</label>
                                      <input 
                                         type="text" 
                                         value={editRequiredAction} 
                                         onChange={(e) => setEditRequiredAction(e.target.value)}
                                         className="w-full bg-gray-800 text-gray-100 border border-gray-600 rounded px-2 py-1 text-xs focus:ring-1 focus:ring-indigo-500"
                                      />
                                   </div>
                                   <div>
                                      <label className="text-xs text-gray-400 block mb-1">Mô tả sự kiện</label>
                                      <textarea 
                                         value={editDescription} 
                                         onChange={(e) => setEditDescription(e.target.value)}
                                         rows={3}
                                         className="w-full bg-gray-800 text-gray-100 border border-gray-600 rounded px-2 py-1 text-xs focus:ring-1 focus:ring-indigo-500"
                                      />
                                   </div>
                                   <div className="flex justify-end gap-2">
                                      <Button 
                                         onClick={() => setEditingIndex(null)}
                                         variant="ghost" 
                                         size="sm"
                                         className="text-xs px-2 py-1"
                                      >
                                         Hủy
                                      </Button>
                                      <Button 
                                         onClick={() => handleSaveEdit(idx)}
                                         variant="primary" 
                                         size="sm"
                                         className="text-xs bg-green-600 hover:bg-green-700 px-3 py-1"
                                      >
                                         Lưu
                                      </Button>
                                   </div>
                                </div>
                            ) : (
                                <>
                                   <div className="flex justify-between items-start gap-4">
                                      <div className="flex-1">
                                         <div className="text-xs text-indigo-400 font-bold mb-1">Thời kỳ: {evt.periodName}</div>
                                         <div className="text-gray-200 font-medium mb-1">{idx + 1}. {evt.eventName}</div>
                                         <div className="text-gray-400 text-xs leading-relaxed mb-1">{evt.description}</div>
                                         
                                         {/* Story Stage Machine metadata display */}
                                         <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1 text-[11px] border-t border-gray-700/50 pt-2 mt-2">
                                            {evt.location && (
                                               <div className="text-gray-400"><span className="text-indigo-400 font-medium">📍 Địa điểm:</span> {evt.location}</div>
                                            )}
                                            {evt.characters && evt.characters.length > 0 && (
                                               <div className="text-gray-400"><span className="text-amber-400 font-medium">👥 Nhân vật:</span> {evt.characters.join(', ')}</div>
                                            )}
                                         </div>
                                         {evt.requiredAction && (
                                            <div className="text-[11px] text-emerald-400 mt-2 bg-emerald-950/20 p-2 rounded border border-emerald-900/30">
                                               <span className="font-semibold text-emerald-300">🎯 Hành động cốt lõi hoàn thành:</span> {evt.requiredAction}
                                            </div>
                                         )}
                                      </div>
                                      
                                      {/* Event list actions */}
                                      <div className="flex items-center gap-1 shrink-0 bg-gray-900/40 p-1 rounded border border-gray-700/50">
                                         <button 
                                            onClick={() => handleMoveTimelineEvent(idx, 'up')}
                                            disabled={idx === 0}
                                            title="Di chuyển lên"
                                            className="p-1 text-gray-400 hover:text-indigo-400 disabled:opacity-30 disabled:hover:text-gray-400 transition-colors"
                                         >
                                            ▲
                                         </button>
                                         <button 
                                            onClick={() => handleMoveTimelineEvent(idx, 'down')}
                                            disabled={idx === (settings.timelineEvents?.length || 0) - 1}
                                            title="Di chuyển xuống"
                                            className="p-1 text-gray-400 hover:text-indigo-400 disabled:opacity-30 disabled:hover:text-gray-400 transition-colors"
                                         >
                                            ▼
                                         </button>
                                         <span className="w-px h-4 bg-gray-700 mx-0.5" />
                                         <button 
                                            onClick={() => handleStartEdit(idx)}
                                            title="Sửa sự kiện"
                                            className="px-1.5 py-0.5 text-xs text-yellow-400 hover:bg-yellow-500/10 rounded transition-colors"
                                         >
                                            Sửa
                                         </button>
                                         <button 
                                            onClick={() => handleDeleteTimelineEvent(idx)}
                                            title="Xóa sự kiện"
                                            className="px-1.5 py-0.5 text-xs text-red-400 hover:bg-red-500/10 rounded transition-colors"
                                         >
                                            Xóa
                                         </button>
                                      </div>
                                   </div>
                                </>
                            )}
                         </div>
                     ))}
                  </div>
               ) : (
                  <div className="p-4 text-center text-sm text-gray-500 italic bg-gray-800/30 rounded border border-gray-800 border-dashed mb-4">
                      Chưa có sự kiện lịch sử nào. Hệ thống sẽ tự tạo nếu bạn "Phân Tích & Tạo Đồng Nhân", hoặc bạn có thể tự bấm nút "Tạo Lại Lịch Sử" ở trên.
                  </div>
               )}

               {/* Add Manual Event Form */}
               <div className="p-3 bg-gray-955/40 border border-gray-700/50 rounded-lg bg-gray-900/20">
                  <h5 className="text-xs font-bold text-gray-300 mb-2 uppercase tracking-wide">Thêm Sự Kiện Thủ Công Tự Định Nghĩa</h5>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mb-2">
                     <div>
                        <input 
                           type="text"
                           placeholder="Tên thời kỳ (Ví dụ: Thất Huyền Môn)"
                           value={newPeriod}
                           onChange={(e) => setNewPeriod(e.target.value)}
                           className="w-full bg-gray-800/80 text-gray-100 placeholder-gray-500 border border-gray-700 rounded px-3 py-1.5 text-xs focus:ring-1 focus:ring-indigo-500"
                        />
                     </div>
                     <div>
                        <input 
                           type="text"
                           placeholder="Tên sự kiện quan trọng (bắt buộc)"
                           value={newEventName}
                           onChange={(e) => setNewEventName(e.target.value)}
                           className="w-full bg-gray-800/80 text-gray-100 placeholder-gray-500 border border-gray-700 rounded px-3 py-1.5 text-xs focus:ring-1 focus:ring-indigo-500"
                        />
                     </div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mb-2">
                     <div>
                        <input 
                           type="text"
                           placeholder="📍 Địa điểm diễn ra (tùy chọn - Ví dụ: Số 4 Privet Drive)"
                           value={newLocation}
                           onChange={(e) => setNewLocation(e.target.value)}
                           className="w-full bg-gray-800/80 text-gray-100 placeholder-gray-500 border border-gray-700 rounded px-3 py-1.5 text-xs focus:ring-1 focus:ring-indigo-500"
                        />
                     </div>
                     <div>
                        <input 
                           type="text"
                           placeholder="👥 Nhân vật tham gia (phân cách bằng dấu phẩy - Ví dụ: Hàn Lập, Lịch Phi Vũ)"
                           value={newCharacters}
                           onChange={(e) => setNewCharacters(e.target.value)}
                           className="w-full bg-gray-800/80 text-gray-100 placeholder-gray-500 border border-gray-700 rounded px-3 py-1.5 text-xs focus:ring-1 focus:ring-indigo-500"
                        />
                     </div>
                  </div>
                  <div className="mb-2">
                     <input 
                        type="text"
                        placeholder="🎯 Hành động / mục tiêu mấu chốt để hệ thống chuyển cảnh (Ví dụ: bái sư thành công)"
                        value={newRequiredAction}
                        onChange={(e) => setNewRequiredAction(e.target.value)}
                        className="w-full bg-gray-800/80 text-gray-100 placeholder-gray-500 border border-gray-700 rounded px-3 py-1.5 text-xs focus:ring-1 focus:ring-indigo-500"
                     />
                  </div>
                  <div className="mb-2">
                     <textarea
                        placeholder="Mô tả sự kiện, bối cảnh đang xảy ra chuyện gì, các nhân vật chính đang làm gì (bắt buộc)..."
                        value={newDescription}
                        onChange={(e) => setNewDescription(e.target.value)}
                        rows={2}
                        className="w-full bg-gray-800/80 text-gray-100 placeholder-gray-500 border border-gray-700 rounded px-3 py-1.5 text-xs focus:ring-1 focus:ring-indigo-500"
                     />
                  </div>
                  <div className="flex justify-end">
                     <Button
                        onClick={handleAddTimelineEvent}
                        disabled={!newEventName.trim() || !newDescription.trim()}
                        size="sm"
                        variant="secondary"
                        className="text-xs px-4 py-1.5 bg-gray-750 hover:bg-gray-700 text-indigo-300"
                     >
                        + Thêm Vào Dòng Thời Gian
                     </Button>
                  </div>
               </div>
            </div>
          </>
        )}
      </div>
    </div>
  </div>
  );
};

export default WorldSettingsTab;