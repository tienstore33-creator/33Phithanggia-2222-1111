
import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Layout, BookOpen, Search, X, Loader2, Map as MapIcon, ChevronRight, Info, Download, Upload, FileJson } from 'lucide-react';
import { KnowledgeMapService, MemoryPalace, KnowledgeRoom } from '../services/KnowledgeMapService';
import { MigrationService } from '../services/MigrationService';
import Button from './ui/Button';
import Modal from './ui/Modal';

interface KnowledgeMapInspectorProps {
  isOpen: boolean;
  onClose: () => void;
}

export const KnowledgeMapInspector: React.FC<KnowledgeMapInspectorProps> = ({ isOpen, onClose }) => {
  const [palace, setPalace] = useState<MemoryPalace | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedRoom, setSelectedRoom] = useState<KnowledgeRoom | null>(null);
  const [isMigrating, setIsMigrating] = useState(false);
  const [showConfirmImport, setShowConfirmImport] = useState(false);
  const [pendingImportContent, setPendingImportContent] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleExport = async () => {
    try {
      setIsMigrating(true);
      const data = await MigrationService.exportFullMemory();
      const blob = new Blob([data], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `DaoDoAI_Memory_${new Date().toLocaleDateString()}.json`;
      link.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError("Lỗi khi xuất dữ liệu ký ức.");
    } finally {
      setIsMigrating(false);
    }
  };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const content = await file.text();
      setPendingImportContent(content);
      setShowConfirmImport(true);
      // Reset input value so same file can be selected again
      if (fileInputRef.current) fileInputRef.current.value = '';
    } catch (err) {
      setError("Không thể đọc file. Hãy thử lại.");
    }
  };

  const executeImport = async () => {
    if (!pendingImportContent) return;

    try {
      setIsMigrating(true);
      setShowConfirmImport(false);
      await MigrationService.importFullMemory(pendingImportContent);
      window.location.reload();
    } catch (err) {
      setError("Lỗi khi nhập dữ liệu: File không hợp lệ hoặc bị hỏng.");
      setIsMigrating(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadPalace();
    }
  }, [isOpen]);

  const loadPalace = async () => {
    try {
      const savedPalace = await KnowledgeMapService.loadFromDB();
      if (savedPalace) {
        setPalace(savedPalace);
      }
    } catch (err) {
      console.error("Failed to load palace from DB", err);
    }
  };

  const handleGenerate = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const result = await KnowledgeMapService.generateMemoryPalace();
      setPalace(result);
    } catch (err: any) {
      setError(err.message || "Không thể tạo bản đồ tri thức");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="CUNG ĐIỆN KÝ ỨC (MEMORY PALACE)">
      <div className="flex flex-col gap-4 p-2">
        {/* Migration UI - Always Visible */}
        <div className="flex items-center gap-3 p-3 bg-gray-800/50 border border-gray-700 rounded-lg">
          <div className="flex-grow">
            <p className="text-[10px] text-gray-500 uppercase font-bold">Di cư dữ liệu (Migration)</p>
            <p className="text-[9px] text-gray-600">Xuất/Nhập ký ức để đổi thiết bị</p>
          </div>
          <Button onClick={handleExport} variant="ghost" size="sm" className="h-8 text-[10px] gap-1" disabled={isMigrating}>
            <Download size={12} /> {isMigrating ? 'ĐANG XỬ LÝ...' : 'TẢI KÝ ỨC'}
          </Button>
          <Button onClick={() => fileInputRef.current?.click()} variant="ghost" size="sm" className="h-8 text-[10px] gap-1" disabled={isMigrating}>
            <Upload size={12} /> NHẬP KÝ ỨC
          </Button>
          <input type="file" ref={fileInputRef} onChange={handleImport} hidden accept=".json" />
        </div>

        {!palace && !isLoading && (
          <div className="text-center py-12 bg-gray-900/50 rounded-xl border border-dashed border-gray-700">
            <MapIcon size={48} className="mx-auto text-gray-600 mb-4" />
            <h3 className="text-lg font-medium text-gray-300 mb-2">Chưa có bản đồ tri thức</h3>
            <p className="text-sm text-gray-500 max-w-xs mx-auto mb-6">
              AI sẽ phân tích các đoạn trích từ nguyên tác để xây dựng một cấu trúc "Cung điện ký ức" giúp nén và tổ chức tri thức.
            </p>
            <Button onClick={handleGenerate} variant="primary">
              BẮT ĐẦU PHÂN TÍCH & TẠO BẢN ĐỒ
            </Button>
          </div>
        )}

        {isLoading && (
          <div className="text-center py-20">
            <Loader2 size={40} className="mx-auto text-indigo-500 animate-spin mb-4" />
            <p className="text-indigo-300 font-medium animate-pulse">AI đang xây dựng Cung điện ký ức...</p>
            <p className="text-xs text-gray-500 mt-2">Quá trình này có thể mất 10-20 giây tùy độ dài tác phẩm.</p>
          </div>
        )}

        {error && (
          <div className="p-4 bg-red-900/20 border border-red-500/50 rounded-lg text-red-400 text-sm">
            {error}
            <Button onClick={handleGenerate} variant="ghost" size="sm" className="mt-2 w-full">Thử lại</Button>
          </div>
        )}

        {palace && (
          <div className="space-y-6">
            <div className="bg-indigo-900/20 p-4 rounded-lg border border-indigo-500/30">
              <h2 className="text-xl font-bold text-indigo-300 mb-1">{palace.name}</h2>
              <p className="text-sm text-gray-400 italic">{palace.summary}</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {palace.rooms.map((room, idx) => (
                <motion.div
                  key={idx}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.1 }}
                  onClick={() => setSelectedRoom(room)}
                  className="p-4 bg-gray-800 hover:bg-gray-700 border border-gray-700 rounded-xl cursor-pointer transition-all group"
                >
                  <div className="flex justify-between items-start mb-2">
                    <h4 className="font-bold text-sky-400 group-hover:text-sky-300">{room.name}</h4>
                    <ChevronRight size={16} className="text-gray-600 group-hover:translate-x-1 transition-transform" />
                  </div>
                  <p className="text-xs text-gray-500 line-clamp-2">{room.description}</p>
                  <div className="mt-3 flex flex-wrap gap-1">
                    {room.keyTopics.slice(0, 3).map((topic, tIdx) => (
                      <span key={tIdx} className="px-2 py-0.5 bg-gray-900 text-[10px] text-gray-400 rounded border border-gray-700">
                        {topic}
                      </span>
                    ))}
                    {room.keyTopics.length > 3 && (
                      <span className="text-[10px] text-gray-600">+{room.keyTopics.length - 3}</span>
                    )}
                  </div>
                </motion.div>
              ))}
            </div>

            <div className="flex justify-center">
              <Button onClick={handleGenerate} variant="ghost" size="sm" className="text-gray-500">
                LÀM MỚI BẢN ĐỒ
              </Button>
            </div>
          </div>
        )}
      </div>

      <AnimatePresence>
        {selectedRoom && (
          <div className="fixed inset-0 z-70 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }} 
              animate={{ opacity: 1 }} 
              exit={{ opacity: 0 }}
              onClick={() => setSelectedRoom(null)}
              className="absolute inset-0 bg-black/80 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="relative bg-gray-900 border border-gray-700 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl"
            >
              <div className="p-6">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-2xl font-bold text-sky-400">{selectedRoom.name}</h3>
                  <button onClick={() => setSelectedRoom(null)} className="text-gray-500 hover:text-white">
                    <X size={24} />
                  </button>
                </div>
                <div className="space-y-4">
                  <div>
                    <h5 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Mô tả phòng</h5>
                    <p className="text-gray-300 text-sm leading-relaxed">{selectedRoom.description}</p>
                  </div>
                  <div>
                    <h5 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Các từ khóa/Chủ đề chính</h5>
                    <div className="flex flex-wrap gap-2">
                      {selectedRoom.keyTopics.map((topic, idx) => (
                        <span key={idx} className="px-3 py-1 bg-indigo-900/30 text-indigo-300 text-xs rounded-full border border-indigo-500/30">
                          {topic}
                        </span>
                      ))}
                    </div>
                  </div>
                  <div className="pt-4 mt-4 border-t border-gray-800">
                    <div className="flex items-start gap-3 p-3 bg-sky-900/10 rounded-lg border border-sky-500/20">
                      <Info size={16} className="text-sky-400 mt-0.5 flex-shrink-0" />
                      <p className="text-[11px] text-sky-300/70 italic">
                        Trong tương lai, khi bạn đặt câu hỏi liên quan đến các chủ đề này, AI sẽ ưu tiên truy xuất dữ liệu từ "Phòng" này để tăng độ chính xác.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
              <div className="p-4 bg-gray-800/50 flex justify-end">
                <Button onClick={() => setSelectedRoom(null)} variant="primary" size="sm">ĐÃ HIỂU</Button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
      <AnimatePresence>
        {showConfirmImport && (
          <div className="fixed inset-0 z-80 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }} 
              animate={{ opacity: 1 }} 
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/90 backdrop-blur-md"
            />
            <motion.div 
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="relative bg-gray-900 border border-red-500/30 rounded-2xl w-full max-w-sm overflow-hidden shadow-[0_0_50px_rgba(239,68,68,0.2)]"
            >
              <div className="p-6 text-center">
                <div className="w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center mx-auto mb-4 border border-red-500/20">
                  <Info size={32} className="text-red-500" />
                </div>
                <h3 className="text-xl font-bold text-white mb-2">XÁC NHẬN NHẬP KÝ ỨC</h3>
                <p className="text-sm text-gray-400 leading-relaxed">
                  Hành động này sẽ <span className="text-red-400 font-bold">XÓA VĨNH VIỄN</span> toàn bộ ký ức hiện tại trên máy này để thay thế bằng dữ liệu từ file.
                </p>
                <div className="mt-6 flex flex-col gap-2">
                  <Button onClick={executeImport} variant="primary" className="bg-red-600 hover:bg-red-700 border-none">
                    XÁC NHẬN & GHI ĐÈ
                  </Button>
                  <Button onClick={() => setShowConfirmImport(false)} variant="ghost" className="text-gray-500">
                    HỦY BỎ
                  </Button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </Modal>
  );
};
