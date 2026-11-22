
import React, { useState, useMemo } from 'react';
import { Item, Skill } from '../../../types';
import Modal from '../../ui/Modal';
import InputField from '../../ui/InputField';
import * as GameTemplates from '../../../templates';
import { VIETNAMESE } from '../../../constants';

interface InteractionSelectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  inventory: Item[];
  skills: Skill[];
  onSelect: (type: 'item' | 'skill', object: Item | Skill) => void;
  targetName: string;
}

const InteractionSelectionModal: React.FC<InteractionSelectionModalProps> = ({ 
    isOpen, onClose, inventory, skills, onSelect, targetName 
}) => {
  const [activeTab, setActiveTab] = useState<'item' | 'skill'>('item');
  const [searchTerm, setSearchTerm] = useState('');

  const filteredItems = useMemo(() => {
    return inventory.filter(item => {
        // Filter for usable/consumable items (Potions, or Misc marked as usable)
        const isUsable = item.category === GameTemplates.ItemCategory.POTION || 
                        (item.category === GameTemplates.ItemCategory.MISCELLANEOUS && (item as any).miscDetails?.usable);
        return isUsable && item.name.toLowerCase().includes(searchTerm.toLowerCase());
    });
  }, [inventory, searchTerm]);

  const filteredSkills = useMemo(() => {
    return skills.filter(skill => {
        // Filter for active skills usually used in interactions/combat
        const isActive = skill.skillType === GameTemplates.SkillType.LINH_KI || 
                         skill.skillType === GameTemplates.SkillType.THAN_THONG ||
                         skill.skillType === GameTemplates.SkillType.CAM_THUAT ||
                         skill.skillType === GameTemplates.SkillType.KHAC;
        return isActive && skill.name.toLowerCase().includes(searchTerm.toLowerCase());
    });
  }, [skills, searchTerm]);

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={`Tương tác với ${targetName}`}>
      <div className="flex flex-col h-[60vh]">
        
        {/* Tabs */}
        <div className="flex border-b border-gray-600 mb-3">
            <button 
                onClick={() => setActiveTab('item')} 
                className={`flex-1 py-2 text-sm font-semibold ${activeTab === 'item' ? 'text-amber-400 border-b-2 border-amber-400' : 'text-gray-400 hover:text-white'}`}
            >
                Vật Phẩm
            </button>
            <button 
                onClick={() => setActiveTab('skill')} 
                className={`flex-1 py-2 text-sm font-semibold ${activeTab === 'skill' ? 'text-cyan-400 border-b-2 border-cyan-400' : 'text-gray-400 hover:text-white'}`}
            >
                Kỹ Năng
            </button>
        </div>

        {/* Search */}
        <div className="mb-3 flex-shrink-0">
          <InputField
            label=""
            id="interaction-search"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder={`Tìm kiếm ${activeTab === 'item' ? 'vật phẩm' : 'kỹ năng'}...`}
            className="!mb-0"
          />
        </div>

        {/* List */}
        <div className="flex-grow overflow-y-auto custom-scrollbar pr-2 -mr-2 bg-gray-900/50 rounded-md p-2">
            {activeTab === 'item' ? (
                filteredItems.length > 0 ? (
                    <ul className="space-y-2">
                        {filteredItems.map(item => (
                            <li key={item.id}>
                                <button
                                    onClick={() => onSelect('item', item)}
                                    className="w-full text-left p-3 bg-gray-800 hover:bg-gray-700 rounded-lg transition-colors flex justify-between items-center border border-gray-700 hover:border-amber-500/50"
                                >
                                    <div>
                                        <p className="font-semibold text-indigo-200">{item.name} <span className="text-xs text-gray-400">(x{item.quantity})</span></p>
                                        <p className="text-xs text-gray-500">{item.rarity}</p>
                                    </div>
                                    <span className="text-xs px-2 py-1 bg-amber-900/50 text-amber-200 rounded border border-amber-700">Sử dụng</span>
                                </button>
                            </li>
                        ))}
                    </ul>
                ) : <p className="text-center text-gray-500 italic mt-4">Không có vật phẩm khả dụng.</p>
            ) : (
                filteredSkills.length > 0 ? (
                    <ul className="space-y-2">
                        {filteredSkills.map(skill => (
                            <li key={skill.id}>
                                <button
                                    onClick={() => onSelect('skill', skill)}
                                    className="w-full text-left p-3 bg-gray-800 hover:bg-gray-700 rounded-lg transition-colors flex justify-between items-center border border-gray-700 hover:border-cyan-500/50"
                                >
                                    <div>
                                        <p className="font-semibold text-indigo-200">{skill.name}</p>
                                        <p className="text-xs text-gray-500">{skill.skillType} {skill.manaCost > 0 ? `- ${skill.manaCost} MP` : ''}</p>
                                    </div>
                                    <span className="text-xs px-2 py-1 bg-cyan-900/50 text-cyan-200 rounded border border-cyan-700">Thi triển</span>
                                </button>
                            </li>
                        ))}
                    </ul>
                ) : <p className="text-center text-gray-500 italic mt-4">Không có kỹ năng khả dụng.</p>
            )}
        </div>
      </div>
    </Modal>
  );
};

export default InteractionSelectionModal;
