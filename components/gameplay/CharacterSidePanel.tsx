import React, { useMemo, useState, useEffect } from 'react';
import { KnowledgeBase, Item, Skill } from '../../types'; 
import PlayerStatsWithEquipment from './equipment/PlayerStatsWithEquipment'; 
import InventoryPanel from './InventoryPanel';
import * as GameTemplates from '../../templates';
import MasterPanel from './MasterPanel';
import { useGame } from '../../hooks/useGame';
import { useSkillTransformation } from '../../hooks/useSkillTransformation';

interface CharacterSidePanelProps {
  knowledgeBase: KnowledgeBase;
  onItemClick: (item: Item) => void;
  onSkillClick: (skill: Skill) => void;
  onPlayerAvatarUploadRequest: (base64Data: string) => void;
  isUploadingPlayerAvatar: boolean;
}

const AccordionItem: React.FC<{
    title: string;
    isOpen: boolean;
    onClick: () => void;
    count?: number;
    children: React.ReactNode;
}> = ({ title, isOpen, onClick, count, children }) => {
    return (
        <div className="border-b border-gray-700 last:border-0">
            <button
                onClick={onClick}
                className={`w-full flex justify-between items-center p-3 text-left transition-colors duration-200 ${
                    isOpen ? 'bg-indigo-900/40 text-indigo-300' : 'bg-gray-800 hover:bg-gray-750 text-gray-300'
                }`}
            >
                <span className="font-semibold text-sm">{title}</span>
                <div className="flex items-center gap-2">
                    {count !== undefined && <span className="text-xs bg-gray-900/50 px-2 py-0.5 rounded-full text-gray-400">{count}</span>}
                    <svg 
                        xmlns="http://www.w3.org/2000/svg" 
                        className={`h-4 w-4 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} 
                        fill="none" viewBox="0 0 24 24" stroke="currentColor"
                    >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                </div>
            </button>
            {isOpen && (
                <div className="p-2 bg-gray-900/30 animate-fade-in">
                    {children}
                </div>
            )}
        </div>
    );
};

const SkillList: React.FC<{ skills: Skill[]; onSkillClick: (skill: Skill) => void }> = ({ skills, onSkillClick }) => {
    if (skills.length === 0) return null;
    return (
        <ul className="space-y-1 max-h-60 overflow-y-auto custom-scrollbar p-2">
            {skills.map(skill => (
                <li
                    key={skill.id}
                    className="text-sm text-gray-300 hover:bg-gray-700 p-2 rounded cursor-pointer transition-colors"
                    onClick={() => onSkillClick(skill)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => e.key === 'Enter' && onSkillClick(skill)}
                    aria-label={`Details for ${skill.name}`}
                    title={skill.name}
                >
                    <span className="truncate block">
                        <strong className="text-indigo-300">{skill.name}</strong>
                    </span>
                </li>
            ))}
        </ul>
    );
};


const CharacterSidePanel: React.FC<CharacterSidePanelProps> = ({
  knowledgeBase,
  onItemClick,
  onSkillClick,
  onPlayerAvatarUploadRequest,
  isUploadingPlayerAvatar,
}) => {
  const { setIsJourneyLogOpen, setIsSummaryModalOpen } = useGame();
  const { triggerTransformation } = useSkillTransformation();
  const [activeSection, setActiveSection] = useState<string | null>('stats');
  const hasTriggered = React.useRef(false);

  useEffect(() => {
    if (!hasTriggered.current && knowledgeBase.playerSkills.length > 0) {
      triggerTransformation(true);
      hasTriggered.current = true;
    }
  }, [triggerTransformation, knowledgeBase.playerSkills.length]);
  
  const toggleSection = (section: string) => {
    setActiveSection(prev => (prev === section ? null : section));
  };

  const isPlayerRestricted = !!knowledgeBase.playerStats.playerSpecialStatus;
  const master = knowledgeBase.master;
  
  const allEquippedItemIds = useMemo(() => {
    const ids = new Set<string>();
    if (knowledgeBase.equippedItems) {
      Object.values(knowledgeBase.equippedItems).forEach(id => { if (id) ids.add(id as string); });
    }
    if (knowledgeBase.wives) {
      knowledgeBase.wives.forEach(c => {
        if (c.equippedItems) {
          Object.values(c.equippedItems).forEach(id => { if (id) ids.add(id as string); });
        }
      });
    }
    if (knowledgeBase.slaves) {
      knowledgeBase.slaves.forEach(c => {
        if (c.equippedItems) {
          Object.values(c.equippedItems).forEach(id => { if (id) ids.add(id as string); });
        }
      });
    }
    return ids;
  }, [knowledgeBase.equippedItems, knowledgeBase.wives, knowledgeBase.slaves]);

  const displayableInventory = useMemo(() => {
      return knowledgeBase.inventory.filter(item => !allEquippedItemIds.has(item.id));
  }, [knowledgeBase.inventory, allEquippedItemIds]);

  const congPhapSkills = knowledgeBase.playerSkills.filter(s => s.skillType === GameTemplates.SkillType.CONG_PHAP_TU_LUYEN);
  const linhKiSkills = knowledgeBase.playerSkills.filter(s => s.skillType === GameTemplates.SkillType.LINH_KI);
  const ngheNghiepSkills = knowledgeBase.playerSkills.filter(s => s.skillType === GameTemplates.SkillType.NGHE_NGHIEP);
  const thanThongSkills = knowledgeBase.playerSkills.filter(s => s.skillType === GameTemplates.SkillType.THAN_THONG);
  const camThuatSkills = knowledgeBase.playerSkills.filter(s => s.skillType === GameTemplates.SkillType.CAM_THUAT);
  const otherSkills = knowledgeBase.playerSkills.filter(s => 
    s.skillType !== GameTemplates.SkillType.CONG_PHAP_TU_LUYEN &&
    s.skillType !== GameTemplates.SkillType.LINH_KI &&
    s.skillType !== GameTemplates.SkillType.NGHE_NGHIEP &&
    s.skillType !== GameTemplates.SkillType.THAN_THONG &&
    s.skillType !== GameTemplates.SkillType.CAM_THUAT
  );

  return (
    <div className="flex flex-col h-full bg-gray-800 rounded-lg border border-gray-700 overflow-hidden">
        {isPlayerRestricted && master && <div className="p-4 flex-shrink-0 border-b border-gray-700"><MasterPanel master={master} /></div>}
        
        <div className="flex-grow overflow-y-auto custom-scrollbar">
            <AccordionItem title="Chỉ Số & Trang Bị" isOpen={activeSection === 'stats'} onClick={() => toggleSection('stats')}>
                 <PlayerStatsWithEquipment 
                    personId={'player'}
                    playerStats={knowledgeBase.playerStats}
                    equippedItems={knowledgeBase.equippedItems}
                    inventory={knowledgeBase.inventory}
                    currencyName={knowledgeBase.worldConfig?.currencyName}
                    playerName={knowledgeBase.worldConfig?.playerName}
                    playerGender={knowledgeBase.worldConfig?.playerGender}
                    playerRace={knowledgeBase.worldConfig?.playerRace}
                    playerAvatarUrl={knowledgeBase.worldConfig?.playerAvatarUrl} 
                    playerAvatarData={knowledgeBase.playerAvatarData} 
                    worldConfig={knowledgeBase.worldConfig} 
                    worldDate={knowledgeBase.worldDate}
                    isPlayerContext={true}
                    onPlayerAvatarUploadRequest={onPlayerAvatarUploadRequest}
                    isUploadingPlayerAvatar={isUploadingPlayerAvatar}
                    currentLocationName={knowledgeBase.discoveredLocations.find(l => l.id === knowledgeBase.currentLocationId)?.name}
                    isSafeZone={knowledgeBase.discoveredLocations.find(l => l.id === knowledgeBase.currentLocationId)?.isSafeZone}
                    safetyOverride={knowledgeBase.currentLocationSafetyOverride}
                    setIsJourneyLogOpen={setIsJourneyLogOpen}
                    setIsSummaryModalOpen={setIsSummaryModalOpen}
                />
            </AccordionItem>
            
            <AccordionItem title="Túi Đồ" isOpen={activeSection === 'inventory'} onClick={() => toggleSection('inventory')} count={displayableInventory.length}>
                <InventoryPanel items={displayableInventory} onItemClick={onItemClick} />
            </AccordionItem>
            
            {congPhapSkills.length > 0 && 
                <AccordionItem title="Công Pháp Tu Luyện" isOpen={activeSection === 'congphap'} onClick={() => toggleSection('congphap')} count={congPhapSkills.length}>
                    <SkillList skills={congPhapSkills} onSkillClick={onSkillClick} />
                </AccordionItem>
            }
             {linhKiSkills.length > 0 && 
                <AccordionItem title="Linh Kĩ" isOpen={activeSection === 'linhki'} onClick={() => toggleSection('linhki')} count={linhKiSkills.length}>
                    <SkillList skills={linhKiSkills} onSkillClick={onSkillClick} />
                </AccordionItem>
            }
            {thanThongSkills.length > 0 && 
                <AccordionItem title="Thần Thông" isOpen={activeSection === 'thanthong'} onClick={() => toggleSection('thanthong')} count={thanThongSkills.length}>
                    <SkillList skills={thanThongSkills} onSkillClick={onSkillClick} />
                </AccordionItem>
            }
            {camThuatSkills.length > 0 && 
                <AccordionItem title="Cấm Thuật" isOpen={activeSection === 'camthuat'} onClick={() => toggleSection('camthuat')} count={camThuatSkills.length}>
                    <SkillList skills={camThuatSkills} onSkillClick={onSkillClick} />
                </AccordionItem>
            }
            {ngheNghiepSkills.length > 0 && 
                <AccordionItem title="Kỹ Năng Nghề Nghiệp" isOpen={activeSection === 'nghenghiep'} onClick={() => toggleSection('nghenghiep')} count={ngheNghiepSkills.length}>
                    <SkillList skills={ngheNghiepSkills} onSkillClick={onSkillClick} />
                </AccordionItem>
            }
            {otherSkills.length > 0 && 
                <AccordionItem title="Kỹ Năng Khác" isOpen={activeSection === 'khac'} onClick={() => toggleSection('khac')} count={otherSkills.length}>
                    <SkillList skills={otherSkills} onSkillClick={onSkillClick} />
                </AccordionItem>
            }
        </div>
    </div>
  );
};

export default CharacterSidePanel;
