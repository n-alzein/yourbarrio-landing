"use client";

import { useEffect } from "react";

export default function useBodyScrollLock(locked, options = {}) {
  const { disableBackgroundScroll = false } = options;

  useEffect(() => {
    if (!locked || typeof document === "undefined") return undefined;
    if (!disableBackgroundScroll) return undefined;

    const { body } = document;
    const scrollbarGap = window.innerWidth - document.documentElement.clientWidth;
    const previousOverflow = body.style.overflow;
    const previousPaddingRight = body.style.paddingRight;

    body.style.overflow = "hidden";
    if (scrollbarGap > 0) {
      body.style.paddingRight = `${scrollbarGap}px`;
    }

    return () => {
      body.style.overflow = previousOverflow;
      body.style.paddingRight = previousPaddingRight;
    };
  }, [locked, disableBackgroundScroll]);
}
