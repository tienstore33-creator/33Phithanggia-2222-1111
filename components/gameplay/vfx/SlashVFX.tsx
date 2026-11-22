
import React from 'react';
import { motion } from 'motion/react';

interface SlashVFXProps {
    onComplete?: () => void;
}

export const SlashVFX: React.FC<SlashVFXProps> = ({ onComplete }) => {
    return (
        <motion.div
            initial={{ opacity: 0, scale: 0.5, rotate: -45 }}
            animate={{ opacity: [0, 1, 1, 0], scale: [0.5, 1.2, 1], rotate: [-45, 0] }}
            transition={{ duration: 0.4 }}
            onAnimationComplete={onComplete}
            className="absolute inset-0 z-50 flex items-center justify-center pointer-events-none"
        >
            <img 
                src="/images/sword_slash_effect.jpg" 
                alt="slash" 
                className="w-full h-full object-contain mix-blend-screen"
                referrerPolicy="no-referrer"
            />
        </motion.div>
    );
};
