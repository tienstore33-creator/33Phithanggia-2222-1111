import React, { useState, useEffect, useRef } from 'react';
import { useGame } from '../../hooks/useGame';

export const ScreenStretchWrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const game = useGame();
  const screenStretchMode = game?.styleSettings?.screenStretchMode || 'none';
  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: window.innerWidth, height: window.innerHeight });

  useEffect(() => {
    const handleResize = () => {
      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        // Use rect values or client values, fall back to window coordinates if needed
        const w = rect.width || containerRef.current.clientWidth || window.innerWidth;
        const h = rect.height || containerRef.current.clientHeight || window.innerHeight;
        setDimensions({ width: w, height: h });
      } else {
        setDimensions({ width: window.innerWidth, height: window.innerHeight });
      }
    };

    window.addEventListener('resize', handleResize);
    
    // Create a ResizeObserver to instantly detect iframe/webview resize events
    let observer: ResizeObserver | null = null;
    if (typeof ResizeObserver !== 'undefined' && containerRef.current) {
      observer = new ResizeObserver(() => {
        handleResize();
      });
      observer.observe(containerRef.current);
    }

    // Trigger multi-phase recalculations to ensure absolute rendering convergence
    handleResize();
    const t1 = setTimeout(handleResize, 100);
    const t2 = setTimeout(handleResize, 400);

    return () => {
      window.removeEventListener('resize', handleResize);
      if (observer) {
        observer.disconnect();
      }
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, []);

  if (screenStretchMode === 'none') {
    return (
      <div ref={containerRef} className="w-full h-[100dvh] overflow-y-auto overflow-x-hidden flex flex-col" id="game-responsive-wrapper">
        {children}
      </div>
    );
  }

  // Base design size for responsive portrait viewport layout
  const BASE_W = 390;
  const BASE_H = 800;

  const screenW = dimensions.width;
  const screenH = dimensions.height;

  // Horizontal screen check (PC / Landscape tablet vs portrait phone)
  const isLandscape = screenW > screenH && screenW > 768;

  let scaleX = 1;
  let scaleY = 1;
  let wrapperWidth = BASE_W;
  let wrapperHeight = BASE_H;
  let transformStyle = '';
  
  const outerStyle: React.CSSProperties = {
    width: '100%',
    height: '100%',
    overflow: 'hidden',
    position: 'relative',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: '#000000',
    zIndex: 40,
  };

  if (screenStretchMode === 'stretch') {
    if (isLandscape) {
      // For landscape layout (PC), maintain clean proportions by matching height to available viewport
      wrapperWidth = BASE_W;
      wrapperHeight = BASE_H;
      const scaleVal = screenH / BASE_H;
      scaleX = scaleVal;
      scaleY = scaleVal;
    } else {
      // For mobile device displays/iframe modes, STRETCH perfectly to cover 100% of the screen dimension.
      // Squeezes or stretches height & width exactly like retro screen resizing.
      wrapperWidth = BASE_W;
      wrapperHeight = BASE_H;
      scaleX = screenW / BASE_W;
      scaleY = screenH / BASE_H;
    }
    transformStyle = `scale(${scaleX}, ${scaleY})`;
  } else if (screenStretchMode === 'fit-uniform') {
    // Keep golden portrait ratio but scale up/down to seamlessly touch the bounding box
    wrapperWidth = BASE_W;
    wrapperHeight = BASE_H;
    const ratioX = screenW / wrapperWidth;
    const ratioY = screenH / wrapperHeight;
    const uniformScale = Math.min(ratioX, ratioY);
    scaleX = uniformScale;
    scaleY = uniformScale;
    transformStyle = `scale(${uniformScale})`;
  }

  return (
    <div ref={containerRef} style={outerStyle} id="retro-stretch-outer-container">
      <div
        id="retro-stretch-inner-container"
        style={{
          width: `${wrapperWidth}px`,
          height: `${wrapperHeight}px`,
          transform: `translate(-50%, -50%) ${transformStyle}`,
          transformOrigin: 'center center',
          flexShrink: 0,
          display: 'flex',
          flexDirection: 'column',
          position: 'absolute',
          left: '50%',
          top: '50%',
          overflow: 'hidden',
          backgroundColor: '#000000',
          boxShadow: '0 0 40px rgba(0,0,0,0.9)',
          borderLeft: isLandscape ? '1px solid rgba(63,63,70,0.5)' : 'none',
          borderRight: isLandscape ? '1px solid rgba(63,63,70,0.5)' : 'none',
        }}
      >
        {children}
      </div>
    </div>
  );
};
