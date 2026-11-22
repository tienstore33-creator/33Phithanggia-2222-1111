

import React from 'react';
import { WorldSettings, StartingNPC, StartingLore, StartingLocation, StartingFaction, StartingYeuThu } from './../../../types';
import * as GameTemplates from './../../../templates';

// Import the new section components
import CollapsibleSection from './startingElements/CollapsibleSection';
import SkillsSection from './startingElements/SkillsSection';
import ItemsSection from './startingElements/ItemsSection';
import NpcsSection from './startingElements/NpcsSection';
import YeuThuSection from './startingElements/YeuThuSection'; // New
import LoreSection from './startingElements/LoreSection';
import LocationsSection from './startingElements/LocationsSection';
import FactionsSection from './startingElements/FactionsSection';
import { VIETNAMESE } from './../../../constants';
import { Sparkles, PenTool } from 'lucide-react';
import CustomPromptModal from './../../ui/CustomPromptModal';
import { GuideMarker } from '../../guide/GuideSystem';
import { useState } from 'react';

interface StartingElementsTabProps {
  settings: WorldSettings;
  isSkillsSectionOpen: boolean;
  setIsSkillsSectionOpen: (isOpen: boolean) => void;
  handleStartingSkillChange: (index: number, field: string, value: any) => void;
  addStartingSkill: (type: GameTemplates.SkillTypeValues) => void;
  removeStartingSkill: (index: number) => void;
  isItemsSectionOpen: boolean;
  setIsItemsSectionOpen: (isOpen: boolean) => void;
  handleStartingItemChange: (index: number, field: any, value: any) => void;
  addStartingItem: () => void;
  removeStartingItem: (index: number) => void;
  isNpcsSectionOpen: boolean;
  setIsNpcsSectionOpen: (isOpen: boolean) => void;
  handleStartingNPCChange: (index: number, field: keyof StartingNPC, value: any) => void;
  addStartingNPC: () => void;
  removeStartingNPC: (index: number) => void;
  isYeuThuSectionOpen: boolean; // New
  setIsYeuThuSectionOpen: (isOpen: boolean) => void; // New
  handleStartingYeuThuChange: (index: number, field: keyof StartingYeuThu, value: string | boolean) => void; // New
  addStartingYeuThu: () => void; // New
  removeStartingYeuThu: (index: number) => void; // New
  isLoreSectionOpen: boolean;
  setIsLoreSectionOpen: (isOpen: boolean) => void;
  handleStartingLoreChange: (index: number, field: keyof StartingLore, value: string) => void;
  addStartingLore: () => void;
  removeStartingLore: (index: number) => void;
  isLocationsSectionOpen: boolean;
  setIsLocationsSectionOpen: (isOpen: boolean) => void;
  handleStartingLocationChange: (index: number, field: keyof StartingLocation, value: string | boolean) => void;
  addStartingLocation: () => void;
  removeStartingLocation: (index: number) => void;
  isFactionsSectionOpen: boolean;
  setIsFactionsSectionOpen: (isOpen: boolean) => void;
  handleStartingFactionChange: (index: number, field: keyof StartingFaction, value: string | number) => void;
  addStartingFaction: () => void;
  removeStartingFaction: (index: number) => void;
  handleRewriteStartingElements: (customPrompt?: string) => void;
  isRewritingStartingElements: boolean;
  isGuideOverlayActive?: boolean;
  activeGuideId?: string | null;
  setActiveGuideId?: (id: string | null) => void;
}

const StartingElementsTab: React.FC<StartingElementsTabProps> = ({
  settings,
  isSkillsSectionOpen, setIsSkillsSectionOpen, handleStartingSkillChange, addStartingSkill, removeStartingSkill,
  isItemsSectionOpen, setIsItemsSectionOpen, handleStartingItemChange, addStartingItem, removeStartingItem,
  isNpcsSectionOpen, setIsNpcsSectionOpen, handleStartingNPCChange, addStartingNPC, removeStartingNPC,
  isYeuThuSectionOpen, setIsYeuThuSectionOpen, handleStartingYeuThuChange, addStartingYeuThu, removeStartingYeuThu,
  isLoreSectionOpen, setIsLoreSectionOpen, handleStartingLoreChange, addStartingLore, removeStartingLore,
  isLocationsSectionOpen, setIsLocationsSectionOpen, handleStartingLocationChange, addStartingLocation, removeStartingLocation,
  isFactionsSectionOpen, setIsFactionsSectionOpen, handleStartingFactionChange, addStartingFaction, removeStartingFaction,
  handleRewriteStartingElements, isRewritingStartingElements,
  isGuideOverlayActive,
  activeGuideId,
  setActiveGuideId
}) => {
  const [isCustomPromptModalOpen, setIsCustomPromptModalOpen] = useState(false);

  return (
    <div className="space-y-2">
      <div className="mb-4">
        <div className="flex flex-col sm:flex-row gap-2">
          <div className="relative flex-1">
            <button
              type="button"
              onClick={() => handleRewriteStartingElements()}
              disabled={isRewritingStartingElements}
              className={`
                w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl font-bold text-xs sm:text-sm uppercase tracking-wider
                transition-all duration-300 transform hover:-translate-y-1 active:translate-y-1 active:shadow-none
                ${isRewritingStartingElements 
                  ? 'bg-slate-800 text-slate-600 cursor-not-allowed border-b-4 border-slate-900 opacity-70' 
                  : 'bg-gradient-to-r from-amber-500 to-orange-600 text-white shadow-[0_4px_0_#9a3412,0_8px_15px_rgba(249,115,22,0.4)] hover:shadow-[0_4px_0_#9a3412,0_12px_20px_rgba(249,115,22,0.5)] border border-amber-400/30'}
              `}
            >
              {isRewritingStartingElements ? (
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <Sparkles size={16} className="text-white animate-pulse" />
              )}
              <span className="drop-shadow-md whitespace-nowrap">
                {isRewritingStartingElements ? 'ĐANG VIẾT...' : '✨ TỰ ĐỘNG THIẾT LẬP'}
              </span>
            </button>
            {isGuideOverlayActive && setActiveGuideId && (
              <GuideMarker id="setup-elements-auto" index={15} text="AI sẽ dựa trên bối cảnh để tự động sinh ra Kỹ năng, Vật phẩm và NPC khởi đầu phù hợp." position="top" activeId={activeGuideId} onToggle={setActiveGuideId} />
            )}
          </div>

          <div className="relative flex-1">
            <button
              type="button"
              onClick={() => setIsCustomPromptModalOpen(true)}
              disabled={isRewritingStartingElements}
              className={`
                w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl font-bold text-xs sm:text-sm uppercase tracking-wider
                transition-all duration-300 transform hover:-translate-y-1 active:translate-y-1 active:shadow-none
                ${isRewritingStartingElements 
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
              <GuideMarker id="setup-elements-custom" index={16} text="Yêu cầu AI sinh các vật phẩm hoặc kỹ năng cụ thể (ví dụ: 'Hãy cho tôi một thanh kiếm gãy')." position="top" activeId={activeGuideId} onToggle={setActiveGuideId} />
            )}
          </div>
        </div>
        <p className="mt-2 text-[10px] text-center text-gray-400 italic">
          * AI sẽ dựa trên Tiểu sử, Bối cảnh ban đầu và Thế giới để tạo lại Kỹ năng, Vật phẩm, NPC...
        </p>
      </div>

      <CollapsibleSection
        title={VIETNAMESE.startingSkillsSection}
        isOpen={isSkillsSectionOpen}
        onToggle={() => setIsSkillsSectionOpen(!isSkillsSectionOpen)}
        itemCount={(settings.startingSkills || []).length}
      >
        <SkillsSection 
          settings={settings}
          handleStartingSkillChange={handleStartingSkillChange}
          addStartingSkill={addStartingSkill}
          removeStartingSkill={removeStartingSkill}
        />
      </CollapsibleSection>

      <CollapsibleSection
        title={VIETNAMESE.startingItemsSection}
        isOpen={isItemsSectionOpen}
        onToggle={() => setIsItemsSectionOpen(!isItemsSectionOpen)}
        itemCount={(settings.startingItems || []).length}
      >
        <ItemsSection 
          settings={settings}
          handleStartingItemChange={handleStartingItemChange}
          addStartingItem={addStartingItem}
          removeStartingItem={removeStartingItem}
        />
      </CollapsibleSection>
      
      <CollapsibleSection
        title={VIETNAMESE.startingNPCsSection}
        isOpen={isNpcsSectionOpen}
        onToggle={() => setIsNpcsSectionOpen(!isNpcsSectionOpen)}
        itemCount={(settings.startingNPCs || []).length}
      >
        <NpcsSection 
          settings={settings}
          handleStartingNPCChange={handleStartingNPCChange}
          addStartingNPC={addStartingNPC}
          removeStartingNPC={removeStartingNPC}
        />
      </CollapsibleSection>

      <CollapsibleSection
        title={"Yêu Thú Khởi Đầu"}
        isOpen={isYeuThuSectionOpen}
        onToggle={() => setIsYeuThuSectionOpen(!isYeuThuSectionOpen)}
        itemCount={(settings.startingYeuThu || []).length}
      >
        <YeuThuSection 
          settings={settings}
          handleStartingYeuThuChange={handleStartingYeuThuChange}
          addStartingYeuThu={addStartingYeuThu}
          removeStartingYeuThu={removeStartingYeuThu}
        />
      </CollapsibleSection>

      <CollapsibleSection
        title={VIETNAMESE.startingLoreSection}
        isOpen={isLoreSectionOpen}
        onToggle={() => setIsLoreSectionOpen(!isLoreSectionOpen)}
        itemCount={(settings.startingLore || []).length}
      >
        <LoreSection
          startingLore={settings.startingLore}
          handleStartingLoreChange={handleStartingLoreChange}
          addStartingLore={addStartingLore}
          removeStartingLore={removeStartingLore}
        />
      </CollapsibleSection>

      <CollapsibleSection
        title={VIETNAMESE.startingLocationsSection}
        isOpen={isLocationsSectionOpen}
        onToggle={() => setIsLocationsSectionOpen(!isLocationsSectionOpen)}
        itemCount={(settings.startingLocations || []).length}
      >
        <LocationsSection
          startingLocations={settings.startingLocations}
          handleStartingLocationChange={handleStartingLocationChange}
          addStartingLocation={addStartingLocation}
          removeStartingLocation={removeStartingLocation}
        />
      </CollapsibleSection>
      
      <CollapsibleSection
        title={VIETNAMESE.startingFactionsSection}
        isOpen={isFactionsSectionOpen}
        onToggle={() => setIsFactionsSectionOpen(!isFactionsSectionOpen)}
        itemCount={(settings.startingFactions || []).length}
      >
        <FactionsSection
          startingFactions={settings.startingFactions}
          handleStartingFactionChange={handleStartingFactionChange}
          addStartingFaction={addStartingFaction}
          removeStartingFaction={removeStartingFaction}
        />
      </CollapsibleSection>
      <CustomPromptModal
        isOpen={isCustomPromptModalOpen}
        onClose={() => setIsCustomPromptModalOpen(false)}
        onConfirm={(prompt) => {
          setIsCustomPromptModalOpen(false);
          handleRewriteStartingElements(prompt);
        }}
        title="Yêu cầu thiết lập khởi đầu"
        placeholder="Ví dụ: 'Thanh niên nghèo khó, mang theo 1 quả linh dược cấp cao và 1 thanh kiếm gãy, có 2 đối thủ cạnh tranh là NPC...'"
        isLoading={isRewritingStartingElements}
      />
    </div>
  );
};

export default StartingElementsTab;
