import React, { useState, useCallback, ChangeEvent, useMemo, useEffect } from 'react';
import { GameScreen, KnowledgeBase, Item as ItemType, OfflineCombatEffect, OfflineCombatEffectType, OfflineCombatTarget, OfflineCombatElement, OfflineCombatStatus, Skill } from '../../../types';
import Button from '../../ui/Button';
import InputField from '../../ui/InputField';
import { VIETNAMESE } from '../../../constants';
import * as GameTemplates from '../../../templates';
import CraftingMaterialSlotUI from './CraftingMaterialSlotUI';
import MaterialInventoryListUI from './MaterialInventoryListUI';
import MaterialSelectionModal from './MaterialSelectionModal';
import { useGame } from '../../../hooks/useGame';

interface CraftingScreenProps {
  knowledgeBase: KnowledgeBase;
  setCurrentScreen: (screen: GameScreen) => void;
  onCraftItem: (
    desiredCategory: GameTemplates.ItemCategoryValues,
    requirements: string,
    materialIds: string[]
  ) => void;
  isCrafting: boolean; 
}

const OFFLINE_EFFECT_TYPES: OfflineCombatEffectType[] = ['DAMAGE_HP', 'HEAL_HP', 'HEAL_MP', 'REVIVE', 'APPLY_STATUS', 'DRAIN_HP', 'CURE_STATUS', 'STAT_DEBUFF'];
const OFFLINE_TARGETS: OfflineCombatTarget[] = ['single_enemy', 'all_enemies', 'self', 'single_ally', 'all_allies', 'single_dead_ally', 'lowest_hp_ally'];
const OFFLINE_ELEMENTS: OfflineCombatElement[] = ['fire', 'ice', 'thunder', 'water', 'holy', 'dark'];
const OFFLINE_STATUSES: OfflineCombatStatus[] = ['POISON', 'BLIND', 'SILENCE', 'HASTE', 'PROTECT', 'SHELL', 'SLOW', 'SLEEP', 'STUN'];
const CONVERSION_COST = 500;
const POTION_CRAFT_BASE_COST = 200;

const CraftingScreen: React.FC<CraftingScreenProps> = ({
  knowledgeBase,
  setCurrentScreen,
  onCraftItem,
  isCrafting,
}) => {
  const { setKnowledgeBase, showNotification } = useGame();
  const [activeTab, setActiveTab] = useState<'items' | 'offlineResearch'>('items');
  const [conversionType, setConversionType] = useState<'skill' | 'potion'>('skill');

  // State for item crafting (AI)
  const [desiredCategory, setDesiredCategory] = useState<GameTemplates.ItemCategoryValues | ''>('');
  const [itemRequirements, setItemRequirements] = useState('');
  const [materialSlots, setMaterialSlots] = useState<Array<{ id: string; itemId: string | null }>>([
    { id: `slot-${Date.now()}-1`, itemId: null },
    { id: `slot-${Date.now()}-2`, itemId: null },
    { id: `slot-${Date.now()}-3`, itemId: null },
  ]);
  const [draggingOverSlotId, setDraggingOverSlotId] = useState<string | null>(null);
  const [isMaterialModalOpen, setIsMaterialModalOpen] = useState(false);
  const [activeSlotIdForSelection, setActiveSlotIdForSelection] = useState<string | null>(null);

  // State for skill/potion conversion (Offline)
  const [selectedSkillId, setSelectedSkillId] = useState<string>('');
  const [newSkillName, setNewSkillName] = useState<string>('');
  const [offlineEffect, setOfflineEffect] = useState<Partial<OfflineCombatEffect>>({});
  const [potionName, setPotionName] = useState('');
  const [potionDescription, setPotionDescription] = useState('');
  const [potionMaterialSlots, setPotionMaterialSlots] = useState<Array<{ id: string; itemId: string | null }>>([
    { id: `potion-slot-1`, itemId: null },
    { id: `potion-slot-2`, itemId: null },
    { id: `potion-slot-3`, itemId: null },
  ]);

  const currencyName = knowledgeBase.worldConfig?.currencyName || "Tiền";

  // Allow selecting ANY skill
  const skillsEligibleForConversion = useMemo(() => {
    return knowledgeBase.playerSkills;
  }, [knowledgeBase.playerSkills]);

  // --- LOGIC RE-ROLL NGẪU NHIÊN (DỰA TRÊN POWER BUDGET) ---
  const generateRandomOfflineEffect = useCallback((skill: Skill): OfflineCombatEffect => {
      // 1. Calculate Power Budget from the source skill
      // Base score + damage/heal + (mana cost * efficiency factor)
      let powerBudget = 50; // Minimum budget
      if (skill.baseDamage) powerBudget += skill.baseDamage;
      if (skill.healingAmount) powerBudget += skill.healingAmount * 1.2; // Healing is slightly more valuable
      if (skill.manaCost) powerBudget += skill.manaCost * 3; // Mana translates to power
      if (skill.cooldown) powerBudget += skill.cooldown * 10; // Longer cooldown = stronger effect allowed

      // Add some randomness to the budget (±20%)
      const variation = 0.8 + Math.random() * 0.4;
      powerBudget = Math.floor(powerBudget * variation);

      // 2. Pick Random Archetype
      const types: OfflineCombatEffectType[] = ['DAMAGE_HP', 'DAMAGE_HP', 'DAMAGE_HP', 'HEAL_HP', 'HEAL_HP', 'APPLY_STATUS', 'APPLY_STATUS', 'STAT_DEBUFF', 'DRAIN_HP', 'REVIVE'];
      const type = types[Math.floor(Math.random() * types.length)];
      
      // 3. Determine Element (Random)
      const element = OFFLINE_ELEMENTS[Math.floor(Math.random() * OFFLINE_ELEMENTS.length)];

      // 4. Determine Target & Calculate Value based on Type and Budget
      let target: OfflineCombatTarget = 'single_enemy';
      let basePower: number | undefined = undefined;
      let percentage: number | undefined = undefined;
      let status: OfflineCombatStatus | undefined = undefined;
      let duration: number | undefined = undefined;
      let stat: keyof import('../../../types').PlayerStats | undefined = undefined;

      if (type === 'DAMAGE_HP') {
          // 30% chance for AoE
          if (Math.random() < 0.3) {
              target = 'all_enemies';
              basePower = Math.floor(powerBudget * 0.6); // AoE deals less damage per target
          } else {
              target = 'single_enemy';
              basePower = powerBudget;
          }
      } else if (type === 'HEAL_HP') {
          if (Math.random() < 0.3) {
              target = 'all_allies';
              basePower = Math.floor(powerBudget * 0.5);
          } else {
              target = 'single_ally';
              basePower = Math.floor(powerBudget * 0.9);
          }
      } else if (type === 'DRAIN_HP') {
          target = 'single_enemy';
          basePower = Math.floor(powerBudget * 0.7); // Drain is expensive
      } else if (type === 'REVIVE') {
          target = 'single_dead_ally';
          // Budget determines HP percentage
          percentage = Math.min(100, Math.max(10, Math.floor(powerBudget / 5)));
      } else if (type === 'APPLY_STATUS') {
           if (Math.random() < 0.5) {
               // Buff
               target = Math.random() < 0.4 ? 'all_allies' : 'single_ally';
               const buffTypes: OfflineCombatStatus[] = ['HASTE', 'PROTECT', 'SHELL'];
               status = buffTypes[Math.floor(Math.random() * buffTypes.length)];
           } else {
               // Debuff
               target = Math.random() < 0.4 ? 'all_enemies' : 'single_enemy';
               const debuffTypes: OfflineCombatStatus[] = ['POISON', 'BLIND', 'SILENCE', 'SLOW', 'SLEEP', 'STUN'];
               status = debuffTypes[Math.floor(Math.random() * debuffTypes.length)];
           }
           duration = Math.min(5, Math.max(2, Math.floor(powerBudget / 30)));
      } else if (type === 'STAT_DEBUFF') {
          target = 'single_enemy';
          stat = 'sucTanCong';
          percentage = Math.min(50, Math.max(10, Math.floor(powerBudget / 5)));
          duration = 3;
      }

      return {
          type,
          target,
          basePower,
          percentage,
          element,
          status,
          duration,
          statuses: type === 'CURE_STATUS' ? ['POISON', 'BLIND', 'SILENCE'] : undefined,
          stat,
      };
  }, []);

  const handleRandomizeEffect = () => {
      if (selectedSkillId) {
          const skill = skillsEligibleForConversion.find(s => s.id === selectedSkillId);
          if (skill) {
               const randomEffect = generateRandomOfflineEffect(skill);
               setOfflineEffect(randomEffect);
               // Auto-generate a cool name suggestion if empty
               if (!newSkillName.trim()) {
                    // Just a placeholder, user should still input name
               }
               showNotification("Đã re-roll thuộc tính ngẫu nhiên!", "info");
          }
      }
  };

  useEffect(() => {
    const skill = knowledgeBase.playerSkills.find(s => s.id === selectedSkillId);
    if (skill && conversionType === 'skill') {
        setNewSkillName(skill.name);
        // If skill already has an offline effect, assume user wants to re-roll or keep it? 
        // For this "re-roll" feature, let's always generate a NEW one when selecting to prompt surprise.
        const randomEffect = generateRandomOfflineEffect(skill);
        setOfflineEffect(randomEffect);
    } else {
        setOfflineEffect({});
        setNewSkillName('');
    }
  }, [selectedSkillId, conversionType, knowledgeBase.playerSkills, generateRandomOfflineEffect]);

  const getEffectDescription = (effect: Partial<OfflineCombatEffect>) => {
      if (!effect.type) return "Chưa có hiệu ứng";
      let desc = "";
      const targetStr = effect.target === 'all_enemies' ? "toàn bộ kẻ địch" : 
                        effect.target === 'single_enemy' ? "một kẻ địch" : 
                        effect.target === 'all_allies' ? "toàn bộ đồng minh" : "đồng minh";
      
      if (effect.type === 'DAMAGE_HP') desc = `Gây khoảng ${effect.basePower} sát thương ${effect.element || ''} lên ${targetStr}.`;
      else if (effect.type === 'HEAL_HP') desc = `Hồi phục khoảng ${effect.basePower} HP cho ${targetStr}.`;
      else if (effect.type === 'APPLY_STATUS') desc = `Gây hiệu ứng ${effect.status} lên ${targetStr} trong ${effect.duration} lượt.`;
      else if (effect.type === 'DRAIN_HP') desc = `Hút khoảng ${effect.basePower} HP từ ${targetStr}.`;
      else if (effect.type === 'REVIVE') desc = `Hồi sinh ${targetStr} với ${effect.percentage}% HP.`;
      else if (effect.type === 'STAT_DEBUFF') desc = `Giảm ${effect.percentage}% chỉ số của ${targetStr}.`;
      
      return desc;
  }

  const handleConvertSkill = () => {
    if (!selectedSkillId || !offlineEffect.type) {
        showNotification("Vui lòng chọn kỹ năng.", "error");
        return;
    }
    if (!newSkillName.trim()) {
        showNotification("Vui lòng đặt tên mới cho kỹ năng.", "error");
        return;
    }
    if (knowledgeBase.playerStats.currency < CONVERSION_COST) {
        showNotification(VIETNAMESE.notEnoughMoney, "error");
        return;
    }

    setKnowledgeBase(prevKb => {
        const newKb = JSON.parse(JSON.stringify(prevKb));
        const skillIndex = newKb.playerSkills.findIndex((s: Skill) => s.id === selectedSkillId);
        if (skillIndex > -1) {
            const finalName = newSkillName.trim();
            const newDescription = getEffectDescription(offlineEffect); // Generate new description

            // Update skill properties
            newKb.playerSkills[skillIndex].name = finalName;
            newKb.playerSkills[skillIndex].description = newDescription; // Set the new description
            newKb.playerSkills[skillIndex].effect = offlineEffect;
            
            newKb.playerStats.currency -= CONVERSION_COST;
            showNotification(`Kỹ năng đã được chuyển hóa thành "${finalName}"!`, 'success');
            
            // Reset UI state
            setSelectedSkillId('');
            setOfflineEffect({});
            setNewSkillName('');
        }
        return newKb;
    });
  };
  
  // Potion crafting handlers (kept mostly same but using InputFields)
  const handleCreatePotion = () => {
     // Logic remains similar for potion...
      if (!potionName.trim() || !potionDescription.trim() || !offlineEffect.type || !offlineEffect.target) {
        showNotification("Vui lòng điền đầy đủ thông tin đan dược.", "error");
        return;
      }
       const materialIds = potionMaterialSlots.map(s => s.itemId).filter(Boolean) as string[];
      if (materialIds.length === 0) {
          showNotification("Cần ít nhất một nguyên liệu.", "error");
          return;
      }
      const totalCost = POTION_CRAFT_BASE_COST * materialIds.length;
      if (knowledgeBase.playerStats.currency < totalCost) {
          showNotification(VIETNAMESE.notEnoughMoney, "error");
          return;
      }
      setKnowledgeBase(prevKb => {
          const newKb = JSON.parse(JSON.stringify(prevKb));
          materialIds.forEach(id => {
              const itemIndex = newKb.inventory.findIndex((i: ItemType) => i.id === id);
              if (itemIndex > -1) {
                  newKb.inventory[itemIndex].quantity -= 1;
                  if (newKb.inventory[itemIndex].quantity <= 0) newKb.inventory.splice(itemIndex, 1);
              }
          });
          newKb.playerStats.currency -= totalCost;
          const newPotion: GameTemplates.PotionTemplate = {
              id: `potion-custom-${Date.now()}`,
              name: potionName,
              description: potionDescription,
              category: GameTemplates.ItemCategory.POTION,
              potionType: GameTemplates.PotionType.DAC_BIET,
              rarity: GameTemplates.ItemRarity.PHO_THONG,
              quantity: 1,
              value: totalCost,
              effects: [JSON.stringify(offlineEffect)],
              structuredEffects: [],
              isConsumedOnUse: true, usable: true, consumable: true,
              effect: offlineEffect as OfflineCombatEffect
          };
          newKb.inventory.push(newPotion);
          showNotification(`Chế tác thành công: ${potionName}!`, 'success');
          setPotionName(''); setPotionDescription(''); setOfflineEffect({});
          setPotionMaterialSlots(potionMaterialSlots.map(s => ({...s, itemId: null})));
          return newKb;
      });
  };

  const handleDropOnPotionMaterialSlot = useCallback((slotId: string, droppedItemId: string) => {
    setPotionMaterialSlots(prevSlots => prevSlots.map(slot => slot.id === slotId ? { ...slot, itemId: droppedItemId } : slot));
    setDraggingOverSlotId(null);
  }, []);
  const handleRemovePotionMaterial = useCallback((slotId: string) => {
    setPotionMaterialSlots(prevSlots => prevSlots.map(slot => slot.id === slotId ? { ...slot, itemId: null } : slot));
  }, []);

  // --- AI Item crafting handlers ---
  const handleAddMaterialSlot = () => { if (materialSlots.length < 10) setMaterialSlots(prev => [...prev, { id: `slot-${Date.now()}-${prev.length}`, itemId: null }]); };
  const handleDropOnMaterialSlot = useCallback((slotId: string, droppedItemId: string) => {
    setMaterialSlots(prevSlots => prevSlots.map(slot => slot.id === slotId ? { ...slot, itemId: droppedItemId } : slot));
    setDraggingOverSlotId(null);
  }, []);
  const handleRemoveMaterialFromSlot = useCallback((slotId: string) => setMaterialSlots(prev => prev.map(s => s.id === slotId ? { ...s, itemId: null } : s)), []);
  const handleDragStartFromInventory = useCallback((event: React.DragEvent<HTMLDivElement>, item: ItemType) => {
    if (item.category === GameTemplates.ItemCategory.MATERIAL) {
      event.dataTransfer.setData('application/json-item-id', String(item.id));
      event.dataTransfer.setData('application/json-item-category', String(item.category));
      event.dataTransfer.effectAllowed = 'copyMove';
    } else { event.preventDefault(); }
  }, []);
  const handleCraft = () => {
    if (!desiredCategory) { showNotification(VIETNAMESE.selectItemCategory, 'error'); return; }
    const materialItemIds = materialSlots.map(slot => slot.itemId).filter(Boolean) as string[];
    if (materialItemIds.length === 0) { showNotification(VIETNAMESE.noMaterialsForCrafting, 'error'); return; }
    onCraftItem(desiredCategory, itemRequirements, materialItemIds);
  };
  const handleMaterialSlotClick = (slotId: string) => { setActiveSlotIdForSelection(slotId); setIsMaterialModalOpen(true); };
  const handlePotionMaterialSlotClick = (slotId: string) => { setActiveSlotIdForSelection(slotId); setIsMaterialModalOpen(true); };
  const handleSelectMaterialFromModal = (itemId: string) => {
    if (activeSlotIdForSelection) {
        if(activeTab === 'items') handleDropOnMaterialSlot(activeSlotIdForSelection, itemId);
        else if (activeTab === 'offlineResearch' && conversionType === 'potion') handleDropOnPotionMaterialSlot(activeSlotIdForSelection, itemId);
    }
    setIsMaterialModalOpen(false); setActiveSlotIdForSelection(null);
  };
  const handlePotionEffectChange = (field: keyof OfflineCombatEffect, value: any) => {
     setOfflineEffect(prev => {
        const newEffect = {...prev, [field]: value};
        if (field === 'type') {
            if (value !== 'APPLY_STATUS') { delete newEffect.status; delete newEffect.duration; }
            if (value !== 'REVIVE') { delete newEffect.percentage; }
        }
        return newEffect;
    });
  };


  return (
    <>
    <div className="min-h-screen flex flex-col bg-gray-800 p-3 sm:p-4 text-gray-100">
      <header className="mb-4 flex justify-between items-center">
        <h1 className="text-2xl sm:text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-orange-400 via-amber-500 to-yellow-600">
          {VIETNAMESE.craftingScreenTitle}
        </h1>
        <Button variant="secondary" onClick={() => setCurrentScreen(GameScreen.Gameplay)} disabled={isCrafting}>
          {VIETNAMESE.goBackButton}
        </Button>
      </header>

      <div className="flex border-b border-gray-600 mb-4">
        <button onClick={() => setActiveTab('items')} className={`flex-1 py-2 text-sm font-semibold ${activeTab === 'items' ? 'text-amber-400 border-b-2 border-amber-400' : 'text-gray-400 hover:text-white'}`}>Luyện Chế (AI)</button>
        <button onClick={() => setActiveTab('offlineResearch')} className={`flex-1 py-2 text-sm font-semibold ${activeTab === 'offlineResearch' ? 'text-amber-400 border-b-2 border-amber-400' : 'text-gray-400 hover:text-white'}`}>Nghiên Cứu Offline</button>
      </div>

      <div className="flex-grow grid grid-cols-1 lg:grid-cols-3 gap-4">
        {activeTab === 'items' && (
            <>
                <div className="lg:col-span-2 flex flex-col gap-4">
                <div className="bg-gray-900 p-3 sm:p-4 rounded-lg shadow-xl border border-gray-700">
                    <h2 className="text-xl font-semibold text-amber-300 mb-3 border-b border-gray-600 pb-2">{VIETNAMESE.desiredItemSection}</h2>
                    <div className="space-y-3">
                    <InputField label={VIETNAMESE.desiredItemCategoryLabel} id="desiredItemCategory" type="select" options={['', ...Object.values(GameTemplates.ItemCategory)]} value={desiredCategory} onChange={(e) => setDesiredCategory(e.target.value as GameTemplates.ItemCategoryValues | '')}/>
                    <InputField label={VIETNAMESE.desiredItemRequirementsLabel} id="itemRequirements" textarea rows={3} value={itemRequirements} onChange={(e) => setItemRequirements(e.target.value)} placeholder={VIETNAMESE.desiredItemRequirementsPlaceholder}/>
                    </div>
                </div>

                <div className="bg-gray-900 p-3 sm:p-4 rounded-lg shadow-xl border border-gray-700">
                    <div className="flex justify-between items-center mb-3 border-b border-gray-600 pb-2">
                        <h2 className="text-xl font-semibold text-amber-300">{VIETNAMESE.craftingMaterialsSection}</h2>
                        <Button variant="primary" size="sm" onClick={handleAddMaterialSlot} disabled={materialSlots.length >= 10 || isCrafting}>{VIETNAMESE.addMaterialSlotButton}</Button>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2 sm:gap-3">
                    {materialSlots.map((slot) => (<CraftingMaterialSlotUI key={slot.id} slotId={slot.id} material={slot.itemId ? knowledgeBase.inventory.find(i => i.id === slot.itemId) || null : null} onDropMaterial={handleDropOnMaterialSlot} onRemoveMaterial={handleRemoveMaterialFromSlot} isDraggingOver={draggingOverSlotId === slot.id} onDragEnterSlot={setDraggingOverSlotId} onDragLeaveSlot={() => setDraggingOverSlotId(null)} onClick={handleMaterialSlotClick}/>))}
                    </div>
                </div>
                <Button onClick={handleCraft} variant="primary" size="lg" className="w-full mt-2 bg-amber-600 hover:bg-amber-700 focus:ring-amber-500" isLoading={isCrafting} loadingText={VIETNAMESE.craftingInProgress} disabled={isCrafting || !desiredCategory || materialSlots.every(s => s.itemId === null)}>{VIETNAMESE.craftItemButton}</Button>
                </div>
                <div className="lg:col-span-1"><MaterialInventoryListUI inventory={knowledgeBase.inventory} onDragStartItem={handleDragStartFromInventory}/></div>
            </>
        )}

        {activeTab === 'offlineResearch' && (
            <div className="lg:col-span-3">
                <div className="flex justify-center border-b border-gray-700 mb-4">
                     <button onClick={() => setConversionType('skill')} className={`py-2 px-4 text-sm font-medium ${conversionType === 'skill' ? 'text-amber-400 border-b-2 border-amber-400' : 'text-gray-400'}`}>Chuyển Hóa Kỹ Năng</button>
                     <button onClick={() => setConversionType('potion')} className={`py-2 px-4 text-sm font-medium ${conversionType === 'potion' ? 'text-amber-400 border-b-2 border-amber-400' : 'text-gray-400'}`}>Chế Tác Đan Dược</button>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                    {conversionType === 'skill' && (
                        <>
                            <div className="lg:col-span-2 bg-gray-900 p-4 rounded-lg shadow-xl border border-gray-700 space-y-4">
                                 <h2 className="text-xl font-semibold text-amber-300 border-b border-gray-600 pb-2">Chuyển Hóa Kỹ Năng Offline</h2>
                                <p className="text-sm text-gray-400">Chọn kỹ năng để chuyển hóa. Hệ thống sẽ <b>Ngẫu Nhiên Hóa</b> chỉ số dựa trên sức mạnh vốn có của kỹ năng (Re-roll).</p>
                                
                                <div className="mb-4">
                                    <label htmlFor="skill-to-convert" className="block text-sm font-medium text-gray-300 mb-1">Chọn Kỹ Năng</label>
                                    <select
                                        id="skill-to-convert"
                                        value={selectedSkillId}
                                        onChange={e => setSelectedSkillId(e.target.value)}
                                        className="w-full p-2 bg-gray-700 border border-gray-600 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 text-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
                                        disabled={skillsEligibleForConversion.length === 0 || isCrafting}
                                    >
                                        <option value="">-- Chọn Kỹ Năng --</option>
                                        {skillsEligibleForConversion.map(skill => (
                                            <option key={skill.id} value={skill.id}>
                                                {skill.name}
                                            </option>
                                        ))}
                                    </select>
                                </div>

                                {selectedSkillId && (
                                    <div className="p-3 border border-gray-600 rounded-md bg-gray-800/50 space-y-3">
                                        <InputField label="Tên Kỹ Năng Mới" id="new-skill-name" value={newSkillName} onChange={e => setNewSkillName(e.target.value)} placeholder="Nhập tên mới (hệ thống tự thêm 'combat ')" />
                                        
                                        <div className="flex flex-col gap-2 p-3 bg-black/30 rounded border border-gray-600/50">
                                            <h4 className="text-sm font-semibold text-yellow-400">Kết Quả Ngẫu Nhiên:</h4>
                                            <p className="text-sm text-gray-200 italic min-h-[40px] flex items-center">
                                                {offlineEffect.type ? getEffectDescription(offlineEffect) : "Chưa có hiệu ứng. Hãy bấm Ngẫu nhiên!"}
                                            </p>
                                            <Button size="sm" variant="secondary" onClick={handleRandomizeEffect} className="w-full text-xs flex items-center justify-center gap-2 mt-2" title="Tiêu phí để Re-roll lại thuộc tính ngẫu nhiên">
                                                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
                                                    <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 4.992l9.19-9.19M15.141 20.357a.5.5 0 000 .707l4.242 4.242a.5.5 0 00.707 0l4.242-4.242a.5.5 0 000-.707l-4.242-4.242a.5.5 0 00-.707 0l-4.242 4.242z" />
                                                </svg>
                                                Ngẫu nhiên hóa (Re-roll)
                                            </Button>
                                        </div>
                                    </div>
                                )}
                                <div className="text-center p-2 bg-gray-800 rounded-md"><p className="text-amber-400 font-semibold">Chi phí chuyển hóa: {CONVERSION_COST.toLocaleString()} {currencyName}</p></div>
                                <Button onClick={handleConvertSkill} variant="primary" size="lg" className="w-full bg-amber-600 hover:bg-amber-700 focus:ring-amber-500" isLoading={isCrafting} disabled={isCrafting || !selectedSkillId || knowledgeBase.playerStats.currency < CONVERSION_COST}>Xác Nhận Chuyển Hóa</Button>
                            </div>
                            <div className="lg:col-span-1 bg-gray-900 p-4 rounded-lg shadow-xl border border-gray-700"><h2 className="text-xl font-semibold text-amber-300 border-b border-gray-600 pb-2 mb-3">Cơ Chế Re-roll</h2><div className="space-y-2 text-sm text-gray-300"><p>Hệ thống sẽ tính toán "Power Budget" từ kỹ năng gốc của bạn.</p><p>Sau đó, hệ thống sẽ <b>ngẫu nhiên hoàn toàn</b> loại hiệu ứng, nguyên tố, và mục tiêu dựa trên ngân sách đó.</p><p>Bạn không thể chỉnh sửa chỉ số thủ công. Nếu không ưng ý, hãy bấm "Ngẫu nhiên hóa" lại.</p></div></div>
                        </>
                    )}

                    {conversionType === 'potion' && (
                         <>
                            <div className="lg:col-span-2 flex flex-col gap-4">
                                <div className="bg-gray-900 p-4 rounded-lg shadow-xl border border-gray-700 space-y-4">
                                    <h2 className="text-xl font-semibold text-amber-300 border-b border-gray-600 pb-2">Chế Tác Đan Dược Offline</h2>
                                    <p className="text-sm text-gray-400">Tự tạo ra các loại đan dược tùy chỉnh để sử dụng trong chiến đấu offline.</p>
                                    <InputField label="Tên Đan Dược (Không cần 'combat ')" id="potion-name" value={potionName} onChange={e => setPotionName(e.target.value)} />
                                    <InputField label="Mô Tả Đan Dược" id="potion-desc" value={potionDescription} onChange={e => setPotionDescription(e.target.value)} textarea rows={2}/>
                                    <div className="p-3 border border-gray-600 rounded-md bg-gray-800/50 space-y-3">
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                            <InputField label="Loại Hiệu Ứng" id="effect-type-potion" type="select" options={['', ...OFFLINE_EFFECT_TYPES]} value={offlineEffect.type || ''} onChange={e => handlePotionEffectChange('type', e.target.value)} />
                                            <InputField label="Mục Tiêu" id="effect-target-potion" type="select" options={['', ...OFFLINE_TARGETS]} value={offlineEffect.target || ''} onChange={e => handlePotionEffectChange('target', e.target.value)} />
                                            <InputField label="Sức Mạnh/Giá Trị" id="effect-value-potion" type="number" value={offlineEffect.value || ''} onChange={e => handlePotionEffectChange('value', parseInt(e.target.value) || 0)} placeholder="Sát thương/Hồi máu cố định" />
                                            {offlineEffect.type === 'APPLY_STATUS' && (<> <InputField label="Trạng Thái Gây Ra" id="effect-status-potion" type="select" options={['', ...OFFLINE_STATUSES]} value={offlineEffect.status || ''} onChange={e => handlePotionEffectChange('status', e.target.value)} /><InputField label="Thời Gian (lượt)" id="effect-duration-potion" type="number" value={offlineEffect.duration || ''} onChange={e => handlePotionEffectChange('duration', parseInt(e.target.value) || 0)} /> </>)}
                                            {offlineEffect.type === 'REVIVE' && (<InputField label="Phần Trăm HP Hồi Sinh" id="effect-percentage-potion" type="number" value={offlineEffect.percentage || ''} onChange={e => handlePotionEffectChange('percentage', parseInt(e.target.value) || 0)} placeholder="Vd: 25 cho 25%" />)}
                                        </div>
                                    </div>
                                </div>
                                <div className="bg-gray-900 p-3 sm:p-4 rounded-lg shadow-xl border border-gray-700">
                                    <h2 className="text-xl font-semibold text-amber-300 mb-3 border-b border-gray-600 pb-2">{VIETNAMESE.craftingMaterialsSection}</h2>
                                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2 sm:gap-3">
                                        {potionMaterialSlots.map((slot) => (<CraftingMaterialSlotUI key={slot.id} slotId={slot.id} material={slot.itemId ? knowledgeBase.inventory.find(i => i.id === slot.itemId) || null : null} onDropMaterial={handleDropOnPotionMaterialSlot} onRemoveMaterial={handleRemovePotionMaterial} isDraggingOver={draggingOverSlotId === slot.id} onDragEnterSlot={setDraggingOverSlotId} onDragLeaveSlot={() => setDraggingOverSlotId(null)} onClick={handlePotionMaterialSlotClick}/>))}
                                    </div>
                                    <div className="text-center mt-3 p-2 bg-gray-800 rounded-md"><p className="text-amber-400 font-semibold">Chi phí: {POTION_CRAFT_BASE_COST * potionMaterialSlots.map(s => s.itemId).filter(Boolean).length} {currencyName}</p></div>
                                </div>
                                <Button onClick={handleCreatePotion} variant="primary" size="lg" className="w-full bg-amber-600 hover:bg-amber-700 focus:ring-amber-500" isLoading={isCrafting} disabled={isCrafting}>Chế Tác Đan Dược</Button>
                            </div>
                            <div className="lg:col-span-1"><MaterialInventoryListUI inventory={knowledgeBase.inventory} onDragStartItem={handleDragStartFromInventory}/></div>
                        </>
                    )}
                </div>
            </div>
        )}
      </div>
    </div>
    <MaterialSelectionModal 
        isOpen={isMaterialModalOpen}
        onClose={() => setIsMaterialModalOpen(false)}
        inventory={knowledgeBase.inventory}
        onSelectMaterial={handleSelectMaterialFromModal}
    />
    </>
  );
};

export default CraftingScreen;