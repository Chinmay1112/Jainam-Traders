'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';

interface SimpleModeContextType {
  isSimpleMode: boolean;
  toggleSimpleMode: () => void;
  speakText: (text: string, lang?: 'hi-IN' | 'en-IN') => void;
}

const SimpleModeContext = createContext<SimpleModeContextType>({
  isSimpleMode: false,
  toggleSimpleMode: () => {},
  speakText: () => {},
});

export function SimpleModeProvider({ children }: { children: React.ReactNode }) {
  const [isSimpleMode, setIsSimpleMode] = useState<boolean>(false);

  useEffect(() => {
    try {
      const saved = localStorage.getItem('jt_simple_mode');
      if (saved === 'true') {
        setIsSimpleMode(true);
        document.documentElement.classList.add('simple-mode');
      }
    } catch {
      // Ignore localStorage access failures
    }
  }, []);

  const toggleSimpleMode = () => {
    setIsSimpleMode((prev) => {
      const next = !prev;
      try {
        localStorage.setItem('jt_simple_mode', String(next));
      } catch {
        // Ignore
      }
      if (next) {
        document.documentElement.classList.add('simple-mode');
        speakText('सरल मोड चालू हो गया है।', 'hi-IN');
      } else {
        document.documentElement.classList.remove('simple-mode');
      }
      return next;
    });
  };

  const speakText = (text: string, lang: 'hi-IN' | 'en-IN' = 'hi-IN') => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
    try {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = lang;
      utterance.rate = 0.95; // Slightly slower for clear rural understanding
      window.speechSynthesis.speak(utterance);
    } catch {
      // Ignore speech synthesis failures
    }
  };

  return (
    <SimpleModeContext.Provider value={{ isSimpleMode, toggleSimpleMode, speakText }}>
      {children}
    </SimpleModeContext.Provider>
  );
}

export function useSimpleMode() {
  return useContext(SimpleModeContext);
}
