import React, { createContext, useContext, useEffect, useState, ReactNode, useCallback } from 'react';
import { useAuth } from './AuthContext';
import { UserTheme, DEFAULT_THEME, THEME_PRESETS, COURSE_THEME_PRESETS, CourseThemePreset } from '@mdavelctf/shared';

interface ThemeState {
  theme: UserTheme;
  setTheme: (t: UserTheme) => void;
  presets: typeof THEME_PRESETS;
  courseThemeId: string | null;
  setCourseThemeId: (id: string | null) => void;
  themeSource: 'course' | 'custom';
  setThemeSource: (s: 'course' | 'custom') => void;
  activeCourseTheme: CourseThemePreset | null;
}

const ThemeContext = createContext<ThemeState>({
  theme: DEFAULT_THEME,
  setTheme: () => {},
  presets: THEME_PRESETS,
  courseThemeId: null,
  setCourseThemeId: () => {},
  themeSource: 'custom',
  setThemeSource: () => {},
  activeCourseTheme: null,
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

function applyCourseTheme(preset: CourseThemePreset) {
  const root = document.documentElement;
  root.style.setProperty('--accent', preset.accent);
  root.style.setProperty('--accent2', preset.accent2);
  root.style.setProperty('--panel-bg', preset.panelBg);
  root.style.setProperty('--bg', preset.bg);
  root.style.setProperty('--hud-text', preset.text);
  root.style.setProperty('--text-dim', preset.textDim);
  root.style.setProperty('--success', preset.success);
  root.style.setProperty('--warning', preset.warning);
  root.style.setProperty('--danger', preset.danger);
  if (preset.gridOpacity !== undefined) {
    root.style.setProperty('--grid-opacity', String(preset.gridOpacity));
  }
  root.style.setProperty(
    '--glow',
    `0 0 8px ${preset.accent}, 0 0 24px ${preset.accent}26`,
  );
  root.style.setProperty(
    '--glow2',
    `0 0 8px ${preset.accent2}, 0 0 24px ${preset.accent2}26`,
  );
}

/** Resolve the active theme based on priority: user override > course theme > default */
export function resolveActiveTheme(
  userTheme: UserTheme | undefined,
  themeSource: 'course' | 'custom',
  courseThemeId: string | null,
): { theme: UserTheme; coursePreset: CourseThemePreset | null } {
  if (themeSource === 'course' && courseThemeId && COURSE_THEME_PRESETS[courseThemeId]) {
    const preset = COURSE_THEME_PRESETS[courseThemeId];
    return {
      theme: { accent: preset.accent, accent2: preset.accent2, panelBg: preset.panelBg },
      coursePreset: preset,
    };
  }
  return { theme: userTheme || DEFAULT_THEME, coursePreset: null };
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const { userDoc } = useAuth();
  const [theme, setThemeState] = useState<UserTheme>(DEFAULT_THEME);
  const [courseThemeId, setCourseThemeIdState] = useState<string | null>(null);
  const [themeSource, setThemeSourceState] = useState<'course' | 'custom'>('custom');
  const [activeCourseTheme, setActiveCourseTheme] = useState<CourseThemePreset | null>(null);

  useEffect(() => {
    if (userDoc) {
      const source = userDoc.themeSource || 'custom';
      setThemeSourceState(source);

      const resolved = resolveActiveTheme(userDoc.theme, source, courseThemeId);
      setThemeState(resolved.theme);
      setActiveCourseTheme(resolved.coursePreset);

      if (resolved.coursePreset) {
        applyCourseTheme(resolved.coursePreset);
      } else {
        applyTheme(resolved.theme);
      }
    }
  }, [userDoc, courseThemeId]);

  const setTheme = useCallback((t: UserTheme) => {
    setThemeState(t);
    applyTheme(t);
    setActiveCourseTheme(null);
  }, []);

  const setCourseThemeId = useCallback((id: string | null) => {
    setCourseThemeIdState(id);
    if (id && COURSE_THEME_PRESETS[id] && themeSource === 'course') {
      const preset = COURSE_THEME_PRESETS[id];
      const t: UserTheme = { accent: preset.accent, accent2: preset.accent2, panelBg: preset.panelBg };
      setThemeState(t);
      setActiveCourseTheme(preset);
      applyCourseTheme(preset);
    }
  }, [themeSource]);

  const setThemeSource = useCallback((s: 'course' | 'custom') => {
    setThemeSourceState(s);
    if (s === 'course' && courseThemeId && COURSE_THEME_PRESETS[courseThemeId]) {
      applyCourseTheme(COURSE_THEME_PRESETS[courseThemeId]);
    } else if (userDoc?.theme) {
      applyTheme(userDoc.theme);
    }
  }, [courseThemeId, userDoc]);

  return (
    <ThemeContext.Provider value={{
      theme, setTheme, presets: THEME_PRESETS,
      courseThemeId, setCourseThemeId,
      themeSource, setThemeSource,
      activeCourseTheme,
    }}>
      {children}
    </ThemeContext.Provider>
  );
}
