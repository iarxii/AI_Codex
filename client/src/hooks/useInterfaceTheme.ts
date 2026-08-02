import { useEffect, useState } from 'react';

export type InterfaceTheme = 'light' | 'dark';

const THEME_STORAGE_KEY = 'aicodex_interface_theme';

const getInitialTheme = (): InterfaceTheme => {
  try {
    return localStorage.getItem(THEME_STORAGE_KEY) === 'dark' ? 'dark' : 'light';
  } catch {
    return 'light';
  }
};

export const useInterfaceTheme = () => {
  const [theme, setTheme] = useState<InterfaceTheme>(getInitialTheme);

  useEffect(() => {
    document.documentElement.dataset.interfaceTheme = theme;
    try {
      localStorage.setItem(THEME_STORAGE_KEY, theme);
    } catch {
      // Theme selection remains available for this session when storage is unavailable.
    }
  }, [theme]);

  return {
    theme,
    toggleTheme: () => setTheme((current) => (current === 'light' ? 'dark' : 'light')),
  };
};