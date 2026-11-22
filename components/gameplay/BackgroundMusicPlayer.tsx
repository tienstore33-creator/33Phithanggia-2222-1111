import React, { useState, useRef, useEffect } from 'react';
import { Play, Pause, Upload, Volume2, VolumeX } from 'lucide-react';

const BackgroundMusicPlayer: React.FC = () => {
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [volume, setVolume] = useState(0.5);
  const [isMuted, setIsMuted] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = isMuted ? 0 : volume;
    }
  }, [volume, isMuted]);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      if (audioUrl) URL.revokeObjectURL(audioUrl);
      const url = URL.createObjectURL(file);
      setAudioUrl(url);
      setIsPlaying(true);
    }
  };

  const playPromiseRef = useRef<Promise<void> | null>(null);

  const togglePlay = async () => {
    if (audioRef.current) {
      if (isPlaying) {
        if (playPromiseRef.current) {
          try {
            await playPromiseRef.current;
          } catch (e) {
            // Ignore play errors
          }
        }
        audioRef.current.pause();
      } else {
        playPromiseRef.current = audioRef.current.play();
        playPromiseRef.current.catch(e => {
            if (e.name !== 'AbortError') {
              console.error("Playback failed:", e);
            }
        });
      }
      setIsPlaying(!isPlaying);
    }
  };

  return (
    <div className="fixed bottom-5 left-5 z-[90] bg-slate-800/80 backdrop-blur-md p-3 rounded-xl border border-slate-700 shadow-lg flex items-center gap-3 text-white">
      <input
        type="file"
        accept="audio/*"
        ref={fileInputRef}
        onChange={handleFileChange}
        className="hidden"
      />
      <button
        onClick={() => fileInputRef.current?.click()}
        className="p-2 hover:bg-slate-700 rounded-full transition-colors"
        title="Tải nhạc nền"
      >
        <Upload size={20} />
      </button>
      
      {audioUrl && (
        <>
          <button
            onClick={togglePlay}
            className="p-2 hover:bg-slate-700 rounded-full transition-colors"
          >
            {isPlaying ? <Pause size={20} /> : <Play size={20} />}
          </button>
          <button
            onClick={() => setIsMuted(!isMuted)}
            className="p-2 hover:bg-slate-700 rounded-full transition-colors"
          >
            {isMuted ? <VolumeX size={20} /> : <Volume2 size={20} />}
          </button>
          <input
            type="range"
            min="0"
            max="1"
            step="0.1"
            value={volume}
            onChange={(e) => setVolume(parseFloat(e.target.value))}
            className="w-20 accent-emerald-500"
          />
          <audio ref={audioRef} src={audioUrl} loop onError={() => setIsPlaying(false)} />
        </>
      )}
    </div>
  );
};

export default BackgroundMusicPlayer;
