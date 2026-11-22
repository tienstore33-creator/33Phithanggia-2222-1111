import React, { useState, useEffect } from 'react';
import { Database, CheckCircle, LogIn, HelpCircle, Trash2, Link, Layout } from 'lucide-react';
import { GoogleDriveService } from '../services/GoogleDriveService';
import { RAGService } from '../services/RAGService';
import { saveVector, getAllVectors } from '../services/indexedDBService';
import { AuthService } from '../services/AuthService';
import { SummaryService } from '../services/SummaryService';
import { RemoteCanonService } from '../services/RemoteCanonService';
import { RAGInspector } from './RAGInspector';
import { KnowledgeMapInspector } from './KnowledgeMapInspector';
import VectorizationPanel from './ui/VectorizationPanel';
import Modal from './ui/Modal';
import Button from './ui/Button';
import { useGame } from '../hooks/useGame';
import { getCurrentlyUsedApiKey } from '../services/geminiService';

export const OriginalWorkSlot = ({ isOpen, onClose, onStartProcessing, onEndProcessing }: { 
  isOpen: boolean, 
  onClose: () => void,
  onStartProcessing?: () => void, 
  onEndProcessing?: () => void 
}) => {
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [progress, setProgress] = useState(0);
  const [url, setUrl] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [isInspectorOpen, setIsInspectorOpen] = useState(false);
  const [isMapOpen, setIsMapOpen] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [isSummarizing, setIsSummarizing] = useState(false);
  const [summaryProgress, setSummaryProgress] = useState({ message: '', percent: 0 });
  const [showSummaryResult, setShowSummaryResult] = useState(false);
  const [generatedSummary, setGeneratedSummary] = useState('');
  const { knowledgeBase, setKnowledgeBase, showNotification } = useGame();

  useEffect(() => {
    if (isOpen && knowledgeBase.worldConfig?.remoteCanonUrl) {
      setUrl(knowledgeBase.worldConfig.remoteCanonUrl);
      setStatus('success');
    } else if (isOpen) {
      // Check if RAG has content
      const checkRag = async () => {
         const vectors = await getAllVectors();
         if (vectors.length > 0 && status === 'idle') {
            setStatus('success');
         }
      };
      checkRag();
    }
  }, [isOpen, knowledgeBase.worldConfig?.remoteCanonUrl]);

  useEffect(() => {
    const token = AuthService.handleCallback() || AuthService.getAccessToken();
    if (token) {
      setIsLoggedIn(true);
    }
  }, []);

  const processBlob = async (blob: Blob, mimeType: string, fileId: string) => {
    const parserWorker = new Worker(new URL('../workers/ebookParserWorker.ts', import.meta.url), { type: 'module' });
    parserWorker.postMessage({ blob, mimeType });

    parserWorker.onmessage = async (e) => {
      if (e.data.type === 'PROGRESS') {
          setProgress(e.data.percent);
      } else if (e.data.type === 'COMPLETE') {
          const fullText = e.data.text;
          const splitToChunks = (text: string, size: number = 1000) => {
              const chunks = [];
              for (let i = 0; i < text.length; i += size) {
                  chunks.push(text.substring(i, i + size));
              }
              return chunks;
          };
          
          await RAGService.batchEmbedAndSave(splitToChunks(fullText), fileId, setProgress);
          setStatus('success');
          onEndProcessing();
          parserWorker.terminate();
      } else if (e.data.type === 'ERROR') {
          setStatus('error');
          setErrorMessage(e.data.message);
          onEndProcessing();
          parserWorker.terminate();
      }
    };
  };

  const handleLoad = async () => {
    try {
      setStatus('loading');
      setErrorMessage('');
      onStartProcessing?.();
      
      const apiKey = getCurrentlyUsedApiKey();
      if (!apiKey) throw new Error("API Key chưa được cấu hình.");

      // Check if it's a direct link (GitHub, etc.)
      const isDirectLink = url.includes('raw.githubusercontent.com') || url.includes('gist.githubusercontent.com') || url.endsWith('.txt');

      if (isDirectLink) {
        localStorage.setItem('REMOTE_CANON_URL', url);
        localStorage.setItem('USE_REMOTE_CANON', 'true');
        setKnowledgeBase(prev => {
           const newKb = JSON.parse(JSON.stringify(prev));
           if (!newKb.worldConfig) newKb.worldConfig = {};
           newKb.worldConfig.remoteCanonUrl = url;
           newKb.worldConfig.useRemoteCanon = true;
           return newKb;
        });
        showNotification("Đã nạp tri thức nguyên tác từ URL thành công! AI sẽ ưu tiên sử dụng nguồn này.", "success");
        setStatus('success');
        onEndProcessing?.();
        return;
      }

      const fileId = GoogleDriveService.extractFileId(url);
      if (!fileId) throw new Error("URL không hợp lệ hoặc không phải link Google Drive trực tiếp. Nếu dùng Link GitHub, hãy đảm bảo là link 'raw'.");

      const accessToken = AuthService.getAccessToken();
      const meta = await GoogleDriveService.getFileMetadata(fileId, apiKey, accessToken || undefined);
      const blob = await GoogleDriveService.fetchBlob(fileId, apiKey, accessToken || undefined);

      await processBlob(blob, meta.mimeType, fileId);
    } catch (error) {
      console.error(error);
      setStatus('error');
      setErrorMessage(error instanceof Error ? error.message : "Có lỗi xảy ra.");
      onEndProcessing?.();
    }
  };

  const handleClear = async () => {
    try {
      await RAGService.clearKnowledgeBase();
      localStorage.removeItem('REMOTE_CANON_URL');
      localStorage.removeItem('USE_REMOTE_CANON');
      setKnowledgeBase(prev => {
         const newKb = JSON.parse(JSON.stringify(prev));
         if (newKb.worldConfig) {
            newKb.worldConfig.remoteCanonUrl = undefined;
            newKb.worldConfig.useRemoteCanon = false;
            newKb.worldConfig.originalStorySummary = undefined;
         }
         return newKb;
      });
      setStatus('idle');
      setUrl('');
      setShowDeleteConfirm(false);
      setShowSuccessModal(true);
    } catch (error) {
      console.error(error);
      setShowDeleteConfirm(false);
    }
  };

  const [summarizeFile, setSummarizeFile] = useState<File | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setSummarizeFile(e.target.files[0]);
    }
  };

  const handleSummarize = async () => {
    try {
        let fullText = "";
        
        setIsSummarizing(true);
        setSummaryProgress({ message: "Đang khởi tạo...", percent: 0 });

        if (summarizeFile) {
            setSummaryProgress({ message: "Đang đọc file cục bộ...", percent: 5 });
            fullText = await summarizeFile.text();
        } else if (status === 'success') {
            if (knowledgeBase.worldConfig?.remoteCanonUrl) {
                setSummaryProgress({ message: "Đang tải dữ liệu từ URL...", percent: 5 });
                const rawUrl = RemoteCanonService.convertToRawUrl(knowledgeBase.worldConfig.remoteCanonUrl);
                const response = await fetch(rawUrl);
                if (!response.ok) throw new Error("Không thể tải dữ liệu từ URL.");
                fullText = await response.text();
            } else {
                setSummaryProgress({ message: "Đang đọc dữ liệu từ bộ nhớ...", percent: 5 });
                const vectors = await getAllVectors();
                fullText = vectors.map(v => v.text).join(" ");
            }
        } else {
            showNotification("Vui lòng nạp tri thức hoặc chọn file txt để tóm tắt.", "error");
            setIsSummarizing(false);
            return;
        }

        if (!fullText || fullText.length < 100) {
            throw new Error("Dữ liệu nguyên tác quá ít hoặc không tồn tại để tóm tắt.");
        }

        const finalSummary = await SummaryService.summarizeLargeText(fullText, (msg, p) => {
            setSummaryProgress({ message: msg, percent: p });
        });

        // Save result to KB and worldConfig
        setKnowledgeBase(prev => {
           const newKb = JSON.parse(JSON.stringify(prev));
           if (!newKb.worldConfig) newKb.worldConfig = {};
           newKb.worldConfig.originalStorySummary = finalSummary;
           newKb.worldConfig.useOriginalSummary = true; // Default to enabled
           return newKb;
        });
        
        setGeneratedSummary(finalSummary);
        setShowSummaryResult(true);
        setSummarizeFile(null);
        showNotification("Đã tóm tắt nguyên tác thành công!", "success");
    } catch (error) {
        console.error(error);
        showNotification(error instanceof Error ? error.message : "Lỗi tóm tắt", "error");
    } finally {
        setIsSummarizing(false);
    }
  };

  const toggleSummaryUsage = () => {
    setKnowledgeBase(prev => {
        const newKb = JSON.parse(JSON.stringify(prev));
        if (!newKb.worldConfig) newKb.worldConfig = {};
        newKb.worldConfig.useOriginalSummary = !newKb.worldConfig.useOriginalSummary;
        return newKb;
    });
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="QUẢN LÝ KHE CẮM NGUYÊN TÁC">
      <div className="p-4 space-y-4 max-h-[80vh] overflow-y-auto custom-scrollbar">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2 text-indigo-300">
            <Database size={18} />
            <span className="text-sm font-bold">NGUỒN DỮ LIỆU</span>
            <button 
              onClick={() => setIsInspectorOpen(true)}
              className="ml-2 px-2 py-0.5 bg-indigo-600/20 hover:bg-indigo-500/30 border border-indigo-500/50 rounded text-[10px] text-indigo-300 transition-colors"
              title="Kiểm tra dữ liệu RAG"
            >
              KIỂM TRA NGUYÊN TÁC
            </button>
            <button 
              onClick={() => setIsMapOpen(true)}
              className="ml-2 px-2 py-0.5 bg-emerald-600/20 hover:bg-emerald-500/30 border border-emerald-500/50 rounded text-[10px] text-emerald-300 transition-colors"
              title="Xem bản đồ tri thức (Memory Palace)"
            >
              BẢN ĐỒ TRI THỨC
            </button>
            <button 
              onClick={handleSummarize}
              disabled={isSummarizing || status !== 'success'}
              className="ml-2 px-2 py-0.5 bg-amber-600/20 hover:bg-amber-500/30 border border-amber-500/50 rounded text-[10px] text-amber-300 transition-colors disabled:opacity-50"
              title="Tóm tắt toàn bộ nội dung thành dàn khung"
            >
              {isSummarizing ? 'ĐANG TÓM TẮT...' : 'TÓM TẮT TOÀN BỘ'}
            </button>
          </div>
          {status === 'success' && <CheckCircle size={16} className="text-green-400" />}
        </div>
        
        <div className="flex gap-2">
          <input 
            type="text" 
            value={url}
            onChange={(e) => {
              setUrl(e.target.value);
              if (status === 'success') setStatus('idle');
            }}
            placeholder="Dán link Google Drive hoặc Link Github (raw) vào đây..."
            className="flex-grow bg-gray-800 border border-gray-700 rounded px-3 py-1.5 text-xs text-gray-300 focus:border-indigo-500 outline-none"
          />
          <button 
            onClick={handleLoad}
            disabled={status === 'loading'}
            className={`${status === 'success' ? 'bg-green-600' : 'bg-indigo-600 hover:bg-indigo-700'} disabled:bg-gray-600 text-white px-4 py-1.5 rounded text-xs font-bold transition-all flex items-center gap-1`}
          >
            {status === 'success' ? <CheckCircle size={14} /> : null}
            {status === 'success' ? 'ĐÃ NẠP' : 'NẠP'}
          </button>
        </div>

        <div className="flex gap-2 mt-2">
          {AuthService.CLIENT_ID && (
            <button 
              onClick={() => AuthService.login()}
              className={`flex items-center gap-1 px-3 py-1 rounded text-[10px] font-bold transition-colors ${isLoggedIn ? 'bg-green-600/20 text-green-400 border border-green-500/30' : 'bg-gray-700 hover:bg-gray-600 text-gray-300'}`}
            >
              <LogIn size={12} />
              {isLoggedIn ? 'ĐÃ ĐĂNG NHẬP GOOGLE' : 'ĐĂNG NHẬP GOOGLE'}
            </button>
          )}
          <button 
            onClick={() => setShowDeleteConfirm(true)}
            className="flex items-center gap-1 bg-red-900/40 hover:bg-red-800/60 text-red-300 px-3 py-1 rounded text-[10px] font-bold transition-colors border border-red-500/30"
          >
            <Trash2 size={12} />
            XÓA TRI THỨC
          </button>
        </div>

        {/* --- Summarization Section --- */}
        <div className="bg-amber-900/10 p-3 rounded border border-amber-500/20 mt-4">
          <div className="flex justify-between items-center mb-2">
            <h3 className="text-xs font-bold text-amber-400 uppercase flex items-center gap-1">
                <Layout size={14} /> Tóm tắt & Dàn khung
            </h3>
            {knowledgeBase.worldConfig?.originalStorySummary && (
                <div className="flex items-center gap-2">
                    <button 
                        onClick={() => setShowSummaryResult(true)}
                        className="px-2 py-0.5 bg-blue-600/30 hover:bg-blue-500/40 border border-blue-500/50 rounded text-[9px] text-blue-200 uppercase font-bold"
                    >
                        XEM TÓM TẮT
                    </button>
                    <button 
                        onClick={toggleSummaryUsage}
                        className={`px-2 py-0.5 border rounded text-[9px] uppercase font-bold transition-colors ${knowledgeBase.worldConfig.useOriginalSummary ? 'bg-green-600/30 border-green-500/50 text-green-200' : 'bg-gray-700/50 border-gray-600 text-gray-400'}`}
                    >
                        {knowledgeBase.worldConfig.useOriginalSummary ? 'ĐANG SỬ DỤNG' : 'ĐÃ TẮT'}
                    </button>
                </div>
            )}
          </div>
          
          <p className="text-[10px] text-gray-400 mb-2 italic">
            Tóm tắt file lớn (TXT) thành dàn khung thế giới để AI bám sát tuyệt đối.
          </p>

          <div className="flex gap-2 items-center">
            <label className="flex-grow cursor-pointer bg-gray-900 border border-dashed border-gray-600 hover:border-amber-500/50 rounded px-2 py-1 transition-colors overflow-hidden">
              <span className="text-[10px] text-gray-400 truncate block">
                {summarizeFile ? summarizeFile.name : 'Chọn file .txt để tóm tắt...'}
              </span>
              <input 
                type="file" 
                accept=".txt" 
                className="hidden" 
                onChange={handleFileChange}
              />
            </label>
            <button
                onClick={handleSummarize}
                disabled={isSummarizing || (!summarizeFile && status !== 'success')}
                className="px-3 py-1 bg-amber-600/80 hover:bg-amber-500 rounded text-[10px] text-white font-bold disabled:opacity-50 transition-colors whitespace-nowrap"
            >
                {isSummarizing ? 'ĐANG CHẠY...' : 'BẮT ĐẦU'}
            </button>
          </div>

          {isSummarizing && (
            <div className="mt-3 p-2 bg-black/40 border border-amber-500/20 rounded">
              <div className="flex justify-between text-[9px] text-amber-200 mb-1.5 font-bold animate-pulse">
                <span>{summaryProgress.message}</span>
                <span>{summaryProgress.percent}%</span>
              </div>
              <div className="w-full bg-gray-800 h-1 rounded-full overflow-hidden">
                <div 
                  className="bg-amber-500 h-full transition-all duration-500 ease-out shadow-[0_0_8px_rgba(245,158,11,0.5)]" 
                  style={{ width: `${summaryProgress.percent}%` }} 
                />
              </div>
              <p className="text-[8px] text-gray-500 mt-1 text-center italic">
                Vui lòng không đóng cửa sổ này khi đang tóm tắt...
              </p>
            </div>
          )}
        </div>

        {status === 'loading' && (
          <div className="mt-3">
            <div className="flex justify-between text-[10px] text-gray-400 mb-1">
              <span>Đang trích xuất tri thức...</span>
              <span>{progress}%</span>
            </div>
            <div className="w-full bg-gray-700 h-1 rounded-full overflow-hidden">
              <div className="bg-indigo-500 h-full transition-all duration-300" style={{ width: `${progress}%` }} />
            </div>
          </div>
        )}

        {status === 'error' && (
          <div className="mt-3 text-red-400 text-xs text-center">
            {errorMessage}
          </div>
        )}

        {/* Dynamic Display based on Grounding Mode */}
        {knowledgeBase.worldConfig?.useRemoteCanon ? (
          <div className="mt-4 p-4 bg-indigo-900/30 border border-indigo-500/30 rounded-lg space-y-3">
             <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-indigo-400 font-bold text-xs">
                   <Link size={14} />
                   <span>CANON GROUNDING ACTIVE</span>
                </div>
                <div className="flex items-center gap-1">
                   <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                   <span className="text-[10px] text-green-400">ONLINE</span>
                </div>
             </div>
             <p className="text-[10px] text-gray-400 italic">
                Sử dụng công nghệ Tra cứu nguyên tác trực tiếp (Grounding). AI sẽ truy vấn dữ liệu từ liên kết GitHub mỗi khi cần xác nhận bối cảnh.
             </p>
             <div className="text-[10px] bg-gray-900/50 p-2 rounded border border-gray-800 break-all text-indigo-300 font-mono">
                {knowledgeBase.worldConfig.remoteCanonUrl}
             </div>
          </div>
        ) : (
          /* Resumable Vectorization System */
          <div className="mt-4 border-t border-gray-700 pt-4">
            <VectorizationPanel />
          </div>
        )}

        <RAGInspector isOpen={isInspectorOpen} onClose={() => setIsInspectorOpen(false)} />
        <KnowledgeMapInspector isOpen={isMapOpen} onClose={() => setIsMapOpen(false)} />

        <Modal 
          isOpen={showDeleteConfirm} 
          onClose={() => setShowDeleteConfirm(false)} 
          title="Xác nhận xóa tri thức"
        >
          <div className="p-4">
            <p className="text-gray-200 mb-6">
              Bạn có chắc chắn muốn xóa toàn bộ tri thức nguyên tác đã nạp? Hành động này không thể hoàn tác và bạn sẽ phải nạp lại file nếu muốn sử dụng tiếp.
            </p>
            <div className="flex justify-end gap-3">
              <Button variant="ghost" onClick={() => setShowDeleteConfirm(false)}>
                Hủy
              </Button>
              <Button variant="danger" onClick={handleClear}>
                Xác nhận xóa
              </Button>
            </div>
          </div>
        </Modal>

        <Modal 
          isOpen={showSuccessModal} 
          onClose={() => setShowSuccessModal(false)} 
          title="Thông báo"
        >
          <div className="p-4">
            <p className="text-gray-200 mb-6">
              Đã xóa toàn bộ tri thức nguyên tác thành công.
            </p>
            <div className="flex justify-end">
              <Button variant="primary" onClick={() => setShowSuccessModal(false)}>
                Đóng
              </Button>
            </div>
          </div>
        </Modal>

        <Modal 
          isOpen={showSummaryResult} 
          onClose={() => setShowSummaryResult(false)} 
          title="DÀN KHUNG TỔNG HỢP NGUYÊN TÁC"
        >
          <div className="p-4 flex flex-col h-[70vh]">
            <div className="flex-grow overflow-y-auto mb-4 bg-gray-900/50 p-4 rounded border border-gray-800 custom-scrollbar">
               <pre className="text-xs text-amber-50 whitespace-pre-wrap font-sans leading-relaxed">
                  {generatedSummary || knowledgeBase.worldConfig?.originalStorySummary}
               </pre>
            </div>
            <div className="flex justify-between items-center bg-amber-900/20 p-2 rounded border border-amber-500/30 mb-4">
                <div>
                   <p className="text-[10px] text-amber-200 uppercase font-bold">
                       Hệ thống: Dàn khung nguyên tác hiện đang {knowledgeBase.worldConfig?.useOriginalSummary ? 'ĐƯỢC BẬT' : 'ĐANG TẮT'}.
                   </p>
                   <p className="text-[9px] text-gray-400">
                       Nếu bật, AI sẽ coi đây là "Chân lý thế giới" tối cao khi mô tả nhân vật và bối cảnh.
                   </p>
                </div>
                <button 
                  onClick={toggleSummaryUsage}
                  className={`px-3 py-1 rounded text-[10px] font-bold transition-all ${knowledgeBase.worldConfig?.useOriginalSummary ? 'bg-red-600/20 text-red-300 border border-red-500/30' : 'bg-green-600/20 text-green-300 border border-green-500/30'}`}
                >
                  {knowledgeBase.worldConfig?.useOriginalSummary ? 'TẠM TẮT' : 'BẬT NGAY'}
                </button>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="secondary" onClick={() => setShowSummaryResult(false)}>
                ĐỂ SAU
              </Button>
              <Button variant="primary" onClick={() => setShowSummaryResult(false)}>
                ÁP DỤNG & ĐÓNG
              </Button>
            </div>
          </div>
        </Modal>
      </div>
    </Modal>
  );
};
