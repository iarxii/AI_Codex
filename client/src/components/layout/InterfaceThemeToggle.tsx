import React from 'react';
import { Moon, Sun } from 'lucide-react';
import { useInterfaceTheme } from '../../hooks/useInterfaceTheme';

const InterfaceThemeToggle: React.FC = () => {
  const { theme, toggleTheme } = useInterfaceTheme();
  const isDark = theme === 'dark';

  return (
    <button
      type="button"
      onClick={toggleTheme}
      className="p-2 rounded-lg text-white/90 hover:bg-white/15 hover:text-white transition-colors touch-44"
      title={`Switch to ${isDark ? 'light' : 'dark'} mode`}
      aria-label={`Switch to ${isDark ? 'light' : 'dark'} mode`}
      aria-pressed={isDark}
    >
      {isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
    </button>
  );
};

export default InterfaceThemeToggle;