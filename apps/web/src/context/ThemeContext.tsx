import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { useAuth } from './AuthContext';
import { UserTheme, DEFAULT_THEME, THEME_PRESETS } from '@mdavelctf/shared';

interface ThemeState {
  theme: UserTheme;
  setTheme: (t: UserTheme) => void;
  presets: typeof THEME_PRESETS;
}

const ThemeContext = createContext<ThemeState>({
  theme: DEFAULT_THEME,
  setTheme: () => {},
  presets: THEME_PRESETS,
});

export const useTheme = () => useContext(ThemeContext);

function applyTheme(theme: UserTheme) {
  const root = document.documentElement;
  root.style.setProperty('--accent', theme.accent);
  root.style.setProperty('--accent2', theme.accent2);
  if (theme.panelBg) root.style.setProperty('--panel-bg', theme.panelBg);

  // Update glow vars
  root.style.setProperty(
    '--glow',
    `0 0 8px ${theme.accent}, 0 0 24px ${theme.accent}26`,
  );
  root.style.setProperty(
    '--glow2',
    `0 0 8px ${theme.accent2}, 0 0 24px ${theme.accent2}26`,
  );
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const { userDoc } = useAuth();
  const [theme, setThemeState] = useState<UserTheme>(DEFAULT_THEME);

  useEffect(() => {
    if (userDoc?.theme) {
      setThemeState(userDoc.theme);
      applyTheme(userDoc.theme);
    }
  }, [userDoc]);

  const setTheme = (t: UserTheme) => {
    setThemeState(t);
    applyTheme(t);
  };

  return (
    <ThemeContext.Provider value={{ theme, setTheme, presets: THEME_PRESETS }}>
      {children}
    </ThemeContext.Provider>
  );
}
