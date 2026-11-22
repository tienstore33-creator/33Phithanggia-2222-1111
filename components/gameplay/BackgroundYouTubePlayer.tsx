import React, { useEffect, useState, useRef } from 'react';

interface BackgroundYouTubePlayerProps {
  playlistUrl: string;
}

declare global {
  interface Window {
    YT: any;
    onYouTubeIframeAPIReady?: () => void;
  }
}

export const BackgroundYouTubePlayer: React.FC<BackgroundYouTubePlayerProps> = ({ playlistUrl }) => {
  const [shouldPlay, setShouldPlay] = useState<boolean>(false);
  const [volume, setVolume] = useState<number>(() => {
    const savedVol = localStorage.getItem('music_volume');
    return savedVol !== null ? Number(savedVol) : 20;
  });

  const playerRef = useRef<any>(null);
  const isPlayerReadyRef = useRef<boolean>(false);
  const containerIdRef = useRef<string>(`yt-player-${Math.random().toString(36).substring(2, 9)}`);

  // Trích xuất playlist ID từ URL YouTube/YouTube Music (ví dụ: https://music.youtube.com/playlist?list=PLdY0vD2hsAsg&si=aD0l1W3kcMFqlqxA -> PLdY0vD2hsAsg)
  const extractPlaylistId = (url: string): string => {
    const match = url.match(/[?&]list=([^&]+)/);
    return match ? match[1] : url;
  };

  const playlistId = extractPlaylistId(playlistUrl);

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
    if (playerRef.current && isPlayerReadyRef.current && typeof playerRef.current.setVolume === 'function') {
      try {
        playerRef.current.setVolume(volume);
      } catch (e) {
        // Ignore
      }
    }
  }, [volume]);

  useEffect(() => {
    const getTargetVolume = () => {
      const savedVol = localStorage.getItem('music_volume');
      return savedVol !== null ? Number(savedVol) : 20;
    };

    const createPlayer = () => {
      if (!window.YT || !window.YT.Player || playerRef.current) return;

      playerRef.current = new window.YT.Player(containerIdRef.current, {
        height: '1',
        width: '1',
        playerVars: {
          listType: 'playlist',
          list: playlistId,
          autoplay: 1,
          controls: 0,
          disablekb: 1,
          fs: 0,
          modestbranding: 1,
          playsinline: 1,
          enablejsapi: 1,
          loop: 1,
          origin: window.location.origin,
        },
        events: {
          onReady: (event: any) => {
            isPlayerReadyRef.current = true;
            try {
              const targetVol = getTargetVolume();
              event.target.setVolume(targetVol);

              // Kích hoạt xáo bài ngẫu nhiên (Shuffle) và lặp lại danh sách
              if (typeof event.target.setShuffle === 'function') {
                event.target.setShuffle(true);
              }
              if (typeof event.target.setLoop === 'function') {
                event.target.setLoop(true);
              }

              if (localStorage.getItem('music_enabled') !== 'false') {
                // Bắt đầu phát từ vị trí ngẫu nhiên trong danh sách xáo
                if (typeof event.target.playVideoAt === 'function') {
                  const randomIndex = Math.floor(Math.random() * 10);
                  event.target.playVideoAt(randomIndex);
                } else if (typeof event.target.playVideo === 'function') {
                  event.target.playVideo();
                }
              } else if (typeof event.target.pauseVideo === 'function') {
                event.target.pauseVideo();
              }
            } catch (err) {
              // Ignore
            }
          },
          onStateChange: (event: any) => {
            // YT.PlayerState.ENDED === 0 -> tự động chuyển bài tiếp theo trong playlist xáo
            if (event.data === 0) {
              if (localStorage.getItem('music_enabled') !== 'false' && playerRef.current) {
                if (typeof playerRef.current.nextVideo === 'function') {
                  playerRef.current.nextVideo();
                } else if (typeof playerRef.current.playVideo === 'function') {
                  playerRef.current.playVideo();
                }
              }
            } else if (event.data === 1) { // YT.PlayerState.PLAYING === 1
              if (playerRef.current && typeof playerRef.current.setVolume === 'function') {
                playerRef.current.setVolume(getTargetVolume());
              }
            }
          },
          onError: () => {
            // Tự động bỏ qua bài bị lỗi (ví dụ bài bị ẩn hoặc giới hạn vùng)
            if (playerRef.current && typeof playerRef.current.nextVideo === 'function') {
              setTimeout(() => {
                try {
                  playerRef.current.nextVideo();
                } catch (e) {
                  // Ignore
                }
              }, 1000);
            }
          },
        },
      });
    };

    // Tải YouTube IFrame API script nếu chưa tồn tại
    if (!window.YT || !window.YT.Player) {
      const existingScript = document.getElementById('youtube-iframe-api');
      if (!existingScript) {
        const tag = document.createElement('script');
        tag.id = 'youtube-iframe-api';
        tag.src = 'https://www.youtube.com/iframe_api';
        const firstScriptTag = document.getElementsByTagName('script')[0];
        firstScriptTag.parentNode?.insertBefore(tag, firstScriptTag);
      }

      const prevCallback = window.onYouTubeIframeAPIReady;
      window.onYouTubeIframeAPIReady = () => {
        if (typeof prevCallback === 'function') {
          prevCallback();
        }
        createPlayer();
      };
    } else {
      createPlayer();
    }

    // Mở khóa Autoplay Policy khi người dùng tương tác lần đầu
    const handleUserInteraction = () => {
      if (
        localStorage.getItem('music_enabled') !== 'false' &&
        playerRef.current &&
        typeof playerRef.current.playVideo === 'function'
      ) {
        try {
          const savedVol = localStorage.getItem('music_volume');
          const vol = savedVol !== null ? Number(savedVol) : 20;
          playerRef.current.setVolume(vol);
          playerRef.current.playVideo();
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
  }, [playlistId]);

  // Điều khiển play/pause dựa vào shouldPlay
  useEffect(() => {
    if (!playerRef.current || !isPlayerReadyRef.current) return;

    if (shouldPlay) {
      if (typeof playerRef.current.playVideo === 'function') {
        try {
          const savedVol = localStorage.getItem('music_volume');
          const vol = savedVol !== null ? Number(savedVol) : 20;
          playerRef.current.setVolume(vol);
          playerRef.current.playVideo();
        } catch (e) {
          // Ignore
        }
      }
    } else {
      if (typeof playerRef.current.pauseVideo === 'function') {
        try {
          playerRef.current.pauseVideo();
        } catch (e) {
          // Ignore
        }
      }
    }
  }, [shouldPlay]);

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
      <div id={containerIdRef.current} />
    </div>
  );
};
