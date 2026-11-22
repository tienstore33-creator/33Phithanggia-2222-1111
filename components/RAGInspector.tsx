import React, { useState } from 'react';
import { Search, X, Loader2, BookOpen } from 'lucide-react';
import { RAGService } from '../services/RAGService';
import { RemoteCanonService } from '../services/RemoteCanonService';

export const RAGInspector = ({ isOpen, onClose }: { isOpen: boolean, onClose: () => void }) => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  if (!isOpen) return null;

  const handleInspect = async () => {
    if (!query.trim()) return;
    setIsLoading(true);
    try {
      // Tìm kiếm song song trong vector DB và URL canon
      const url = "https://raw.githubusercontent.com/tienstore32-png/phamnhanlinhgioi/refs/heads/main/phamnhanlinhgioi.txt";
      const [context, urlResults] = await Promise.all([
        RAGService.findRelevantContext(query, 5),
        RemoteCanonService.search(url, query)
      ]);
      
      const newResults = [];
      if (context) newResults.push(...context.split('\n---\n'));
      if (urlResults) newResults.push(urlResults);
      
      setResults(newResults.length > 0 ? newResults : ["Không tìm thấy dữ liệu liên quan."]);
    } catch (err) {
      setResults(["Lỗi khi truy vấn dữ liệu."]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
      <div className="bg-gray-900 border border-indigo-500/50 rounded-xl w-full max-w-2xl max-h-[80vh] flex flex-col shadow-2xl shadow-indigo-500/20">
        <div className="p-4 border-b border-gray-800 flex justify-between items-center">
          <div className="flex items-center gap-2 text-indigo-400">
            <BookOpen size={20} />
            <h3 className="font-bold uppercase tracking-wider">Kiểm tra tri thức nguyên tác</h3>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors">
            <X size={20} />
          </button>
        </div>

        <div className="px-4 pt-4 text-[10px] text-gray-400 italic">
          Hướng dẫn: Nhập từ khóa hoặc câu hỏi liên quan đến nội dung file nguyên tác bạn đã nạp. AI sẽ tìm kiếm các đoạn văn bản (chunks) có độ tương đồng cao nhất trong cơ sở dữ liệu vector để bạn kiểm tra xem dữ liệu đã được nạp chính xác chưa.
        </div>

        <div className="p-4 flex gap-2">
          <input 
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleInspect()}
            placeholder="Nhập từ khóa hoặc câu hỏi để test RAG..."
            className="flex-grow bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-sm outline-none focus:border-indigo-500 transition-colors"
          />
          <button 
            onClick={handleInspect}
            disabled={isLoading}
            className="bg-indigo-600 hover:bg-indigo-500 px-4 py-2 rounded-lg flex items-center gap-2 disabled:opacity-50 transition-colors"
          >
            {isLoading ? <Loader2 className="animate-spin" size={18} /> : <Search size={18} />}
            <span className="font-bold text-xs">TEST</span>
          </button>
        </div>

        <div className="flex-grow overflow-y-auto p-4 space-y-4 bg-black/20">
          {results.map((text, i) => (
            <div key={i} className="p-3 bg-gray-800/50 border-l-4 border-indigo-500 rounded text-xs text-gray-300 leading-relaxed">
              <div className="text-indigo-400 font-bold mb-1 uppercase text-[10px]">Đoạn trích #{i+1}:</div>
              {text}
            </div>
          ))}
          {results.length === 0 && !isLoading && (
            <div className="text-center text-gray-500 py-10 italic text-sm">
              Nhập nội dung để xem AI trích xuất gì từ file của bạn.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
