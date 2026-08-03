import { createContext, useContext, useEffect, useState, ReactNode } from 'react';

export type ThemeName = 'dark-blue' | 'cyber-green' | 'neon-purple';

interface ThemeConfig {
  name: ThemeName;
  label: string;
  primary: string;
  primaryGlow: string;
  accent: string;
  accent2: string;
  border: string;
  text: string;
  muted: string;
  bgBase: string;
  bgSurface: string;
}

export const THEMES: Record<ThemeName, ThemeConfig> = {
  'dark-blue': {
    name: 'dark-blue',
    label: 'Dark Blue',
    primary: '#3b82f6',
    primaryGlow: 'rgba(59,130,246,0.5)',
    accent: '#06b6d4',
    accent2: '#8b5cf6',
    border: 'rgba(59,130,246,0.3)',
    text: '#e2e8f0',
    muted: '#94a3b8',
    bgBase: '#0a0f1e',
    bgSurface: '#0f172a',
  },
  'cyber-green': {
    name: 'cyber-green',
    label: 'Cyber Green',
    primary: '#22c55e',
    primaryGlow: 'rgba(34,197,94,0.5)',
    accent: '#10b981',
    accent2: '#84cc16',
    border: 'rgba(34,197,94,0.3)',
    text: '#e2e8f0',
    muted: '#94a3b8',
    bgBase: '#0a1a0f',
    bgSurface: '#0f1f17',
  },
  'neon-purple': {
    name: 'neon-purple',
    label: 'Neon Purple',
    primary: '#a855f7',
    primaryGlow: 'rgba(168,85,247,0.5)',
    accent: '#ec4899',
    accent2: '#d946ef',
    border: 'rgba(168,85,247,0.3)',
    text: '#e2e8f0',
    muted: '#94a3b8',
    bgBase: '#0a0118',
    bgSurface: '#140828',
  },
};

interface ThemeContextValue {
  theme: ThemeName;
  config: ThemeConfig;
  setTheme: (t: ThemeName) => void;
}

const ThemeContext = createContext<ThemeContextValue>({
  theme: 'neon-purple',
  config: THEMES['neon-purple'],
  setTheme: () => {},
});

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<ThemeName>(() => {
    const saved = localStorage.getItem('oca-theme') as ThemeName | null;
    return saved ?? 'neon-purple';
  });

  useEffect(() => {
    const config = THEMES[theme];
    const root = document.documentElement;
    root.style.setProperty('--color-primary', config.primary);
    root.style.setProperty('--color-primary-glow', config.primaryGlow);
    root.style.setProperty('--color-accent', config.accent);
    root.style.setProperty('--color-accent-2', config.accent2);
    root.style.setProperty('--color-border', config.border);
    root.style.setProperty('--color-text', config.text);
    root.style.setProperty('--color-muted', config.muted);
    root.style.setProperty('--color-bg-base', config.bgBase);
    root.style.setProperty('--color-bg-surface', config.bgSurface);
    localStorage.setItem('oca-theme', theme);
  }, [theme]);

  const setTheme = (t: ThemeName) => setThemeState(t);

  return (
    <ThemeContext.Provider value={{ theme, config: THEMES[theme], setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}
