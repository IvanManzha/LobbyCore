import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';

const ThemeContext = createContext(null);

const getInitialTheme = () => {
  if (typeof window !== 'undefined') {
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme === 'light' || savedTheme === 'dark') return savedTheme;
  }
  return 'dark';
};

const initialTheme = getInitialTheme();
if (typeof document !== 'undefined') {
  if (initialTheme === 'light') {
    document.body.classList.add('light-theme');
    document.body.classList.remove('dark-theme');
  } else {
    document.body.classList.add('dark-theme');
    document.body.classList.remove('light-theme');
  }
}

function applyThemeToDOM(themeName) {
  if (themeName === 'light') {
    if (document.body) {
      document.body.classList.add('light-theme');
      document.body.classList.remove('dark-theme');
    }
    if (document.documentElement) {
      document.documentElement.classList.add('light-theme');
      document.documentElement.classList.remove('dark-theme');
    }
  } else {
    if (document.body) {
      document.body.classList.add('dark-theme');
      document.body.classList.remove('light-theme');
    }
    if (document.documentElement) {
      document.documentElement.classList.add('dark-theme');
      document.documentElement.classList.remove('light-theme');
    }
  }
}

export function ThemeProvider({ children }) {
  const [theme, setTheme] = useState(initialTheme);

  const updateTheme = useCallback((themeName) => {
    applyThemeToDOM(themeName);
    setTheme(themeName);
  }, []);

  const toggleTheme = useCallback(() => {
    const newTheme = theme === 'light' ? 'dark' : 'light';
    setTheme(newTheme);
    localStorage.setItem('theme', newTheme);
    applyThemeToDOM(newTheme);
  }, [theme]);

  useEffect(() => {
    applyThemeToDOM(theme);
  }, []);

  useEffect(() => {
    const handleStorageChange = (e) => {
      if (e.key === 'theme') {
        const newTheme = e.newValue === 'light' || e.newValue === 'dark' ? e.newValue : 'dark';
        setTheme(newTheme);
        applyThemeToDOM(newTheme);
      }
    };
    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);

  const value = { theme, toggleTheme };
  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  return ctx;
}

export { ThemeContext };
