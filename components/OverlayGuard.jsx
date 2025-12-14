"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

function resetBodyScroll() {
  if (typeof document === "undefined") return;
  if (document.body.style.overflow === "hidden") {
    document.body.style.overflow = "";
  }
}

// Defensive: if a full-viewport overlay gets stuck (e.g., modal/backdrop),
// turn off its pointer events so links become clickable again.
function disableStrayOverlays() {
  if (typeof document === "undefined") return;

  const minWidth = Math.max(0, window.innerWidth * 0.7);
  const minHeight = Math.max(0, window.innerHeight * 0.7);

  const candidates = Array.from(document.querySelectorAll("*")).filter((el) => {
    const rect = el.getBoundingClientRect();
    if (rect.width < minWidth || rect.height < minHeight) return false;

    const style = window.getComputedStyle(el);
    if (!["fixed", "absolute", "sticky"].includes(style.position)) return false;

    // Only target backdrops/overlays, not the main app shell
    const z = Number.parseInt(style.zIndex, 10);
    if (!Number.isFinite(z) || z < 20) return false;

    // Skip navbars and the root app container
    if (el.tagName.toLowerCase() === "nav") return false;
    if (el.id === "__next") return false;

    return true;
  });

  candidates.forEach((el) => {
    el.style.pointerEvents = "none";
    el.style.touchAction = "auto";
  });
}

export default function OverlayGuard() {
  const pathname = usePathname();

  useEffect(() => {
    resetBodyScroll();
    disableStrayOverlays();
  }, [pathname]);

  useEffect(() => {
    const handleKey = (event) => {
      if (event.key === "Escape") {
        resetBodyScroll();
        disableStrayOverlays();
      }
    };

    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, []);

  return null;
}
