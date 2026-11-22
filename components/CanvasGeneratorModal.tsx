import React, { useState, useRef, useEffect } from 'react';
import Button from './ui/Button';
import Spinner from './ui/Spinner';
import { callGeminiAPI, getTaskModel } from '../services/apiService';
import { Sparkles, Play, Download, Trash2, Code, X, Image as ImageIcon } from 'lucide-react';

interface CanvasGeneratorModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const CanvasGeneratorModal: React.FC<CanvasGeneratorModalProps> = ({ isOpen, onClose }) => {
  const [prompt, setPrompt] = useState('Vẽ một linh trận phong ấn pháp thuật đường nét tinh xảo phát sáng màu xanh lam huyền ảo trên nền tối');
  const [generatedCode, setGeneratedCode] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [canvasSize, setCanvasSize] = useState<{ width: number; height: number }>({ width: 500, height: 500 });
  const [showCode, setShowCode] = useState(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  // Thêm các state áp dụng hiệu ứng cho game
  const [applyPrompt, setApplyPrompt] = useState('');
  const [applyTarget, setApplyTarget] = useState<'story' | 'combat'>('story');
  const [applyLayer, setApplyLayer] = useState<'overlay' | 'background'>('overlay');
  const [isApplying, setIsApplying] = useState(false);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const timerRef = useRef<any>(null);
  const economyModelName = getTaskModel('economy');

  const handleApplyEffect = async () => {
    if (!generatedCode) {
      setError("Vui lòng sinh mã Canvas trước khi áp dụng hiệu ứng.");
      return;
    }

    setIsApplying(true);
    let target = applyTarget;
    let layer = applyLayer;

    // Nếu người dùng nhập prompt, dùng AI phân tích ý đồ
    if (applyPrompt.trim()) {
      try {
        const systemInstruction = `
Bạn là một trợ lý AI phân tích ý đồ giao diện. Nhiệm vụ của bạn là đọc yêu cầu áp dụng hiệu ứng của người dùng và trả về một đối tượng JSON phân tích vị trí áp dụng:
{
  "target": "story" hoặc "combat",
  "layer": "overlay" hoặc "background"
}
Quy tắc:
- "target" chọn "combat" nếu người dùng nhắc đến: chiến đấu, combat, trận đấu, đánh nhau, lôi đài, realtimescreencombat. Ngược lại chọn "story".
- "layer" chọn "background" nếu người dùng nhắc đến: nền, background, bên dưới, đằng sau, ẩn sau. Ngược lại chọn "overlay".

CHỈ trả về JSON nguyên bản, không bọc lặp bất kỳ ký tự nào khác. Không dùng markdown code block.
`.trim();

        const { text } = await callGeminiAPI(
          `Phân tích yêu cầu này: "${applyPrompt.trim()}"`,
          undefined,
          'economy',
          undefined,
          systemInstruction
        );

        let cleaned = text.trim();
        if (cleaned.startsWith('```')) {
          cleaned = cleaned.replace(/^```(?:json)?/i, '').replace(/```$/i, '').trim();
        }

        const parsed = JSON.parse(cleaned);
        if (parsed.target === 'story' || parsed.target === 'combat') {
          target = parsed.target;
        }
        if (parsed.layer === 'overlay' || parsed.layer === 'background') {
          layer = parsed.layer;
        }
        
        // Cập nhật lại UI cho đồng bộ
        setApplyTarget(target);
        setApplyLayer(layer);
      } catch (err) {
        console.warn("Lỗi phân tích prompt bằng AI, tự động fallback về cài đặt thủ công:", err);
        // Fallback về regex đơn giản
        const lowerPrompt = applyPrompt.toLowerCase();
        if (lowerPrompt.includes('chiến đấu') || lowerPrompt.includes('combat') || lowerPrompt.includes('đánh nhau') || lowerPrompt.includes('lôi đài')) {
          target = 'combat';
        } else {
          target = 'story';
        }

        if (lowerPrompt.includes('nền') || lowerPrompt.includes('background') || lowerPrompt.includes('đằng sau') || lowerPrompt.includes('sau') || lowerPrompt.includes('ẩn')) {
          layer = 'background';
        } else {
          layer = 'overlay';
        }
        
        setApplyTarget(target);
        setApplyLayer(layer);
      }
    }

    // Bắn event
    const event = new CustomEvent('APPLY_CANVAS_EFFECT', {
      detail: {
        javascriptCode: generatedCode,
        target,
        layer,
        active: true
      }
    });
    window.dispatchEvent(event);
    setIsApplying(false);
  };

  const handleClearAppliedEffect = (targetToClear: 'story' | 'combat') => {
    const event = new CustomEvent('CLEAR_CANVAS_EFFECT', {
      detail: { target: targetToClear }
    });
    window.dispatchEvent(event);
  };

  useEffect(() => {
    if (isLoading) {
      setElapsedSeconds(0);
      timerRef.current = setInterval(() => {
        setElapsedSeconds(prev => prev + 1);
      }, 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isLoading]);

  const executeCanvasCode = (code: string) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Reset canvas before execution
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    try {
      let cleanedCode = code.trim();

      // Kiểm tra xem phản hồi có phải là trang lỗi HTML từ máy chủ hoặc proxy không
      if (
        cleanedCode.toLowerCase().startsWith('<!doctype') || 
        cleanedCode.toLowerCase().startsWith('<html') || 
        cleanedCode.toLowerCase().startsWith('<?xml')
      ) {
        throw new Error("Máy chủ hoặc API phản hồi lỗi định dạng trang HTML/XML thay vì mã nguồn JavaScript vẽ Canvas. Hãy thử bấm nút 'Tạo Canvas' một lần nữa để gửi lại yêu cầu.");
      }

      // Trích xuất mã JavaScript nằm trong các khối markdown code block ```javascript hoặc ```js
      const codeBlockRegex = /```(?:javascript|js)\s*([\s\S]*?)```/i;
      const match = cleanedCode.match(codeBlockRegex);
      if (match && match[1]) {
        cleanedCode = match[1].trim();
      } else {
        // Nếu không có khối markdown chuẩn nhưng bắt đầu bằng ký tự ```
        if (cleanedCode.startsWith('```')) {
          cleanedCode = cleanedCode.replace(/^```(?:javascript|js)?/i, '').replace(/```$/i, '').trim();
        }
      }

      // Loại bỏ các thẻ XML/HTML tùy biến bọc ở đầu và cuối nếu AI vô tình sinh ra (ví dụ: <canvas_code> ... </canvas_code>)
      if (cleanedCode.startsWith('<') && cleanedCode.endsWith('>')) {
        cleanedCode = cleanedCode.replace(/^<[a-zA-Z0-9_\-+]+[^>]*>/, '').replace(/<\/[a-zA-Z0-9_\-+]+>$/, '').trim();
      }

      // Lọc bỏ toàn bộ các thẻ XML hệ thống dư thừa nếu có sinh kèm
      cleanedCode = cleanedCode.replace(/<[a-zA-Z0-9_\-+]+_+[a-zA-Z0-9_\-+]+>[\s\S]*?<\/[a-zA-Z0-9_\-+]+_+[a-zA-Z0-9_\-+]+>/g, '').trim();

      if (!cleanedCode) {
        throw new Error("Không thể trích xuất mã nguồn JavaScript hợp lệ từ câu trả lời của AI. Hãy thử đổi mô tả prompt khác chi tiết hơn.");
      }

      // Execute code safely passing canvas and ctx context
      const drawFunction = new Function('canvas', 'ctx', cleanedCode);
      drawFunction(canvas, ctx);
      setError(null);
    } catch (err: any) {
      console.error('Lỗi khi thực thi mã Canvas:', err);
      
      // Chuyển đổi các thông báo lỗi cú pháp JS thô lỗ thành thông báo tiếng Việt dễ hiểu
      let friendlyMessage = err.message || String(err);
      if (friendlyMessage.includes("Unexpected token '<'")) {
        friendlyMessage = "Lỗi cú pháp: Phát hiện kí tự lạ '<'. Điều này xảy ra do AI phản hồi chứa mã XML/HTML lỗi hoặc mã HTML của máy chủ. Hãy thử bấm 'Tạo Canvas' một lần nữa.";
      } else if (friendlyMessage.includes("is not a function")) {
        friendlyMessage = `Lỗi hàm Canvas API: Một phương thức vẽ không tồn tại trong Canvas 2D Context. Chi tiết: ${friendlyMessage}`;
      }
      
      setError(`Lỗi thực thi mã Canvas: ${friendlyMessage}`);
    }
  };

  const handleGenerate = async () => {
    if (!prompt.trim() || isLoading) return;

    setIsLoading(true);
    setError(null);

    const systemInstruction = `
<canvas_generator_system_+dev_studio>
================
Bạn là một chuyên gia lập trình HTML5 Canvas 2D JavaScript.
Nhiệm vụ của bạn là nhận yêu cầu mô tả hình ảnh/đồ họa từ người dùng và viết đoạn mã JavaScript thuần túy để vẽ hình ảnh đó lên HTML5 Canvas.

QUY TẮC CẮT CỨNG BẮT BUỘC:
1. CHỈ TRẢ VỀ MÃ JAVASCRIPT THUẦN. Không kèm lời giải thích, không bọc văn bản thừa ngoài khối code.
2. Đoạn mã sẽ có sẵn 2 biến đầu vào là 'canvas' và 'ctx' (CanvasRenderingContext2D).
   - canvas.width = ${canvasSize.width}
   - canvas.height = ${canvasSize.height}
3. Tận dụng đầy đủ API của Canvas 2D: ctx.fillStyle, ctx.strokeStyle, ctx.lineWidth, ctx.beginPath(), ctx.arc(), ctx.ellipse(), ctx.bezierCurveTo(), ctx.createRadialGradient(), ctx.shadowBlur, v.v. để tạo hiệu ứng phát sáng, nhiều tầng lớp nghệ thuật và đẹp mắt.
4. Xóa nền sạch sẽ hoặc tạo hình nền phù hợp (ví dụ màu tối hoặc trong suốt) trước khi vẽ các chi tiết chính.
5. Không sử dụng window.confirm, alert, hay load ảnh từ URL bên ngoài để tránh lỗi bảo mật/iframe. Tất cả đường nét đều được vẽ bằng thuật toán/Canvas API.
================
</canvas_generator_system_+dev_studio>
`.trim();

    const fullPrompt = `
<user_input>
User Input Mới Nhất: "Hãy viết code JS Canvas 2D vẽ: ${prompt.trim()}"
</user_input>
`.trim();

    try {
      // Tuân thủ Luuyngudan2: Luôn sử dụng danh sách động 'economy'
      const { text } = await callGeminiAPI(
        fullPrompt,
        undefined,
        'economy',
        undefined,
        systemInstruction
      );

      setGeneratedCode(text);
      executeCanvasCode(text);
    } catch (err: any) {
      console.error('Lỗi gọi AI sinh Canvas:', err);
      setError(`Lỗi gọi AI: ${err.message || String(err)}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleClearCanvas = () => {
    const canvas = canvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext('2d');
      if (ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
    setGeneratedCode('');
    setError(null);
  };

  const handleDownload = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const url = canvas.toDataURL('image/png');
    const link = document.createElement('a');
    link.download = `canvas_art_${Date.now()}.png`;
    link.href = url;
    link.click();
  };

  useEffect(() => {
    if (isOpen && generatedCode) {
      executeCanvasCode(generatedCode);
    }
  }, [canvasSize, isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[250] flex items-center justify-center bg-black/85 backdrop-blur-md p-4">
      <div className="bg-gray-900 border-2 border-indigo-500/80 rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="bg-indigo-950/80 p-4 border-b border-indigo-500/50 flex justify-between items-center">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-indigo-600/30 border border-indigo-500/50 rounded-lg text-indigo-300">
              <ImageIcon size={20} />
            </div>
            <div>
              <h2 className="text-lg font-bold text-indigo-200 uppercase tracking-wider flex items-center gap-2">
                Canvas Prompt Studio (DEV)
                <span className="text-[10px] font-mono font-normal bg-indigo-900 text-indigo-300 border border-indigo-700/60 px-2 py-0.5 rounded-full">
                  Model: {economyModelName}
                </span>
              </h2>
              <p className="text-xs text-indigo-300/70">
                Tạo và vẽ hình ảnh thuật toán trực tiếp lên HTML5 Canvas bằng AI Prompt
              </p>
            </div>
          </div>

          <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors p-1 rounded-lg hover:bg-gray-800">
            <X size={20} />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-4 sm:p-6 overflow-y-auto flex-1 space-y-5 custom-scrollbar">
          
          {/* Input Area */}
          <div className="space-y-2">
            <label className="text-xs font-bold text-indigo-300 uppercase tracking-wider flex items-center gap-1.5">
              <Sparkles size={14} className="text-amber-400" />
              Mô tả hình ảnh Canvas bạn muốn vẽ:
            </label>
            <div className="flex gap-2">
              <textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="Nhập prompt mô tả (VD: Vẽ vòng tròn ma pháp phát sáng, rồng lửa pixel art, trận đồ bát quái...)"
                rows={2}
                disabled={isLoading}
                className="flex-1 bg-gray-950 border border-gray-700 rounded-xl p-3 text-sm text-gray-100 placeholder-gray-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 resize-none"
              />
              <Button
                variant="primary"
                onClick={handleGenerate}
                disabled={isLoading || !prompt.trim()}
                className="px-5 bg-indigo-600 hover:bg-indigo-500 text-white flex flex-col items-center justify-center gap-1 font-medium min-w-[110px]"
              >
                {isLoading ? (
                  <Spinner text="" className="!my-0" />
                ) : (
                  <>
                    <Play size={18} />
                    <span className="text-xs">Tạo Canvas</span>
                  </>
                )}
              </Button>
            </div>
          </div>

          {/* Canvas Display & Controls */}
          <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-start">
            
            {/* Main Stage */}
            <div className="md:col-span-8 flex flex-col items-center justify-center bg-gray-950 border border-gray-800 rounded-xl p-4 min-h-[380px] shadow-inner relative">
              <div className="w-full flex items-center justify-between mb-2 text-xs text-gray-400">
                <span className="font-mono">Kích thước: {canvasSize.width}x{canvasSize.height}px</span>
                <div className="flex items-center space-x-2">
                  <button
                    onClick={() => setCanvasSize({ width: 400, height: 400 })}
                    className={`px-2 py-0.5 rounded text-[10px] ${canvasSize.width === 400 ? 'bg-indigo-600 text-white' : 'bg-gray-800 text-gray-400'}`}
                  >
                    400x400
                  </button>
                  <button
                    onClick={() => setCanvasSize({ width: 500, height: 500 })}
                    className={`px-2 py-0.5 rounded text-[10px] ${canvasSize.width === 500 ? 'bg-indigo-600 text-white' : 'bg-gray-800 text-gray-400'}`}
                  >
                    500x500
                  </button>
                  <button
                    onClick={() => setCanvasSize({ width: 600, height: 600 })}
                    className={`px-2 py-0.5 rounded text-[10px] ${canvasSize.width === 600 ? 'bg-indigo-600 text-white' : 'bg-gray-800 text-gray-400'}`}
                  >
                    600x600
                  </button>
                </div>
              </div>

              <div className="overflow-auto max-w-full max-h-[420px] flex items-center justify-center bg-gray-900 border border-gray-800 rounded-lg shadow-lg relative">
                <canvas
                  ref={canvasRef}
                  width={canvasSize.width}
                  height={canvasSize.height}
                  className="bg-black/40 rounded max-w-full h-auto"
                />

                {isLoading && (
                  <div className="absolute inset-0 bg-black/80 backdrop-blur-sm flex flex-col items-center justify-center space-y-3 z-20 transition-all">
                    <Spinner text="" className="w-10 h-10" />
                    <div className="text-center space-y-1 px-4">
                      <div className="text-sm font-bold text-indigo-300 animate-pulse">
                        AI đang biên dịch mã & vẽ Canvas...
                      </div>
                      <div className="text-xs font-mono text-emerald-400 bg-emerald-950/80 border border-emerald-700/60 px-3 py-1 rounded-full inline-block">
                        Model đang chạy: {economyModelName}
                      </div>
                      <div className="text-xs font-mono text-gray-400">
                        Thời gian trôi qua: <span className="text-amber-400 font-bold">{elapsedSeconds}s</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {error && (
                <div className="mt-3 w-full p-2.5 bg-red-950/80 border border-red-800 rounded-lg text-xs text-red-300 font-mono">
                  {error}
                </div>
              )}
            </div>

            {/* Actions & Code View Side Panel */}
            <div className="md:col-span-4 space-y-3">
              <div className="p-3 bg-gray-800/60 border border-gray-700/60 rounded-xl space-y-2">
                <h3 className="text-xs font-bold text-gray-300 uppercase tracking-wider">Thao tác Studio</h3>
                <div className="grid grid-cols-2 gap-2">
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={handleDownload}
                    disabled={!generatedCode}
                    className="w-full text-xs flex items-center justify-center gap-1.5"
                  >
                    <Download size={14} />
                    <span>Tải hình PNG</span>
                  </Button>
                  <Button
                    variant="danger"
                    size="sm"
                    onClick={handleClearCanvas}
                    className="w-full text-xs flex items-center justify-center gap-1.5"
                  >
                    <Trash2 size={14} />
                    <span>Xóa Canvas</span>
                  </Button>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowCode(!showCode)}
                  className="w-full text-xs flex items-center justify-center gap-1.5 border-indigo-500/40 text-indigo-300 hover:bg-indigo-950/50"
                >
                  <Code size={14} />
                  <span>{showCode ? 'Ẩn Mã Nguồn JS' : 'Xem Mã Nguồn JS'}</span>
                </Button>
              </div>

              {/* ÁP DỤNG HIỆU ỨNG (NEW) */}
              <div className="p-3 bg-indigo-950/40 border border-indigo-500/30 rounded-xl space-y-2">
                <h3 className="text-xs font-bold text-indigo-300 uppercase tracking-wider flex items-center gap-1.5">
                  <Sparkles size={12} className="text-amber-400" />
                  ÁP DỤNG HIỆU ỨNG (NEW)
                </h3>
                <p className="text-[10px] text-indigo-200/70 leading-relaxed">
                  Đưa hình ảnh/hiệu ứng này trực tiếp vào giao diện chơi:
                </p>

                {/* Dropdowns/Toggles */}
                <div className="space-y-1.5">
                  <div>
                    <label className="text-[10px] text-gray-400 block mb-0.5">Vị trí áp dụng:</label>
                    <div className="grid grid-cols-2 gap-1 bg-gray-950 p-0.5 rounded-lg border border-gray-800">
                      <button
                        type="button"
                        onClick={() => setApplyTarget('story')}
                        className={`py-1 text-[10px] rounded transition-all font-semibold ${applyTarget === 'story' ? 'bg-indigo-600 text-white shadow-sm' : 'text-gray-400 hover:text-white'}`}
                      >
                        Kể chuyện (Story)
                      </button>
                      <button
                        type="button"
                        onClick={() => setApplyTarget('combat')}
                        className={`py-1 text-[10px] rounded transition-all font-semibold ${applyTarget === 'combat' ? 'bg-indigo-600 text-white shadow-sm' : 'text-gray-400 hover:text-white'}`}
                      >
                        Chiến đấu (Combat)
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="text-[10px] text-gray-400 block mb-0.5">Lớp hiển thị:</label>
                    <div className="grid grid-cols-2 gap-1 bg-gray-950 p-0.5 rounded-lg border border-gray-800">
                      <button
                        type="button"
                        onClick={() => setApplyLayer('overlay')}
                        className={`py-1 text-[10px] rounded transition-all font-semibold ${applyLayer === 'overlay' ? 'bg-indigo-600 text-white shadow-sm' : 'text-gray-400 hover:text-white'}`}
                        title="Đè lên trên các lớp chữ và nhân vật"
                      >
                        Lớp phủ (Overlay)
                      </button>
                      <button
                        type="button"
                        onClick={() => setApplyLayer('background')}
                        className={`py-1 text-[10px] rounded transition-all font-semibold ${applyLayer === 'background' ? 'bg-indigo-600 text-white shadow-sm' : 'text-gray-400 hover:text-white'}`}
                        title="Chìm ở phía sau nền đen"
                      >
                        Lớp nền (Background)
                      </button>
                    </div>
                  </div>
                </div>

                {/* Custom Apply Prompt */}
                <div className="space-y-1">
                  <div className="flex justify-between items-center">
                    <label className="text-[10px] text-gray-400">Hoặc nhập yêu cầu thông minh:</label>
                    <span className="text-[8px] bg-indigo-900/50 text-indigo-300 px-1 rounded">AI auto-parse</span>
                  </div>
                  <textarea
                    value={applyPrompt}
                    onChange={(e) => setApplyPrompt(e.target.value)}
                    placeholder="VD: Làm hiệu ứng tuyết rơi toàn màn hình kể chuyện, hoặc vòng ma pháp dưới chân RealtimeCombat..."
                    rows={2}
                    className="w-full bg-gray-950 border border-gray-800 rounded-lg p-2 text-[11px] text-gray-100 placeholder-gray-600 focus:outline-none focus:border-indigo-500 resize-none leading-normal"
                  />
                  <p className="text-[8px] text-indigo-300/60 leading-tight italic">
                    * Mẹo: Viết tự do, AI sẽ tự phân tích vị trí (combat/story) và lớp phủ (overlay/background) tương ứng.
                  </p>
                </div>

                <div className="pt-1 flex gap-1.5">
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={handleApplyEffect}
                    disabled={isApplying || !generatedCode}
                    className="flex-1 text-[11px] py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white font-bold tracking-wide uppercase flex items-center justify-center gap-1"
                  >
                    {isApplying ? (
                      <>
                        <Spinner text="" className="!my-0 !w-3.5 !h-3.5" />
                        <span>Đang xử lý...</span>
                      </>
                    ) : (
                      <>
                        🚀 Triển khai ngay
                      </>
                    )}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleClearAppliedEffect(applyTarget)}
                    className="px-2 text-[10px] border-red-500/30 text-red-400 hover:bg-red-950/20 font-bold"
                    title="Xóa hiệu ứng đã áp dụng"
                  >
                    Hủy
                  </Button>
                </div>
              </div>

              {/* Code Display */}
              {showCode && (
                <div className="p-3 bg-gray-950 border border-gray-800 rounded-xl space-y-2">
                  <div className="flex justify-between items-center text-[10px] text-gray-400 font-mono">
                    <span>MÃ JAVASCRIPT CANVAS</span>
                    <button
                      onClick={() => navigator.clipboard.writeText(generatedCode)}
                      className="text-indigo-400 hover:underline"
                    >
                      Sao chép
                    </button>
                  </div>
                  <pre className="text-[11px] font-mono text-emerald-400 bg-black/60 p-2.5 rounded-lg overflow-x-auto max-h-[220px] whitespace-pre-wrap custom-scrollbar border border-gray-800">
                    {generatedCode || '// Chưa có mã nguồn'}
                  </pre>
                </div>
              )}
            </div>

          </div>
        </div>

        {/* Footer */}
        <div className="p-4 bg-gray-850 border-t border-gray-800 flex justify-between items-center">
          <span className="text-xs text-gray-400 italic">
            * Mọi lệnh vẽ Canvas được thực thi trực tiếp bằng JavaScript 2D Context.
          </span>
          <Button variant="secondary" size="md" onClick={onClose} className="min-w-[90px]">
            Đóng
          </Button>
        </div>

      </div>
    </div>
  );
};

export default CanvasGeneratorModal;
