
// Quản lý âm thanh tập trung
class AudioService {
    private static instance: AudioService;
    private audio: HTMLAudioElement | null = null;
    private volume: number = 1.0; // Giá trị âm lượng mặc định từ 0.0 đến 2.0

    private constructor() {
        // Trì hoãn việc tạo Audio đến khi gọi play() hoặc stop() để tránh bị trình duyệt block
        const savedVolume = localStorage.getItem('app_bg_volume');
        if (savedVolume !== null) {
            const vol = parseFloat(savedVolume);
            if (!isNaN(vol)) {
                this.volume = Math.max(0, Math.min(2, vol));
            }
        }
    }

    public static getInstance(): AudioService {
        if (!AudioService.instance) {
            AudioService.instance = new AudioService();
        }
        return AudioService.instance;
    }

    private playPromise: Promise<void> | null = null;

    public play(src: string = './background_music1.mp3', loop: boolean = true) {
        if (!src) return;

        const oldAudio = this.audio;
        if (oldAudio) {
            oldAudio.pause();
            oldAudio.onerror = null;
            oldAudio.removeAttribute('src');
            oldAudio.load();
        }
        
        try {
            const audio = new Audio();
            this.audio = audio;
            audio.loop = loop;
            audio.volume = Math.min(1.0, this.volume * 0.5); // Áp dụng âm lượng thực tế (tối đa 1.0)
            
            audio.onerror = () => {
                // Xử lý an toàn khi file âm thanh không tồn tại hoặc không đúng định dạng
                if (this.audio === audio) {
                    this.stop();
                }
            };

            audio.src = src;
            audio.currentTime = 0; // Reset về đầu
            this.playPromise = audio.play();
            this.playPromise.catch(e => {
                // Bỏ qua các lỗi trình duyệt tự động chặn (Autoplay/Abort/NotSupported)
                if (e.name === 'NotSupportedError') {
                    this.stop();
                } else if (e.name !== 'AbortError' && e.name !== 'NotAllowedError') {
                    console.warn("Audio play warning:", e.message || e);
                }
            });
        } catch (err) {
            console.warn("Audio init error:", err);
        }
    }

    public stop() {
        if (this.audio) {
            this.audio.pause();
            this.audio.onerror = null;
            this.audio.removeAttribute('src');
            this.audio.load();
            this.audio = null;
        }
        this.playPromise = null;
    }

    public setVolume(vol: number) {
        this.volume = Math.max(0, Math.min(2, vol));
        localStorage.setItem('app_bg_volume', this.volume.toString());
        if (this.audio) {
            this.audio.volume = Math.min(1.0, this.volume * 0.5);
        }

        // Đồng bộ hóa sang SoundCloud volume (0 - 100)
        // Mức 100% (vol = 1.0) tương ứng với 50 của SoundCloud
        // Mức 200% (vol = 2.0) tương ứng với 100 của SoundCloud
        const scVol = Math.min(100, Math.round(this.volume * 50));
        localStorage.setItem('music_volume', scVol.toString());

        // Phát ra sự kiện để BackgroundSoundCloudPlayer nhận biết và cập nhật ngay lập tức
        window.dispatchEvent(new Event('music_volume_changed'));
    }

    public getVolume(): number {
        return this.volume;
    }
}

export const audioService = AudioService.getInstance();
