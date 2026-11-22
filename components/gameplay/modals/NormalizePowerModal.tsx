import React, { useState, useEffect } from 'react';
import Modal from '../../ui/Modal';
import Button from '../../ui/Button';
import { useGame } from '../../../hooks/useGame';
import { getApiSettings } from '../../../services/apiService';

interface NormalizePowerModalProps {
    isOpen: boolean;
    onAgree: () => void;
    onIgnore: () => void;
}

export function NormalizePowerModal({ isOpen, onAgree, onIgnore }: NormalizePowerModalProps) {
    const { knowledgeBase, uiState, normalizeNpcRealms, showNotification } = useGame();
    const [isNormalizing, setIsNormalizing] = useState(false);
    const [elapsedSeconds, setElapsedSeconds] = useState(0);
    const [usedModelName, setUsedModelName] = useState<string | null>(null);

    useEffect(() => {
        let timer: any = null;
        if (isNormalizing) {
            setElapsedSeconds(0);
            timer = setInterval(() => {
                setElapsedSeconds(prev => prev + 1);
            }, 1000);
        }
        return () => {
            if (timer) clearInterval(timer);
        };
    }, [isNormalizing]);

    if (!isOpen || !uiState.powerNormalizationsData) return null;

    const data = uiState.powerNormalizationsData;
    const { npcsToFixRealm, npcsToFixStats, mcNeedsFix, triggerAction } = data;

    const handleAgree = async () => {
        setIsNormalizing(true);
        try {
            if (npcsToFixRealm.length > 0) {
                showNotification(`Đang gọi API chuẩn hóa cảnh giới cho ${npcsToFixRealm.length} nhân vật...`, 'info');
            } else {
                showNotification(`Đang chuẩn hóa chỉ số cơ học...`, 'info');
            }

            const res = await normalizeNpcRealms(npcsToFixRealm);
            if (res?.modelUsed) {
                setUsedModelName(res.modelUsed);
            }
            if (res?.executionTimeMs) {
                setElapsedSeconds(Math.round(res.executionTimeMs / 1000));
            }

            triggerAction(); // Resume action
        } catch (error) {
            console.error("Lỗi chuẩn hóa thực lực:", error);
            showNotification("Đã xảy ra lỗi khi chuẩn hóa thực lực.", "error");
        } finally {
            setIsNormalizing(false);
            onAgree(); // Close modal
        }
    };

    const totalIssues = npcsToFixRealm.length + npcsToFixStats.length + (mcNeedsFix ? 1 : 0);
    const apiSettings = getApiSettings();
    const sourceLabel = apiSettings.apiKeySource === 'system' ? "KEY HỆ THỐNG" : (apiSettings.apiKeySource === 'user' ? "KEY CÁ NHÂN" : "PROXY API");
    const displayModel = (usedModelName || apiSettings.model || "GEMINI-2.5-PRO").toUpperCase();

    return (
        <Modal isOpen={isOpen} onClose={onIgnore} title="⚠️ Cảnh báo: Sai Lệch Thực Lực">
            <div className="space-y-4">
                <p className="text-gray-300">
                    Phát hiện <span className="font-bold text-red-400">{totalIssues}</span> trường hợp sai lệch cảnh giới hoặc chỉ số so với quy chuẩn của trò chơi.
                </p>
                <div className="max-h-60 overflow-y-auto space-y-2 bg-slate-900/60 p-3 rounded-lg border border-slate-700/50 text-sm">
                    {mcNeedsFix && (
                        <div className="p-2.5 rounded bg-blue-950/40 border border-blue-800/60">
                            <div className="font-semibold text-blue-300 flex items-center justify-between">
                                <span>Nhân vật chính (Bạn)</span>
                                <span className="text-xs bg-blue-900/60 text-blue-200 px-2 py-0.5 rounded font-normal">{knowledgeBase.playerStats.realm || "Phàm Nhân"}</span>
                            </div>
                            <div className="text-xs text-gray-300 mt-1.5">
                                Chỉ số sai lệch: <span className="font-medium text-red-400">{(data.mcDeviantStats || ["Sinh Lực / Sức Tấn Công / Linh Lực"]).join(", ")}</span> (vượt ngưỡng 95%-105% chuẩn cảnh giới)
                            </div>
                        </div>
                    )}

                    {data.realmIssuesDetails && data.realmIssuesDetails.length > 0 ? (
                        data.realmIssuesDetails.map((item, idx) => (
                            <div key={`realm-${idx}`} className="p-2.5 rounded bg-yellow-950/40 border border-yellow-800/60">
                                <div className="font-semibold text-yellow-300 flex items-center justify-between">
                                    <span>{item.name}</span>
                                    <span className="text-xs bg-yellow-900/60 text-yellow-200 px-2 py-0.5 rounded font-normal">{item.realm}</span>
                                </div>
                                <div className="text-xs text-gray-300 mt-1.5">
                                    Lỗi: <span className="font-medium text-yellow-400">Cảnh giới không thuộc hệ thống tu luyện hiện hành</span>
                                </div>
                            </div>
                        ))
                    ) : (
                        npcsToFixRealm.length > 0 && npcsToFixRealm.map((npc, idx) => (
                            <div key={`realm-fallback-${idx}`} className="p-2.5 rounded bg-yellow-950/40 border border-yellow-800/60">
                                <div className="font-semibold text-yellow-300 flex items-center justify-between">
                                    <span>{npc.name || "Không rõ"}</span>
                                    <span className="text-xs bg-yellow-900/60 text-yellow-200 px-2 py-0.5 rounded font-normal">{npc.realm || "Phàm Nhân"}</span>
                                </div>
                                <div className="text-xs text-gray-300 mt-1.5">
                                    Lỗi: <span className="font-medium text-yellow-400">Cảnh giới không thuộc hệ thống tu luyện hiện hành</span>
                                </div>
                            </div>
                        ))
                    )}

                    {data.statsIssuesDetails && data.statsIssuesDetails.length > 0 ? (
                        data.statsIssuesDetails.map((item, idx) => (
                            <div key={`stats-${idx}`} className="p-2.5 rounded bg-orange-950/40 border border-orange-800/60">
                                <div className="font-semibold text-orange-300 flex items-center justify-between">
                                    <span>{item.name}</span>
                                    <span className="text-xs bg-orange-900/60 text-orange-200 px-2 py-0.5 rounded font-normal">{item.realm}</span>
                                </div>
                                <div className="text-xs text-gray-300 mt-1.5">
                                    Chỉ số sai lệch: <span className="font-medium text-red-400">{item.deviantStats.join(", ")}</span> (không khớp chuẩn 95%-105% cảnh giới)
                                </div>
                            </div>
                        ))
                    ) : (
                        npcsToFixStats.length > 0 && npcsToFixStats.map((npc, idx) => (
                            <div key={`stats-fallback-${idx}`} className="p-2.5 rounded bg-orange-950/40 border border-orange-800/60">
                                <div className="font-semibold text-orange-300 flex items-center justify-between">
                                    <span>{npc.name || "Không rõ"}</span>
                                    <span className="text-xs bg-orange-900/60 text-orange-200 px-2 py-0.5 rounded font-normal">{npc.realm || "Phàm Nhân"}</span>
                                </div>
                                <div className="text-xs text-gray-300 mt-1.5">
                                    Chỉ số sai lệch: <span className="font-medium text-red-400">Sinh Lực / Sức Tấn Công / Linh Lực</span> (không khớp chuẩn 95%-105% cảnh giới)
                                </div>
                            </div>
                        ))
                    )}
                </div>
                <div className="bg-blue-900/30 p-3 rounded border border-blue-800 text-sm text-blue-200">
                    <p className="font-semibold mb-1">Bạn có muốn tự động chuẩn hóa?</p>
                    <p>Hệ thống sẽ gọi API để quy đổi cảnh giới sai, và điều chỉnh cơ học các chỉ số HP/ATK về đúng khoảng 95%-105% so với mức cơ bản.</p>
                    <p className="mt-2 text-yellow-300 text-xs italic">
                        *Lưu ý: Quá trình này có gọi API. Vui lòng đợi thêm 15 giây sau khi hoàn tất để tránh quá tải RPM của Google Gemini.
                    </p>
                </div>

                {/* Model & Execution Time Badge */}
                <div className="flex items-center justify-center my-2">
                    <div className="inline-flex items-center gap-2.5 px-3.5 py-1.5 rounded-full bg-slate-900/90 border border-indigo-500/40 shadow-lg shadow-indigo-950/50 backdrop-blur-md">
                        {isNormalizing ? (
                            <div className="w-2.5 h-2.5 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin shrink-0" />
                        ) : (
                            <div className="w-2 h-2 rounded-full bg-indigo-400 animate-pulse shrink-0" />
                        )}
                        <span className="text-xs font-mono font-semibold uppercase tracking-wider text-indigo-100">
                            {sourceLabel}: {displayModel}
                        </span>
                        <span className="bg-indigo-950/80 text-indigo-300 border border-indigo-700/50 px-2 py-0.5 rounded-full font-mono text-xs font-bold shrink-0">
                            {elapsedSeconds}S
                        </span>
                    </div>
                </div>
                
                <div className="flex gap-3 justify-end mt-6">
                    <Button variant="secondary" onClick={() => { triggerAction(); onIgnore(); }} disabled={isNormalizing}>
                        Không, cứ tiếp tục
                    </Button>
                    <Button variant="primary" onClick={handleAgree} disabled={isNormalizing}>
                        {isNormalizing ? "Đang chuẩn hóa..." : "Đồng ý (Chuẩn hóa)"}
                    </Button>
                </div>
            </div>
        </Modal>
    );
}
