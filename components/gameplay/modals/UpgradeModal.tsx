import React, { useState, useMemo } from 'react';
import { KnowledgeBase, Item } from '../../../types';
import Modal from '../../ui/Modal';
import { VIETNAMESE } from '../../../constants';
import { useGame } from '../../../hooks/useGame';
import * as GameTemplates from '../../../templates';

interface UpgradeModalProps {
    knowledgeBase: KnowledgeBase;
    mainItem: Item;
    onClose: () => void;
    onUpgrade: (mainItemId: string, sacrificeItemIds: string[]) => void;
}

const UpgradeModal: React.FC<UpgradeModalProps> = ({ knowledgeBase, mainItem, onClose, onUpgrade }) => {
    const game = useGame();
    const [selectedSacrifices, setSelectedSacrifices] = useState<string[]>([]);
    
    const equipment = mainItem as GameTemplates.EquipmentTemplate;
    const requiredRank = equipment.rank || 1;

    const availableSacrifices = useMemo(() => {
        return knowledgeBase.inventory.filter(item => {
            if (item.id === mainItem.id) return false;
            if (item.category !== GameTemplates.ItemCategory.EQUIPMENT) return false;
            
            const itemEq = item as GameTemplates.EquipmentTemplate;
            const itemRank = itemEq.rank || 1;
            
            // Sacrifice must be >= main item rank
            return itemRank >= requiredRank;
        });
    }, [knowledgeBase.inventory, mainItem, requiredRank]);

    const toggleSacrifice = (id: string) => {
        setSelectedSacrifices(prev => {
            if (prev.includes(id)) {
                return prev.filter(i => i !== id);
            }
            if (prev.length >= 3) return prev;
            return [...prev, id];
        });
    };

    const handleUpgrade = () => {
        if (selectedSacrifices.length === 3) {
            onUpgrade(mainItem.id, selectedSacrifices);
            onClose();
        }
    };

    return (
        <Modal isOpen={true} onClose={onClose} title={VIETNAMESE.itemUpgradeModalTitle}>
            <div className="flex flex-col gap-4">
                {/* Main Item Info */}
                <div className="bg-gray-800/50 p-4 rounded-lg border border-amber-500/30">
                    <h3 className="text-amber-400 font-bold mb-2">{mainItem.name}</h3>
                    <div className="flex gap-4">
                        <p className="text-sm text-gray-300 mb-1">
                            <span className="text-gray-500">{VIETNAMESE.rankLabel || "Bậc"}:</span> {requiredRank}
                        </p>
                        <p className="text-sm text-gray-300 mb-1">
                            <span className="text-gray-500">Cấp:</span> {equipment.upgradeLevel || 0}
                        </p>
                    </div>
                    <p className="text-xs text-gray-400 italic">{mainItem.description}</p>
                </div>

                {/* Requirements */}
                <div className="bg-blue-900/20 p-3 rounded border border-blue-700/30 text-center">
                    <p className="text-sm text-blue-300">{VIETNAMESE.sacrificeRequirement}</p>
                    <p className="text-xs text-blue-400 mt-1">({selectedSacrifices.length}/3)</p>
                </div>

                {/* Sacrifice Selection */}
                <div className="max-h-60 overflow-y-auto custom-scrollbar pr-2 space-y-2">
                    <h4 className="text-sm font-semibold text-gray-400 sticky top-0 bg-gray-900 py-1">
                        {VIETNAMESE.sacrificingItemsSection}
                    </h4>
                    {availableSacrifices.length > 0 ? (
                        availableSacrifices.map(item => {
                            const isSelected = selectedSacrifices.includes(item.id);
                            return (
                                <div 
                                    key={item.id}
                                    onClick={() => toggleSacrifice(item.id)}
                                    className={`p-2 rounded border cursor-pointer transition-colors ${
                                        isSelected 
                                        ? 'bg-amber-900/40 border-amber-500' 
                                        : 'bg-gray-800/30 border-gray-700 hover:border-gray-500'
                                    }`}
                                >
                                    <div className="flex justify-between items-center">
                                        <div>
                                            <p className={`text-sm ${isSelected ? 'text-amber-400' : 'text-gray-200'}`}>
                                                {item.name}
                                            </p>
                                            <p className="text-xs text-gray-500">Bậc {(item as any).rank || 1}</p>
                                        </div>
                                        {isSelected && <span className="text-amber-500 text-xs font-bold">✓</span>}
                                    </div>
                                </div>
                            );
                        })
                    ) : (
                        <p className="text-gray-500 text-center py-4 italic text-sm">
                            {VIETNAMESE.notEnoughSacrifices}
                        </p>
                    )}
                </div>

                {/* Action */}
                <button
                    disabled={selectedSacrifices.length < 3}
                    onClick={handleUpgrade}
                    className={`w-full py-3 rounded-lg font-bold uppercase tracking-wider transition-all ${
                        selectedSacrifices.length === 3
                        ? 'bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-500 hover:to-orange-500 text-white shadow-lg shadow-amber-900/20'
                        : 'bg-gray-700 text-gray-500 cursor-not-allowed'
                    }`}
                >
                    {VIETNAMESE.upgradeItemButton}
                </button>
            </div>
        </Modal>
    );
};

export default UpgradeModal;
