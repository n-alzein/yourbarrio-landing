"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";

const STORAGE_KEY = "yb-theme";
const THEMES = ["light", "dark"];

const ThemeContext = createContext(null);

export function ThemeProvider({ children }) {
  const [theme, setTheme] = useState("light");
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const saved = typeof window !== "undefined" ? localStorage.getItem(STORAGE_KEY) : null;
    if (saved && THEMES.includes(saved)) {
      setTheme(saved);
    }
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    const root = document.documentElement;
    THEMES.forEach((name) => root.classList.remove(`theme-${name}`));
    root.classList.add(`theme-${theme}`);
    localStorage.setItem(STORAGE_KEY, theme);
  }, [theme, hydrated]);

  const setThemeSafe = (next) => setTheme(THEMES.includes(next) ? next : "light");

  const value = useMemo(
    () => ({
      theme,
      hydrated,
      setTheme: setThemeSafe,
      themes: THEMES,
    }),
    [theme, hydrated]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used within ThemeProvider");
  return ctx;
}
