import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { getTranslation } from '../i18n';

const LanguageContext = createContext(null);

const STORAGE_KEY = 'language';

function getInitialLang() {
  if (typeof window === 'undefined') return 'ru';
  const saved = localStorage.getItem(STORAGE_KEY);
  if (saved === 'ru' || saved === 'en') return saved;
  return 'ru';
}

export function LanguageProvider({ children }) {
  const [lang, setLangState] = useState(getInitialLang);

  const setLang = useCallback((next) => {
    const value = next === 'en' || next === 'ru' ? next : 'ru';
    setLangState(value);
    if (typeof window !== 'undefined') {
      localStorage.setItem(STORAGE_KEY, value);
      if (document.documentElement) document.documentElement.lang = value === 'ru' ? 'ru' : 'en';
    }
  }, []);

  useEffect(() => {
    if (document.documentElement) document.documentElement.lang = lang === 'ru' ? 'ru' : 'en';
  }, [lang]);

  const t = useCallback((key, params) => getTranslation(lang, key, params || {}), [lang]);

  const value = { lang, setLang, t };
  return (
    <LanguageContext.Provider value={value}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useTranslation() {
  const ctx = useContext(LanguageContext);
  return ctx;
}

export { LanguageContext };
