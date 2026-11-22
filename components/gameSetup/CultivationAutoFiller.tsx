import React, { useState } from 'react';
import Button from '../ui/Button';
import Spinner from '../ui/Spinner';
import { AISetupService } from '@/services/aiSetupService';
import { CultivationCanonSearchService } from '@/services/ai/cultivationCanonSearchService';
import { CultivationAutoFillerStreamService } from '@/src/services/cultivationAutoFillerStreamService';
import { CultivationValidator } from '@/services/ai/cultivationValidator';
import { NPC, WorldSettings } from '@/types';
import { parseRealmString } from '@/utils/realmParser';

interface CultivationAutoFillerProps {
  worldContext: string;
  npcs: NPC[];
  isStrictGrounding?: boolean;
  remoteCanonUrl?: string;
  rawCanonData?: string | null;
  onGenerated: (major: string, minor: string) => void;
  onNestedChange: (parent: keyof WorldSettings, field: string, value: any) => void;
  setSimpleField?: (key: keyof WorldSettings, value: any) => void;
  batchUpdateNPCs: (realmMap: Record<string, string>) => void;
  setStreamingText?: (text: string) => void;
  setIsStreamingActive?: (active: boolean) => void;
}

const FALLBACK_MAJOR = "Cảnh giới 1 - Cảnh giới 2 - Cảnh giới 3 - Cảnh giới 4 - Cảnh giới 5 - Cảnh giới 6 - Cảnh giới 7 - Cảnh giới 8 - Cảnh giới 9 - Cảnh giới 10";
const FALLBACK_MINOR = "Tầng 1 - Tầng 2 - Tầng 3 - Tầng 4 - Tầng 5 - Tầng 6 - Tầng 7 - Tầng 8 - Tầng 9 - Tầng 10";

const CultivationAutoFiller: React.FC<CultivationAutoFillerProps> = ({ 
  worldContext, 
  npcs,
  isStrictGrounding,
  remoteCanonUrl,
  rawCanonData,
  onGenerated, 
  onNestedChange,
  setSimpleField,
  batchUpdateNPCs,
  setStreamingText,
  setIsStreamingActive
}) => {
  const [isGenerating, setIsGenerating] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleAutoFill = async () => {
    setError(null);
    if (!worldContext.trim()) {
      setError("Vui lòng nhập bối cảnh hoặc ý tưởng thế giới trước khi sử dụng tính năng này.");
      return;
    }

    setIsGenerating(true);
    setLoadingMessage("🔍 [1/2] Đang tìm kiếm cấp bậc nguyên tác bằng ngôn ngữ gốc...");
    
    try {
      let majors = "";
      let minors = "";

      if (isStrictGrounding && remoteCanonUrl) {
          let canonData = rawCanonData;
          if (!canonData) {
              setLoadingMessage("Đang tải dữ liệu gốc từ URL...");
              const { fetchRawCanonData } = await import('@/utils/rawFetcher');
              canonData = await fetchRawCanonData(remoteCanonUrl) || null;
          }

          if (canonData) {
              setLoadingMessage("🔍 [1/2] Đang trích xuất hệ thống tu luyện từ nguyên tác...");
              const { CanonExtractionService } = await import('@/src/services/CanonExtractionService');
              const extracted = await CanonExtractionService.extractRelevantContext(canonData, 'CULTIVATION_SYSTEM');
              
              setLoadingMessage("⚡ [2/2] Đang biên soạn hệ thống tu luyện từ dữ liệu trích xuất...");
              const { GeminiService } = await import('@/src/services/geminiService');
              const result = await GeminiService.generateCultivationFromExtractedContext(extracted);
              majors = result.realms;
              minors = result.subRealms;
          } else {
              setLoadingMessage("⚡ [2/2] Đang phân tích & chuyển đổi sang hệ thống tu luyện...");
              if (setStreamingText && setIsStreamingActive) {
                setStreamingText('');
                setIsStreamingActive(true);
              }
              const result = await CultivationAutoFillerStreamService.fillCultivationSystemStream(worldContext, setStreamingText);
              majors = result.majorRealmsRaw;
              minors = result.minorRealmsRaw;
          }
      } else {
          setLoadingMessage("⚡ [2/2] Đang phân tích & chuyển đổi sang hệ thống tu luyện...");
          if (setStreamingText && setIsStreamingActive) {
            setStreamingText('');
            setIsStreamingActive(true);
          }
          const result = await CultivationAutoFillerStreamService.fillCultivationSystemStream(worldContext, setStreamingText);
          majors = result.majorRealmsRaw;
          minors = result.minorRealmsRaw;
      }
      
      // Cập nhật UI và đồng bộ state
      onGenerated(majors, minors);
      
      setLoadingMessage(null);
    } catch (err: any) {
      console.error("AI AutoFill error:", err);
      // Fallback cho hệ thống tu luyện nếu lỗi
      onGenerated(FALLBACK_MAJOR, FALLBACK_MINOR);
      setError("AI gặp sự cố khi tạo hệ thống, đã dùng bộ khung mặc định.");
    } finally {
      setIsGenerating(false);
      setLoadingMessage(null);
      if (setIsStreamingActive) {
        setIsStreamingActive(false);
      }
    }
  };

  return (
    <div className="flex flex-col gap-2 mb-2">
      <div className="flex items-center gap-2">
        <Button
          onClick={handleAutoFill}
          disabled={isGenerating}
          variant="secondary"
          className="text-xs py-1 px-3 bg-indigo-600 hover:bg-indigo-700 text-white flex items-center gap-2"
        >
          {isGenerating ? <Spinner size="sm" /> : null}
          {isGenerating ? (loadingMessage || "Đang tạo...") : "AI Tự động thiết lập theo bối cảnh"}
        </Button>
        <span className="text-[10px] text-gray-400 italic">
          (Hệ thống chung cho tất cả chủng tộc)
        </span>
      </div>
      {error && (
        <p className="text-[10px] text-red-400 bg-red-900/20 p-1 rounded border border-red-500/30">
          {error}
        </p>
      )}
    </div>
  );
};

export default CultivationAutoFiller;

