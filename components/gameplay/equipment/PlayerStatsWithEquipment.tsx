
import React, { useState, ChangeEvent, useRef } from 'react'; 
import { PlayerStats, Item, EquipmentSlotId, KnowledgeBase, StatusEffect, WorldDate, TuChatTier, RealmBaseStatDefinition } from '../../../types';
import { VIETNAMESE, FEMALE_AVATAR_BASE_URL, MAX_FEMALE_AVATAR_INDEX, MALE_AVATAR_PLACEHOLDER_URL } from '../../../constants';
import * as GameTemplates from '../../../templates';
import Modal from '../../ui/Modal'; 
import Button from '../../ui/Button'; 
import InputField from '../../ui/InputField'; 
import Spinner from '../../ui/Spinner'; 
import { isValidImageUrl } from '../../../utils/imageValidationUtils'; 
import { getDeterministicAvatarSrc } from '../../../utils/avatarUtils';
import DynamicAvatar from '../../DynamicAvatar';
import { safeNumber, formatNumberDot } from '../../../utils/combatDataSanitizer';
import { getHpFormulaExplanation, calculateRealmBaseStats } from '../../../utils/statsCalculationUtils';
import { formatTimeString } from '../../../utils/timeUtils';
import { ItemSkillUsageModal } from '../modals/ItemSkillUsageModal';

interface PlayerStatsWithEquipmentProps {
  playerStats: PlayerStats; 
  equippedItems: Record<EquipmentSlotId, Item['id'] | null>;
  inventory: Item[]; 
  currencyName?: string;
  playerName?: string;
  playerGender?: string;
  playerRace?: string;
  playerAvatarUrl?: string; 
  playerAvatarData?: string; 
  worldConfig?: KnowledgeBase['worldConfig'];
  worldDate?: WorldDate;
  isPlayerContext?: boolean; 
  onPlayerAvatarUploadRequest?: (base64DataOrUrl: string) => void; 
  isUploadingPlayerAvatar?: boolean; 
  currentLocationName?: string;
  isSafeZone?: boolean;
  safetyOverride?: 'safe' | 'danger';
  tuChat?: TuChatTier;
  personId?: string; // NEW: Unique ID for the person (player or NPC)
  setIsJourneyLogOpen?: (isOpen: boolean) => void;
  setIsSummaryModalOpen?: (isOpen: boolean) => void; 
}

const PlayerStatsWithEquipment: React.FC<PlayerStatsWithEquipmentProps> = ({
  playerStats,
  equippedItems,
  inventory,
  currencyName,
  playerName,
  playerGender,
  playerRace,
  playerAvatarUrl, 
  playerAvatarData, 
  worldConfig,
  worldDate,
  isPlayerContext,
  onPlayerAvatarUploadRequest,
  isUploadingPlayerAvatar,
  currentLocationName,
  isSafeZone,
  safetyOverride,
  tuChat,
  personId,
  setIsJourneyLogOpen,
  setIsSummaryModalOpen,
}) => {
  const [selectedStatusEffect, setSelectedStatusEffect] = useState<StatusEffect | null>(null);
  const [isItemSkillModalOpen, setIsItemSkillModalOpen] = useState(false);
  const isCultivationEnabled = worldConfig?.isCultivationEnabled !== undefined ? worldConfig.isCultivationEnabled : true;
  const playerAvatarFileInputRef = useRef<HTMLInputElement>(null);

  // New state for player avatar URL input in gameplay
  const [showPlayerAvatarUrlInput, setShowPlayerAvatarUrlInput] = useState(false);
  const [playerAvatarUrlInputValue, setPlayerAvatarUrlInputValue] = useState('');
  const [isPlayerAvatarUrlValidating, setIsPlayerAvatarUrlValidating] = useState(false);
  const [playerAvatarUrlError, setPlayerAvatarUrlError] = useState<string | null>(null);
  
  const tuChatToDisplay = tuChat || playerStats.tuChat;

  const getBonusForStat = (statKey: keyof Omit<PlayerStats, 'realm' | 'currency' | 'isInCombat' | 'turn' | 'hieuUngBinhCanh' | 'sinhLuc' | 'linhLuc' | 'kinhNghiem' | 'activeStatusEffects' | 'spiritualRoot' | 'specialPhysique' | 'professions' | 'tuChat'>): number | undefined => {
    return undefined; // We rely on effectiveValue - baseValue instead
  };

  const renderStatLine = (
    label: string, 
    baseValue: number | undefined, 
    effectiveValue: number | undefined, 
    bonusValue?: number,
    currentStatValueForDisplay?: number | undefined,
    explanationSteps?: string[]
    ) => {
    const baseVal = safeNumber(baseValue);
    const effectiveVal = safeNumber(effectiveValue);
    const equipBonus = bonusValue !== undefined ? safeNumber(bonusValue) : (effectiveVal - baseVal);
    const currentVal = currentStatValueForDisplay !== undefined ? safeNumber(currentStatValueForDisplay) : undefined;
    
    const displayValue = currentVal !== undefined 
        ? `${formatNumberDot(currentVal)}/${formatNumberDot(effectiveVal)}` 
        : formatNumberDot(effectiveVal);
    
    const tooltipText = explanationSteps && explanationSteps.length > 0
        ? formatNumberDot(explanationSteps.join('\n'))
        : `Cơ bản: ${formatNumberDot(baseVal)}, Trang bị: ${equipBonus > 0 ? '+' : ''}${formatNumberDot(equipBonus)}`;

    return (
      <div className="text-sm py-0.5">
        <span className="font-semibold text-indigo-300">{label}: </span>
        <span className="text-gray-100 cursor-help border-b border-dotted border-gray-500" title={tooltipText}>
          {displayValue}
          {equipBonus !== 0 && (
            <span className={`ml-1 text-xs ${equipBonus > 0 ? 'text-green-400' : 'text-red-400'}`}>
              ({formatNumberDot(baseVal)}{equipBonus > 0 ? `+${formatNumberDot(equipBonus)}` : formatNumberDot(equipBonus)})
            </span>
          )}
        </span>
      </div>
    );
  };

  const realmLabel = isCultivationEnabled ? VIETNAMESE.realmLabel : "Trạng Thái/Cấp Độ";
  const energyLabel = isCultivationEnabled ? VIETNAMESE.linhLucLabel : "Năng Lượng/Thể Lực";
  const experienceLabel = isCultivationEnabled ? VIETNAMESE.kinhNghiemLabel : "Kinh Nghiệm (Chung)";

  const getStatusEffectTypeColor = (type: StatusEffect['type']) => {
    switch (type) {
      case 'buff': return 'text-green-400';
      case 'debuff': return 'text-red-400';
      case 'neutral': return 'text-gray-400';
      default: return 'text-gray-200';
    }
  };
  
  const formatStatModifiers = (modifiers: StatusEffect['statModifiers']) => {
    if (!modifiers || Object.keys(modifiers).length === 0) return "Không có.";
    return Object.entries(modifiers).map(([key, value]) => {
        let statName = key;
        if (key === 'maxSinhLuc') statName = "Sinh Lực Tối Đa";
        else if (key === 'maxLinhLuc') statName = "Linh Lực Tối Đa";
        else if (key === 'sucTanCong') statName = "Sức Tấn Công";
        return `${statName}: ${value}`;
    }).join('; ');
  };

  const handlePlayerAvatarFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file && onPlayerAvatarUploadRequest) {
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64String = reader.result as string;
        onPlayerAvatarUploadRequest(base64String);
        setShowPlayerAvatarUrlInput(false); 
        setPlayerAvatarUrlInputValue('');
        setPlayerAvatarUrlError(null);
      };
      reader.readAsDataURL(file);
      if (playerAvatarFileInputRef.current) { 
          playerAvatarFileInputRef.current.value = "";
      }
    }
  };

  const handlePlayerAvatarUrlSubmit = async () => {
    if (!playerAvatarUrlInputValue.trim() || !onPlayerAvatarUploadRequest) return;
    setIsPlayerAvatarUrlValidating(true);
    setPlayerAvatarUrlError(null);
    const isValid = await isValidImageUrl(playerAvatarUrlInputValue);
    setIsPlayerAvatarUrlValidating(false);
    if (isValid) {
      onPlayerAvatarUploadRequest(playerAvatarUrlInputValue);
      setShowPlayerAvatarUrlInput(false);
    } else {
      setPlayerAvatarUrlError(VIETNAMESE.avatarUrlInvalid);
    }
  };

  return (
    <>
    <div className="bg-gray-800 p-3 sm:p-4 rounded-lg shadow-md border border-gray-700">
      <div className="flex items-start mb-3 border-b border-gray-700 pb-2">
        <div className="relative shrink-0 mr-3 sm:mr-4">
          {playerGender?.toLowerCase().includes("nữ") && !(playerAvatarData || playerAvatarUrl) ? (
            <DynamicAvatar 
              hairIndex={worldConfig?.playerAvatarHairId ?? 0} 
              faceIndex={worldConfig?.playerAvatarFaceId ?? 0} 
              size={80} 
            />
          ) : (
            <img 
              src={getDeterministicAvatarSrc({ 
                  id: personId || (isPlayerContext ? 'player' : 'unknown-char'), 
                  name: playerName, 
                  avatarUrl: playerAvatarData || playerAvatarUrl, 
                  gender: playerGender 
              })}
              alt={VIETNAMESE.playerAvatarLabel} 
              className="w-16 h-16 sm:w-20 sm:h-20 rounded-full object-cover border-2 border-indigo-500 shadow-md"
            />
          )}
        </div>
        <div className="flex-grow">
            <h3 className="text-lg font-semibold text-indigo-400">
            <span>{isPlayerContext ? VIETNAMESE.playerStatsSection : playerName}</span>
            {isCultivationEnabled && playerStats.hieuUngBinhCanh && (
                <span className="block text-xs font-bold text-red-400 bg-red-900/50 px-2 py-0.5 rounded-full border border-red-600 animate-pulse mt-1">
                {VIETNAMESE.bottleneckEffectLabel}
                </span>
            )}
            </h3>
            {isPlayerContext && (
              <div className="mt-1 space-y-1">
                <div className="flex flex-wrap gap-1">
                    <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => playerAvatarFileInputRef.current?.click()}
                        className="text-xs !py-1 !px-2 border-indigo-500 hover:bg-indigo-700/50 flex-grow sm:flex-grow-0"
                        isLoading={isUploadingPlayerAvatar && !showPlayerAvatarUrlInput}
                        loadingText={VIETNAMESE.uploadingAvatarMessage}
                        disabled={isUploadingPlayerAvatar}
                        title={VIETNAMESE.uploadAvatarButtonLabel}
                    >
                     {VIETNAMESE.uploadAvatarButtonLabel}
                    </Button>
                    <input
                        type="file"
                        ref={playerAvatarFileInputRef}
                        onChange={handlePlayerAvatarFileChange}
                        accept="image/png, image/jpeg, image/webp, image/gif"
                        className="hidden"
                        id="player-avatar-upload-input"
                        disabled={isUploadingPlayerAvatar}
                    />
                    <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                            setShowPlayerAvatarUrlInput(!showPlayerAvatarUrlInput);
                            if (!showPlayerAvatarUrlInput) {
                                if (playerAvatarData && playerAvatarData.startsWith('http')) {
                                    setPlayerAvatarUrlInputValue(playerAvatarData);
                                } else if (playerAvatarUrl && playerAvatarUrl.startsWith('http')) {
                                     setPlayerAvatarUrlInputValue(playerAvatarUrl);
                                } else {
                                    setPlayerAvatarUrlInputValue('');
                                }
                            }
                            setPlayerAvatarUrlError(null);
                        }}
                        className="text-xs !py-1 !px-2 border-cyan-500 hover:bg-cyan-700/50 flex-grow sm:flex-grow-0"
                        disabled={isUploadingPlayerAvatar}
                        aria-expanded={showPlayerAvatarUrlInput}
                        title={VIETNAMESE.avatarUrlInputLabel}
                    >
                        {showPlayerAvatarUrlInput ? "Đóng URL" : VIETNAMESE.avatarUrlInputLabel.replace(":", "")}
                    </Button>
                </div>
                 {showPlayerAvatarUrlInput && (
                    <div className="mt-1.5 p-2 border border-gray-600 rounded-md bg-gray-800/30">
                        <InputField
                            label="" 
                            id="playerGameplayAvatarUrlInput"
                            value={playerAvatarUrlInputValue}
                            onChange={(e) => setPlayerAvatarUrlInputValue(e.target.value)}
                            placeholder={VIETNAMESE.avatarUrlInputPlaceholder}
                            disabled={isPlayerAvatarUrlValidating || isUploadingPlayerAvatar}
                            className="!mb-1.5"
                        />
                        <Button
                            type="button"
                            variant="primary"
                            onClick={handlePlayerAvatarUrlSubmit}
                            className="w-full text-xs !py-1"
                            isLoading={isPlayerAvatarUrlValidating}
                            disabled={isPlayerAvatarUrlValidating || isUploadingPlayerAvatar || !playerAvatarUrlInputValue.trim()}
                            loadingText={VIETNAMESE.avatarUrlValidating}
                        >
                            {VIETNAMESE.confirmUrlButton}
                        </Button>
                        {playerAvatarUrlError && <p className="text-xs text-red-400 mt-1">{playerAvatarUrlError}</p>}
                    </div>
                )}
              </div>
            )}
        </div>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-x-3 gap-y-0.5">
        {playerName && !isPlayerContext && (
          <div className="text-sm py-0.5">
            <span className="font-semibold text-indigo-300">{VIETNAMESE.characterName}: </span>
            {playerName}
            {worldConfig?.originalPlayerName && worldConfig.originalPlayerName !== playerName && (
              <span className="text-[11px] text-gray-400 font-normal ml-1 whitespace-nowrap">
                ({worldConfig.originalPlayerName})
              </span>
            )}
          </div>
        )}
        {isPlayerContext && (
          <div className="text-sm py-0.5">
            <span className="font-semibold text-indigo-300">{VIETNAMESE.characterName}: </span>
            {playerName}
            {worldConfig?.originalPlayerName && worldConfig.originalPlayerName !== playerName && (
              <span className="text-[11px] text-gray-400 font-normal ml-1 whitespace-nowrap">
                ({worldConfig.originalPlayerName})
              </span>
            )}
          </div>
        )}
        {playerGender && <div className="text-sm py-0.5"><span className="font-semibold text-indigo-300">{VIETNAMESE.gender}: </span>{playerGender}</div>}
        {playerRace && <div className="text-sm py-0.5"><span className="font-semibold text-indigo-300">{VIETNAMESE.playerRaceLabel || "Chủng Tộc"}: </span>{playerRace}</div>}
        
        {isPlayerContext && currentLocationName && (
          <div className="text-sm py-0.5 col-span-1 md:col-span-2 flex items-center flex-wrap gap-x-2">
            <span className="font-semibold text-indigo-300">{VIETNAMESE.legendCurrentLocation}: </span>
            <span className="text-gray-100">{currentLocationName}</span>
            <div className="flex items-center gap-1 ml-1">
              <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${safetyOverride !== 'danger' ? 'bg-green-900/40 text-green-400 border border-green-700' : 'bg-red-900/40 text-red-400 border border-red-700'}`}>
                {safetyOverride !== 'danger' ? VIETNAMESE.safetyStatusSafe : VIETNAMESE.safetyStatusDanger}
              </span>
              {safetyOverride && (
                <span className="text-[9px] text-indigo-400 font-medium italic opacity-80">{VIETNAMESE.aiVerified}</span>
              )}
            </div>
          </div>
        )}
        
        {isPlayerContext && worldDate && (
            <div className="text-sm py-0.5 col-span-1 md:col-span-2">
                <span className="font-semibold text-indigo-300">Thời Gian: </span>
                <span className="text-cyan-300 font-bold mr-1">{formatTimeString(worldDate)}</span>
                <span className="text-yellow-300 font-semibold">({worldDate.timeOfDay})</span>
                <span className="text-gray-300">, Ngày {worldDate.day}, Tháng {worldDate.month}, Năm {worldDate.year}</span>
            </div>
        )}

        {(playerName || playerGender || currentLocationName || worldDate) && <div className="md:col-span-2 h-1 my-1 border-t border-gray-700/50"></div>}

        <div className="text-sm py-0.5 col-span-1 md:col-span-2"><span className="font-semibold text-indigo-300">{VIETNAMESE.spiritualRootLabel || 'Linh Căn'}: </span>{playerStats.spiritualRoot ?? 'Không rõ'}</div>
        <div className="text-sm py-0.5 col-span-1 md:col-span-2"><span className="font-semibold text-indigo-300">{VIETNAMESE.specialPhysiqueLabel || 'Thể Chất'}: </span>{playerStats.specialPhysique ?? 'Không rõ'}</div>
        {tuChatToDisplay && <div className="text-sm py-0.5 col-span-1 md:col-span-2"><span className="font-semibold text-indigo-300">Tư Chất: </span>{tuChatToDisplay}</div>}
        
        <div className="md:col-span-2 h-1 my-1 border-t border-gray-700/50"></div>

        {isCultivationEnabled && 
          <div className="text-sm py-0.5 col-span-1 md:col-span-2">
              <span className="font-semibold text-indigo-300">Thọ Nguyên: </span>
              <span className="text-lime-300 font-semibold">
                {typeof playerStats.thoNguyen === 'number' 
                  ? (Number.isInteger(playerStats.thoNguyen) ? formatNumberDot(playerStats.thoNguyen) : parseFloat(playerStats.thoNguyen.toFixed(7)).toString()) 
                  : '0'} / {formatNumberDot(safeNumber(playerStats.maxThoNguyen))} (năm)
              </span>
          </div>
        }
        <div className="text-sm py-0.5 col-span-1 md:col-span-2">
            <span className="font-semibold text-indigo-300">{realmLabel}: </span>
            <span className="text-amber-400 font-semibold">{playerStats.realm ?? 'Không rõ'}</span>
        </div>
        {(() => {
            // Calculate HP Explanation
            const baseStats = calculateRealmBaseStats(playerStats.realm || "Phàm Nhân Nhất Trọng", { 
                currentRealmBaseStats: worldConfig?.majorRealmsRaw ? {} : undefined 
            } as any);
            
            const maxHpMult = playerStats.permanentBonuses?.maxHpMult || 1.0;
            
            const hpExpl = getHpFormulaExplanation(
                playerStats,
                equippedItems,
                inventory,
                { worldConfig } as any
            );
            
            return renderStatLine(
                VIETNAMESE.sinhLucLabel, 
                playerStats.baseMaxSinhLuc, 
                playerStats.maxMaxSinhLuc ?? playerStats.maxSinhLuc, // Use maxMaxSinhLuc if present for baseMax, or standard max
                getBonusForStat('maxSinhLuc'), 
                playerStats.sinhLuc,
                hpExpl.steps
            );
        })()}
        {(isCultivationEnabled || (playerStats.maxLinhLuc ?? 0) > 0 || (playerStats.baseMaxLinhLuc ?? 0) > 0) && renderStatLine(energyLabel, playerStats.baseMaxLinhLuc, playerStats.maxLinhLuc, getBonusForStat('maxLinhLuc'), playerStats.linhLuc)}
        {renderStatLine(VIETNAMESE.sucTanCongLabel, playerStats.baseSucTanCong, playerStats.sucTanCong, getBonusForStat('sucTanCong'))}
        
        {isCultivationEnabled && renderStatLine(experienceLabel, playerStats.baseMaxKinhNghiem, playerStats.maxKinhNghiem, getBonusForStat('maxKinhNghiem'), playerStats.kinhNghiem)}

        {isPlayerContext && <div className="text-sm py-0.5"><span className="font-semibold text-indigo-300">{currencyName || "Tiền Tệ"}: </span>{formatNumberDot(safeNumber(playerStats.currency))}</div>}
        {isPlayerContext && <div className="text-sm py-0.5"><span className="font-semibold text-indigo-300">Lượt: </span>{formatNumberDot(safeNumber(playerStats.turn))}</div>}
      </div>
       
      {isPlayerContext && setIsSummaryModalOpen && (
        <div className="mt-3 pt-3 border-t border-gray-700 flex flex-col gap-2">
            <Button
                variant="secondary"
                className="w-full border-teal-500 text-teal-300 hover:bg-teal-700/50"
                onClick={() => setIsSummaryModalOpen(true)}
            >
                Hành Trình Ký
            </Button>
            <Button
                variant="primary"
                className="w-full bg-gradient-to-r from-teal-600 to-indigo-600 border border-teal-500 text-white hover:from-teal-500 hover:to-indigo-500 shadow-lg shadow-teal-500/10"
                onClick={() => setIsItemSkillModalOpen(true)}
            >
                ⚡ Dùng Vật Phẩm & Kỹ Năng
            </Button>
        </div>
      )}

      {playerStats.playerSpecialStatus && isPlayerContext && (
        <div className="mt-3 pt-3 border-t-2 border-red-700/60">
            <h4 className="text-md font-semibold text-red-300 mb-1.5">{VIETNAMESE.specialStatusSection}</h4>
            <div className="space-y-1 text-sm bg-red-900/20 p-2 rounded-md">
                <p>
                    <strong className="text-red-400">Trạng Thái: </strong> 
                    <span className="font-bold capitalize">{playerStats.playerSpecialStatus.type === 'prisoner' ? 'Tù Nhân' : 'Nô Lệ'}</span>
                </p>
                <p>
                    <strong className="text-red-400">Chủ Nhân: </strong> 
                    {playerStats.playerSpecialStatus.ownerName}
                </p>
                <div className="grid grid-cols-2 gap-x-2 pt-1">
                    <p><strong className="text-indigo-300">{VIETNAMESE.statWillpower}:</strong> {formatNumberDot(safeNumber(playerStats.playerSpecialStatus.willpower))}</p>
                    <p><strong className="text-indigo-300">{VIETNAMESE.statObedience}:</strong> {formatNumberDot(safeNumber(playerStats.playerSpecialStatus.obedience))}</p>
                    <p><strong className="text-indigo-300">{VIETNAMESE.statResistance}:</strong> {formatNumberDot(safeNumber(playerStats.playerSpecialStatus.resistance))}</p>
                    <p><strong className="text-indigo-300">{VIETNAMESE.statFear}:</strong> {formatNumberDot(safeNumber(playerStats.playerSpecialStatus.fear))}</p>
                    <p><strong className="text-indigo-300">{VIETNAMESE.statTrust}:</strong> {formatNumberDot(safeNumber(playerStats.playerSpecialStatus.trust))}</p>
                </div>
            </div>
        </div>
      )}

      {(playerStats.activeStatusEffects ?? []).length > 0 && (
        <div className="mt-3 pt-3 border-t border-gray-700">
            <h4 className="text-md font-semibold text-indigo-300 mb-1.5">{VIETNAMESE.statusEffectsSection}</h4>
            <ul className="space-y-1 text-xs">
                {(playerStats.activeStatusEffects ?? []).map(effect => (
                    <li 
                        key={effect.id} 
                        className="p-1.5 bg-gray-700/50 rounded-md border border-gray-600/70 hover:bg-gray-600/70 cursor-pointer transition-colors" 
                        title={`Nhấn để xem chi tiết hiệu ứng ${effect.name}`}
                        onClick={() => setSelectedStatusEffect(effect)}
                        role="button"
                        tabIndex={0}
                        onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && setSelectedStatusEffect(effect)}
                    >
                        <div className="flex justify-between items-center">
                            <span className={`font-medium ${getStatusEffectTypeColor(effect.type)}`}>{effect.name}</span>
                            <span className="text-gray-400">
                                {effect.durationTurns > 0 ? VIETNAMESE.statusEffectDuration(effect.durationTurns) : (effect.durationTurns === 0 || effect.durationTurns === -1) ? VIETNAMESE.statusEffectPermanent : ''}
                            </span>
                        </div>
                        {effect.specialEffects && effect.specialEffects.length > 0 && (
                             <p className="text-gray-300 text-[11px] italic mt-0.5 pl-1 truncate">Ảnh hưởng: {effect.specialEffects.join('; ')}</p>
                        )}
                    </li>
                ))}
            </ul>
        </div>
      )}
    </div>

    {selectedStatusEffect && (
        <Modal
            isOpen={!!selectedStatusEffect}
            onClose={() => setSelectedStatusEffect(null)}
            title={`Chi Tiết Hiệu Ứng: ${selectedStatusEffect.name}`}
        >
            <div className="space-y-2 text-sm">
                <p><strong className="text-indigo-300">Tên:</strong> {selectedStatusEffect.name}</p>
                <p>
                    <strong className="text-indigo-300">Loại:</strong> 
                    <span className={`ml-1 font-semibold ${getStatusEffectTypeColor(selectedStatusEffect.type)}`}>
                        {selectedStatusEffect.type === 'buff' ? VIETNAMESE.statusEffectTypeBuff :
                         selectedStatusEffect.type === 'debuff' ? VIETNAMESE.statusEffectTypeDebuff :
                         VIETNAMESE.statusEffectTypeNeutral}
                    </span>
                </p>
                <p><strong className="text-indigo-300">Mô tả:</strong> {selectedStatusEffect.description}</p>
                <p>
                    <strong className="text-indigo-300">Thời gian:</strong> 
                    {selectedStatusEffect.durationTurns > 0 
                        ? VIETNAMESE.statusEffectDuration(selectedStatusEffect.durationTurns) 
                        : (selectedStatusEffect.durationTurns === 0 || selectedStatusEffect.durationTurns === -1) 
                            ? VIETNAMESE.statusEffectPermanent 
                            : 'Không rõ thời gian'}
                </p>
                {selectedStatusEffect.statModifiers && Object.keys(selectedStatusEffect.statModifiers).length > 0 && (
                    <p><strong className="text-indigo-300">Ảnh hưởng chỉ số:</strong> {formatStatModifiers(selectedStatusEffect.statModifiers)}</p>
                )}
                {selectedStatusEffect.specialEffects && selectedStatusEffect.specialEffects.length > 0 && (
                    <div>
                        <strong className="text-indigo-300">Hiệu ứng đặc biệt khác:</strong>
                        <ul className="list-disc list-inside pl-4 text-gray-300">
                            {selectedStatusEffect.specialEffects.map((eff, idx) => <li key={idx}>{eff}</li>)}
                        </ul>
                    </div>
                )}
                {selectedStatusEffect.source && <p className="text-xs text-gray-400 mt-3">Nguồn gốc: {selectedStatusEffect.source}</p>}
            </div>
        </Modal>
    )}
    
    <ItemSkillUsageModal 
        isOpen={isItemSkillModalOpen} 
        onClose={() => setIsItemSkillModalOpen(false)} 
    />
    </>
  );
};

export default PlayerStatsWithEquipment;
