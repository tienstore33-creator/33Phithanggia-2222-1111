import React, { ChangeEvent, useRef } from 'react';
import { WorldSettings, GenreType, NsfwDescriptionStyle, ViolenceLevel, StoryTone } from '../../../types';
import Button from '../../ui/Button';
import InputField from '../../ui/InputField';
import { VIETNAMESE, MAX_TOKENS_FANFIC, CUSTOM_GENRE_VALUE, NSFW_DESCRIPTION_STYLES, VIOLENCE_LEVELS, STORY_TONES, DEFAULT_NSFW_DESCRIPTION_STYLE, DEFAULT_VIOLENCE_LEVEL, DEFAULT_STORY_TONE } from '../../../constants';
import { GuideMarker } from '../../guide/GuideSystem';

interface AIAssistTabProps {
  settings: WorldSettings; 
  handleChange: (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => void;
  storyIdea: string;
  setStoryIdea: (value: string) => void;
  handleGenerateFromStoryIdea: () => void;
  isGeneratingDetails: boolean;
  handleGenerateCompletion: () => void; // NEW PROP
  isGeneratingCompletion: boolean; // NEW PROP

  fanficSourceType: 'name' | 'file';
  setFanficSourceType: (value: 'name' | 'file') => void;
  fanficStoryName: string;
  setFanficStoryName: (value: string) => void;
  fanficFile: File | null;
  handleFanficFileChange: (e: ChangeEvent<HTMLInputElement>) => void;
  fanficTokenCount: number | null;
  isLoadingTokens: boolean;
  fanficPlayerDescription: string;
  setFanficPlayerDescription: (value: string) => void;

  // NEW PROPS
  handleAnalyzeWork: (workTitle: string) => void;
  isAnalyzingWork: boolean;
  handleStressTest: () => Promise<void>;
  isStressTesting: boolean;
  stressTestProgress: number;
  stressTestResults: string[];
  handleGenerateTimelineEvents: () => void;
  isGeneratingTimeline: boolean;
  availableWorks: string[];
  onOpenWorkSelectionModal: () => void;
  originalStorySummary: string;
  handleOriginalStorySummaryChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
  showOriginalStorySummaryInput: boolean; 
  setShowOriginalStorySummaryInput: (show: boolean) => void;
  fanficFileInputRef: React.RefObject<HTMLInputElement | null>;

  isGuideOverlayActive?: boolean;
  activeGuideId?: string | null;
  setActiveGuideId?: (id: string | null) => void;
}

const AIAssistTab: React.FC<AIAssistTabProps> = ({
  settings,
  handleChange,
  storyIdea, setStoryIdea,
  handleGenerateFromStoryIdea, isGeneratingDetails,
  handleGenerateCompletion, isGeneratingCompletion, // Destructure new props
  fanficSourceType, setFanficSourceType,
  fanficStoryName, setFanficStoryName,
  fanficFile, handleFanficFileChange,
  fanficTokenCount, isLoadingTokens,
  fanficPlayerDescription, setFanficPlayerDescription,
  handleAnalyzeWork, isAnalyzingWork, 
  handleStressTest, isStressTesting, stressTestProgress, stressTestResults,
  availableWorks, onOpenWorkSelectionModal, // Destructure new props
  fanficFileInputRef,
  isGuideOverlayActive,
  activeGuideId,
  setActiveGuideId
}) => {

  const nsfwStyleOptions: Array<{ value: NsfwDescriptionStyle; label: string }> = NSFW_DESCRIPTION_STYLES.map(style => {
    const labelKey = `nsfwStyle${style.replace(/\s+/g, '')}` as keyof typeof VIETNAMESE;
    const labelValue = VIETNAMESE[labelKey];
    return { value: style, label: (typeof labelValue === 'string' ? labelValue : style) };
  });

  const violenceLevelOptions: Array<{ value: ViolenceLevel; label: string }> = VIOLENCE_LEVELS.map(level => {
    const labelKey = `violenceLevel${level.replace(/\s+/g, '')}` as keyof typeof VIETNAMESE;
    const labelValue = VIETNAMESE[labelKey];
    return { value: level, label: (typeof labelValue === 'string' ? labelValue : level) };
  });

  const storyToneOptions: Array<{ value: StoryTone; label: string }> = STORY_TONES.map(tone => {
    const labelKey = `storyTone${tone.replace(/\s+/g, '')}` as keyof typeof VIETNAMESE;
    const labelValue = VIETNAMESE[labelKey];
    return { value: tone, label: (typeof labelValue === 'string' ? labelValue : tone) };
  });

  return (
    <div className="space-y-6">
      <fieldset className="border border-orange-700 p-4 rounded-md bg-orange-900/10">
        <legend className="text-lg font-semibold text-orange-300 px-2">AI Hỗ Trợ Khởi Tạo (Phân Tích & Đồng Nhân)</legend>
        <p className="text-sm text-gray-400 mb-3">
          Chọn một tác phẩm có sẵn hoặc nhập ý tưởng của bạn. AI sẽ phân tích chuyên sâu, tìm kiếm thông tin và hoàn thiện toàn bộ thế giới game cho bạn.
        </p>
        <div className="space-y-4">
          <div className="flex-1 w-full">
            <label htmlFor="analyzeWorkSelect" className="block text-sm font-medium text-gray-300 mb-1">
              Chọn Tác Phẩm (Nguyên Tác)
            </label>
            <div className="relative">
              <input
                id="analyzeWorkSelect"
                className={`w-full bg-gray-800 border ${fanficStoryName.startsWith('http') ? 'border-orange-500 ring-1 ring-orange-500/30' : 'border-gray-600'} rounded-md py-2 px-3 text-white focus:outline-none focus:ring-2 focus:ring-orange-500 pr-10 transition-all`}
                placeholder="Nhấn để tìm kiếm hoặc dán URL trực tiếp (GitHub/TXT)..."
                value={fanficStoryName}
                onChange={(e) => {
                   const val = e.target.value;
                   setFanficStoryName(val);
                   if (val.trim().startsWith('http')) {
                      handleChange({ target: { name: 'remoteCanonUrl', value: val.trim() } } as any);
                      // Auto-enable strict grounding if pasting URL directly
                      handleChange({ target: { name: 'isStrictGrounding', value: true } } as any);
                   }
                }}
                onClick={(e) => {
                  if (!fanficStoryName || !fanficStoryName.startsWith('http')) {
                     onOpenWorkSelectionModal();
                  }
                }}
              />
              {fanficStoryName.startsWith('http') && (
                <div className="absolute left-3 -top-2 px-1 bg-gray-900 text-[10px] text-orange-400 font-bold uppercase tracking-wider">
                  Link nguyên tác thô
                </div>
              )}
              <div 
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-orange-400 cursor-pointer transition-colors"
                onClick={onOpenWorkSelectionModal}
                title="Mở bảng tìm kiếm"
              >
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
                </svg>
              </div>
            </div>
          </div>

          <InputField
            label="Mô tả thêm về ý tưởng đồng nhân của bạn (tùy chọn)"
            id="fanficPlayerDescription"
            name="fanficPlayerDescription"
            value={fanficPlayerDescription}
            onChange={(e) => setFanficPlayerDescription(e.target.value)}
            textarea
            rows={3}
            placeholder="Ví dụ: Tôi muốn nhân vật chính là một người xuyên không, mang theo hệ thống, thay đổi vận mệnh của nhân vật X..."
          />

          <div className="flex flex-col space-y-2">
            <InputField
              label="Ưu tiên nội dung 18+"
              id="nsfwModeStory"
              name="nsfwMode"
              type="checkbox"
              checked={settings.nsfwMode || false}
              onChange={handleChange}
            />
            
            <div className="flex items-center space-x-2">
              <InputField
                label="ƯU TIÊN TUYỆT ĐỐI DỮ LIỆU TỪ NGUYÊN TÁC (GITHUB/TXT)"
                id="isStrictGrounding"
                name="isStrictGrounding"
                type="checkbox"
                checked={settings.isStrictGrounding || false}
                onChange={handleChange}
                disabled={!settings.remoteCanonUrl && !fanficStoryName.startsWith('http')}
              />
              {!settings.remoteCanonUrl && !fanficStoryName.startsWith('http') && (
                <span className="text-[10px] text-orange-400 font-medium italic">
                  * Vui lòng nhập URL nguyên tác để kích hoạt
                </span>
              )}
            </div>

            <InputField
              label="KÍCH HOẠT TRA CỨU SÂU (GOOGLE SEARCH GROUNDING - TỰ ĐỘNG DỊCH TIẾNG GỐC TRUNG/NHẬT/ANH) [⚠️ Một số model yếu sẽ không gánh nổi, gây ra lỗi, nếu không dùng proxy thì cẩn thận ⚠️]"
              id="useDeepGrounding"
              name="useDeepGrounding"
              type="checkbox"
              checked={settings.useDeepGrounding || false}
              onChange={handleChange}
            />
          </div>

          {settings.nsfwMode && (
            <div className="pl-4 mt-2 space-y-3 border-l-2 border-orange-500/50 bg-orange-900/5 p-3 rounded-r-md">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <InputField
                  label={VIETNAMESE.nsfwDescriptionStyleLabel}
                  id="nsfwDescriptionStyleStory"
                  name="nsfwDescriptionStyle"
                  type="select"
                  options={nsfwStyleOptions.map(opt => opt.label)}
                  value={nsfwStyleOptions.find(opt => opt.value === (settings.nsfwDescriptionStyle || DEFAULT_NSFW_DESCRIPTION_STYLE))?.label || nsfwStyleOptions[0].label}
                  onChange={(e) => {
                    const selectedLabel = e.target.value;
                    const selectedValue = nsfwStyleOptions.find(opt => opt.label === selectedLabel)?.value || DEFAULT_NSFW_DESCRIPTION_STYLE;
                    handleChange({ target: { name: 'nsfwDescriptionStyle', value: selectedValue } } as any);
                  }}
                />
                <InputField
                  label={VIETNAMESE.violenceLevelLabel}
                  id="violenceLevelStory"
                  name="violenceLevel"
                  type="select"
                  options={violenceLevelOptions.map(opt => opt.label)}
                  value={violenceLevelOptions.find(opt => opt.value === (settings.violenceLevel || DEFAULT_VIOLENCE_LEVEL))?.label || violenceLevelOptions[0].label}
                  onChange={(e) => {
                    const selectedLabel = e.target.value;
                    const selectedValue = violenceLevelOptions.find(opt => opt.label === selectedLabel)?.value || DEFAULT_VIOLENCE_LEVEL;
                    handleChange({ target: { name: 'violenceLevel', value: selectedValue } } as any);
                  }}
                />
                <InputField
                  label={VIETNAMESE.storyToneLabel}
                  id="storyToneStory"
                  name="storyTone"
                  type="select"
                  options={storyToneOptions.map(opt => opt.label)}
                  value={storyToneOptions.find(opt => opt.value === (settings.storyTone || DEFAULT_STORY_TONE))?.label || storyToneOptions[0].label}
                  onChange={(e) => {
                    const selectedLabel = e.target.value;
                    const selectedValue = storyToneOptions.find(opt => opt.label === selectedLabel)?.value || DEFAULT_STORY_TONE;
                    handleChange({ target: { name: 'storyTone', value: selectedValue } } as any);
                  }}
                />
              </div>
            </div>
          )}

          <div className="flex flex-col sm:flex-row gap-3 pt-2">
            <div className="relative flex-1">
              <Button
                onClick={() => handleAnalyzeWork(fanficStoryName)}
                isLoading={isAnalyzingWork}
                disabled={isGeneratingDetails || isGeneratingCompletion || isAnalyzingWork || isStressTesting}
                variant="primary"
                className="w-full bg-orange-600 hover:bg-orange-700 focus:ring-orange-500 py-3 text-lg shadow-lg shadow-orange-900/20"
                loadingText="AI đang phân tích & khởi tạo..."
              >
                Phân Tích & Tạo Đồng Nhân
              </Button>
              {isGuideOverlayActive && setActiveGuideId && (
                <GuideMarker id="setup-ai-analyze" index={8} text="Nhấn để AI quét dữ liệu nguyên tác và tự động thiết lập toàn bộ bối cảnh cho bạn." position="top" activeId={activeGuideId} onToggle={setActiveGuideId} />
              )}
            </div>
            
            <div className="relative sm:w-auto">
              <Button
                onClick={handleStressTest}
                isLoading={isStressTesting}
                disabled={isGeneratingDetails || isGeneratingCompletion || isAnalyzingWork || isStressTesting}
                variant="outline"
                className="w-full border-red-600 text-red-400 hover:bg-red-900/20"
                loadingText={`Stress Test (${stressTestProgress.current}/${stressTestProgress.total})...`}
              >
                Stress Test (200 lần)
              </Button>
              {isGuideOverlayActive && setActiveGuideId && (
                <GuideMarker id="setup-ai-stress" index={9} text="Chế độ thử nghiệm: AI sẽ chạy 200 lần để kiểm tra độ ổn định của prompt." position="top" activeId={activeGuideId} onToggle={setActiveGuideId} />
              )}
            </div>

            <div className="relative sm:w-auto">
              <Button
                onClick={handleGenerateCompletion}
                isLoading={isGeneratingCompletion}
                disabled={isGeneratingDetails || isGeneratingCompletion || isAnalyzingWork || isStressTesting}
                variant="outline"
                className="w-full border-green-600 text-green-400 hover:bg-green-900/20"
                loadingText="Đang hoàn thiện..."
              >
                Chỉ Hoàn Thiện Các Ô Trống
              </Button>
              {isGuideOverlayActive && setActiveGuideId && (
                <GuideMarker id="setup-ai-complete" index={10} text="AI sẽ chỉ điền vào các ô dữ liệu còn trống, không thay đổi các ô đã có dữ liệu." position="top" activeId={activeGuideId} onToggle={setActiveGuideId} />
              )}
            </div>
          </div>

          {isStressTesting && (
            <div className="mt-4 p-4 bg-red-900/20 rounded-lg border border-red-700/50 flex flex-col gap-3">
              <div className="flex items-center gap-3">
                <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                <p className="text-sm font-medium text-red-300">Đang chạy Stress Test: {stressTestProgress.current}/{stressTestProgress.total}</p>
              </div>
              <div className="max-h-40 overflow-y-auto text-[10px] font-mono bg-black/40 p-2 rounded border border-red-900/30">
                {stressTestResults.map((r, i) => (
                  <div key={i} className={r.success ? "text-green-400" : "text-red-400"}>
                    #{r.iteration}: {r.success ? "OK" : "FAIL"} - {r.duration}ms - {r.modelUsed} {r.error && `- ${r.error}`}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </fieldset>

      <fieldset className="border border-purple-700 p-4 rounded-md bg-purple-900/10">
        <legend className="text-lg font-semibold text-purple-300 px-2">Lối Chơi (Bắt buộc)</legend>
        <p className="text-sm text-gray-400 mb-3">
          Chọn phong cách kể chuyện bạn muốn AI tuân theo.
        </p>
        <div className="space-y-2">
          <label className="flex items-start p-3 rounded-md bg-gray-800/50 hover:bg-gray-700/50 border border-gray-700 cursor-pointer">
            <input 
              type="radio" 
              name="storyMode" 
              value="worldSimulator" 
              checked={settings.storyMode === 'worldSimulator' || !settings.storyMode} 
              onChange={handleChange}
              className="mt-1 h-4 w-4 text-indigo-600 border-gray-500 focus:ring-indigo-500"
            />
            <div className="ml-3 text-sm">
              <span className="font-medium text-gray-200">Thế Giới Tự Do / Sandbox (worldSimulator)</span>
              <p className="text-gray-400 text-xs mt-1">Nếu sau 30 lượt mà mốc sự kiện cốt truyện/nhiệm vụ chính tuyến hiện tại chưa được hoàn thành, hệ thống sẽ tự động để nhân vật chính nguyên tác hoàn tất sự kiện đó (completedByCanonProtagonist = true) và chuyển sang mốc tiếp theo trong dòng thời gian.</p>
            </div>
          </label>
          <label className="flex items-start p-3 rounded-md bg-gray-800/50 hover:bg-gray-700/50 border border-gray-700 cursor-pointer">
            <input 
              type="radio" 
              name="storyMode" 
              value="focusedStoryteller" 
              checked={settings.storyMode === 'focusedStoryteller'} 
              onChange={handleChange}
              className="mt-1 h-4 w-4 text-indigo-600 border-gray-500 focus:ring-indigo-500"
            />
            <div className="ml-3 text-sm">
              <span className="font-medium text-gray-200">Người Kể Chuyện Tuyến Tính (focusedStoryteller)</span>
              <p className="text-gray-400 text-xs mt-1">Cốt truyện được dẫn dắt chặt chẽ theo các chương/mục tiêu tuyến tính và không tự động hoàn thành mốc sự kiện sau 30 lượt.</p>
            </div>
          </label>
        </div>
      </fieldset>
    </div>
  );
};

export default AIAssistTab;
