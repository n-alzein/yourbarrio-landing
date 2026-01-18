"use client";

import { createContext, useContext, useEffect, useMemo, useState, useSyncExternalStore } from "react";

const STORAGE_KEY = "yb-theme";
const THEMES = ["light", "dark"];

const ThemeContext = createContext(null);

export function ThemeProvider({ children }) {
  const [theme, setTheme] = useState(() => {
    if (typeof window === "undefined") return "light";
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved && THEMES.includes(saved) ? saved : "light";
  });
  const hydrated = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false
  );

  useEffect(() => {
    const root = document.documentElement;
    THEMES.forEach((name) => root.classList.remove(`theme-${name}`));
    root.classList.add(`theme-${theme}`);
    localStorage.setItem(STORAGE_KEY, theme);
  }, [theme]);

  useEffect(() => {
    const handleStorage = (event) => {
      if (event.key !== STORAGE_KEY) return;
      if (event.newValue && THEMES.includes(event.newValue)) {
        setTheme(event.newValue);
      }
    };
    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }, []);

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
