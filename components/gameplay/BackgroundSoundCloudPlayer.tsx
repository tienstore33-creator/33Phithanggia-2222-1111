import React, { useEffect, useState, useRef } from 'react';

interface BackgroundSoundCloudPlayerProps {
  playlistUrl: string;
  active: boolean;
}

declare global {
  interface Window {
    SC: any;
  }
}

export const BackgroundSoundCloudPlayer: React.FC<BackgroundSoundCloudPlayerProps> = ({ playlistUrl, active }) => {
  const [shouldPlay, setShouldPlay] = useState<boolean>(false);
  const [volume, setVolume] = useState<number>(() => {
    const savedVol = localStorage.getItem('music_volume');
    return savedVol !== null ? Number(savedVol) : 20;
  });
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const widgetRef = useRef<any>(null);
  const isWidgetReadyRef = useRef<boolean>(false);
  const allSoundsRef = useRef<any[]>([]);
  const playedIndicesRef = useRef<number[]>([]);
  const prevPlaylistUrlRef = useRef<string>("");

  useEffect(() => {
    // Kiểm tra trạng thái nút nhạc và âm lượng từ localStorage
    const checkMusicState = () => {
      const isMusicEnabled = localStorage.getItem('music_enabled') !== 'false';
      setShouldPlay(isMusicEnabled);

      const savedVol = localStorage.getItem('music_volume');
      const currentVol = savedVol !== null ? Number(savedVol) : 20;
      setVolume(currentVol);
    };

    checkMusicState();

    const handleStorageChange = () => {
      checkMusicState();
    };

    window.addEventListener('storage', handleStorageChange);
    window.addEventListener('music_state_changed', handleStorageChange);
    window.addEventListener('music_volume_changed', handleStorageChange);

    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('music_state_changed', handleStorageChange);
      window.removeEventListener('music_volume_changed', handleStorageChange);
    };
  }, []);

  // Cập nhật âm lượng khi state volume thay đổi
  useEffect(() => {
    if (widgetRef.current && isWidgetReadyRef.current && typeof widgetRef.current.setVolume === 'function') {
      try {
        widgetRef.current.setVolume(volume);
      } catch (e) {
        // Ignore
      }
    }
  }, [volume]);

  // Hàm lấy danh sách bài hát đầy đủ
  const fetchAllSounds = (widget: any, retryCount = 0) => {
    if (!widget || typeof widget.getSounds !== 'function') return;

    widget.getSounds((sounds: any[]) => {
      if (sounds && Array.isArray(sounds) && sounds.length > 0) {
        allSoundsRef.current = sounds;
        if (sounds.length < 10 && retryCount < 10) {
          setTimeout(() => fetchAllSounds(widget, retryCount + 1), 800);
        }
      } else if (retryCount < 10) {
        setTimeout(() => fetchAllSounds(widget, retryCount + 1), 800);
      }
    });
  };

  const getTargetVolume = () => {
    const savedVol = localStorage.getItem('music_volume');
    return savedVol !== null ? Number(savedVol) : 20;
  };

  const playRandomTrack = (widget: any) => {
    if (!widget) return;
    const currentVol = getTargetVolume();
    if (typeof widget.setVolume === 'function') {
      widget.setVolume(currentVol);
    }

    const sounds = allSoundsRef.current;
    if (sounds && Array.isArray(sounds) && sounds.length > 0) {
      let unplayedIndices = sounds
        .map((_, idx) => idx)
        .filter((idx) => !playedIndicesRef.current.includes(idx));

      if (unplayedIndices.length === 0) {
        playedIndicesRef.current = [];
        unplayedIndices = sounds.map((_, idx) => idx);
      }

      const randomPos = Math.floor(Math.random() * unplayedIndices.length);
      const targetIndex = unplayedIndices[randomPos];

      playedIndicesRef.current.push(targetIndex);

      if (typeof widget.skip === 'function') {
        widget.skip(targetIndex);
      }
      if (typeof widget.play === 'function') {
        widget.play();
      }
    } else {
      if (typeof widget.getSounds === 'function') {
        widget.getSounds((s: any[]) => {
          if (s && Array.isArray(s) && s.length > 0) {
            allSoundsRef.current = s;
            const randomIndex = Math.floor(Math.random() * s.length);
            if (typeof widget.skip === 'function') widget.skip(randomIndex);
          }
          if (typeof widget.play === 'function') widget.play();
        });
      } else if (typeof widget.play === 'function') {
        widget.play();
      }
    }
  };

  useEffect(() => {
    const scriptId = 'soundcloud-widget-api';
    let script = document.getElementById(scriptId) as HTMLScriptElement | null;

    const initWidget = () => {
      if (window.SC && iframeRef.current) {
        const widget = window.SC.Widget(iframeRef.current);
        widgetRef.current = widget;

        widget.bind(window.SC.Widget.Events.READY, () => {
          isWidgetReadyRef.current = true;

          if (playlistUrl) {
            prevPlaylistUrlRef.current = playlistUrl;
            if (typeof widget.load === 'function') {
              widget.load(playlistUrl, {
                auto_play: false,
                hide_related: true,
                show_comments: false,
                show_user: false,
                show_reposts: false,
                show_teaser: false,
                sharing: false,
                visual: false
              });
            }
          }

          fetchAllSounds(widget, 0);

          const isMusicEnabled = localStorage.getItem('music_enabled') !== 'false';
          const reallyShouldPlay = active && isMusicEnabled;

          if (reallyShouldPlay) {
            setTimeout(() => playRandomTrack(widget), 800);
          } else if (typeof widget.pause === 'function') {
            widget.pause();
          }
        });

        widget.bind(window.SC.Widget.Events.PLAY, () => {
          if (typeof widget.setVolume === 'function') {
            widget.setVolume(getTargetVolume());
          }
        });

        widget.bind(window.SC.Widget.Events.FINISH, () => {
          const isMusicEnabled = localStorage.getItem('music_enabled') !== 'false';
          const reallyShouldPlay = active && isMusicEnabled;
          if (reallyShouldPlay) {
            playRandomTrack(widget);
          }
        });
      }
    };

    if (!script) {
      script = document.createElement('script');
      script.id = scriptId;
      script.src = 'https://w.soundcloud.com/player/api.js';
      script.async = true;
      script.onload = initWidget;
      document.body.appendChild(script);
    } else {
      initWidget();
    }

    const handleUserInteraction = () => {
      const isMusicEnabled = localStorage.getItem('music_enabled') !== 'false';
      const reallyShouldPlay = active && isMusicEnabled;
      if (
        reallyShouldPlay &&
        widgetRef.current &&
        typeof widgetRef.current.play === 'function'
      ) {
        try {
          widgetRef.current.setVolume(getTargetVolume());
          widgetRef.current.play();
        } catch (e) {
          // Ignore
        }
      }
    };

    window.addEventListener('click', handleUserInteraction, { once: true });
    window.addEventListener('keydown', handleUserInteraction, { once: true });
    window.addEventListener('touchstart', handleUserInteraction, { once: true });

    return () => {
      window.removeEventListener('click', handleUserInteraction);
      window.removeEventListener('keydown', handleUserInteraction);
      window.removeEventListener('touchstart', handleUserInteraction);
    };
  }, []);

  // Lắng nghe thay đổi playlistUrl hoặc trạng thái active/shouldPlay
  useEffect(() => {
    if (!widgetRef.current || !isWidgetReadyRef.current) return;

    const isMusicEnabled = localStorage.getItem('music_enabled') !== 'false';
    const reallyShouldPlay = active && isMusicEnabled;

    if (!active || !playlistUrl) {
      if (typeof widgetRef.current.pause === 'function') {
        try {
          widgetRef.current.pause();
        } catch (e) {}
      }
      return;
    }

    if (playlistUrl !== prevPlaylistUrlRef.current) {
      prevPlaylistUrlRef.current = playlistUrl;
      try {
        if (typeof widgetRef.current.load === 'function') {
          // Xóa danh sách bài hát cũ và lịch sử tráo bài để tránh lỗi của playlist trước
          allSoundsRef.current = [];
          playedIndicesRef.current = [];
          
          widgetRef.current.load(playlistUrl, {
            auto_play: reallyShouldPlay,
            hide_related: true,
            show_comments: false,
            show_user: false,
            show_reposts: false,
            show_teaser: false,
            sharing: false,
            visual: false
          });

          // Tải lại các bài hát và thiết lập sẵn sàng
          setTimeout(() => {
            fetchAllSounds(widgetRef.current, 0);
            if (reallyShouldPlay) {
              if (typeof widgetRef.current.setVolume === 'function') {
                widgetRef.current.setVolume(getTargetVolume());
              }
              setTimeout(() => playRandomTrack(widgetRef.current), 500);
            }
          }, 500);
        }
      } catch (e) {
        console.error("Lỗi khi chuyển đổi playlist SoundCloud:", e);
      }
    } else {
      if (reallyShouldPlay) {
        if (typeof widgetRef.current.play === 'function') {
          try {
            widgetRef.current.setVolume(getTargetVolume());
            widgetRef.current.play();
          } catch (e) {}
        }
      } else {
        if (typeof widgetRef.current.pause === 'function') {
          try {
            widgetRef.current.pause();
          } catch (e) {}
        }
      }
    }
  }, [playlistUrl, active, shouldPlay]);

  const encodedPlaylistUrl = encodeURIComponent(playlistUrl || "https://soundcloud.com/knell101/sets/bat-dau");
  const soundcloudEmbedSrc = `https://w.soundcloud.com/player/?url=${encodedPlaylistUrl}&color=%23ff5500&auto_play=false&hide_related=true&show_comments=false&show_user=false&show_reposts=false&show_teaser=false&sharing=false&visual=false&enable_api=true`;

  return (
    <div
      tabIndex={-1}
      aria-hidden="true"
      style={{
        position: 'fixed',
        top: '-9999px',
        left: '-9999px',
        width: '1px',
        height: '1px',
        opacity: 0,
        pointerEvents: 'none',
        overflow: 'hidden',
      }}
    >
      <iframe
        ref={iframeRef}
        width="100"
        height="100"
        scrolling="no"
        frameBorder="no"
        allow="autoplay"
        src={soundcloudEmbedSrc}
        title="SoundCloud Background Music Player"
      />
    </div>
  );
};
