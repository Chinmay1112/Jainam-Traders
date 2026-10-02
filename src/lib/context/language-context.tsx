'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import { Language, TranslationKey, getTranslation } from '@/lib/i18n/translations';

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: TranslationKey, params?: Record<string, string | number>) => string;
}

const LanguageContext = createContext<LanguageContextType>({
  language: 'en',
  setLanguage: () => {},
  t: (key) => getTranslation('en', key),
});

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [language, setLanguageState] = useState<Language>('en');

  useEffect(() => {
    try {
      const saved = localStorage.getItem('jt_lang');
      if (saved === 'hi' || saved === 'en') {
        setLanguageState(saved);
      }
    } catch {
      // Ignore localStorage read errors
    }
  }, []);

  const setLanguage = (lang: Language) => {
    setLanguageState(lang);
    try {
      localStorage.setItem('jt_lang', lang);
    } catch {
      // Ignore localStorage write errors
    }
  };

  const t = (key: TranslationKey, params?: Record<string, string | number>) => {
    return getTranslation(language, key, params);
  };

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  return useContext(LanguageContext);
}

/**
 * Reusable bilingual toggle [ हिंदी ] [ English ]
 */
export function LanguageSwitch({ className = '' }: { className?: string }) {
  const { language, setLanguage } = useLanguage();

  return (
    <div
      role="group"
      aria-label="Language selection / भाषा चुनें"
      className={`inline-flex items-center rounded-full bg-stone-100 p-0.5 border border-stone-300 text-xs font-bold ${className}`}
    >
      <button
        type="button"
        onClick={() => setLanguage('hi')}
        aria-pressed={language === 'hi'}
        className={`px-3 py-1 rounded-full transition-all ${
          language === 'hi'
            ? 'bg-amber-600 text-white shadow-sm'
            : 'text-stone-700 hover:text-stone-950 hover:bg-stone-200/60'
        }`}
      >
        हिंदी
      </button>
      <button
        type="button"
        onClick={() => setLanguage('en')}
        aria-pressed={language === 'en'}
        className={`px-3 py-1 rounded-full transition-all ${
          language === 'en'
            ? 'bg-amber-600 text-white shadow-sm'
            : 'text-stone-700 hover:text-stone-950 hover:bg-stone-200/60'
        }`}
      >
        English
      </button>
    </div>
  );
}
