import React, { useState } from 'react';
import { Play, Zap, RefreshCw, CheckCircle, AlertCircle, Clock, Search, CheckSquare, Square } from 'lucide-react';
import Button from './ui/Button';
import { ModelPingResult, pingSingleModel, pingMultipleModels } from '../services/modelPingService';

interface ModelPingTesterProps {
  availableModels: { id: string; name: string }[];
  className?: string;
  onApplyWorkingModelsToFallback?: (workingModelIds: string[]) => void;
}

export const ModelPingTester: React.FC<ModelPingTesterProps> = ({
  availableModels,
  className = '',
  onApplyWorkingModelsToFallback
}) => {
  const [resultsMap, setResultsMap] = useState<Record<string, ModelPingResult>>({});
  const [selectedModelIds, setSelectedModelIds] = useState<Set<string>>(new Set());
  const [isTestingAll, setIsTestingAll] = useState(false);
  const [isTestingSelected, setIsTestingSelected] = useState(false);
  const [currentlyTestingId, setCurrentlyTestingId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'success' | 'error' | 'untested'>('all');

  // Filter models based on search and status
  const filteredModels = availableModels.filter(m => {
    const matchesSearch = m.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          m.id.toLowerCase().includes(searchQuery.toLowerCase());
    if (!matchesSearch) return false;

    const res = resultsMap[m.id];
    if (filterStatus === 'all') return true;
    if (filterStatus === 'success') return res && res.status === 'success';
    if (filterStatus === 'error') return res && res.status === 'error';
    if (filterStatus === 'untested') return !res || res.status === 'idle';
    return true;
  });

  // Toggle model selection
  const toggleSelect = (id: string) => {
    const next = new Set(selectedModelIds);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    setSelectedModelIds(next);
  };

  const handleSelectAll = () => {
    if (selectedModelIds.size === filteredModels.length) {
      setSelectedModelIds(new Set());
    } else {
      setSelectedModelIds(new Set(filteredModels.map(m => m.id)));
    }
  };

  // Test a single model
  const handleTestSingle = async (m: { id: string; name: string }) => {
    setCurrentlyTestingId(m.id);
    setResultsMap(prev => ({
      ...prev,
      [m.id]: { modelId: m.id, modelName: m.name, status: 'testing' }
    }));

    const result = await pingSingleModel(m.id, m.name);

    setResultsMap(prev => ({
      ...prev,
      [m.id]: result
    }));
    setCurrentlyTestingId(null);
  };

  // Test selected models in parallel
  const handleTestSelected = async () => {
    const targetModels = availableModels.filter(m => selectedModelIds.has(m.id));
    if (targetModels.length === 0) return;

    setIsTestingSelected(true);
    
    // Set testing state for selected
    setResultsMap(prev => {
      const next = { ...prev };
      targetModels.forEach(m => {
        next[m.id] = { modelId: m.id, modelName: m.name, status: 'testing' };
      });
      return next;
    });

    await pingMultipleModels(targetModels, (singleRes) => {
      setResultsMap(prev => ({
        ...prev,
        [singleRes.modelId]: singleRes
      }));
    });

    setIsTestingSelected(false);
  };

  // Test ALL models in parallel
  const handleTestAll = async () => {
    if (availableModels.length === 0) return;

    setIsTestingAll(true);

    // Set testing state for all
    setResultsMap(prev => {
      const next = { ...prev };
      availableModels.forEach(m => {
        next[m.id] = { modelId: m.id, modelName: m.name, status: 'testing' };
      });
      return next;
    });

    await pingMultipleModels(availableModels, (singleRes) => {
      setResultsMap(prev => ({
        ...prev,
        [singleRes.modelId]: singleRes
      }));
    });

    setIsTestingAll(false);
  };

  const handleResetResults = () => {
    setResultsMap({});
    setSelectedModelIds(new Set());
  };

  const handleApplyWorkingModels = () => {
    const workingModels = availableModels
      .filter(m => resultsMap[m.id]?.status === 'success')
      .map(m => m.id);

    if (workingModels.length > 0 && onApplyWorkingModelsToFallback) {
      onApplyWorkingModelsToFallback(workingModels);
    }
  };

  // Calculate statistics
  const totalCount = availableModels.length;
  const testedResults: ModelPingResult[] = Object.values(resultsMap);
  const successCount = testedResults.filter((r: ModelPingResult) => r.status === 'success').length;
  const errorCount = testedResults.filter((r: ModelPingResult) => r.status === 'error').length;
  const testingCount = testedResults.filter((r: ModelPingResult) => r.status === 'testing').length;
  
  const totalLatency = testedResults.reduce((acc: number, r: ModelPingResult) => acc + (r.latencyMs || 0), 0);
  const avgLatency = successCount > 0 ? (totalLatency / successCount / 1000).toFixed(2) : null;

  return (
    <div className={`bg-gray-900 border border-gray-800 rounded-xl p-4 text-gray-200 shadow-xl ${className}`}>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-gray-800 pb-3 mb-4">
        <div>
          <div className="flex items-center gap-2">
            <Zap className="text-amber-400 w-5 h-5 animate-pulse" />
            <h3 className="text-sm font-bold text-gray-100 uppercase tracking-wide">
              Bộ Kiểm Tra Trạng Thái & Độ Trễ Model (Model Ping Tester)
            </h3>
          </div>
          <p className="text-xs text-gray-400 mt-0.5">
            Gửi prompt siêu ngắn (ping) kiểm tra khả năng hoạt động & phản hồi theo thời gian thực (Song song tối đa 2 model/lần)
          </p>
        </div>

        {/* Stats summary bar */}
        <div className="flex items-center gap-2 text-xs">
          <span className="bg-gray-800 px-2.5 py-1 rounded text-gray-300 font-mono">
            Tổng: <strong className="text-white">{totalCount}</strong>
          </span>
          <span className="bg-emerald-950/80 border border-emerald-500/30 text-emerald-300 px-2.5 py-1 rounded font-mono">
            Hoạt động: <strong>{successCount}</strong>
          </span>
          <span className="bg-rose-950/80 border border-rose-500/30 text-rose-300 px-2.5 py-1 rounded font-mono">
            Lỗi: <strong>{errorCount}</strong>
          </span>
          {avgLatency && (
            <span className="bg-indigo-950/80 border border-indigo-500/30 text-indigo-300 px-2.5 py-1 rounded font-mono">
              Trung bình: <strong>{avgLatency}s</strong>
            </span>
          )}
        </div>
      </div>

      {/* Action buttons & Selection bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="primary"
            onClick={handleTestAll}
            isLoading={isTestingAll}
            disabled={isTestingAll || isTestingSelected}
            className="!py-1.5 !px-3 text-xs flex items-center gap-1.5 bg-gradient-to-r from-amber-600 to-amber-700 hover:from-amber-500 hover:to-amber-600 border-none shadow-md"
          >
            <Zap size={14} />
            {isTestingAll ? 'Đang test tất cả (Max 2 cùng lúc)...' : 'Kiểm Tra Tất Cả (Batch 2)'}
          </Button>

          <Button
            type="button"
            variant="secondary"
            onClick={handleTestSelected}
            isLoading={isTestingSelected}
            disabled={selectedModelIds.size === 0 || isTestingAll || isTestingSelected}
            className="!py-1.5 !px-3 text-xs flex items-center gap-1.5 bg-indigo-900/80 hover:bg-indigo-800 border-indigo-700"
          >
            <Play size={14} />
            {isTestingSelected
              ? `Đang test ${selectedModelIds.size} model...`
              : `Kiểm Tra Đã Chọn (${selectedModelIds.size})`}
          </Button>

          {successCount > 0 && onApplyWorkingModelsToFallback && (
            <Button
              type="button"
              variant="secondary"
              onClick={handleApplyWorkingModels}
              disabled={isTestingAll || isTestingSelected}
              className="!py-1.5 !px-3 text-xs flex items-center gap-1.5 bg-emerald-950/90 hover:bg-emerald-900 border-emerald-500/50 text-emerald-200 shadow-sm transition-all"
              title="Đưa toàn bộ model hoạt động vào danh sách fallback thay thế cho danh sách hiện tại (áp dụng cho Main, Economy, Combat)"
            >
              <CheckCircle size={14} className="text-emerald-400" />
              Đưa Model Hoạt Động Vào Fallback ({successCount})
            </Button>
          )}

          {Object.keys(resultsMap).length > 0 && (
            <Button
              type="button"
              variant="ghost"
              onClick={handleResetResults}
              disabled={isTestingAll || isTestingSelected}
              className="!py-1.5 !px-2.5 text-xs text-gray-400 hover:text-white"
            >
              <RefreshCw size={13} />
              Xóa kết quả
            </Button>
          )}
        </div>

        {/* Filter controls */}
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-500" />
            <input
              type="text"
              placeholder="Tìm kiếm model..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="bg-gray-950 border border-gray-800 rounded pl-8 pr-2 py-1 text-xs text-gray-200 focus:outline-none focus:border-indigo-500 w-40 sm:w-48"
            />
          </div>

          <select
            value={filterStatus}
            onChange={(e: any) => setFilterStatus(e.target.value)}
            className="bg-gray-950 border border-gray-800 rounded px-2 py-1 text-xs text-gray-300 focus:outline-none focus:border-indigo-500"
          >
            <option value="all">Tất cả ({availableModels.length})</option>
            <option value="success">Hoạt động ({successCount})</option>
            <option value="error">Lỗi ({errorCount})</option>
            <option value="untested">Chưa test</option>
          </select>
        </div>
      </div>

      {/* Select All Bar */}
      <div className="flex items-center justify-between text-xs text-gray-400 bg-gray-950/60 px-3 py-1.5 rounded border border-gray-800/80 mb-3">
        <button
          type="button"
          onClick={handleSelectAll}
          className="flex items-center gap-1.5 hover:text-white transition-colors"
        >
          {selectedModelIds.size === filteredModels.length && filteredModels.length > 0 ? (
            <CheckSquare size={14} className="text-indigo-400" />
          ) : (
            <Square size={14} />
          )}
          <span>
            {selectedModelIds.size === filteredModels.length && filteredModels.length > 0
              ? 'Bỏ chọn tất cả'
              : `Chọn tất cả (${filteredModels.length})`}
          </span>
        </button>

        <span className="text-[11px] text-gray-500">
          Hiển thị {filteredModels.length} / {availableModels.length} model
        </span>
      </div>

      {/* Models List */}
      <div className="max-h-72 overflow-y-auto space-y-1.5 pr-1 scrollbar-thin scrollbar-thumb-gray-700">
        {filteredModels.length === 0 ? (
          <div className="text-center py-6 text-xs text-gray-500 italic">
            Không tìm thấy model nào phù hợp.
          </div>
        ) : (
          filteredModels.map((m) => {
            const isSelected = selectedModelIds.has(m.id);
            const res = resultsMap[m.id];
            const isTestingThis = currentlyTestingId === m.id || (res && res.status === 'testing');

            return (
              <div
                key={m.id}
                className={`flex items-center justify-between gap-3 p-2 rounded-lg border transition-all text-xs ${
                  res?.status === 'success'
                    ? 'bg-emerald-950/20 border-emerald-900/40 hover:border-emerald-600/50'
                    : res?.status === 'error'
                    ? 'bg-rose-950/20 border-rose-900/40 hover:border-rose-600/50'
                    : isTestingThis
                    ? 'bg-amber-950/20 border-amber-500/40'
                    : 'bg-gray-950/50 border-gray-800/80 hover:border-gray-700'
                }`}
              >
                {/* Left: Checkbox + Name + ID */}
                <div className="flex items-center gap-2.5 min-w-0 flex-1">
                  <button
                    type="button"
                    onClick={() => toggleSelect(m.id)}
                    className="text-gray-400 hover:text-indigo-400 flex-shrink-0"
                  >
                    {isSelected ? (
                      <CheckSquare size={15} className="text-indigo-400" />
                    ) : (
                      <Square size={15} />
                    )}
                  </button>

                  <div className="min-w-0 flex-1">
                    <div className="font-medium text-gray-200 truncate flex items-center gap-2">
                      <span>{m.name}</span>
                    </div>
                    <div className="text-[11px] text-gray-500 font-mono truncate">{m.id}</div>
                  </div>
                </div>

                {/* Right: Status badge & Test Button */}
                <div className="flex items-center gap-2 flex-shrink-0">
                  {/* Status Badge */}
                  {isTestingThis ? (
                    <span
                      className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40 text-[11px] font-mono animate-pulse"
                      title="🟡 Đang kiểm tra model này..."
                    >
                      🟡 <RefreshCw size={10} className="animate-spin" />
                    </span>
                  ) : res?.status === 'success' ? (
                    <span
                      className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 text-[11px] font-mono cursor-help"
                      title={`🟢 Hoạt động! Phản hồi trong ${((res.latencyMs || 0) / 1000).toFixed(2)}s`}
                    >
                      🟢 {((res.latencyMs || 0) / 1000).toFixed(1)}s
                    </span>
                  ) : res?.status === 'error' ? (
                    <span
                      className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-300 border border-rose-500/40 text-[11px] font-mono cursor-help"
                      title={`🔴 Lỗi chi tiết: ${res.errorMessage || 'Không phản hồi'}`}
                    >
                      🔴 Lỗi
                    </span>
                  ) : (
                    <span
                      className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-gray-800 text-gray-400 text-[11px] font-mono"
                      title="⚪ Chưa kiểm tra"
                    >
                      ⚪
                    </span>
                  )}

                  {/* Individual Test Button */}
                  <button
                    type="button"
                    onClick={() => handleTestSingle(m)}
                    disabled={isTestingThis || isTestingAll || isTestingSelected}
                    className="p-1 px-2 rounded bg-gray-800 hover:bg-gray-700 text-gray-300 hover:text-white border border-gray-700 transition-colors flex items-center gap-1 text-[11px]"
                    title="Kiểm tra riêng model này"
                  >
                    <Play size={10} />
                    Test
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
