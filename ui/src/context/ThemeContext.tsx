import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { safeStorage } from "../lib/storage";

export type ThemeMode = "light" | "dark" | "system";

interface ThemeContextValue {
  mode: ThemeMode;
  setMode: (m: ThemeMode) => void;
  /** Resolved — system mode resolved against media query */
  isDark: boolean;
  toggle: () => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

const KEY = "apidocs_theme_mode";

const systemPrefersDark = (): boolean =>
  typeof window !== "undefined" &&
  window.matchMedia?.("(prefers-color-scheme: dark)").matches;

const apply = (dark: boolean) => {
  document.documentElement.classList.toggle("dark", dark);
};

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [mode, setModeState] = useState<ThemeMode>(() => {
    const stored = safeStorage.get(KEY) as ThemeMode | null;
    if (stored === "light" || stored === "dark" || stored === "system")
      return stored;
    // Migrate legacy single-value key
    return safeStorage.get("apidocs_theme") === "dark" ? "dark" : "system";
  });

  const [systemDark, setSystemDark] = useState(systemPrefersDark);

  // Listen to OS-level scheme changes when in system mode
  useEffect(() => {
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const handler = (e: MediaQueryListEvent) => setSystemDark(e.matches);
    mq.addEventListener?.("change", handler);
    return () => mq.removeEventListener?.("change", handler);
  }, []);

  const isDark = mode === "dark" || (mode === "system" && systemDark);

  useEffect(() => {
    apply(isDark);
  }, [isDark]);

  const setMode = useCallback((m: ThemeMode) => {
    setModeState(m);
    safeStorage.set(KEY, m);
  }, []);

  const toggle = useCallback(() => {
    setMode(isDark ? "light" : "dark");
  }, [isDark, setMode]);

  const value = useMemo(
    () => ({ mode, setMode, isDark, toggle }),
    [mode, setMode, isDark, toggle],
  );

  return (
    <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
  );
};

export const useTheme = (): ThemeContextValue => {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used inside <ThemeProvider>");
  return ctx;
};
