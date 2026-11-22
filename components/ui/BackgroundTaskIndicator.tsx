
import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { backgroundTaskManager } from '../../utils/BackgroundTaskManager';
import { Settings } from 'lucide-react';

const BackgroundTaskIndicator: React.FC = () => {
    const [taskCount, setTaskCount] = useState(backgroundTaskManager.getTaskCount());

    useEffect(() => {
        const unsubscribe = backgroundTaskManager.subscribe((count) => {
            setTaskCount(count);
        });
        return unsubscribe;
    }, []);

    return (
        <AnimatePresence>
            {taskCount > 0 && (
                <motion.div
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.8 }}
                    className="fixed top-4 right-4 z-[300] pointer-events-none"
                >
                    <div className="bg-gray-900/80 backdrop-blur-sm border border-amber-500/50 rounded-full p-2 shadow-lg flex items-center justify-center" title="Đang xử lý tác vụ ngầm...">
                        <motion.div
                            animate={{ rotate: 360 }}
                            transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                            className="text-amber-500"
                        >
                            <Settings size={16} />
                        </motion.div>
                    </div>
                </motion.div>
            )}
        </AnimatePresence>
    );
};

export default BackgroundTaskIndicator;
