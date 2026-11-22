import { useState, useEffect, useCallback } from 'react';
import { vectorizationManager, VectorizationJob } from '../services/VectorizationManager';

export const useVectorization = () => {
    const [activeJobs, setActiveJobs] = useState<VectorizationJob[]>([]);
    const [isProcessing, setIsProcessing] = useState(false);
    const [progress, setProgress] = useState<{ current: number, total: number }>({ current: 0, total: 0 });

    const refreshJobs = useCallback(async () => {
        const jobs = await vectorizationManager.getActiveJobs();
        setActiveJobs(jobs);
    }, []);

    useEffect(() => {
        refreshJobs();
    }, [refreshJobs]);

    const startNewVectorization = async (file: File) => {
        try {
            const jobId = await vectorizationManager.startJob(file);
            
            // Đọc nội dung file
            const text = await file.text();
            
            // Chuẩn bị chunks
            await vectorizationManager.prepareChunks(jobId, text);
            
            await refreshJobs();
            
            // Bắt đầu xử lý
            await processJob(jobId);
        } catch (error) {
            console.error("Failed to start vectorization:", error);
        }
    };

    const processJob = async (jobId: string) => {
        setIsProcessing(true);
        try {
            await vectorizationManager.processJob(jobId, (current, total) => {
                setProgress({ current, total });
                refreshJobs(); // Update logs and progress in real-time
            });
            await refreshJobs();
        } catch (error) {
            console.error("Error processing job:", error);
        } finally {
            setIsProcessing(false);
            setProgress({ current: 0, total: 0 });
        }
    };

    const cancelJob = async (jobId: string) => {
        // [QUAN TRỌNG] Bỏ window.confirm() vì Iframe chặn hàm này.
        // Thực thi ngay lập tức để tránh treo UI.
        
        setIsProcessing(false); 
        setActiveJobs([]); // Xóa sổ khỏi UI ngay lập tức
        
        await vectorizationManager.cleanup(jobId);
        await refreshJobs();
    };

    return {
        activeJobs,
        isProcessing,
        progress,
        startNewVectorization,
        resumeJob: processJob,
        cancelJob,
        refreshJobs
    };
};
