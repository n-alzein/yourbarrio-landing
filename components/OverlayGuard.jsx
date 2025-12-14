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
  // Previously disabled stray overlays; now we keep this a no-op to avoid
  // interfering with interactive elements like maps or modals.
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
    const interval = window.setInterval(() => {
      resetBodyScroll();
      disableStrayOverlays();
    }, 3000);

    return () => {
      window.removeEventListener("keydown", handleKey);
      window.clearInterval(interval);
    };
  }, []);

  return null;
}
