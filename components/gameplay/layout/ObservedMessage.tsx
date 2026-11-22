
import React, { useState, useRef, useEffect, useLayoutEffect, ReactNode } from 'react';

interface ObservedMessageProps {
  children: ReactNode;
  /**
   * An estimated height for the placeholder to reduce layout shift.
   * A good estimate can be the average height of a message.
   */
  placeholderHeight?: number;
  forceRender?: boolean;
  id?: string;
  dataMsgType?: string;
  dataIsLatest?: string;
  className?: string;
}

const observerOptions = {
  root: null, // observes intersections relative to the viewport
  // Load content when it's 300px away from the viewport, provides a smoother experience
  rootMargin: '300px 0px', 
  threshold: 0.01, // Trigger as soon as a tiny part is visible
};

const ObservedMessage: React.FC<ObservedMessageProps> = ({ 
  children, 
  placeholderHeight = 75,
  forceRender = false,
  id,
  dataMsgType,
  dataIsLatest,
  className
}) => {
  const [isIntersecting, setIsIntersecting] = useState(false);
  // Use a ref to store the measured height to avoid re-renders when it changes.
  // We only need to set the wrapper's height.
  const heightRef = useRef<number>(placeholderHeight);
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(([entry]) => {
      // Update intersection state
      setIsIntersecting(entry.isIntersecting);
    }, observerOptions);

    const currentRef = wrapperRef.current;
    if (currentRef) {
      observer.observe(currentRef);
    }

    return () => {
      if (currentRef) {
        observer.unobserve(currentRef);
      }
    };
  }, []);

  useLayoutEffect(() => {
    // If the component is visible, measure its actual height and store it in the ref.
    // This measured height will be used for the placeholder when it becomes invisible again.
    if ((isIntersecting || forceRender) && wrapperRef.current) {
        const newHeight = wrapperRef.current.offsetHeight;
        if (newHeight > 0) {
             heightRef.current = newHeight;
        }
    }
  }, [isIntersecting, forceRender, children]);

  // The wrapper div will either contain the full content or have a fixed height
  // to act as a placeholder, preventing scroll jumps.
  return (
    <div 
      ref={wrapperRef} 
      id={id}
      data-msg-type={dataMsgType}
      data-is-latest-narration={dataIsLatest}
      className={className}
      style={{ minHeight: `${heightRef.current}px`, contain: forceRender ? 'none' : 'layout style' }}
    >
      {(isIntersecting || forceRender) ? children : null}
    </div>
  );
};

export default ObservedMessage;
