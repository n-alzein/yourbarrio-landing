"use client";

import { useEffect, useMemo, useState } from "react";
import { isSafariDesktop, layersDebugEnabled } from "@/lib/safariLayers";

const FLAG_LABELS = [
  { key: "backdrop", label: "backdrop-blur override" },
  { key: "shadows", label: "shadow reduction" },
  { key: "gpu", label: "gpu forcing override" },
  { key: "filters", label: "filter override" },
];

export default function SafariLayersDebug() {
  const [enabled] = useState(() => layersDebugEnabled());
  const [safariDesktop] = useState(() => isSafariDesktop());
  const [tileCount, setTileCount] = useState(0);

  useEffect(() => {
    const root = document.documentElement;
    if (safariDesktop) {
      root.classList.add("safari-desktop");
    } else {
      root.classList.remove("safari-desktop");
    }
    return () => {
      root.classList.remove("safari-desktop");
    };
  }, [safariDesktop]);

  useEffect(() => {
    if (!enabled) return undefined;
    const update = () => {
      try {
        const count = document.querySelectorAll('[data-layer="tile"]').length;
        setTileCount(count);
      } catch {
        setTileCount(0);
      }
    };
    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, [enabled]);

  const flags = useMemo(() => {
    if (!safariDesktop) {
      return {
        backdrop: "off",
        shadows: "off",
        gpu: "off",
        filters: "off",
      };
    }
    return {
      backdrop: "on",
      shadows: "on",
      gpu: "on",
      filters: "on",
    };
  }, [safariDesktop]);

  if (!enabled) return null;

  return (
    <div
      className="fixed bottom-4 left-4 z-[9999] rounded-xl border border-white/10 bg-black/80 px-3 py-2 text-[11px] text-white/80 shadow-xl"
      style={{ fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, \"Liberation Mono\", \"Courier New\", monospace" }}
    >
      <div className="text-[10px] uppercase tracking-[0.2em] text-white/50">
        Safari Layers Debug
      </div>
      <div className="mt-1">isSafariDesktop: {safariDesktop ? "true" : "false"}</div>
      <div>tiles: {tileCount}</div>
      <div className="mt-1">
        {FLAG_LABELS.map((flag) => (
          <div key={flag.key}>
            {flag.label}: {flags[flag.key]}
          </div>
        ))}
      </div>
    </div>
  );
}
