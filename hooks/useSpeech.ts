import { useState, useCallback, useEffect } from 'react';

export const useSpeech = () => {
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [pitch, setPitch] = useState(1.0);
  const [rate, setRate] = useState(1.0);
  const [currentId, setCurrentId] = useState<string | null>(null);
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);

  useEffect(() => {
    if (typeof window === 'undefined' || !window.speechSynthesis) return;

    const loadVoices = () => {
      try {
        const availableVoices = window.speechSynthesis.getVoices();
        if (availableVoices && availableVoices.length > 0) {
          setVoices(availableVoices);
        }
      } catch (err) {
        console.warn('Failed to load speech synthesis voices:', err);
      }
    };

    loadVoices();
    if (window.speechSynthesis.onvoiceschanged !== undefined) {
      window.speechSynthesis.onvoiceschanged = loadVoices;
    }

    // Warm-up: Speak a small character safely to unlock audio on user gesture
    const warmUp = () => {
      try {
        if (window.speechSynthesis) {
          const u = new SpeechSynthesisUtterance('.');
          u.volume = 0;
          u.onerror = () => {};
          window.speechSynthesis.speak(u);
        }
      } catch {
        // Ignore warm-up errors
      }
    };
    
    window.addEventListener('click', warmUp, { once: true });
    return () => {
      window.removeEventListener('click', warmUp);
      if (typeof window !== 'undefined' && window.speechSynthesis) {
        try {
          window.speechSynthesis.cancel();
        } catch {
          // ignore
        }
      }
    };
  }, []);

  const stop = useCallback(() => {
    if (typeof window !== 'undefined' && window.speechSynthesis) {
      try {
        window.speechSynthesis.cancel();
      } catch {
        // ignore
      }
    }
    setIsSpeaking(false);
    setCurrentId(null);
  }, []);

  const speak = useCallback((text: string, id: string) => {
    if (typeof window === 'undefined' || !window.speechSynthesis) {
      console.warn('Web Speech API is not supported in this browser.');
      return;
    }

    // If clicking the same message that is currently speaking, stop it
    if (isSpeaking && currentId === id) {
      stop();
      return;
    }

    // Stop any current speech and cancel browser speech queue before starting new one
    try {
      window.speechSynthesis.cancel();
      if (window.speechSynthesis.paused) {
        window.speechSynthesis.resume();
      }
    } catch {
      // Ignore cancel errors
    }
    
    const content = String(text || '');
    if (!content) {
      setIsSpeaking(false);
      setCurrentId(null);
      return;
    }

    // Clean text: remove markdown-like symbols and technical tags
    const cleanText = content.replace(/[*_#`~]/g, ' ').replace(/<[^>]+>/g, ' ').trim();
    if (!cleanText) {
      setIsSpeaking(false);
      setCurrentId(null);
      return;
    }

    // Split text into smaller chunks (sentences) to avoid mobile browser limits
    const rawChunks = cleanText.match(/[^.!?]+[.!?]+(?=\s|$)|[^.!?]+$/g) || [cleanText];
    const chunks = rawChunks.map(c => c.trim()).filter(Boolean);

    if (chunks.length === 0) {
      setIsSpeaking(false);
      setCurrentId(null);
      return;
    }
    
    let chunkIndex = 0;

    const playNextChunk = () => {
      if (chunkIndex >= chunks.length) {
        setIsSpeaking(false);
        setCurrentId(null);
        return;
      }

      const chunkText = chunks[chunkIndex];
      if (!chunkText) {
        chunkIndex++;
        playNextChunk();
        return;
      }

      try {
        const utterance = new SpeechSynthesisUtterance(chunkText);
        
        // Dynamic fetch fresh voices to avoid stale closure
        const availableVoices = window.speechSynthesis.getVoices();
        const activeVoices = availableVoices.length > 0 ? availableVoices : voices;
        
        // Try to find a Vietnamese voice explicitly
        const viVoice = activeVoices.find(v => v.lang && (v.lang.toLowerCase().includes('vi') || v.lang.toLowerCase().includes('vietnamese')));
        if (viVoice) {
          utterance.voice = viVoice;
          utterance.lang = viVoice.lang;
        } else {
          utterance.lang = 'vi-VN';
        }
        utterance.rate = rate;
        utterance.pitch = pitch;

        utterance.onstart = () => {
          setIsSpeaking(true);
          setCurrentId(id);
        };

        utterance.onend = () => {
          chunkIndex++;
          playNextChunk();
        };

        utterance.onerror = (event) => {
          console.warn('SpeechSynthesis utterance error:', event);
          // If canceled, interrupted, or synthesis engine failed, stop further chunks
          if (event.error === 'canceled' || event.error === 'interrupted' || event.error === 'synthesis-failed') {
            setIsSpeaking(false);
            setCurrentId(null);
            return;
          }
          // On other non-fatal errors, advance to next chunk or stop gracefully
          chunkIndex++;
          if (chunkIndex >= chunks.length) {
            setIsSpeaking(false);
            setCurrentId(null);
          } else {
            playNextChunk();
          }
        };

        window.speechSynthesis.speak(utterance);
        if (window.speechSynthesis.paused) {
          window.speechSynthesis.resume();
        }
      } catch (err) {
        console.warn('SpeechSynthesis execution error:', err);
        setIsSpeaking(false);
        setCurrentId(null);
      }
    };

    playNextChunk();
  }, [stop, rate, pitch, isSpeaking, currentId, voices]);

  // Clean up on unmount
  useEffect(() => {
    return () => {
      if (typeof window !== 'undefined' && window.speechSynthesis) {
        try {
          window.speechSynthesis.cancel();
        } catch {
          // ignore
        }
      }
    };
  }, []);

  return { 
    speak, 
    stop, 
    isSpeaking, 
    currentId, 
    pitch, 
    setPitch, 
    rate, 
    setRate 
  };
};
