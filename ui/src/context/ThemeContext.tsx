import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { safeStorage } from '../lib/storage';

export type ThemeMode = 'light' | 'dark' | 'system';
export type Density = 'comfortable' | 'compact';

interface ThemeContextValue {
  mode: ThemeMode;
  setMode: (m: ThemeMode) => void;
  /** Resolved — system mode resolved against media query */
  isDark: boolean;
  toggle: () => void;
  density: Density;
  setDensity: (d: Density) => void;
  toggleDensity: () => void;
  /** True when OS requests reduced motion */
  prefersReducedMotion: boolean;
  /** True when OS requests high contrast */
  prefersHighContrast: boolean;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

const KEYS = {
  mode: 'apidocs_theme_mode',
  density: 'apidocs_density',
} as const;

const systemPrefersDark = (): boolean =>
  typeof window !== 'undefined' &&
  window.matchMedia?.('(prefers-color-scheme: dark)').matches;

const systemPrefersReducedMotion = (): boolean =>
  typeof window !== 'undefined' &&
  window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

const systemPrefersHighContrast = (): boolean =>
  typeof window !== 'undefined' &&
  window.matchMedia?.('(prefers-contrast: more)').matches;

const applyTheme = (dark: boolean) => {
  document.documentElement.classList.toggle('dark', dark);
  document.documentElement.dataset.theme = dark ? 'dark' : 'light';
};

const applyDensity = (d: Density) => {
  document.documentElement.setAttribute('data-density', d);
};

const applyMotionPreference = (reduced: boolean, contrast: boolean) => {
  document.documentElement.classList.toggle('reduce-motion', reduced);
  document.documentElement.classList.toggle('high-contrast', contrast);
};

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [mode, setModeState] = useState<ThemeMode>(() => {
    const stored = safeStorage.get(KEYS.mode) as ThemeMode | null;
    if (stored === 'light' || stored === 'dark' || stored === 'system')
      return stored;
    // Migrate legacy single-value key
    const legacy = safeStorage.get('apidocs_theme');
    if (legacy === 'light' || legacy === 'dark') return legacy;
    // go-apidocs is a dark-first developer console
    return 'dark';
  });

  const [density, setDensityState] = useState<Density>(() => {
    const stored = safeStorage.get(KEYS.density);
    return stored === 'compact' ? 'compact' : 'comfortable';
  });

  const [systemDark, setSystemDark] = useState(systemPrefersDark);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(
    systemPrefersReducedMotion,
  );
  const [prefersHighContrast, setPrefersHighContrast] = useState(
    systemPrefersHighContrast,
  );

  // Listen to OS-level scheme / motion / contrast changes
  useEffect(() => {
    const darkMq = window.matchMedia('(prefers-color-scheme: dark)');
    const motionMq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const contrastMq = window.matchMedia('(prefers-contrast: more)');

    const onDark = (e: MediaQueryListEvent) => setSystemDark(e.matches);
    const onMotion = (e: MediaQueryListEvent) => setPrefersReducedMotion(e.matches);
    const onContrast = (e: MediaQueryListEvent) => setPrefersHighContrast(e.matches);

    darkMq.addEventListener?.('change', onDark);
    motionMq.addEventListener?.('change', onMotion);
    contrastMq.addEventListener?.('change', onContrast);
    return () => {
      darkMq.removeEventListener?.('change', onDark);
      motionMq.removeEventListener?.('change', onMotion);
      contrastMq.removeEventListener?.('change', onContrast);
    };
  }, []);

  const isDark = mode === 'dark' || (mode === 'system' && systemDark);

  useEffect(() => {
    applyTheme(isDark);
  }, [isDark]);

  useEffect(() => {
    applyDensity(density);
  }, [density]);

  useEffect(() => {
    applyMotionPreference(prefersReducedMotion, prefersHighContrast);
  }, [prefersReducedMotion, prefersHighContrast]);

  const setMode = useCallback((m: ThemeMode) => {
    setModeState(m);
    safeStorage.set(KEYS.mode, m);
  }, []);

  const toggle = useCallback(() => {
    setMode(isDark ? 'light' : 'dark');
  }, [isDark, setMode]);

  const setDensity = useCallback((d: Density) => {
    setDensityState(d);
    safeStorage.set(KEYS.density, d);
  }, []);

  const toggleDensity = useCallback(() => {
    setDensity(density === 'compact' ? 'comfortable' : 'compact');
  }, [density, setDensity]);

  const value = useMemo(
    () => ({
      mode,
      setMode,
      isDark,
      toggle,
      density,
      setDensity,
      toggleDensity,
      prefersReducedMotion,
      prefersHighContrast,
    }),
    [
      mode,
      setMode,
      isDark,
      toggle,
      density,
      setDensity,
      toggleDensity,
      prefersReducedMotion,
      prefersHighContrast,
    ],
  );

  return (
    <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
  );
};

export const useTheme = (): ThemeContextValue => {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used inside <ThemeProvider>');
  return ctx;
};