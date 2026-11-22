import React, { useState, useEffect, useRef } from 'react';
import { useGame } from '../hooks/useGame';
import { GameScreen } from '../types';
import Button from './ui/Button';
import Spinner from './ui/Spinner';
import { getTaskModel } from '../services/apiService';
import { processFile, ProcessedFile } from '../services/fileProcessorService';
import { streamChatbotResponse } from '../services/chatbotStreamService';
import { verifyChatbotResponse, VerificationResult } from '../services/chatbotVerifierService';
import { 
  Send, 
  ArrowLeft, 
  Trash2, 
  RefreshCw, 
  Bot, 
  User, 
  Sparkles, 
  Sliders, 
  Paperclip, 
  X, 
  FileText, 
  Image as ImageIcon, 
  Zap,
  MessageSquarePlus,
  History,
  MessageSquare,
  Clock,
  ShieldCheck,
  ShieldAlert,
  ChevronDown,
  ChevronUp
} from 'lucide-react';

import { ChatbotReferenceSources } from './chatbot/ChatbotReferenceSources';
import { ChatMessage, ChatSession, GroundingData } from '../types/chatbot';

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
  let withoutTones = removeVietnameseTones(name);
  let tag = withoutTones
    .replace(/[^a-zA-Z0-9\s_-]/g, '')
    .trim()
    .replace(/[\s_-]+/g, '_');
  if (!tag) return 'PresetSection';
  if (/^[0-9_]/.test(tag)) {
    tag = 'Preset_' + tag;
  }
  return tag;
}

function getCompiledActivePresets(): { compiled: string; fileCount: number; sectionCount: number } {
  try {
    const saved = localStorage.getItem('accessory_preset_files');
    if (!saved) return { compiled: '', fileCount: 0, sectionCount: 0 };
    
    const files: any[] = JSON.parse(saved);
    if (!Array.isArray(files)) return { compiled: '', fileCount: 0, sectionCount: 0 };
    
    const activeFiles = files.filter(f => f.enabled);
    let presetCounter = 1;
    let fileCounter = 1;
    let sectionCount = 0;
    
    const compiled = activeFiles
      .map(pf => {
        let sectionsText = "";
        if (pf.parsedSections && pf.parsedSections.length > 0) {
          const activeSections = pf.parsedSections.filter((s: any) => s.enabled);
          sectionCount += activeSections.length;
          sectionsText = activeSections
            .map((s: any) => {
              const currentNum = String(presetCounter++).padStart(2, '0');
              const safeTag = `${toSafeXmlTagName(s.title)}_presetNo.${currentNum}`;
              return `<${safeTag}>\n${(s.rawContent || '').trim()}\n</${safeTag}>`;
            })
            .join('\n\n');
        } else if (pf.prompts && pf.prompts.length > 0) {
          const activePrompts = pf.prompts.filter((p: any) => p.enabled);
          sectionCount += activePrompts.length;
          sectionsText = activePrompts
            .map((p: any) => {
              const currentNum = String(presetCounter++).padStart(2, '0');
              const safeTag = `${toSafeXmlTagName(p.name)}_presetNo.${currentNum}`;
              return `<${safeTag}>\n${(p.content || '').trim()}\n</${safeTag}>`;
            })
            .join('\n\n');
        }
        
        if (!sectionsText.trim()) return "";
        
        const currentFileNum = fileCounter++;
        const safeFileName = toSafeXmlTagName(pf.fileName || 'PresetFile');
        const parentTagOpen = `Tong_muc_preset_thu_${currentFileNum}_${safeFileName}`;
        return `<${parentTagOpen}>\n${sectionsText.trim()}\n</${parentTagOpen}>`;
      })
      .filter(text => text !== "")
      .join('\n\n');

    return { compiled, fileCount: activeFiles.length, sectionCount };
  } catch (e) {
    console.error('Lỗi nạp Preset trong Chatbot Sandbox:', e);
    return { compiled: '', fileCount: 0, sectionCount: 0 };
  }
}

const createWelcomeMessage = (): ChatMessage => ({
  id: 'welcome-' + Date.now(),
  sender: 'model',
  text: 'Xin chào! Đây là Chatbot Sandbox độc lập. Tôi sẽ trò chuyện dựa trên các Preset ngự thiện phòng mà bạn đã bật. Không có quy tắc game hay bối cảnh lịch sử game nào được nạp vào đây. Bạn muốn trao đổi điều gì?',
  timestamp: new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })
});

const ChatbotScreen: React.FC = () => {
  const { setCurrentScreen, showNotification } = useGame();
  
  const [sessions, setSessions] = useState<ChatSession[]>(() => {
    try {
      const savedSessions = localStorage.getItem('chatbot_sandbox_sessions');
      if (savedSessions) {
        const parsed = JSON.parse(savedSessions);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
      
      const oldHistory = localStorage.getItem('chatbot_sandbox_history');
      if (oldHistory) {
        const parsedOld = JSON.parse(oldHistory);
        if (Array.isArray(parsedOld) && parsedOld.length > 0) {
          return [
            {
              id: 'session-' + Date.now(),
              title: 'Đoạn chat trước đây',
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
              messages: parsedOld
            }
          ];
        }
      }
    } catch (e) {
      console.error('Lỗi khởi tạo session chatbot sandbox:', e);
    }
    
    const initialSession: ChatSession = {
      id: 'session-' + Date.now(),
      title: 'Đoạn chat 1',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      messages: [createWelcomeMessage()]
    };
    return [initialSession];
  });

  const [currentSessionId, setCurrentSessionId] = useState<string>(() => {
    try {
      const savedId = localStorage.getItem('chatbot_sandbox_current_session_id');
      if (savedId) return savedId;
    } catch (e) {}
    return sessions[0]?.id || 'session-' + Date.now();
  });

  const [showHistoryModal, setShowHistoryModal] = useState<boolean>(false);
  const [expandedVerifications, setExpandedVerifications] = useState<Record<string, boolean>>({});
  const [input, setInput] = useState('');
  const [attachments, setAttachments] = useState<ProcessedFile[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const [activePresetInfo, setActivePresetInfo] = useState<{ compiled: string; fileCount: number; sectionCount: number }>({ compiled: '', fileCount: 0, sectionCount: 0 });
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const mainModelName = getTaskModel('main');
  const combatModelName = getTaskModel('combat');

  const currentSession = sessions.find(s => s.id === currentSessionId) || sessions[0] || {
    id: currentSessionId,
    title: 'Đoạn chat',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    messages: [createWelcomeMessage()]
  };

  const messages = currentSession.messages || [];

  const updateCurrentSessionMessages = (updater: (prevMsgs: ChatMessage[]) => ChatMessage[]) => {
    setSessions(prevSessions => {
      return prevSessions.map(s => {
        if (s.id === currentSession.id) {
          const newMessages = updater(s.messages || []);
          let newTitle = s.title;
          
          if ((!s.title || s.title.startsWith('Đoạn chat') || s.title.startsWith('Cuộc trò chuyện')) && newMessages.length > 1) {
            const firstUserMsg = newMessages.find(m => m.sender === 'user');
            if (firstUserMsg && firstUserMsg.text.trim()) {
              newTitle = firstUserMsg.text.trim().slice(0, 30) + (firstUserMsg.text.trim().length > 30 ? '...' : '');
            }
          }

          return {
            ...s,
            title: newTitle,
            updatedAt: new Date().toISOString(),
            messages: newMessages
          };
        }
        return s;
      });
    });
  };

  const loadPresetInfo = () => {
    const info = getCompiledActivePresets();
    setActivePresetInfo(info);
  };

  useEffect(() => {
    loadPresetInfo();
  }, []);

  useEffect(() => {
    try {
      const cleanSessions = sessions.map(s => ({
        ...s,
        messages: (s.messages || []).map(msg => ({
          ...msg,
          attachments: msg.attachments?.map(a => ({
            name: a.name,
            mimeType: a.mimeType,
            previewUrl: a.previewUrl && a.previewUrl.length < 2000 ? a.previewUrl : undefined
          }))
        }))
      }));
      localStorage.setItem('chatbot_sandbox_sessions', JSON.stringify(cleanSessions));
      localStorage.setItem('chatbot_sandbox_current_session_id', currentSession.id);
    } catch (e) {
      console.error('Lỗi lưu lịch sử chat sandbox:', e);
    }
    
    if (!isStreaming) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [sessions, currentSession.id, isStreaming]);

  const handleCreateNewChat = () => {
    const newSessionId = 'session-' + Date.now();
    const newSession: ChatSession = {
      id: newSessionId,
      title: `Đoạn chat ${sessions.length + 1}`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      messages: [createWelcomeMessage()]
    };

    setSessions(prev => [newSession, ...prev]);
    setCurrentSessionId(newSessionId);
    setInput('');
    setAttachments([]);
    showNotification('Đã ghi lại đoạn chat cũ vào lịch sử và mở ra đoạn chat mới!', 'success');
  };

  const handleSwitchSession = (sessionId: string) => {
    setCurrentSessionId(sessionId);
    setInput('');
    setAttachments([]);
    setShowHistoryModal(false);
    showNotification('Đã chuyển sang đoạn hội thoại đã chọn.', 'info');
  };

  const handleDeleteSession = (sessionId: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    
    const remaining = sessions.filter(s => s.id !== sessionId);
    if (remaining.length === 0) {
      const freshSession: ChatSession = {
        id: 'session-' + Date.now(),
        title: 'Đoạn chat 1',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        messages: [createWelcomeMessage()]
      };
      setSessions([freshSession]);
      setCurrentSessionId(freshSession.id);
    } else {
      setSessions(remaining);
      if (currentSession.id === sessionId) {
        setCurrentSessionId(remaining[0].id);
      }
    }
    showNotification('Đã xóa đoạn chat khỏi lịch sử.', 'success');
  };

  const handleClearCurrentMessages = () => {
    updateCurrentSessionMessages(() => [
      {
        id: Date.now().toString(),
        sender: 'model',
        text: 'Đã xóa nội dung đoạn chat hiện tại. Bạn có thể bắt đầu trao đổi mới!',
        timestamp: new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })
      }
    ]);
    showNotification('Đã làm sạch tin nhắn của đoạn chat hiện tại.', 'success');
  };

  const handleVerifyMessage = async (msgId: string, textToVerify: string) => {
    if (!textToVerify.trim()) return;

    updateCurrentSessionMessages(prev => prev.map(m => {
      if (m.id === msgId) {
        return {
          ...m,
          verification: {
            status: 'verifying',
            isFabricated: false,
            verdict: 'Đang kiểm chứng...',
            details: '',
            verifiedAt: new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })
          }
        };
      }
      return m;
    }));

    const result = await verifyChatbotResponse(textToVerify);

    updateCurrentSessionMessages(prev => prev.map(m => {
      if (m.id === msgId) {
        return {
          ...m,
          verification: result
        };
      }
      return m;
    }));

    if (result.status === 'verified') {
      if (result.isFabricated) {
        showNotification('Cảnh báo: Phát hiện chi tiết bịa đặt/sai lệch trong phản hồi!', 'error');
      } else {
        showNotification('Thẩm định hoàn tất: Nội dung chính xác và đáng tin cậy.', 'success');
      }
    } else {
      showNotification('Lỗi khi gọi API kiểm chứng.', 'error');
    }
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    const filesArray = Array.from(e.target.files) as File[];
    try {
      const processed = await Promise.all(filesArray.map(file => processFile(file)));
      setAttachments(prev => [...prev, ...processed]);
    } catch (err) {
      console.error('Lỗi xử lý tệp đính kèm:', err);
      showNotification('Không thể đọc tệp tin đã chọn.', 'error');
    } finally {
      if (e.target) e.target.value = '';
    }
  };

  const removeAttachment = (index: number) => {
    setAttachments(prev => prev.filter((_, i) => i !== index));
  };

  const handleDrop = async (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const filesArray = Array.from(e.dataTransfer.files) as File[];
      try {
        const processed = await Promise.all(filesArray.map(file => processFile(file)));
        setAttachments(prev => [...prev, ...processed]);
      } catch (err) {
        console.error('Lỗi xử lý tệp kéo thả:', err);
        showNotification('Không thể xử lý tệp kéo thả.', 'error');
      }
    }
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
  };

  const handleSendMessage = async () => {
    if ((!input.trim() && attachments.length === 0) || isLoading) return;

    const userText = input.trim() || (attachments.length > 0 ? `[Gửi kèm ${attachments.length} tệp đính kèm]` : '');
    const currentAttachments = [...attachments];

    const userMsg: ChatMessage = {
      id: Date.now().toString(),
      sender: 'user',
      text: userText,
      timestamp: new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }),
      attachments: currentAttachments.map(a => ({
        name: a.name,
        mimeType: a.mimeType,
        previewUrl: a.previewUrl
      }))
    };

    updateCurrentSessionMessages(prev => [...prev, userMsg]);
    setInput('');
    setAttachments([]);
    setIsLoading(true);
    
    setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, 100);

    try {
      const { compiled } = getCompiledActivePresets();

      const systemInstruction = `
<quy_tac_chatbot_sandbox>
================
1. BẮT BUỘC tập trung trả lời TRỰC TIẾP, CHÍNH XÁC và RÕ RÀNG vào yêu cầu của người dùng trong thẻ <user_input>.
2. Nếu người dùng cung cấp hình ảnh hoặc tài liệu đính kèm, hãy phân tích chi tiết nội dung trong hình ảnh/tài liệu đó.
3. KHÔNG tự ý sinh ra các kịch bản phụ, hội thoại kịch tính hậu trường (Tawa, AvarsiSkull,...), thẻ HTML không cần thiết (<details>, <summary>), hoặc các nội dung lặp lại lộn xộn.
4. Sử dụng các thông tin trong <prompt_phu_tung> bên dưới làm phong cách/tri thức tham chiếu, nhưng ưu tiên HÀNG ĐẦU là giải quyết đúng trọng tâm thắc mắc của người dùng.
5. QUY TẮC CHỐNG BỊA ĐẶT VÀ HOANG TƯỞNG (ANTI-HALLUCINATION):
   - BẮT BUỘC cung cấp thông tin trung thực, chính xác và có căn cứ thực tế. Tuyệt đối KHÔNG ngụy tạo, bịa đặt hay tự suy đoán thông tin hoang tưởng.
   - Nếu không có dữ liệu chính xác và liên quan, AI ĐƯỢC PHÉP trả lời thẳng thắn: "vì thiếu dữ kiện chính xác và liên quan, tôi không thể đưa ra nội dung chính xác".
6. QUY TẮC TRA CỨU WEB & ĐỐI CHIẾU THỰC TẾ (GOOGLE SEARCH GROUNDING):
   - Luôn chủ động kích hoạt và sử dụng công cụ Google Search để tra cứu, thu thập và đối chiếu các thông tin, tài liệu thực tế nhằm mang lại nguồn tham khảo chuẩn xác và minh bạch cho người dùng.
================
</quy_tac_chatbot_sandbox>

<prompt_phu_tung_+chatbot_system>
================
${compiled || '(Không có Preset nào đang bật)'}
================
</prompt_phu_tung_+chatbot_system>
`.trim();

      const historyContext = [...messages, userMsg]
        .slice(-8)
        .map(m => `${m.sender === 'user' ? 'Người dùng' : 'AI'}: ${m.text}`)
        .join('\n\n');

      const imageParts = currentAttachments
        .filter(a => a.mimeType.startsWith('image/'))
        .map(a => ({
          mimeType: a.mimeType,
          data: a.base64Data
        }));

      const textFilesContext = currentAttachments
        .filter(a => a.textContent)
        .map(a => `
<tep_tin name="${a.name}" type="${a.mimeType}">
${a.textContent}
</tep_tin>`.trim())
        .join('\n\n');

      let fileInjection = '';
      if (textFilesContext) {
        fileInjection = `
<du_lieu_tep_dinh_kem_+user_input>
================
${textFilesContext}
================
</du_lieu_tep_dinh_kem_+user_input>
`.trim();
      }

      const fullPrompt = `
${fileInjection}

<user_input>
User Input Mới Nhất: "${userText}"
</user_input>

Lịch sử trò chuyện gần nhất của đoạn chat này:
${historyContext}

Hãy tập trung trả lời trực tiếp câu hỏi/yêu cầu mới nhất của Người dùng ở trên:
`.trim();

      const aiMsgId = (Date.now() + 1).toString();
      const aiMsg: ChatMessage = {
        id: aiMsgId,
        sender: 'model',
        text: '',
        timestamp: new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })
      };
      
      updateCurrentSessionMessages(prev => [...prev, aiMsg]);
      setIsStreaming(true);
      setIsLoading(false);

      await streamChatbotResponse(
        fullPrompt,
        systemInstruction,
        {
          onReset: () => {
            updateCurrentSessionMessages(prev => prev.map(m => 
              m.id === aiMsgId ? { ...m, text: '' } : m
            ));
          },
          onChunk: (chunk) => {
            updateCurrentSessionMessages(prev => prev.map(m => 
              m.id === aiMsgId ? { ...m, text: m.text + chunk } : m
            ));
          },
          onGrounding: (groundingData) => {
            updateCurrentSessionMessages(prev => prev.map(m => 
              m.id === aiMsgId ? { ...m, grounding: groundingData } : m
            ));
          },
          onFullText: (_fullText, groundingData) => {
            if (groundingData) {
              updateCurrentSessionMessages(prev => prev.map(m => 
                m.id === aiMsgId ? { ...m, grounding: groundingData } : m
              ));
            }
          },
          onMetadata: (meta) => {
            console.log(`[API Update] key#${meta.apiKeyIndex} : ${meta.model} : ${meta.duration} : ${meta.purpose}`);
          },
          onError: (err) => {
            updateCurrentSessionMessages(prev => prev.map(m => 
              m.id === aiMsgId ? { ...m, text: m.text + `\n\n⚠️ Lỗi streaming: ${err.message || String(err)}` } : m
            ));
            showNotification('Lỗi khi streaming phản hồi AI.', 'error');
          }
        },
        imageParts
      );

    } catch (err: any) {
      console.error('Lỗi Chatbot Sandbox API:', err);
      const errorMsg: ChatMessage = {
        id: (Date.now() + 2).toString(),
        sender: 'model',
        text: `⚠️ Rất tiếc, đã xảy ra lỗi: ${err?.message || String(err)}`,
        timestamp: new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })
      };
      updateCurrentSessionMessages(prev => [...prev, errorMsg]);
      showNotification('Lỗi khi gọi API Chatbot.', 'error');
    } finally {
      setIsLoading(false);
      setIsStreaming(false);
    }
  };

  return (
    <div 
      className="min-h-screen flex flex-col bg-gray-950 text-gray-100 font-sans"
      onDrop={handleDrop}
      onDragOver={handleDragOver}
    >
      {/* Hidden File Input */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileSelect}
        multiple
        className="hidden"
      />

      {/* Header */}
      <header className="bg-gray-900/90 border-b border-gray-800 p-3 sm:p-4 sticky top-0 z-10 backdrop-blur-md flex items-center justify-between shadow-lg gap-2">
        <div className="flex items-center space-x-2 sm:space-x-3 min-w-0">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setCurrentScreen(GameScreen.Initial)}
            className="text-gray-300 hover:text-white hover:bg-gray-800 p-2 rounded-lg flex items-center gap-1.5 flex-shrink-0"
          >
            <ArrowLeft size={18} />
            <span className="hidden sm:inline text-sm font-medium">Trở về</span>
          </Button>

          <div className="flex items-center space-x-2 min-w-0">
            <div className="p-2 bg-indigo-950/80 border border-indigo-700/50 rounded-lg text-indigo-400 flex-shrink-0">
              <Bot size={20} />
            </div>
            <div className="min-w-0">
              <h1 className="text-sm sm:text-lg font-bold text-gray-100 flex items-center gap-1.5 truncate">
                <span className="truncate">{currentSession.title || 'Chatbot Sandbox'}</span>
                <span className="hidden sm:inline-block text-xs font-mono font-normal bg-indigo-950 text-indigo-300 border border-indigo-800/60 px-2 py-0.5 rounded-full flex-shrink-0">
                  Model: {mainModelName}
                </span>
              </h1>
              <p className="text-[11px] sm:text-xs text-gray-400 flex items-center gap-1 truncate">
                <Sparkles size={12} className="text-amber-400 flex-shrink-0" />
                <span className="truncate">Thử nghiệm Preset độc lập • Không mang bối cảnh game</span>
              </p>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center space-x-1.5 sm:space-x-2 flex-shrink-0">
          <Button
            variant="primary"
            size="sm"
            onClick={handleCreateNewChat}
            className="text-xs py-1.5 px-2.5 sm:px-3 flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-500 text-white font-medium shadow-sm border border-indigo-400/30"
            title="Lưu đoạn chat hiện tại vào lịch sử và bắt đầu đoạn chat mới độc lập"
          >
            <MessageSquarePlus size={15} />
            <span className="hidden md:inline">Đoạn Chat Mới</span>
          </Button>

          <Button
            variant="secondary"
            size="sm"
            onClick={() => setShowHistoryModal(true)}
            className="text-xs py-1.5 px-2.5 sm:px-3 flex items-center gap-1.5 bg-gray-800/80 border border-gray-700 text-gray-300 hover:bg-gray-700 hover:text-white"
            title="Xem danh sách các đoạn chat trong lịch sử"
          >
            <History size={14} />
            <span className="hidden lg:inline">Lịch Sử</span>
            <span className="bg-gray-700 text-gray-300 text-[10px] px-1.5 py-0.2 rounded-full font-mono">
              {sessions.length}
            </span>
          </Button>

          <Button
            variant="secondary"
            size="sm"
            onClick={loadPresetInfo}
            className="text-xs py-1.5 px-2 sm:px-2.5 flex items-center gap-1 bg-gray-800/80 border border-gray-700 text-gray-300 hover:bg-gray-700"
            title="Tải lại các Preset đang bật"
          >
            <RefreshCw size={14} />
            <span className="hidden xl:inline">Cập nhật Preset</span>
          </Button>

          <Button
            variant="danger"
            size="sm"
            onClick={handleClearCurrentMessages}
            className="text-xs py-1.5 px-2 sm:px-2.5 flex items-center gap-1"
            title="Xóa nội dung của đoạn chat hiện tại"
          >
            <Trash2 size={14} />
            <span className="hidden xl:inline">Xóa Lời Thoại</span>
          </Button>
        </div>
      </header>

      {/* Active Preset Status Bar */}
      <div className="bg-gray-900/50 border-b border-gray-800/60 px-4 py-2 text-xs text-gray-400 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center space-x-2">
          <Sliders size={14} className="text-indigo-400" />
          <span>
            Preset hiện tại:{' '}
            <strong className="text-emerald-400 font-medium">
              {activePresetInfo.fileCount > 0
                ? `${activePresetInfo.fileCount} file (${activePresetInfo.sectionCount} đầu mục)`
                : 'Chưa bật Preset nào'}
            </strong>
          </span>
        </div>
        <span className="text-gray-500 italic">
          (Mọi phản hồi sẽ sử dụng các nhãn trong &lt;prompt_phu_tung&gt;)
        </span>
      </div>

      {/* Messages List */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4 max-w-4xl w-full mx-auto custom-scrollbar">
        {messages.map((msg) => {
          const isAi = msg.sender === 'model';
          const isVerified = msg.verification?.status === 'verified';
          const isFabricated = isVerified && msg.verification?.isFabricated;
          const isAccurate = isVerified && !msg.verification?.isFabricated;

          return (
            <div
              key={msg.id}
              className={`flex items-start gap-3 ${
                msg.sender === 'user' ? 'flex-row-reverse' : 'flex-row'
              }`}
            >
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 text-xs font-bold ${
                  msg.sender === 'user'
                    ? 'bg-indigo-600 text-white shadow-md'
                    : isFabricated
                    ? 'bg-red-800 text-red-100 border border-red-500 shadow-md ring-2 ring-red-500/50'
                    : isAccurate
                    ? 'bg-emerald-700 text-emerald-100 border border-emerald-400 shadow-md ring-2 ring-emerald-500/50'
                    : 'bg-emerald-800 text-emerald-100 border border-emerald-600/50 shadow-md'
                }`}
              >
                {msg.sender === 'user' ? <User size={16} /> : <Bot size={16} />}
              </div>

              <div
                className={`max-w-[85%] sm:max-w-[75%] rounded-2xl p-4 text-sm leading-relaxed shadow-lg transition-all ${
                  msg.sender === 'user'
                    ? 'bg-indigo-600/90 text-white rounded-tr-none border border-indigo-500/40'
                    : isFabricated
                    ? 'bg-gray-900 text-gray-200 rounded-tl-none border-2 border-red-600 shadow-red-950/50 whitespace-pre-wrap ring-1 ring-red-500/30'
                    : isAccurate
                    ? 'bg-gray-900 text-gray-200 rounded-tl-none border-2 border-emerald-500 shadow-emerald-950/50 whitespace-pre-wrap ring-1 ring-emerald-500/30'
                    : 'bg-gray-900 text-gray-200 rounded-tl-none border border-gray-800 whitespace-pre-wrap'
                }`}
              >
                <div className="flex items-center justify-between mb-1 text-[10px] opacity-70 border-b border-white/10 pb-1">
                  <span className="font-semibold flex items-center gap-1.5">
                    {msg.sender === 'user' ? 'Bạn' : `AI (${mainModelName})`}
                    {isFabricated && (
                      <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-red-950 text-red-400 border border-red-700">
                        Cảnh báo: Bịa đặt
                      </span>
                    )}
                    {isAccurate && (
                      <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-emerald-950 text-emerald-400 border border-emerald-700">
                        Đã kiểm chứng: Chính xác
                      </span>
                    )}
                  </span>
                  <span>{msg.timestamp}</span>
                </div>

                {/* Render Attachments if present */}
                {msg.attachments && msg.attachments.length > 0 && (
                  <div className="mb-2 flex flex-wrap gap-2">
                    {msg.attachments.map((att, idx) => (
                      <div key={idx} className="bg-black/30 border border-white/20 rounded-lg p-2 max-w-xs flex items-center gap-2">
                        {att.mimeType.startsWith('image/') && att.previewUrl ? (
                          <img src={att.previewUrl} alt={att.name} className="w-16 h-16 object-cover rounded" />
                        ) : att.mimeType.startsWith('image/') ? (
                          <ImageIcon size={20} className="text-indigo-300" />
                        ) : (
                          <FileText size={20} className="text-indigo-300" />
                        )}
                        <div className="text-xs truncate max-w-[120px]">
                          <p className="font-medium truncate">{att.name}</p>
                          <p className="text-[10px] opacity-70">{att.mimeType}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                <div className="mt-1">{msg.text}</div>

                {/* Nguồn tham khảo / Liên kết tài liệu đã tra cứu từ Google Search Grounding */}
                {isAi && msg.text.trim().length > 0 && msg.id !== 'welcome' && (
                  <ChatbotReferenceSources grounding={msg.grounding} />
                )}

                {/* Nút & Khung Kiểm Chứng Tính Chân Thực */}
                {isAi && msg.text.trim().length > 0 && msg.id !== 'welcome' && (
                  <div className="mt-3 pt-2 border-t border-gray-800/80">
                    {!msg.verification && (
                      <div className="flex items-center justify-between">
                        <button
                          onClick={() => handleVerifyMessage(msg.id, msg.text)}
                          disabled={isLoading || isStreaming}
                          className="text-xs px-2.5 py-1 rounded-lg bg-indigo-950/70 hover:bg-indigo-900/90 text-indigo-300 hover:text-indigo-100 border border-indigo-800/60 flex items-center gap-1.5 transition-all shadow-sm group disabled:opacity-50"
                          title="Kiểm chứng tính chân thực của phản hồi bằng model combat"
                        >
                          <ShieldCheck size={14} className="text-indigo-400 group-hover:scale-110 transition-transform" />
                          <span className="font-medium">Kiểm chứng</span>
                        </button>
                        <span className="text-[10px] text-gray-500 italic">Thẩm định tính chân thực bằng model combat</span>
                      </div>
                    )}

                    {/* Trạng thái đang kiểm chứng */}
                    {msg.verification?.status === 'verifying' && (
                      <div className="p-2.5 rounded-xl bg-indigo-950/40 border border-indigo-700/60 flex items-center gap-2 text-xs text-indigo-300 animate-pulse">
                        <Spinner text="" className="!my-0 !w-4 !h-4" />
                        <span>Đang thẩm định & kiểm chứng tính chân thực (Model: {combatModelName})...</span>
                      </div>
                    )}

                    {/* Kết quả: PHÁT HIỆN BỊA ĐẶT / SAI LỆCH (TÔ ĐỎ) -> DROPDOWN */}
                    {msg.verification?.status === 'verified' && msg.verification.isFabricated && (
                      <div className="rounded-xl overflow-hidden bg-red-950/80 border-2 border-red-600 text-red-100 text-xs shadow-lg transition-all animate-fade-in">
                        <button
                          type="button"
                          onClick={() => setExpandedVerifications(prev => ({ ...prev, [msg.id]: !prev[msg.id] }))}
                          className="w-full p-2.5 flex items-center justify-between font-bold text-red-300 hover:bg-red-900/50 transition-colors text-left gap-2 cursor-pointer"
                          title="Bấm để mở/thu gọn toàn bộ nội dung kiểm chứng"
                        >
                          <div className="flex items-center gap-1.5 text-xs sm:text-sm text-red-400 min-w-0 truncate">
                            <ShieldAlert size={16} className="text-red-400 flex-shrink-0" />
                            <span className="truncate">⚠️ PHÁT HIỆN CHI TIẾT BỊA ĐẶT / SAI LỆCH</span>
                          </div>
                          <div className="flex items-center gap-2 flex-shrink-0">
                            <span className="text-[10px] font-mono opacity-80 hidden sm:inline">
                              Verifier: {msg.verification.modelUsed}
                            </span>
                            {expandedVerifications[msg.id] ? (
                              <ChevronUp size={16} className="text-red-400 flex-shrink-0" />
                            ) : (
                              <ChevronDown size={16} className="text-red-400 flex-shrink-0" />
                            )}
                          </div>
                        </button>

                        {expandedVerifications[msg.id] && (
                          <div className="p-3 pt-2 border-t border-red-800/80 space-y-2 bg-red-950/60 animate-fade-in">
                            <div className="whitespace-pre-wrap leading-relaxed text-red-200">
                              {msg.verification.details}
                            </div>
                            {msg.verification.grounding && (
                              <ChatbotReferenceSources grounding={msg.verification.grounding} variant="verifier" />
                            )}
                            <div className="text-[10px] text-red-400/90 italic pt-1 border-t border-red-900/50 flex items-center justify-between">
                              <span>* Toàn bộ phản hồi có chi tiết ngụy tạo đã được tô đỏ cảnh báo.</span>
                              <button 
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleVerifyMessage(msg.id, msg.text);
                                }}
                                className="text-red-300 hover:text-white underline ml-2 cursor-pointer"
                              >
                                Kiểm chứng lại
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Kết quả: CHÍNH XÁC / ĐÁNG TIN CẬY -> DROPDOWN */}
                    {msg.verification?.status === 'verified' && !msg.verification.isFabricated && (
                      <div className="rounded-xl overflow-hidden bg-emerald-950/70 border-2 border-emerald-600/80 text-emerald-100 text-xs shadow-md transition-all animate-fade-in">
                        <button
                          type="button"
                          onClick={() => setExpandedVerifications(prev => ({ ...prev, [msg.id]: !prev[msg.id] }))}
                          className="w-full p-2.5 flex items-center justify-between font-bold text-emerald-300 hover:bg-emerald-900/50 transition-colors text-left gap-2 cursor-pointer"
                          title="Bấm để mở/thu gọn toàn bộ nội dung kiểm chứng"
                        >
                          <div className="flex items-center gap-1.5 text-xs text-emerald-400 min-w-0 truncate">
                            <ShieldCheck size={16} className="text-emerald-400 flex-shrink-0" />
                            <span className="truncate">✅ ĐÃ KIỂM CHỨNG: NỘI DUNG CHÂN THỰC & CHUẨN XÁC</span>
                          </div>
                          <div className="flex items-center gap-2 flex-shrink-0">
                            <span className="text-[10px] font-mono opacity-80 hidden sm:inline">
                              Verifier: {msg.verification.modelUsed}
                            </span>
                            {expandedVerifications[msg.id] ? (
                              <ChevronUp size={16} className="text-emerald-400 flex-shrink-0" />
                            ) : (
                              <ChevronDown size={16} className="text-emerald-400 flex-shrink-0" />
                            )}
                          </div>
                        </button>

                        {expandedVerifications[msg.id] && (
                          <div className="p-3 pt-2 border-t border-emerald-800/80 space-y-2 bg-emerald-950/40 animate-fade-in">
                            <div className="whitespace-pre-wrap leading-relaxed text-emerald-200/90 text-[11px]">
                              {msg.verification.details}
                            </div>
                            {msg.verification.grounding && (
                              <ChatbotReferenceSources grounding={msg.verification.grounding} variant="verifier" />
                            )}
                            <div className="text-[10px] text-emerald-400/80 italic pt-1 border-t border-emerald-900/40 flex items-center justify-between">
                              <span>* Không phát hiện chi tiết bịa đặt hay sai sự thật.</span>
                              <button 
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleVerifyMessage(msg.id, msg.text);
                                }}
                                className="text-emerald-300 hover:text-white underline ml-2 cursor-pointer"
                              >
                                Kiểm chứng lại
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Trạng thái lỗi */}
                    {msg.verification?.status === 'error' && (
                      <div className="p-2.5 rounded-xl bg-gray-950 border border-red-800/60 text-red-300 text-xs flex items-center justify-between">
                        <span>{msg.verification.details}</span>
                        <button 
                          onClick={() => handleVerifyMessage(msg.id, msg.text)}
                          className="text-indigo-400 hover:text-indigo-300 underline ml-2"
                        >
                          Thử lại
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          );
        })}

        {isLoading && !isStreaming && (
          <div className="flex items-center gap-3 text-gray-400 text-xs py-2 italic bg-gray-900/40 p-3 rounded-xl border border-gray-800/50 max-w-xs">
            <Spinner text="" className="!my-0" />
            <span>AI ({mainModelName}) đang chuẩn bị kết nối...</span>
          </div>
        )}

        {isStreaming && (
          <div className="flex items-center gap-2 text-indigo-400 text-[10px] uppercase tracking-wider font-bold animate-pulse px-4">
            <Zap size={10} className="fill-current" />
            <span>Đang Stream dữ liệu trực tiếp...</span>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Footer Input Area */}
      <div className="p-4 bg-gray-900/90 border-t border-gray-800 sticky bottom-0 backdrop-blur-md">
        <div className="max-w-4xl mx-auto flex flex-col gap-2">
          {attachments.length > 0 && (
            <div className="flex flex-wrap items-center gap-2 p-2 bg-gray-950 border border-gray-800 rounded-xl">
              <span className="text-xs text-gray-400 font-medium flex items-center gap-1 mr-1">
                <Paperclip size={14} /> Tệp đính kèm ({attachments.length}):
              </span>
              {attachments.map((att, idx) => (
                <div key={idx} className="flex items-center gap-1.5 bg-gray-900 border border-indigo-900/60 px-2.5 py-1 rounded-lg text-xs text-gray-200">
                  {att.mimeType.startsWith('image/') ? (
                    <ImageIcon size={14} className="text-indigo-400" />
                  ) : (
                    <FileText size={14} className="text-indigo-400" />
                  )}
                  <span className="max-w-[120px] truncate">{att.name}</span>
                  <button
                    onClick={() => removeAttachment(idx)}
                    className="text-gray-400 hover:text-red-400 p-0.5 rounded transition-colors ml-1"
                    title="Xóa tệp"
                  >
                    <X size={14} />
                  </button>
                </div>
              ))}
            </div>
          )}

          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="secondary"
              onClick={() => fileInputRef.current?.click()}
              disabled={isLoading}
              className="h-12 px-3 bg-gray-800 hover:bg-gray-700 text-gray-300 border border-gray-700 rounded-xl flex items-center justify-center gap-1.5 font-medium disabled:opacity-50"
              title="Đính kèm tệp tin / hình ảnh"
            >
              <Paperclip size={18} />
              <span className="hidden sm:inline text-xs">Đính kèm</span>
            </Button>

            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSendMessage();
                }
              }}
              placeholder="Nhập tin nhắn trò chuyện với AI Sandbox (Thả file vào đây hoặc nhấn Đính kèm, Enter để gửi)..."
              rows={2}
              disabled={isLoading}
              className="flex-1 bg-gray-950 border border-gray-800 rounded-xl px-4 py-2.5 text-sm text-gray-200 placeholder-gray-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 resize-none transition-all disabled:opacity-50"
            />

            <Button
              onClick={handleSendMessage}
              disabled={(!input.trim() && attachments.length === 0) || isLoading}
              variant="primary"
              className="h-12 px-5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl flex items-center justify-center gap-2 font-medium disabled:opacity-40 disabled:cursor-not-allowed shadow-md"
            >
              <Send size={18} />
              <span className="hidden sm:inline">Gửi</span>
            </Button>
          </div>
        </div>
      </div>

      {/* Modal Lịch Sử Các Đoạn Chat */}
      {showHistoryModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-fade-in">
          <div className="bg-gray-900 border border-gray-800 rounded-2xl w-full max-w-xl max-h-[85vh] flex flex-col shadow-2xl overflow-hidden">
            <div className="p-4 border-b border-gray-800 flex items-center justify-between bg-gray-900/90">
              <div className="flex items-center space-x-2">
                <div className="p-1.5 bg-indigo-950/80 border border-indigo-700/50 rounded-lg text-indigo-400">
                  <History size={18} />
                </div>
                <div>
                  <h2 className="text-base font-bold text-gray-100">Lịch Sử Các Đoạn Chat</h2>
                  <p className="text-xs text-gray-400">Đã lưu trữ {sessions.length} đoạn hội thoại độc lập</p>
                </div>
              </div>
              <button
                onClick={() => setShowHistoryModal(false)}
                className="text-gray-400 hover:text-white p-1.5 rounded-lg hover:bg-gray-800 transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            <div className="p-3 bg-gray-950/60 border-b border-gray-800/80 flex items-center justify-between gap-2">
              <Button
                variant="primary"
                size="sm"
                onClick={() => {
                  handleCreateNewChat();
                  setShowHistoryModal(false);
                }}
                className="text-xs py-1.5 px-3 flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-500"
              >
                <MessageSquarePlus size={14} />
                <span>+ Tạo Đoạn Chat Mới</span>
              </Button>
              <span className="text-[11px] text-gray-500 italic">Mỗi đoạn chat được cách ly hoàn toàn</span>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-2.5 custom-scrollbar">
              {sessions.map((session) => {
                const isActive = session.id === currentSession.id;
                const messageCount = session.messages?.length || 0;
                const firstUserText = session.messages?.find(m => m.sender === 'user')?.text;

                return (
                  <div
                    key={session.id}
                    onClick={() => handleSwitchSession(session.id)}
                    className={`p-3.5 rounded-xl border transition-all cursor-pointer flex items-center justify-between gap-3 group ${
                      isActive
                        ? 'bg-indigo-950/40 border-indigo-600/80 ring-1 ring-indigo-500/50 shadow-md'
                        : 'bg-gray-950/70 border-gray-800/80 hover:bg-gray-800/60 hover:border-gray-700'
                    }`}
                  >
                    <div className="flex items-start space-x-3 min-w-0 flex-1">
                      <div className={`mt-0.5 p-2 rounded-lg flex-shrink-0 ${
                        isActive ? 'bg-indigo-600 text-white' : 'bg-gray-800 text-gray-400 group-hover:text-gray-200'
                      }`}>
                        <MessageSquare size={16} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className={`text-sm font-semibold truncate ${isActive ? 'text-indigo-300' : 'text-gray-200'}`}>
                            {session.title || 'Đoạn chat'}
                          </h3>
                          {isActive && (
                            <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-indigo-600 text-white flex-shrink-0">
                              Đang mở
                            </span>
                          )}
                        </div>
                        {firstUserText && (
                          <p className="text-xs text-gray-400 line-clamp-1 italic mb-1">
                            "{firstUserText}"
                          </p>
                        )}
                        <div className="flex items-center gap-3 text-[11px] text-gray-500">
                          <span className="flex items-center gap-1">
                            <Clock size={11} />
                            {new Date(session.updatedAt || session.createdAt).toLocaleString('vi-VN', {
                              hour: '2-digit',
                              minute: '2-digit',
                              day: '2-digit',
                              month: '2-digit'
                            })}
                          </span>
                          <span>•</span>
                          <span>{messageCount} tin nhắn</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center space-x-1 flex-shrink-0">
                      <button
                        onClick={(e) => handleDeleteSession(session.id, e)}
                        className="p-1.5 rounded-lg text-gray-500 hover:text-red-400 hover:bg-red-950/50 border border-transparent hover:border-red-900/40 transition-colors"
                        title="Xóa đoạn chat này"
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="p-3 border-t border-gray-800 bg-gray-900/90 flex justify-end">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setShowHistoryModal(false)}
                className="text-xs py-1.5 px-4"
              >
                Đóng
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ChatbotScreen;
