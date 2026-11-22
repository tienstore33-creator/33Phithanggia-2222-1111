
import React, { useState, useEffect } from 'react';
import { useGame } from '../hooks/useGame';
import { Prisoner, GameScreen, Item, Skill } from '../types';
import { VIETNAMESE } from '../constants';
import Button from './ui/Button';
import InputField from './ui/InputField';
import Spinner from './ui/Spinner';
import Modal from './ui/Modal';
import { getEffectiveRealmSystem } from '../services/realmManager';
import { getDeterministicAvatarSrc } from './../utils/avatarUtils';
import InteractionSelectionModal from './gameplay/modals/InteractionSelectionModal';

const DebugModal: React.FC<{ title: string; prompts: string[]; responses: string[]; onClose: () => void; }> = ({ title, prompts, responses, onClose }) => {
    return (
      <Modal isOpen={true} onClose={onClose} title={title}>
        <div className="space-y-4 max-h-[60vh] overflow-y-auto custom-scrollbar">
          <div>
            <h3 className="text-lg font-semibold text-sky-300 mb-2">Prompt Đã Gửi ({prompts.length})</h3>
            <div className="space-y-2 text-xs bg-gray-900 p-2 rounded-md">
              {prompts.length > 0 ? prompts.map((prompt, index) => (
                <details key={`prompt-${index}`} className="bg-gray-800 rounded group">
                  <summary className="p-1.5 text-sky-200 cursor-pointer text-[11px] group-open:font-semibold">
                    Prompt #{prompts.length - index} (Nhấn để xem)
                  </summary>
                  <pre className="p-1.5 bg-gray-850 text-sky-100 whitespace-pre-wrap break-all text-[10px] leading-relaxed max-h-60 overflow-y-auto custom-scrollbar">
                    {prompt}
                  </pre>
                </details>
              )) : <p className="text-gray-500 italic">Chưa có prompt nào được gửi.</p>}
            </div>
          </div>
          <div>
            <h3 className="text-lg font-semibold text-lime-300 mb-2">Phản Hồi Nhận Được ({responses.length})</h3>
            <div className="space-y-2 text-xs bg-gray-900 p-2 rounded-md">
              {responses.length > 0 ? responses.map((response, index) => (
                <details key={`resp-${index}`} className="bg-gray-800 rounded group">
                  <summary className="p-1.5 text-lime-200 cursor-pointer text-[11px] group-open:font-semibold">
                    Phản hồi #{responses.length - index} (Nhấn để xem)
                  </summary>
                  <pre className="p-1.5 bg-gray-850 text-lime-100 whitespace-pre-wrap break-all text-[10px] leading-relaxed max-h-60 overflow-y-auto custom-scrollbar">
                    {response}
                  </pre>
                </details>
              )) : <p className="text-gray-500 italic">Chưa có phản hồi nào được nhận.</p>}
            </div>
          </div>
        </div>
      </Modal>
    );
};


const PrisonerManagementScreen: React.FC = () => {
    const game = useGame();
    const { 
        knowledgeBase, 
        setCurrentScreen,
        isLoadingApi, 
        prisonerInteractionLog,
        // FIX: Destructure handleFreePerson from useGame hook
        handleFreePerson,
        convertPrisoner, // NEW
        handlePrisonerAction // Used for interaction
    } = game;

    const [selectedPrisonerId, setSelectedPrisonerId] = useState<string | null>(
        knowledgeBase.prisoners.length > 0 ? knowledgeBase.prisoners[0].id : null
    );
    const [showDebug, setShowDebug] = useState(false);
    const [isInteractionModalOpen, setIsInteractionModalOpen] = useState(false);

    const selectedPrisoner = knowledgeBase.prisoners?.find(p => p.id === selectedPrisonerId);

    useEffect(() => {
        if (selectedPrisonerId && !knowledgeBase.prisoners?.some(p => p.id === selectedPrisonerId)) {
            setSelectedPrisonerId(knowledgeBase.prisoners?.[0]?.id || null);
        }
    }, [knowledgeBase.prisoners, selectedPrisonerId]);

    
    const handleNormalizeRealms = () => {
        const realmSystem = getEffectiveRealmSystem(game.knowledgeBase);
        const validRealms = new Set<string>();
        realmSystem.majorRealms.forEach(major => {
            validRealms.add(major);
            realmSystem.minorRealms.forEach(minor => {
                validRealms.add(major + ' ' + minor);
            });
        });
        
        const wrongNpcs = game.knowledgeBase.prisoners.filter(c => !validRealms.has(c.realm));
        
        if (wrongNpcs.length > 0) {
            game.showNotification(`Đang tiến hành chuẩn hóa cảnh giới cho ${wrongNpcs.length} tù binh...`, "info");
        } else {
            game.showNotification("Đang kiểm tra và chuẩn hóa chỉ số tù binh...", "info");
        }
        
        game.normalizeNpcRealms(wrongNpcs as any[]);
    };

    const handleUseItemOrSkill = (type: 'item' | 'skill', object: Item | Skill) => {
        if (!selectedPrisoner) return;
        
        const actionString = type === 'item' 
            ? `Sử dụng vật phẩm "${object.name}" lên ${selectedPrisoner.name}` 
            : `Thi triển kỹ năng "${object.name}" lên ${selectedPrisoner.name}`;
            
        handlePrisonerAction(selectedPrisoner, actionString);
        setIsInteractionModalOpen(false);
    };
    
    return (
        <>
        <div className="min-h-screen flex flex-col bg-gray-800 p-4 text-gray-100">
            <header className="mb-4 flex justify-between items-center">
                <h1 className="text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-red-400 via-gray-500 to-red-600">
                    {VIETNAMESE.prisonerManagementScreenTitle}
                </h1>
                <div className="flex items-center gap-2">
                    
                    <Button variant="secondary" onClick={handleNormalizeRealms} disabled={isLoadingApi} className="bg-blue-600 hover:bg-blue-700 border-none text-white">
                        Chuẩn Hoá Thực Lực
                    </Button>
                    <Button variant="ghost" onClick={() => setShowDebug(true)} className="border-yellow-500 text-yellow-300 hover:bg-yellow-700 hover:text-white">
                        Debug
                    </Button>
                    <Button variant="secondary" onClick={() => setCurrentScreen(GameScreen.Gameplay)} disabled={isLoadingApi}>
                        {VIETNAMESE.goBackButton}
                    </Button>
                </div>
            </header>

            <div className="flex-grow grid grid-cols-1 lg:grid-cols-2 gap-4 overflow-hidden h-full">
                {/* Left Column (Narrow): Prisoner List */}
                <div className="lg:col-span-1 bg-gray-900 p-3 rounded-lg shadow-xl border border-gray-700 h-full overflow-y-auto custom-scrollbar">
                    <h2 className="text-xl font-semibold text-gray-300 mb-3 border-b border-gray-600 pb-2">Danh Sách Tù Nhân</h2>
                    {knowledgeBase.prisoners.length === 0 ? (
                        <p className="text-gray-400 italic">{VIETNAMESE.noPrisoners}</p>
                    ) : (
                        <ul className="space-y-2">
                            {knowledgeBase.prisoners.map(p => (
                                <li key={p.id}>
                                    <button
                                        onClick={() => setSelectedPrisonerId(p.id)}
                                        className={`w-full text-left p-2 rounded-lg transition-colors ${selectedPrisonerId === p.id ? 'bg-red-800/50 ring-2 ring-red-500' : 'bg-gray-700/70 hover:bg-gray-700'}`}
                                    >
                                        <div className="flex-grow">
                                            <span className="font-semibold block">{p.name}</span>
                                            <div className="flex justify-between items-center mt-0.5">
                                                <span className="text-xs text-gray-400">{p.realm}</span>
                                                <span className={`text-[11px] font-medium px-1.5 py-0.2 rounded ${
                                                    (p.satisfaction ?? 100) < 30 ? 'bg-red-950 text-red-400 border border-red-800 animate-pulse' : 'bg-green-950 text-green-400 border border-green-800'
                                                }`}>
                                                    😊 {p.satisfaction ?? 100}%
                                                </span>
                                            </div>
                                        </div>
                                    </button>
                                </li>
                            ))}
                        </ul>
                    )}
                </div>

                {/* Right Column: Details */}
                <div className="lg:col-span-1 bg-gray-900 p-4 rounded-lg shadow-xl border border-gray-700 overflow-y-auto custom-scrollbar">
                    {selectedPrisoner ? (
                        <div className="space-y-4">
                            <h2 className="text-2xl font-bold text-red-400 border-b border-gray-600 pb-2 flex justify-between items-center">
                                {selectedPrisoner.name}
                                <Button 
                                    size="sm" 
                                    variant="secondary" 
                                    className="text-xs bg-indigo-600 hover:bg-indigo-700 border-none text-white"
                                    onClick={() => setIsInteractionModalOpen(true)}
                                    disabled={isLoadingApi}
                                    id="btn-use-item-prisoner"
                                >
                                    Dùng Vật Phẩm / Kỹ Năng
                                </Button>
                            </h2>

                            {/* Thang đo mức độ thỏa mãn và Nút trả lương */}
                            <div className="bg-gray-850 p-3 rounded-lg border border-gray-700 flex flex-col gap-2" id="prisoner-satisfaction-card">
                                <div className="flex justify-between items-center">
                                    <span className="text-sm font-semibold text-gray-300">Mức độ thỏa mãn:</span>
                                    <div className="flex items-center gap-3">
                                        <span className={`text-sm font-bold ${
                                            (selectedPrisoner.satisfaction ?? 100) < 30 ? 'text-red-400 animate-pulse' : 'text-green-400'
                                        }`}>
                                            {selectedPrisoner.satisfaction ?? 100}%
                                        </span>
                                        <Button 
                                            size="sm" 
                                            className="text-xs bg-emerald-600 hover:bg-emerald-700 border-none text-white py-1 px-3 flex items-center gap-1 h-7"
                                            onClick={() => game.paySalary(selectedPrisoner.id, 'prisoner')}
                                            disabled={isLoadingApi}
                                            id="btn-pay-salary-prisoner"
                                        >
                                            💸 Tiền Lương ({Math.max(10, Math.floor((selectedPrisoner.stats?.maxKinhNghiem || 100) * 0.1))} {knowledgeBase.worldConfig?.currencyName || "Linh Thạch"})
                                        </Button>
                                    </div>
                                </div>
                                <div className="w-full bg-gray-900 rounded-full h-3 overflow-hidden border border-gray-750">
                                    <div 
                                        className={`h-full transition-all duration-300 ${
                                            (selectedPrisoner.satisfaction ?? 100) < 30 ? 'bg-red-500' : (selectedPrisoner.satisfaction ?? 100) < 60 ? 'bg-yellow-500' : 'bg-green-500'
                                        }`} 
                                        style={{ width: `${isNaN(selectedPrisoner.satisfaction as any) ? 100 : (selectedPrisoner.satisfaction ?? 100)}%` }}
                                    ></div>
                                </div>
                                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 mt-1">
                                    <span className="text-xs text-gray-400 italic">
                                        {(selectedPrisoner.satisfaction ?? 100) < 30 ? '⚠️ Thỏa mãn dưới 30%, có nguy cơ đào tẩu!' : 'Trạng thái ổn định.'}
                                    </span>
                                </div>
                            </div>
                            <div className="flex flex-col sm:flex-row items-center sm:items-start gap-4">
                                <img src={getDeterministicAvatarSrc(selectedPrisoner)} alt={selectedPrisoner.name} className="w-24 h-24 rounded-full object-cover border-2 border-red-700 flex-shrink-0" />
                                <p className="text-sm text-gray-300 italic flex-grow">{selectedPrisoner.description}</p>
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-2 p-3 bg-gray-800/50 rounded-lg text-sm">
                                {selectedPrisoner.title && <p><strong className="text-indigo-300">Chức danh:</strong> {selectedPrisoner.title}</p>}
                                {selectedPrisoner.gender && <p><strong className="text-indigo-300">Giới tính:</strong> {selectedPrisoner.gender}</p>}
                                {selectedPrisoner.race && <p><strong className="text-indigo-300">Chủng tộc:</strong> {selectedPrisoner.race}</p>}
                                
                                <div className="col-span-full border-t border-gray-700 my-1"></div>
                                
                                {selectedPrisoner.realm && <p className="col-span-full"><strong className="text-indigo-300">Cảnh giới:</strong> {selectedPrisoner.realm}</p>}
                                {selectedPrisoner.tuChat && <p><strong className="text-indigo-300">Tư chất:</strong> {selectedPrisoner.tuChat}</p>}
                                {selectedPrisoner.spiritualRoot && <p><strong className="text-indigo-300">Linh căn:</strong> {selectedPrisoner.spiritualRoot}</p>}
                                {selectedPrisoner.specialPhysique && <p className="col-span-full"><strong className="text-indigo-300">Thể chất:</strong> {selectedPrisoner.specialPhysique}</p>}
                                
                                <div className="col-span-full border-t border-gray-700 my-1"></div>

                                <p><strong className="text-indigo-300">{VIETNAMESE.statAffinity}:</strong> {selectedPrisoner.affinity}</p>
                                {selectedPrisoner.captureReason && (
                                    <p className="col-span-full"><strong className="text-red-400">Lý do giam giữ:</strong> {selectedPrisoner.captureReason}</p>
                                )}

                                {selectedPrisoner.stats && (selectedPrisoner.stats.maxSinhLuc != null || selectedPrisoner.stats.sucTanCong != null) && (
                                    <>
                                        <div className="col-span-full border-t border-gray-700 my-1"></div>
                                        {selectedPrisoner.stats.maxSinhLuc != null && <p><strong className="text-indigo-300">Sinh Lực:</strong> {selectedPrisoner.stats.sinhLuc ?? '??'} / {selectedPrisoner.stats.maxSinhLuc}</p>}
                                        {selectedPrisoner.stats.maxLinhLuc != null && selectedPrisoner.stats.maxLinhLuc > 0 && <p><strong className="text-indigo-300">Linh Lực:</strong> {selectedPrisoner.stats.linhLuc ?? '??'} / {selectedPrisoner.stats.maxLinhLuc}</p>}
                                        {selectedPrisoner.stats.sucTanCong != null && <p><strong className="text-indigo-300">Sức Tấn Công:</strong> {selectedPrisoner.stats.sucTanCong}</p>}
                                        {selectedPrisoner.stats.thoNguyen !== undefined && <p className="col-span-full"><strong className="text-indigo-300">Thọ Nguyên:</strong> {typeof selectedPrisoner.stats.thoNguyen === 'number' ? (Number.isInteger(selectedPrisoner.stats.thoNguyen) ? selectedPrisoner.stats.thoNguyen : parseFloat(selectedPrisoner.stats.thoNguyen.toFixed(2))) : selectedPrisoner.stats.thoNguyen} / {selectedPrisoner.stats.maxThoNguyen}</p>}
                                    </>
                                )}
                            </div>
                            <div className="mt-4 pt-4 border-t border-gray-700 flex flex-col sm:flex-row gap-2">
                                <Button variant="primary" onClick={() => convertPrisoner(selectedPrisoner.id, 'slave')} disabled={isLoadingApi}>
                                    {VIETNAMESE.convertToSlaveButton}
                                </Button>
                                <Button variant="primary" onClick={() => convertPrisoner(selectedPrisoner.id, 'wife')} disabled={isLoadingApi}>
                                    {VIETNAMESE.convertToWifeButton}
                                </Button>
                                <Button variant="secondary" onClick={() => handleFreePerson(selectedPrisoner.id, 'prisoner')} disabled={isLoadingApi}>
                                    Trả Tự Do
                                </Button>
                            </div>
                        </div>
                    ) : (
                        <div className="flex items-center justify-center h-full">
                            <p className="text-gray-500 italic">Chọn một tù nhân để xem chi tiết.</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
        
        {isInteractionModalOpen && selectedPrisoner && (
            <InteractionSelectionModal
                isOpen={isInteractionModalOpen}
                onClose={() => setIsInteractionModalOpen(false)}
                inventory={knowledgeBase.inventory}
                skills={knowledgeBase.playerSkills}
                onSelect={handleUseItemOrSkill}
                targetName={selectedPrisoner.name}
            />
        )}

        {showDebug && (
            <DebugModal
                title="Nhật Ký Gỡ Lỗi Tù Nhân"
                prompts={game.sentPrisonerPromptsLog}
                responses={game.receivedPrisonerResponsesLog}
                onClose={() => setShowDebug(false)}
            />
        )}
        </>
    );
};

export default PrisonerManagementScreen;
