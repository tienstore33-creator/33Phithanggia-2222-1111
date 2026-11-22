import React, { useEffect, useRef, useState } from 'react';

interface DynamicCanvasEffectProps {
    screenName: 'story' | 'combat';
}

interface SavedEffect {
    javascriptCode: string;
    layer: 'overlay' | 'background';
    active: boolean;
}

export const DynamicCanvasEffect: React.FC<DynamicCanvasEffectProps> = ({ screenName }) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [effect, setEffect] = useState<SavedEffect | null>(null);
    const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
    const cleanupRef = useRef<(() => void) | null>(null);

    // 1. Tải hiệu ứng đã lưu từ LocalStorage khi mount
    useEffect(() => {
        try {
            const saved = localStorage.getItem(`canvas_effect_${screenName}`);
            if (saved) {
                const parsed = JSON.parse(saved);
                if (parsed && parsed.javascriptCode && parsed.active) {
                    setEffect(parsed);
                }
            }
        } catch (e) {
            console.error('Lỗi khi tải cấu hình Canvas từ LocalStorage:', e);
        }
    }, [screenName]);

    // 2. Lắng nghe Event 'APPLY_CANVAS_EFFECT'
    useEffect(() => {
        const handleApplyEffect = (e: Event) => {
            const customEvent = e as CustomEvent<{
                javascriptCode: string;
                target: 'story' | 'combat';
                layer: 'overlay' | 'background';
                active?: boolean;
            }>;

            const { javascriptCode, target, layer, active = true } = customEvent.detail;

            if (target === screenName) {
                const newEffect: SavedEffect = { javascriptCode, layer, active };
                setEffect(newEffect);
                try {
                    localStorage.setItem(`canvas_effect_${screenName}`, JSON.stringify(newEffect));
                } catch (err) {
                    console.error('Lỗi khi lưu cấu hình Canvas vào LocalStorage:', err);
                }
            }
        };

        const handleClearEffect = (e: Event) => {
            const customEvent = e as CustomEvent<{ target: 'story' | 'combat' }>;
            if (customEvent.detail.target === screenName) {
                setEffect(null);
                try {
                    localStorage.removeItem(`canvas_effect_${screenName}`);
                } catch (err) {
                    console.error('Lỗi khi xóa cấu hình Canvas:', err);
                }
            }
        };

        window.addEventListener('APPLY_CANVAS_EFFECT', handleApplyEffect);
        window.addEventListener('CLEAR_CANVAS_EFFECT', handleClearEffect);
        return () => {
            window.removeEventListener('APPLY_CANVAS_EFFECT', handleApplyEffect);
            window.removeEventListener('CLEAR_CANVAS_EFFECT', handleClearEffect);
        };
    }, [screenName]);

    // 3. Theo dõi kích thước container bằng ResizeObserver để canvas luôn full-screen
    useEffect(() => {
        const container = containerRef.current;
        if (!container) return;

        const resizeObserver = new ResizeObserver((entries) => {
            if (!entries || entries.length === 0) return;
            const entry = entries[0];
            const { width, height } = entry.contentRect;
            
            // Debounce hoặc cập nhật ngay kích thước canvas để không bị nháy hình
            setDimensions({
                width: Math.floor(width),
                height: Math.floor(height)
            });
        });

        resizeObserver.observe(container);
        return () => {
            resizeObserver.disconnect();
        };
    }, []);

    // 4. Khởi chạy và làm sạch mã nguồn Canvas
    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        // Dọn dẹp hiệu ứng cũ trước khi chạy cái mới
        if (cleanupRef.current) {
            try {
                cleanupRef.current();
            } catch (e) {
                console.error('Lỗi khi dọn dẹp mã Canvas cũ:', e);
            }
            cleanupRef.current = null;
        }

        ctx.clearRect(0, 0, canvas.width, canvas.height);

        if (!effect || !effect.active || !effect.javascriptCode) {
            return;
        }

        try {
            // Bao bọc mã nguồn để kiểm soát hoạt ảnh và ngăn chặn rò rỉ vòng lặp (Leak loop)
            const execute = new Function(
                'canvas',
                'ctx',
                'requestAnimationFrame',
                'setInterval',
                'setTimeout',
                `
                const activeTimers = [];
                const activeFrames = [];

                const customRAF = (cb) => {
                    const id = window.requestAnimationFrame((time) => {
                        const idx = activeFrames.indexOf(id);
                        if (idx > -1) activeFrames.splice(idx, 1);
                        cb(time);
                    });
                    activeFrames.push(id);
                    return id;
                };

                const customSI = (cb, delay) => {
                    const id = window.setInterval(cb, delay);
                    activeTimers.push({ id, type: 'interval' });
                    return id;
                };

                const customST = (cb, delay) => {
                    const id = window.setTimeout(cb, delay);
                    activeTimers.push({ id, type: 'timeout' });
                    return id;
                };

                // Đè lên đối tượng window giả lập để tránh mã tự tiện dùng global window mà không dọn dẹp
                const windowShadow = {
                    requestAnimationFrame: customRAF,
                    setInterval: customSI,
                    setTimeout: customST,
                    innerWidth: canvas.width,
                    innerHeight: canvas.height,
                    addEventListener: () => {},
                    removeEventListener: () => {}
                };

                try {
                    // Chạy code với ngữ cảnh tùy biến
                    const customEval = function() {
                        ${effect.javascriptCode}
                    };
                    customEval.call(windowShadow);
                } catch (e) {
                    console.error('Lỗi thực thi trong hàm giả lập Canvas:', e);
                }

                return () => {
                    activeFrames.forEach(id => window.cancelAnimationFrame(id));
                    activeTimers.forEach(item => {
                        if (item.type === 'interval') window.clearInterval(item.id);
                        if (item.type === 'timeout') window.clearTimeout(item.id);
                    });
                };
                `
            );

            const cleanup = execute(
                canvas,
                ctx,
                // Chuyền các hàm dọn dẹp vào trong
                window.requestAnimationFrame,
                window.setInterval,
                window.setTimeout
            );

            if (typeof cleanup === 'function') {
                cleanupRef.current = cleanup;
            }
        } catch (err) {
            console.error('Lỗi biên dịch mã Canvas:', err);
        }

        return () => {
            if (cleanupRef.current) {
                try {
                    cleanupRef.current();
                } catch (e) {
                    console.error('Lỗi dọn dẹp Canvas khi unmount:', e);
                }
                cleanupRef.current = null;
            }
        };
    }, [effect, dimensions]);

    if (!effect || !effect.active) {
        return <div ref={containerRef} className="absolute inset-0 pointer-events-none z-0" />;
    }

    // Đặt z-index và vị trí tùy thuộc vào layer
    const isOverlay = effect.layer === 'overlay';
    const zIndexClass = isOverlay ? 'z-40 pointer-events-none' : 'z-0 pointer-events-none';

    return (
        <div 
            ref={containerRef} 
            className={`absolute inset-0 overflow-hidden bg-transparent ${zIndexClass}`}
        >
            <canvas
                ref={canvasRef}
                width={dimensions.width}
                height={dimensions.height}
                className="absolute inset-0 w-full h-full bg-transparent block pointer-events-none"
                style={{ mixBlendMode: isOverlay ? 'screen' : 'normal' }}
            />
        </div>
    );
};

export default DynamicCanvasEffect;
