import React from 'react';
import { useVectorization } from '../../hooks/useVectorization';
import Button from './Button';
import { Loader2, FileText, Play, AlertCircle } from 'lucide-react';

const VectorizationPanel: React.FC = () => {
    const { activeJobs, isProcessing, startNewVectorization, resumeJob, cancelJob } = useVectorization();

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            startNewVectorization(e.target.files[0]);
        }
    };

    // Focus on the first active job for the main display
    const job = activeJobs[0];

    return (
        <div className="p-4 bg-black border border-green-900 rounded-lg font-mono text-green-500 shadow-2xl">
            <div className="flex justify-between border-b border-green-900 pb-2 mb-4">
                <h3 className="text-sm font-bold flex items-center gap-2">
                    <FileText className="w-4 h-4" />
                    [ KHO TRI THỨC ] &gt; [ VECTƠ HÓA TÀI LIỆU ]
                </h3>
                <span className="text-[10px] animate-pulse flex items-center gap-1">
                    <span className="w-2 h-2 bg-green-500 rounded-full"></span>
                    SYSTEM ACTIVE
                </span>
            </div>

            {!job ? (
                <div className="py-8">
                    <label className="block w-full p-8 border-2 border-dashed border-green-900 rounded-lg hover:bg-green-900/10 transition-colors cursor-pointer text-center">
                        <input type="file" className="hidden" onChange={handleFileChange} accept=".txt" disabled={isProcessing} />
                        <div className="flex flex-col items-center gap-2">
                            <Play className="w-8 h-8 opacity-50" />
                            <span className="text-sm">NHẤP ĐỂ TẢI FILE CỤC BỘ (.TXT)</span>
                        </div>
                    </label>
                </div>
            ) : (
                <div className="space-y-6">
                    {/* Job Info */}
                    <div className="space-y-1">
                        <p className="text-xs text-green-400">Tệp: "{job.fileName}"</p>
                        <p className="text-xs">
                            Trạng thái: [ {job.status === 'processing' ? 'ĐANG VECTƠ HÓA...' : 
                                         job.status === 'ready' ? 'SẴN SÀNG' : 
                                         job.status === 'failed' ? 'LỖI HỆ THỐNG' : 'KHỞI TẠO'} {Math.round((job.currentChunk / job.totalChunks) * 100) || 0}% ]
                        </p>
                    </div>

                    {/* Progress Bar */}
                    <div className="space-y-1">
                        <div className="w-full bg-gray-900 h-6 border border-green-900 relative">
                            <div 
                                className="bg-green-800 h-full transition-all duration-500"
                                style={{ width: `${(job.currentChunk / job.totalChunks) * 100 || 0}%` }}
                            />
                            <div className="absolute inset-0 flex items-center justify-center text-[10px] font-bold text-white mix-blend-difference">
                                {job.currentChunk} / {job.totalChunks} Chunks
                            </div>
                        </div>
                    </div>

                    {/* Warning if paused */}
                    {job.status !== 'processing' && job.currentChunk > 0 && (
                        <div className="flex items-center gap-2 text-yellow-500 text-[10px] bg-yellow-500/10 p-2 border border-yellow-900/50">
                            <AlertCircle className="w-3 h-3" />
                            <span>{`{!}`} Cảnh báo: Tiến trình bị dừng lúc {new Date(job.timestamp).toLocaleTimeString()}</span>
                        </div>
                    )}

                    {/* Actions */}
                    <div className="grid grid-cols-2 gap-4">
                        <Button 
                            onClick={() => resumeJob(job.id)}
                            disabled={isProcessing}
                            className={`py-3 text-xs font-bold border ${job.status === 'processing' ? 'bg-green-900/20 border-green-900 text-green-900' : 'bg-indigo-900/40 hover:bg-indigo-800 border-indigo-500 text-indigo-100'}`}
                        >
                            {isProcessing ? 'ĐANG XỬ LÝ...' : 'TIẾP TỤC XỬ LÝ'}
                        </Button>
                        <Button 
                            variant="danger"
                            onClick={() => cancelJob(job.id)}
                            className="py-3 text-xs font-bold bg-red-900/40 hover:bg-red-800 border-red-500 text-red-100"
                        >
                            HỦY & XÓA TẠM
                        </Button>
                    </div>

                    {/* Terminal Logs */}
                    <div className="space-y-1">
                        <p className="text-[10px] text-green-700 font-bold uppercase tracking-widest">NHẬT KÝ HỆ THỐNG:</p>
                        <div className="bg-black/50 border border-green-900 p-2 h-40 overflow-y-auto text-[9px] space-y-1 scrollbar-thin scrollbar-thumb-green-900">
                            {job.logs?.map((log, idx) => (
                                <p key={idx} className="leading-relaxed opacity-80 hover:opacity-100 transition-opacity">
                                    {log}
                                </p>
                            ))}
                            {isProcessing && (
                                <p className="animate-pulse text-green-400">&gt; [ĐANG CHỜ] Đang xử lý dữ liệu...</p>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default VectorizationPanel;
