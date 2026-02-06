"use client";

import { useEffect } from "react";
import { isSafariDesktop } from "@/lib/safariLayers";

export default function SafariDesktopClassClient() {
  useEffect(() => {
    if (typeof document === "undefined") return;
    const root = document.documentElement;
    if (isSafariDesktop()) {
      root.classList.add("safari-desktop");
    } else {
      root.classList.remove("safari-desktop");
    }
    return () => {
      root.classList.remove("safari-desktop");
    };
  }, []);

  return null;
}
