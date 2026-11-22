import React, { useState, useEffect, useRef } from 'react';
import Button from './ui/Button';
import { Eye, EyeOff, Check, X, FileText, Settings, Trash2, FolderPlus, HelpCircle, Loader2 } from 'lucide-react';
import Modal from './ui/Modal';
import { callGeminiAPI } from '../services/apiService';
import { GuideMarker } from './guide/GuideSystem';

export interface ParsedPresetSection {
  id: string;
  title: string;
  description: string; // Lời giải thích của AI (Hiển thị khi bấm [?])
  rawContent: string;  // Khối text thực tế của đầu mục (Hiển thị khi bấm [👁])
  enabled: boolean;    // User có đang bật mục này không (Nút [✔])
}

interface PresetPrompt {
  identifier: string;
  name: string;
  enabled: boolean;
  content: string;
  role?: string;
}

interface PresetFile {
  id: string;
  fileName: string;
  enabled: boolean;
  prompts: PresetPrompt[];
  parsedSections?: ParsedPresetSection[];
}

function splitPresetMechanically(content: string): { title: string; rawContent: string }[] {
  const lines = content.split('\n');
  const segments: { title: string; rawContent: string }[] = [];
  let currentTitle = "Khởi tạo ban đầu";
  let currentLines: string[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();
    
    const isDivider = 
      (trimmed.startsWith('===') && trimmed.endsWith('===')) ||
      (trimmed.startsWith('---') && trimmed.endsWith('---')) ||
      trimmed.startsWith('###') || trimmed.startsWith('##') ||
      trimmed.includes('✦ Phân khu') || trimmed.includes('✦ Phân khu') ||
      (trimmed.startsWith('// ===') && trimmed.endsWith('===')) ||
      (trimmed.startsWith('/* ===') && trimmed.endsWith('=== */'));

    if (isDivider && currentLines.length > 0) {
      segments.push({
        title: currentTitle,
        rawContent: currentLines.join('\n')
      });
      currentLines = [];
      currentTitle = trimmed
        .replace(/^[=\s\-#/*✦]+/g, '')
        .replace(/[=\s\-#/*✦]+$/g, '')
        .trim();
      if (!currentTitle) {
        currentTitle = `Phân khu ${segments.length + 1}`;
      }
    } else if (isDivider) {
      currentTitle = trimmed
        .replace(/^[=\s\-#/*✦]+/g, '')
        .replace(/[=\s\-#/*✦]+$/g, '')
        .trim();
      if (!currentTitle) {
        currentTitle = `Phân khu ${segments.length + 1}`;
      }
    }
    
    currentLines.push(line);
  }

  if (currentLines.length > 0) {
    segments.push({
      title: currentTitle,
      rawContent: currentLines.join('\n')
    });
  }

  if (segments.length === 1 && content.includes('\n\n')) {
    const blocks = content.split(/\n\s*\n/);
    if (blocks.length > 1) {
      return blocks.map((block, idx) => {
        const blockLines = block.trim().split('\n');
        let title = blockLines[0].trim().replace(/^[#\s\-/*//]+/g, '').substring(0, 40).trim();
        if (!title || title.length < 3) {
          title = `Khối ${idx + 1}`;
        }
        return {
          title,
          rawContent: block
        };
      });
    }
  }

  return segments;
}

function removeVietnameseTones(str: string): string {
  let result = str;
  result = result.replace(/à|á|ạ|ả|ã|â|ầ|ấ|ậ|ẩ|ẫ|ă|ằ|ắ|ặ|ẳ|ẵ/g, "a");
  result = result.replace(/è|é|ẹ|ẻ|ẽ|ê|ề|ế|ệ|ể|ễ/g, "e");
  result = result.replace(/ì|í|ị|ỉ|ĩ/g, "i");
  result = result.replace(/ò|ó|ọ|ỏ|õ|ô|ồ|ố|ộ|ổ|ỗ|ơ|ờ|ớ|ợ|ở|ỡ/g, "o");
  result = result.replace(/ù|ú|ụ|ủ|ũ|ư|ừ|ứ|ự|ử|ữ/g, "u");
  result = result.replace(/ỳ|ý|ỵ|ỷ|ỹ/g, "y");
  result = result.replace(/đ/g, "d");
  result = result.replace(/À|Á|Ạ|Ả|Ã|Â|Ầ|Ấ|Ậ|Ẩ|Ẫ|Ă|Ằ|Ắ|Ặ|Ẳ|Ẵ/g, "A");
  result = result.replace(/È|É|Ẹ|Ẻ|Ẽ|Ê|Ề|Ế|Ệ|Ể|Ễ/g, "E");
  result = result.replace(/Ì|Í|Ị|Ỉ|Ĩ/g, "I");
  result = result.replace(/Ò|Ó|Ọ|Ỏ|Õ|Ô|Ồ|Ố|Ộ|Ổ|Ỗ|Ơ|Ờ|Ớ|Ợ|Ở|Ỡ/g, "O");
  result = result.replace(/Ù|Ú|Ụ|Ủ|Ũ|Ư|Ừ|Ứ|Ự|Ử|Ữ/g, "U");
  result = result.replace(/Ỳ|Ý|Y|Ỷ|Ỹ/g, "Y");
  result = result.replace(/Đ/g, "D");
  try {
    result = result.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  } catch (e) {}
  return result;
}

function toSafeXmlTagName(name: string): string {
  // Chuyển tiếng Việt có dấu thành không dấu
  let withoutTones = removeVietnameseTones(name);
  
  // Loại bỏ các ký tự đặc biệt, giữ lại chữ cái tiếng Anh không dấu, số và dấu gạch dưới
  let tag = withoutTones
    .replace(/[^a-zA-Z0-9\s_-]/g, '') // Chỉ giữ lại chữ cái tiếng Anh, số, khoảng trắng, gạch dưới/ngang
    .trim()
    .replace(/[\s_-]+/g, '_'); // Thay khoảng trắng/gạch nối bằng một dấu gạch dưới đơn
  
  if (!tag) return 'PresetSection';
  // XML tag không được bắt đầu bằng số hoặc dấu gạch dưới
  if (/^[0-9_]/.test(tag)) {
    tag = 'Preset_' + tag;
  }
  return tag;
}

interface PresetManagerProps {
  value: string;
  onChange: (compiledValue: string) => void;
  onPresetCountChange?: (count: number) => void;
  mainModel?: string;
  isGuideOverlayActive?: boolean;
  activeGuideId?: string | null;
  setActiveGuideId?: (id: string | null) => void;
}

export const PresetManager: React.FC<PresetManagerProps> = ({ 
  value, 
  onChange, 
  onPresetCountChange, 
  mainModel,
  isGuideOverlayActive,
  activeGuideId,
  setActiveGuideId
}) => {
  const [presetFiles, setPresetFiles] = useState<PresetFile[]>(() => {
    try {
      const saved = localStorage.getItem('accessory_preset_files');
      return saved ? JSON.parse(saved) : [];
    } catch (e) {
      console.error('Error loading preset files from localStorage:', e);
      return [];
    }
  });

  const [expandedIndices, setExpandedIndices] = useState<Record<string, number | null>>({});
  const [success, setSuccess] = useState<string>('');
  const [error, setError] = useState<string>('');
  const [showConfirmDelete, setShowConfirmDelete] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // AI states
  const [analyzingFileId, setAnalyzingFileId] = useState<string | null>(null);
  const [translatingFileId, setTranslatingFileId] = useState<string | null>(null);
  const [viewingRawContent, setViewingRawContent] = useState<{ title: string; content: string } | null>(null);
  const [viewingExplanation, setViewingExplanation] = useState<{ title: string; explanation: string } | null>(null);
  const [isPreviewModalOpen, setIsPreviewModalOpen] = useState(false);

  // Sync presetFiles and trigger compiled value update
  useEffect(() => {
    localStorage.setItem('accessory_preset_files', JSON.stringify(presetFiles));
    window.dispatchEvent(new Event('accessory_preset_files_changed'));
    
    let presetCounter = 1;
    let fileCounter = 1;
    const compiled = presetFiles
      .filter(pf => pf.enabled)
      .map(pf => {
        let sectionsText = "";
        if (pf.parsedSections && pf.parsedSections.length > 0) {
          sectionsText = pf.parsedSections
            .filter(s => s.enabled)
            .map(s => {
              const currentNum = String(presetCounter++).padStart(2, '0');
              const safeTag = `${toSafeXmlTagName(s.title)}_presetNo.${currentNum}`;
              return `<${safeTag}>\n${s.rawContent.trim()}\n</${safeTag}>`;
            })
            .join('\n\n');
        } else {
          sectionsText = pf.prompts
            .filter(p => p.enabled)
            .map(p => {
              const currentNum = String(presetCounter++).padStart(2, '0');
              const safeTag = `${toSafeXmlTagName(p.name)}_presetNo.${currentNum}`;
              return `<${safeTag}>\n${p.content.trim()}\n</${safeTag}>`;
            })
            .join('\n\n');
        }
        
        if (!sectionsText.trim()) return "";
        
        const currentFileNum = fileCounter++;
        const safeFileName = toSafeXmlTagName(pf.fileName);
        const parentTagOpen = `Tong_muc_preset_thu_${currentFileNum}_${safeFileName}`;
        return `<${parentTagOpen}>\n${sectionsText.trim()}\n</${parentTagOpen}>`;
      })
      .filter(text => text !== "")
      .join('\n\n');
    
    onChange(compiled);
    if (onPresetCountChange) {
      onPresetCountChange(presetFiles.length);
    }
  }, [presetFiles, onChange, onPresetCountChange]);

  const handleTogglePrompt = (fileId: string, promptIndex: number) => {
    setPresetFiles(prev =>
      prev.map(pf => pf.id === fileId 
        ? { ...pf, prompts: pf.prompts.map((p, i) => i === promptIndex ? { ...p, enabled: !p.enabled } : p) }
        : pf
      )
    );
  };

  const isAllEnabled = (pf: PresetFile) => {
    const hasParsed = pf.parsedSections && pf.parsedSections.length > 0;
    if (hasParsed) {
      return pf.parsedSections.every(s => s.enabled);
    }
    return pf.prompts.every(p => p.enabled);
  };

  const handleToggleSelectAll = (fileId: string) => {
    setPresetFiles(prev =>
      prev.map(pf => {
        if (pf.id !== fileId) return pf;
        const hasParsed = pf.parsedSections && pf.parsedSections.length > 0;
        if (hasParsed) {
          const allEnabled = pf.parsedSections.every(s => s.enabled);
          return {
            ...pf,
            parsedSections: pf.parsedSections.map(s => ({ ...s, enabled: !allEnabled }))
          };
        } else {
          const allEnabled = pf.prompts.every(p => p.enabled);
          return {
            ...pf,
            prompts: pf.prompts.map(p => ({ ...p, enabled: !allEnabled }))
          };
        }
      })
    );
  };

  const handleToggleFile = (fileId: string) => {
    setPresetFiles(prev =>
      prev.map(pf => pf.id === fileId ? { ...pf, enabled: !pf.enabled } : pf)
    );
  };

  const handleToggleSection = (fileId: string, sectionId: string) => {
    setPresetFiles(prev =>
      prev.map(pf => pf.id === fileId && pf.parsedSections
        ? { ...pf, parsedSections: pf.parsedSections.map(s => s.id === sectionId ? { ...s, enabled: !s.enabled } : s) }
        : pf
      )
    );
  };

  const handleAnalyzePreset = async (fileId: string) => {
    const file = presetFiles.find(pf => pf.id === fileId);
    if (!file) return;

    const fullContent = file.prompts.map(p => p.content).join('\n\n');
    if (!fullContent.trim()) {
      setError('File preset không có nội dung để phân tích.');
      return;
    }

    setAnalyzingFileId(fileId);
    setError('');
    setSuccess('');

    try {
      // 1. Phân tách cơ học ở phía Frontend
      const segments = splitPresetMechanically(fullContent);
      
      // Tạo bản rút gọn gửi cho AI phân tích để giảm tải token và tăng tốc độ xử lý
      const segmentInputsForAI = segments.map((seg, idx) => {
        const preview = seg.rawContent.length > 500 
          ? seg.rawContent.substring(0, 500) + "\n...[Nội dung còn tiếp]..."
          : seg.rawContent;
        return `--- PHÂN ĐOẠN INDEX ${idx} ---
Tiêu đề giả định: ${seg.title}
Nội dung:
${preview}
`;
      }).join('\n\n');

      const prompt = `
Hãy đóng vai một chuyên gia phân tích hệ thống và lập trình viên cao cấp cho trò chơi nhập vai. Nhiệm vụ của bạn là đọc các phân đoạn cấu hình Prompt (Preset) dưới đây, sau đó phân tích và gán nhãn cho từng phân đoạn theo đúng chỉ số INDEX tương ứng.

Yêu cầu chi tiết cho mỗi phân đoạn:
1. Bạn phải phân tích dựa trên nội dung thực tế của phân đoạn đó.
2. Với mỗi phân đoạn, hãy cung cấp:
   - index: Giữ nguyên chính xác số index của phân đoạn từ dữ liệu đầu vào.
   - title: Đặt tên đầu mục ngắn gọn, trực quan, chuyên nghiệp (ví dụ: "Phân khu 00 · Khởi động song sinh" hoặc "Khởi tạo biến").
   - description: Viết một mô tả chuyên sâu bằng tiếng Việt có độ dài từ 2 đến 4 câu đầy đủ. Giải thích rõ ràng ý nghĩa, tác dụng hoặc cơ chế vận hành của nó trong hệ thống game. Đặc biệt, TRÁNH viết chung chung kiểu "Cấu hình thiết lập trạng thái...". Thay vào đó, hãy nêu rõ tác động thực tế: "Nếu bật phần này, hệ thống sẽ [tác dụng thực tế]. Ngược lại, nếu tắt hoặc bỏ qua, [hệ quả hoặc trạng thái mặc định của game]".

Hãy trả về kết quả dưới dạng một JSON Array duy nhất. Mỗi object trong array bắt buộc có cấu trúc sau:
{
  "index": 0,
  "title": "Tên đầu mục",
  "description": "Lời giải thích súc tích bằng tiếng Việt (2-4 câu) mô tả chi tiết tác động của việc bật/tắt mục này"
}

Dưới đây là danh sách các phân đoạn cần phân tích:
${segmentInputsForAI}
`;

      const { text: responseText } = await callGeminiAPI(
        prompt,
        undefined,
        'main',
        undefined,
        undefined,
        false,
        'application/json'
      );

      if (!responseText) {
        throw new Error("Không nhận được phản hồi phân tích từ AI.");
      }

      // Làm sạch JSON nếu AI trả về bọc trong markdown code block
      const sanitizedJson = responseText.replace(/```json/g, '').replace(/```/g, '').trim();
      const aiSections: any[] = JSON.parse(sanitizedJson);
      
      // 2. Ghép nối dữ liệu tại Frontend bằng ánh xạ index cơ học để đảm bảo rawContent nguyên bản 100%
      const parsedSections: ParsedPresetSection[] = aiSections.map((s) => {
        const indexValue = typeof s.index === 'number' ? s.index : 0;
        const originalSegment = segments[indexValue] || segments[0] || { title: `Khối ${indexValue + 1}`, rawContent: '' };
        
        return {
          id: `section-${indexValue}-${Date.now()}`,
          title: s.title || originalSegment.title || `Khối ${indexValue + 1}`,
          description: s.description || 'Không có mô tả chi tiết từ AI.',
          rawContent: originalSegment.rawContent || '',
          enabled: true
        };
      });

      setPresetFiles(prev =>
        prev.map(pf => pf.id === fileId ? { ...pf, parsedSections } : pf)
      );
      
      setSuccess(`Đã phân tích AI thành công file ${file.fileName}!`);
    } catch (err: any) {
      console.error('Lỗi phân tích preset:', err);
      setError(`Lỗi phân tích: ${err.message || String(err)}`);
    } finally {
      setAnalyzingFileId(null);
    }
  };

  const handleTranslatePreset = async (fileId: string) => {
    const file = presetFiles.find(pf => pf.id === fileId);
    if (!file) return;

    setTranslatingFileId(fileId);
    setError('');
    setSuccess('');

    const safeParseJson = (rawText: string) => {
      let cleanText = rawText;
      // Remove thinking tags if present
      cleanText = cleanText.replace(/<thinking>[\s\S]*?<\/thinking>/gi, '').trim();
      // Remove markdown code blocks
      cleanText = cleanText.replace(/```json/gi, '').replace(/```/gi, '').trim();

      const firstBracket = cleanText.indexOf('[');
      const lastBracket = cleanText.lastIndexOf(']');
      if (firstBracket !== -1 && lastBracket !== -1 && lastBracket > firstBracket) {
        return JSON.parse(cleanText.substring(firstBracket, lastBracket + 1));
      }

      const firstBrace = cleanText.indexOf('{');
      const lastBrace = cleanText.lastIndexOf('}');
      if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
        return JSON.parse(cleanText.substring(firstBrace, lastBrace + 1));
      }

      return JSON.parse(cleanText);
    };

    const restoreLeadingEmojis = (originalText: string, translatedText: string): string => {
      if (!originalText || !translatedText) return translatedText;
      // Match all leading non-letter and non-number characters (emojis, symbols, spaces, bullets, stars)
      const match = originalText.match(/^([^\p{L}\p{N}]+)/u);
      if (!match) return translatedText;
      const prefix = match[1];
      const cleanPrefix = prefix.trim();
      if (!cleanPrefix) return translatedText;

      if (!translatedText.trim().startsWith(cleanPrefix)) {
        return `${prefix}${translatedText.trim()}`;
      }
      return translatedText;
    };

    try {
      // TH1: Dành cho file đã phân tích AI (có parsedSections)
      if (file.parsedSections && file.parsedSections.length > 0) {
        const inputData = file.parsedSections.map((s, idx) => ({
          index: idx,
          title: s.title,
          description: s.description
        }));

        const prompt = `Bạn là biên dịch viên cao cấp cho game nhập vai. Hãy dịch toàn bộ tiêu đề (title) và lời giải thích (description) trong danh sách dưới đây sang tiếng Việt chuẩn xác, tự nhiên, dễ hiểu.
LƯU Ý QUAN TRỌNG: 
1. BẮT BUỘC giữ nguyên các biểu tượng cảm xúc, ký hiệu đặc biệt (emojis, icons như 🌙, 🔸, 🔹, 📖, 🌕, 💀, 🧪, ◆, etc.) ở đầu hoặc bên trong tiêu đề ban đầu. Tuyệt đối không được tự ý xóa bỏ hay thay đổi chúng.
2. Giữ nguyên chỉ số "index" chính xác. Trả về dưới dạng JSON Array duy nhất:
[
  {
    "index": 0,
    "title": "Tiêu đề tiếng Việt",
    "description": "Lời giải thích tiếng Việt"
  }
]

Danh sách cần dịch:
${JSON.stringify(inputData, null, 2)}`;

        const { text } = await callGeminiAPI(
          prompt,
          undefined,
          'economy',
          undefined,
          undefined,
          false,
          'application/json'
        );

        if (!text) throw new Error('Không nhận được kết quả dịch từ AI.');

        const translatedArray: { index: number; title: string; description: string }[] = safeParseJson(text);

        setPresetFiles(prev =>
          prev.map(pf => {
            if (pf.id !== fileId || !pf.parsedSections) return pf;
            const newSections = [...pf.parsedSections];
            translatedArray.forEach(item => {
              if (newSections[item.index]) {
                const orig = newSections[item.index];
                newSections[item.index] = {
                  ...orig,
                  title: restoreLeadingEmojis(orig.title, item.title || orig.title),
                  description: item.description || orig.description
                };
              }
            });
            return { ...pf, parsedSections: newSections };
          })
        );
      } else {
        // TH2: Dành cho file thô chưa qua phân tích AI (dịch tên prompt.name)
        const inputData = file.prompts.map((p, idx) => ({
          index: idx,
          name: p.name
        }));

        const prompt = `Hãy dịch các tên phân khu (name) sau đây sang tiếng Việt ngắn gọn, súc tích:
LƯU Ý QUAN TRỌNG: 
1. BẮT BUỘC giữ nguyên các biểu tượng cảm xúc, ký hiệu đặc biệt (emojis, icons như 🌙, 🔸, 🔹, 📖, 🌕, 💀, 🧪, ◆, etc.) ở đầu hoặc bên trong tên ban đầu. Tuyệt đối không được tự ý xóa bỏ hay thay đổi chúng.
2. Trả về định dạng JSON Array:
[
  {
    "index": 0,
    "name": "Tên tiếng Việt"
  }
]

Danh sách:
${JSON.stringify(inputData, null, 2)}`;

        const { text } = await callGeminiAPI(
          prompt,
          undefined,
          'economy',
          undefined,
          undefined,
          false,
          'application/json'
        );

        if (!text) throw new Error('Không nhận được kết quả dịch từ AI.');

        const translatedArray: { index: number; name: string }[] = safeParseJson(text);

        setPresetFiles(prev =>
          prev.map(pf => {
            if (pf.id !== fileId) return pf;
            const newPrompts = [...pf.prompts];
            translatedArray.forEach(item => {
              if (newPrompts[item.index]) {
                const orig = newPrompts[item.index];
                newPrompts[item.index] = {
                  ...orig,
                  name: restoreLeadingEmojis(orig.name, item.name || orig.name)
                };
              }
            });
            return { ...pf, prompts: newPrompts };
          })
        );
      }

      setSuccess(`Đã dịch các mục hiển thị của file "${file.fileName}" sang tiếng Việt thành công!`);
    } catch (err: any) {
      console.error('Lỗi khi dịch preset:', err);
      setError(`Lỗi dịch tiếng Việt: ${err.message || String(err)}`);
    } finally {
      setTranslatingFileId(null);
    }
  };

  const handleImportFile = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const rawContent = e.target?.result as string;
        setError('');
        setSuccess('');

        let newPrompts: PresetPrompt[] = [];

        // Attempt to parse as JSON preset
        try {
          const parsed = JSON.parse(rawContent);
          let extracted: any[] = [];

          if (Array.isArray(parsed)) {
            extracted = parsed;
          } else if (parsed && Array.isArray(parsed.prompts)) {
            extracted = parsed.prompts;
          }

          if (extracted.length > 0) {
            newPrompts = extracted
              .filter(p => p && typeof p === 'object' && (p.name || p.content))
              .map((p, idx) => ({
                identifier: p.identifier || `prompt-${idx}-${Date.now()}`,
                name: p.name || `Unnamed Part ${idx + 1}`,
                enabled: p.enabled !== undefined ? p.enabled : true,
                content: p.content || '',
                role: p.role || 'system'
              }));
          }
        } catch {
          // If JSON parsing fails, treat as plain text
          newPrompts = [{
            identifier: `prompt-text-${Date.now()}`,
            name: file.name,
            enabled: true,
            content: rawContent,
            role: 'system'
          }];
        }

        if (newPrompts.length > 0) {
          const newFile: PresetFile = {
            id: `file-${Date.now()}`,
            fileName: file.name,
            enabled: true,
            prompts: newPrompts
          };
          setPresetFiles(prev => [...prev, newFile]);
          setSuccess(`Đã nạp file ${file.name} thành công!`);
        }
      } catch (err: any) {
        setError(`Lỗi khi đọc file: ${err?.message || String(err)}`);
      }
    };

    reader.readAsText(file);
    if (event.target) {
      event.target.value = '';
    }
  };

  const handleDeleteFile = (fileId: string) => {
    setPresetFiles(prev => prev.filter(pf => pf.id !== fileId));
    setShowConfirmDelete(null);
  };

  const getTagDescription = (tag: string) => {
    const lower = tag.toLowerCase();
    if (lower === 'thinking') {
      return 'Suy nghĩ ẩn, phân tích bối cảnh và định hướng xử lý của AI';
    }
    if (lower === 'dialogue') {
      return 'Lời thoại nhân vật, mô tả hành động và diễn biến câu chuyện';
    }
    if (lower === 'update_data') {
      return 'Các tag cập nhật hệ thống như NPC_RENAME, STATS, INVENTORY, v.v.';
    }
    if (lower === 'action_result') {
      return 'Mô tả kết quả thực thi hành động của người chơi';
    }
    if (lower === 'combat_log') {
      return 'Báo cáo chi tiết các đòn đánh, chỉ số sát thương trong giao tranh';
    }
    return 'Cấu trúc thẻ đầu ra do Preset thiết lập';
  };

  const generatePreviewContent = () => {
    const activeFiles = presetFiles.filter(pf => pf.enabled);
    const expectedTags = new Set<string>();

    activeFiles.forEach(pf => {
      if (pf.parsedSections && pf.parsedSections.length > 0) {
        pf.parsedSections
          .filter(s => s.enabled)
          .forEach(s => {
            const matches = s.rawContent.match(/<([a-zA-Z_][a-zA-Z0-9_\-\.]*?)>/g);
            if (matches) {
              matches.forEach(match => {
                const tag = match.replace(/[<>]/g, '').trim();
                const ignoredTags = ['p', 'br', 'div', 'span', 'b', 'i', 'u', 'strong', 'em', 'img', 'pre', 'code', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'ul', 'ol', 'li', 'a', 'iframe', 'button', 'input', 'select', 'textarea'];
                if (tag && !ignoredTags.includes(tag.toLowerCase()) && !tag.startsWith('/') && !tag.includes('_presetNo.')) {
                  expectedTags.add(tag);
                }
              });
            }
          });
      } else {
        pf.prompts
          .filter(p => p.enabled)
          .forEach(p => {
            const matches = p.content.match(/<([a-zA-Z_][a-zA-Z0-9_\-\.]*?)>/g);
            if (matches) {
              matches.forEach(match => {
                const tag = match.replace(/[<>]/g, '').trim();
                const ignoredTags = ['p', 'br', 'div', 'span', 'b', 'i', 'u', 'strong', 'em', 'img', 'pre', 'code', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'ul', 'ol', 'li', 'a', 'iframe', 'button', 'input', 'select', 'textarea'];
                if (tag && !ignoredTags.includes(tag.toLowerCase()) && !tag.startsWith('/') && !tag.includes('_presetNo.')) {
                  expectedTags.add(tag);
                }
              });
            }
          });
      }
    });

    if (expectedTags.size === 0) {
      return ['thinking', 'dialogue', 'update_data'];
    }

    return Array.from(expectedTags);
  };

  return (
    <div className="flex flex-col space-y-4 bg-gray-800/20 p-4 rounded-lg border border-gray-700/50">
      {/* File Loader Header */}
      <div className="flex items-center justify-between pb-3 border-b border-gray-700/40 relative">
        <div className="flex items-center space-x-2">
          <Settings className="w-5 h-5 text-indigo-400" />
          <span className="font-semibold text-gray-200">Preset ngự thiện phòng</span>
          {isGuideOverlayActive && setActiveGuideId && (
            <GuideMarker
              id="api-preset-manager"
              index={6}
              text="Bước 6: Mục 'Preset ngự thiện phòng' là tính năng cực kỳ mạnh mẽ! Cho phép bạn nạp các file phụ tùng (.txt, .json) để thay đổi cách AI tương tác, cách mô tả sự kiện, hoặc tinh chỉnh văn phong kể chuyện của AI. Bạn cũng có thể bật tắt các phân khu nhỏ, và phối trộn nhiều preset với nhau để tạo nên một hệ thống kể chuyện hoàn hảo, đúng ý nhất."
              position="bottom"
              className="ml-1"
              activeId={activeGuideId}
              onToggle={setActiveGuideId}
            />
          )}
        </div>
        <div className="flex items-center space-x-2">
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={() => setIsPreviewModalOpen(true)}
            className="text-xs py-1.5 px-3 flex items-center gap-1.5 bg-indigo-950/40 border border-indigo-800/40 text-indigo-300 hover:bg-indigo-900/40 transition-colors"
          >
            <Eye className="w-3.5 h-3.5" />
            Xem trước cấu trúc
          </Button>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={() => fileInputRef.current?.click()}
            className="text-xs py-1.5 px-3 flex items-center gap-1.5"
          >
            <FolderPlus className="w-3.5 h-3.5" />
            Thêm file Preset
          </Button>
        </div>
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleImportFile}
          accept=".txt,.json"
          className="hidden"
        />
      </div>

      {/* Success/Error Feedback */}
      {success && <div className="text-xs text-green-400 bg-green-950/20 border border-green-900/40 p-2 rounded">{success}</div>}
      {error && <div className="text-xs text-red-400 bg-red-950/20 border border-red-900/40 p-2 rounded">{error}</div>}

      {/* Preset Files List */}
      <div className="space-y-4">
        {presetFiles.map((pf) => (
          <div key={pf.id} className="bg-gray-900/40 border border-gray-700 rounded-md p-3">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center space-x-2">
                <button
                  type="button"
                  onClick={() => handleToggleFile(pf.id)}
                  className={`relative inline-flex h-5 w-10 items-center rounded-full transition-colors focus:outline-none ${
                    pf.enabled ? 'bg-indigo-600' : 'bg-gray-600'
                  }`}
                >
                  <span
                    className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${
                      pf.enabled ? 'translate-x-5' : 'translate-x-1'
                    }`}
                  />
                </button>
                <span className="font-semibold text-sm text-gray-200 truncate max-w-[200px] sm:max-w-[320px] block" title={pf.fileName}>
                  {pf.fileName}
                </span>
              </div>
              <div className="flex items-center space-x-2">
                <Button
                  variant="danger"
                  size="sm"
                  onClick={() => showConfirmDelete === pf.id ? handleDeleteFile(pf.id) : setShowConfirmDelete(pf.id)}
                  className="text-[10px] py-1 px-2"
                >
                  {showConfirmDelete === pf.id ? 'Xác nhận xóa' : <Trash2 className="w-3 h-3" />}
                </Button>
              </div>
            </div>

            {pf.enabled && (
              <div className="flex flex-wrap items-center gap-2 p-1.5 mb-2.5 bg-gray-950/40 rounded-lg border border-gray-800/80">
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() => handleToggleSelectAll(pf.id)}
                  className="text-[11px] py-1 px-2.5 bg-gray-800/60 border border-gray-700/60 text-gray-300 hover:bg-gray-750 hover:text-white transition-colors"
                >
                  {isAllEnabled(pf) ? '❌ Bỏ chọn tất cả' : '✅ Chọn tất cả'}
                </Button>

                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  disabled={translatingFileId !== null || analyzingFileId !== null}
                  onClick={() => handleTranslatePreset(pf.id)}
                  className="text-[11px] py-1 px-2.5 flex items-center gap-1 bg-emerald-950/60 border border-emerald-800/50 text-emerald-300 hover:bg-emerald-900/60 disabled:opacity-50 transition-colors"
                  title="Dịch toàn bộ tiêu đề và giải thích hiển thị của Preset này sang tiếng Việt"
                >
                  {translatingFileId === pf.id ? (
                    <>
                      <Loader2 className="w-3 h-3 animate-spin text-emerald-400" />
                      <span>Đang dịch...</span>
                    </>
                  ) : (
                    <>
                      <span>🌐 Dịch TV</span>
                    </>
                  )}
                </Button>

                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  disabled={analyzingFileId !== null || translatingFileId !== null}
                  onClick={() => handleAnalyzePreset(pf.id)}
                  className="text-[11px] py-1 px-2.5 flex items-center gap-1 bg-indigo-950/60 border border-indigo-800/50 text-indigo-300 hover:bg-indigo-900/60 disabled:opacity-50 transition-colors"
                >
                  {analyzingFileId === pf.id ? (
                    <>
                      <Loader2 className="w-3 h-3 animate-spin text-indigo-400" />
                      <span>Đang phân tích...</span>
                    </>
                  ) : (
                    <>
                      <span>✨ Phân tích AI</span>
                    </>
                  )}
                </Button>
              </div>
            )}

            {pf.enabled && (
              <div className="space-y-1.5 mt-2 ml-2 pl-2 border-l border-gray-700">
                {pf.parsedSections && pf.parsedSections.length > 0 ? (
                  pf.parsedSections.map((section, idx) => {
                    const displayNum = String(idx + 1).padStart(2, '0');
                    return (
                      <div key={section.id} className="flex items-start justify-between p-2 rounded hover:bg-gray-800/30 transition-colors text-xs border border-gray-800/40 bg-gray-900/20 gap-2">
                        <span className={`flex-1 min-w-0 break-words whitespace-normal leading-relaxed font-mono ${section.enabled ? 'text-gray-200' : 'text-gray-500 line-through'}`}>
                          <span className="text-indigo-400 mr-1.5 font-semibold font-sans inline-block">[{displayNum}]</span>
                          {section.title}
                        </span>
                        <div className="flex items-center space-x-2 flex-shrink-0">
                          <button
                            type="button"
                            onClick={() => setViewingRawContent({ title: section.title, content: section.rawContent })}
                            title="Xem nội dung thô"
                            className="text-gray-400 hover:text-indigo-400 p-1 rounded hover:bg-gray-700/50 transition-colors"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setViewingExplanation({ title: section.title, explanation: section.description })}
                            title="Giải thích từ AI"
                            className="text-gray-400 hover:text-indigo-400 p-1 rounded hover:bg-gray-700/50 transition-colors"
                          >
                            <HelpCircle className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleToggleSection(pf.id, section.id)}
                            title={section.enabled ? "Vô hiệu hóa mục này" : "Kích hoạt mục này"}
                            className={`p-1 rounded hover:bg-gray-700/50 transition-colors ${
                              section.enabled ? 'text-emerald-400' : 'text-gray-500'
                            }`}
                          >
                            <Check className={`w-4 h-4 ${section.enabled ? 'opacity-100' : 'opacity-40'}`} />
                          </button>
                        </div>
                      </div>
                    );
                  })
                ) : (
                  pf.prompts.map((p, idx) => {
                    const displayNum = String(idx + 1).padStart(2, '0');
                    return (
                      <div key={p.identifier || idx} className="rounded hover:bg-gray-800/30 transition-colors">
                        <div className="flex items-start justify-between p-1.5 text-xs gap-2">
                          <span className={`flex-1 min-w-0 break-words whitespace-normal leading-relaxed ${p.enabled ? 'text-gray-200' : 'text-gray-500 line-through'}`}>
                            <span className="text-indigo-400 mr-1.5 font-semibold font-sans inline-block">[{displayNum}]</span>
                            {p.name}
                          </span>
                          <div className="flex items-center space-x-2">
                            <button
                              type="button"
                              onClick={() => setExpandedIndices(prev => ({ ...prev, [pf.id]: prev[pf.id] === idx ? null : idx }))}
                              className="text-gray-500 hover:text-gray-200 p-1 rounded hover:bg-gray-700/35"
                            >
                              {expandedIndices[pf.id] === idx ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                            </button>
                            <input
                              type="checkbox"
                              checked={p.enabled}
                              onChange={() => handleTogglePrompt(pf.id, idx)}
                              className="accent-indigo-500 cursor-pointer h-3.5 w-3.5"
                            />
                          </div>
                        </div>
                        {expandedIndices[pf.id] === idx && (
                          <div className="px-2 pb-2 text-[11px] text-gray-300">
                            <pre className="bg-gray-950/60 p-2 rounded border border-gray-800/80 whitespace-pre-wrap max-h-40 overflow-y-auto font-mono text-[11px] select-all">
                              {p.content}
                            </pre>
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            )}
          </div>
        ))}
        {presetFiles.length === 0 && (
          <p className="text-xs text-gray-500 italic text-center py-4">Chưa có file Preset nào được tải lên.</p>
        )}
      </div>

      {/* Modal hiển thị nội dung thô */}
      <Modal
        isOpen={viewingRawContent !== null}
        onClose={() => setViewingRawContent(null)}
        title={viewingRawContent ? `Nội dung thô: ${viewingRawContent.title}` : ""}
        maxWidth="max-w-2xl"
      >
        <div className="space-y-4">
          <pre className="bg-gray-950 p-4 rounded border border-gray-750 text-[11px] font-mono text-gray-300 whitespace-pre-wrap max-h-96 overflow-y-auto select-all leading-relaxed">
            {viewingRawContent?.content ? viewingRawContent.content.replace(/\\n/g, '\n').replace(/\\r/g, '') : ''}
          </pre>
        </div>
      </Modal>

      {/* Modal hiển thị lời giải thích từ AI */}
      <Modal
        isOpen={viewingExplanation !== null}
        onClose={() => setViewingExplanation(null)}
        title={viewingExplanation ? `Giải thích AI: ${viewingExplanation.title}` : ""}
        maxWidth="max-w-lg"
      >
        <div className="space-y-3 text-sm text-gray-200 leading-relaxed">
          <p className="font-medium text-amber-400">Tác dụng của đầu mục này:</p>
          <div className="bg-gray-900/60 p-4 rounded border border-gray-750/50 italic text-gray-300">
            {viewingExplanation?.explanation}
          </div>
        </div>
      </Modal>

      {/* Modal hiển thị cấu trúc xem trước phản hồi AI */}
      <Modal
        isOpen={isPreviewModalOpen}
        onClose={() => setIsPreviewModalOpen(false)}
        title="Xem trước cấu trúc AI phản hồi"
        maxWidth="max-w-xl"
      >
        <div className="space-y-4">
          <p className="text-xs text-gray-300 leading-relaxed">
            Dựa trên toàn bộ các Preset và cấu hình đang được bật, dưới đây là mô phỏng cấu trúc các thẻ XML dự kiến sẽ xuất hiện trong nội dung phản hồi của AI chính:
          </p>
          
          <div className="bg-gray-950 p-4 rounded-lg border border-gray-800 font-mono text-xs leading-relaxed max-h-96 overflow-y-auto select-all shadow-inner">
            {generatePreviewContent().map(tag => (
              <div key={tag} className="mb-4 last:mb-0 border-l-2 border-indigo-500/40 pl-3">
                <span className="text-emerald-400 font-bold">{`<${tag}>`}</span>
                <div className="pl-4 text-gray-500 my-1 italic">
                  {"// " + getTagDescription(tag)}
                </div>
                <div className="pl-4 text-gray-300 font-sans my-1">
                  ... (Nội dung diễn giải chi tiết hoặc cập nhật từ AI) ...
                </div>
                <span className="text-emerald-400 font-bold">{`</${tag}>`}</span>
              </div>
            ))}
          </div>

          <div className="text-[11px] text-amber-500/80 bg-amber-950/10 border border-amber-900/30 p-2.5 rounded-md leading-relaxed">
            <strong className="text-amber-400">Lưu ý an toàn:</strong> Các thẻ XML cập nhật hệ thống như <code className="text-amber-300 font-mono font-bold">&lt;update_data&gt;</code> chỉ được xuất hiện một lần duy nhất tại kết quả cuối cùng. Tránh viết trùng lặp hoặc lồng ghép sai quy chuẩn trong suy nghĩ của AI để đảm bảo tính đồng bộ hoàn hảo.
          </div>
          
          <div className="flex justify-end pt-2 border-t border-gray-800">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => setIsPreviewModalOpen(false)}
              className="text-xs py-1.5 px-4"
            >
              Đóng
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
