"use client";

import { Moon, Sun } from "lucide-react";
import { useTheme } from "./ThemeProvider";

const options = [
  { value: "light", label: "Light", icon: Sun },
  { value: "dark", label: "Dark", icon: Moon },
];

export default function ThemeToggle({ className = "", showLabel = false, align = "right" }) {
  const { theme, setTheme, hydrated } = useTheme();

  const placement = align === "left" ? "left-0" : "right-0";
  const current = options.find((o) => o.value === theme) || options[0];
  const CurrentIcon = current.icon;

  return (
    <div className={`relative ${className}`}>
      <button
        type="button"
        disabled={!hydrated}
        onClick={() => {
          const idx = options.findIndex((o) => o.value === theme);
          const next = options[(idx + 1) % options.length]?.value || "light";
          setTheme(next);
        }}
        className="flex items-center gap-2 rounded-lg border border-white/20 px-3 py-2 text-sm font-semibold text-white/80 hover:text-white hover:bg-white/10 transition theme-lock"
      >
        <CurrentIcon className="h-4 w-4" />
        {showLabel && <span>{current.label}</span>}
      </button>

      {/* Hidden list for accessibility + optional dropdown in future */}
      <div className="sr-only" role="status">
        Theme set to {current.label}
      </div>
    </div>
  );
}
