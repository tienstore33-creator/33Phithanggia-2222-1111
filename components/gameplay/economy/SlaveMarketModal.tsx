import React, { useState, useMemo, useEffect } from 'react';
import { KnowledgeBase, Slave, NPC, Prisoner } from '../../../types';
import Modal from '../../ui/Modal';
import { VIETNAMESE } from '../../../constants';
import Button from '../../ui/Button';
import { useGame } from '../../../hooks/useGame';
import { getDeterministicAvatarSrc } from '../../../utils/avatarUtils';
import { calculatePrisonerValue, calculateSlaveValue } from '../../../utils/statsCalculationUtils';
import { seedVendorsForLocation } from '../../../services/economy/vendorAutoSeeder';

interface SlaveEntryProps {
  slave: Slave;
  price: number;
  currencyName: string;
  actionLabel: string;
  onAction: () => void;
  onSlaveClick: (slave: Slave) => void;
  disabled?: boolean;
}

const SlaveEntry: React.FC<SlaveEntryProps> = ({ slave, price, currencyName, actionLabel, onAction, onSlaveClick, disabled }) => {
  return (
    <div className="flex items-center justify-between p-2 bg-gray-700/50 rounded-lg hover:bg-gray-700/80 transition-colors duration-150">
      <div 
        className="flex-grow cursor-pointer flex items-center gap-3"
        onClick={() => onSlaveClick(slave)}
        title={`Xem chi tiết ${slave.name}`}
      >
        <img src={getDeterministicAvatarSrc(slave)} alt={slave.name} className="w-10 h-10 rounded-full object-cover border border-gray-600"/>
        <div>
            <p className="font-semibold text-indigo-300">{slave.name}</p>
            <p className="text-xs text-gray-400">{slave.realm} - Tư chất: {slave.tuChat}</p>
        </div>
      </div>
      <div className="flex items-center space-x-3 flex-shrink-0">
        <p className="text-sm font-semibold text-amber-400">{price.toLocaleString()} {currencyName}</p>
        <Button 
            size="sm" 
            variant="primary" 
            onClick={onAction} 
            className="text-xs"
            disabled={disabled}
        >
          {actionLabel}
        </Button>
      </div>
    </div>
  );
};

const PrisonerEntry: React.FC<{
  prisoner: Prisoner;
  price: number;
  currencyName: string;
  actionLabel: string;
  onAction: () => void;
  onPrisonerClick: (prisoner: Prisoner) => void;
  disabled?: boolean;
}> = ({ prisoner, price, currencyName, actionLabel, onAction, onPrisonerClick, disabled }) => {
  return (
    <div className="flex items-center justify-between p-2 bg-gray-700/50 rounded-lg hover:bg-gray-700/80 transition-colors duration-150">
      <div 
        className="flex-grow cursor-pointer flex items-center gap-3"
        onClick={() => onPrisonerClick(prisoner)}
        title={`Xem chi tiết ${prisoner.name}`}
      >
        <img src={getDeterministicAvatarSrc(prisoner)} alt={prisoner.name} className="w-10 h-10 rounded-full object-cover border border-gray-600"/>
        <div>
            <p className="font-semibold text-indigo-300">{prisoner.name}</p>
            <p className="text-xs text-gray-400">
                {prisoner.realm || 'Phàm nhân'}
                {typeof prisoner.willpower === 'number' ? ` - Ý chí: ${prisoner.willpower}` : ''}
                {typeof prisoner.resistance === 'number' ? `, P.Kháng: ${prisoner.resistance}` : ''}
            </p>
        </div>
      </div>
      <div className="flex items-center space-x-3 flex-shrink-0">
        <p className="text-sm font-semibold text-amber-400">{(price || 0).toLocaleString()} {currencyName}</p>
        <Button 
            size="sm" 
            variant="primary" 
            onClick={onAction} 
            className="text-xs"
            disabled={disabled}
        >
          {actionLabel}
        </Button>
      </div>
    </div>
  );
};


interface SlaveMarketModalProps {
    knowledgeBase: KnowledgeBase;
    onClose: () => void;
    onBuySlave: (slave: Slave, vendorId: string) => void;
    locationId: string;
}

const SlaveMarketModal: React.FC<SlaveMarketModalProps> = ({ knowledgeBase, onClose, onBuySlave, locationId }) => {
    const game = useGame();
    const { discoveredNPCs, playerStats, prisoners, slaves } = knowledgeBase;

    const slaveTraders = useMemo(() => {
        return discoveredNPCs.filter(npc => 
            npc.locationId === locationId && npc.vendorType === 'SlaveTrader'
        );
    }, [discoveredNPCs, locationId]);

    const [activeTraderId, setActiveTraderId] = useState<string | null>(slaveTraders[0]?.id || null);
    const [activeTab, setActiveTab] = useState<'buy_slave' | 'sell_slave' | 'buy_prisoner' | 'sell_prisoner'>('buy_slave');

    useEffect(() => {
        if (slaveTraders.length === 0) {
            console.log("[Auto-Seeder] Slave traders empty, seeding now for location:", locationId);
            game.setKnowledgeBase(prev => seedVendorsForLocation(prev, locationId, 'slave_market'));
        }
    }, [slaveTraders.length, locationId, game.setKnowledgeBase]);

    useEffect(() => {
        if (!activeTraderId && slaveTraders.length > 0) {
            setActiveTraderId(slaveTraders[0].id);
        }
    }, [slaveTraders, activeTraderId]);
    
    const currencyName = knowledgeBase.worldConfig?.currencyName || "Tiền";
    const selectedTrader = slaveTraders.find(v => v.id === activeTraderId);

    const handleTraderTabClick = (traderId: string) => {
        setActiveTraderId(traderId);
        setActiveTab('buy_slave'); // Reset to buy tab on trader change
    };

    const renderContent = () => {
        if (!selectedTrader) {
            return <p className="text-gray-400 italic text-center py-8">Không có thương nhân nô lệ nào ở đây.</p>;
        }

        switch (activeTab) {
            case 'buy_slave':
                return (selectedTrader.slavesForSale && selectedTrader.slavesForSale.length > 0) ? selectedTrader.slavesForSale.map(slave => (
                    <SlaveEntry 
                        key={slave.id} slave={slave} price={slave.value || 0} currencyName={currencyName}
                        actionLabel={VIETNAMESE.buyButton} onAction={() => game.handleBuySlave(slave, selectedTrader.id)}
                        onSlaveClick={(s) => game.openEntityModal('slave', s)}
                        disabled={playerStats.currency < (slave.value || 0)}
                    />
                )) : <p className="text-gray-400 italic">Thương nhân này không có nô lệ nào để bán.</p>;
            
            case 'sell_slave':
                 return slaves.length > 0 ? slaves.map(slave => {
                    const calculatedValue = calculateSlaveValue(slave, knowledgeBase);
                    const sellPrice = Math.max(10, Math.floor(calculatedValue * 0.8));
                    return (
                        <SlaveEntry 
                            key={slave.id} slave={slave} price={sellPrice} currencyName={currencyName}
                            actionLabel={VIETNAMESE.sellButton} onAction={() => game.handleSellSlave(slave.id, selectedTrader.id)}
                            onSlaveClick={(s) => game.openEntityModal('slave', s)}
                        />
                    );
                }) : <p className="text-gray-400 italic">Bạn không có nô lệ nào để bán.</p>;

            case 'buy_prisoner':
                return (selectedTrader.prisonersForSale && selectedTrader.prisonersForSale.length > 0) ? selectedTrader.prisonersForSale.map(prisoner => {
                    const price = (prisoner as any).value || 0;
                    return (
                        <PrisonerEntry 
                            key={prisoner.id} prisoner={prisoner} price={price} currencyName={currencyName}
                            actionLabel={VIETNAMESE.buyButton} onAction={() => game.handleBuyPrisoner(prisoner.id, selectedTrader.id)}
                            onPrisonerClick={(p) => game.openEntityModal('prisoner', p)}
                            disabled={playerStats.currency < price}
                        />
                    )
                }) : <p className="text-gray-400 italic">Thương nhân này không có tù nhân nào để bán.</p>;

            case 'sell_prisoner':
                return prisoners.length > 0 ? prisoners.map(prisoner => {
                    const calculatedValue = calculatePrisonerValue(prisoner, knowledgeBase);
                    const sellPrice = Math.max(10, Math.floor(calculatedValue * 0.8));
                    return (
                        <PrisonerEntry 
                            key={prisoner.id} prisoner={prisoner} price={sellPrice} currencyName={currencyName}
                            actionLabel={VIETNAMESE.sellButton} onAction={() => game.handleSellPrisoner(prisoner.id, selectedTrader.id)}
                            onPrisonerClick={(p) => game.openEntityModal('prisoner', p)}
                        />
                    )
                }) : <p className="text-gray-400 italic">Bạn không có tù nhân nào để bán.</p>;
        }
    };
    
    const getTabClass = (tabName: typeof activeTab) => {
        return `py-2 px-3 text-xs sm:text-sm whitespace-nowrap ${activeTab === tabName ? 'text-amber-400 border-b-2 border-amber-400 font-semibold' : 'text-gray-400 hover:text-white'}`;
    };


    return (
        <Modal isOpen={true} onClose={onClose} title={VIETNAMESE.slaveMarketTitle || 'Chợ Nô Lệ'}>
            <div className="flex flex-col min-h-0">
                <p className="text-right text-sm text-amber-300 mb-2 bg-gray-900/40 p-2 rounded border border-gray-700">
                    {VIETNAMESE.yourWallet} {playerStats.currency.toLocaleString()} {currencyName}
                </p>
                
                <div className="flex border-b border-gray-600 mb-2 overflow-x-auto custom-scrollbar">
                    {slaveTraders.map(trader => (
                        <button 
                            key={trader.id}
                            onClick={() => handleTraderTabClick(trader.id)}
                            className={`py-2 px-4 text-sm whitespace-nowrap ${activeTraderId === trader.id ? 'text-amber-400 border-b-2 border-amber-400 font-semibold' : 'text-gray-400 hover:text-white'}`}
                        >
                            {trader.name}
                        </button>
                    ))}
                </div>
                {selectedTrader?.vendorSlogan && (
                    <p className="text-center text-sm italic text-gray-400 my-2">"{selectedTrader.vendorSlogan}"</p>
                )}

                {selectedTrader ? (
                    <div className="flex flex-col flex-grow">
                         <div className="flex border-b border-gray-700 mb-2 overflow-x-auto custom-scrollbar">
                            <button onClick={() => setActiveTab('buy_slave')} className={getTabClass('buy_slave')}>Mua Nô Lệ</button>
                            <button onClick={() => setActiveTab('sell_slave')} className={getTabClass('sell_slave')}>Bán Nô Lệ</button>
                            <button onClick={() => setActiveTab('buy_prisoner')} className={getTabClass('buy_prisoner')}>Mua Tù Nhân</button>
                            <button onClick={() => setActiveTab('sell_prisoner')} className={getTabClass('sell_prisoner')}>Bán Tù Nhân</button>
                        </div>
                        <div className="flex-grow overflow-y-auto custom-scrollbar pr-2 space-y-2">
                             {renderContent()}
                        </div>
                    </div>
                ) : <p className="text-gray-400 italic text-center py-8">Không có thương nhân nô lệ nào ở đây.</p>}
            </div>
        </Modal>
    );
};

export default SlaveMarketModal;