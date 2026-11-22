import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronUp, Minus } from 'lucide-react';
import { apiRunningService } from '../../services/apiRunningService';
import { useGame } from '../../hooks/useGame';
import { GameScreen } from '../../types';

export const ScrollControl = () => {
  const { currentScreen } = useGame();
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    if (currentScreen !== GameScreen.Gameplay) {
      setIsVisible(false);
      return;
    }

    const handleScroll = () => {
      const storyLog = document.getElementById('story-log');
      if (storyLog) {
        setIsVisible(storyLog.scrollTop > 200);
      } else {
        setIsVisible(window.pageYOffset > 400);
      }
    };

    // Use capture phase to intercept scroll events from the story-log container too
    window.addEventListener('scroll', handleScroll, true);
    handleScroll();
    return () => window.removeEventListener('scroll', handleScroll, true);
  }, [currentScreen]);

  if (currentScreen !== GameScreen.Gameplay) {
    return null;
  }

  const scrollToTop = () => {
    const storyLog = document.getElementById('story-log');
    if (storyLog) {
      storyLog.scrollTo({ top: 0, behavior: 'smooth' });
    } else {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const scrollToLatestTurn = () => {
    const storyLog = document.getElementById('story-log');
    if (storyLog) {
      // Tìm phần tử lời kể của lượt mới nhất vừa được tạo
      const latestNarration = (
        storyLog.querySelector('#latest-story-narration') || 
        storyLog.querySelector('[data-is-latest-narration="true"]')
      ) as HTMLElement;

      if (latestNarration) {
        const containerRect = storyLog.getBoundingClientRect();
        const elementRect = latestNarration.getBoundingClientRect();
        const relativeTop = elementRect.top - containerRect.top;
        
        // Cuộn đến đầu lượt kể chuyện (AI chính phản hồi) mới nhất, chừa ra 12px lề trên
        storyLog.scrollTo({
          top: storyLog.scrollTop + relativeTop - 12,
          behavior: 'smooth'
        });
        return;
      }

      // Dự phòng nếu chưa gán id thì tìm phần tử narration cuối cùng
      const narrationTurns = storyLog.querySelectorAll('[data-msg-type="narration"]');
      if (narrationTurns.length > 0) {
        const fallbackNarration = narrationTurns[narrationTurns.length - 1] as HTMLElement;
        const containerRect = storyLog.getBoundingClientRect();
        const elementRect = fallbackNarration.getBoundingClientRect();
        const relativeTop = elementRect.top - containerRect.top;
        
        storyLog.scrollTo({
          top: storyLog.scrollTop + relativeTop - 12,
          behavior: 'smooth'
        });
      } else {
        // Dự phòng nếu không tìm thấy lượt kể chuyện nào thì cuộn xuống cuối cùng
        scrollToAbsoluteBottom();
      }
    } else {
      window.scrollTo({
        top: document.documentElement.scrollHeight,
        behavior: 'smooth'
      });
    }
  };

  const scrollToAbsoluteBottom = () => {
    const storyLog = document.getElementById('story-log');
    if (storyLog) {
      storyLog.scrollTo({
        top: storyLog.scrollHeight,
        behavior: 'smooth'
      });
    } else {
      window.scrollTo({
        top: document.documentElement.scrollHeight,
        behavior: 'smooth'
      });
    }
  };

  return (
    <div className="fixed bottom-[35%] right-4 md:right-6 flex flex-col gap-3 z-[90] -translate-y-[30px]">
      <AnimatePresence>
        {isVisible && (
          <>
            <motion.button
              initial={{ opacity: 0, scale: 0.5 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.5 }}
              onClick={scrollToTop}
              className="p-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-full shadow-lg shadow-black/50 border border-indigo-400/30 transition-colors cursor-pointer flex items-center justify-center w-11 h-11"
              title="Cuộn lên đầu trang"
            >
              <ChevronUp size={22} />
            </motion.button>
            <motion.button
              initial={{ opacity: 0, scale: 0.5 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.5 }}
              onClick={scrollToLatestTurn}
              className="p-3 bg-gray-800 hover:bg-gray-700 text-white rounded-md shadow-lg shadow-black/50 border border-gray-600/30 transition-colors cursor-pointer flex items-center justify-center w-11 h-11"
              title="Cuộn đến đầu lượt kể chuyện (AI) gần nhất"
            >
              <Minus size={22} />
            </motion.button>
            <motion.button
              initial={{ opacity: 0, scale: 0.5 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.5 }}
              onClick={scrollToAbsoluteBottom}
              className="p-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-full shadow-lg shadow-black/50 border border-indigo-400/30 transition-colors cursor-pointer flex items-center justify-center w-11 h-11"
              title="Cuộn xuống dưới cùng"
            >
              <span className="font-bold text-lg leading-none mt-1">√</span>
            </motion.button>
          </>
        )}
      </AnimatePresence>
    </div>
  );
};

