"use client";

import { useEffect, useRef } from "react";

export default function useBodyScrollLock(locked) {
  const lockRef = useRef(null);

  useEffect(() => {
    if (!locked || typeof document === "undefined") return undefined;

    const { body, documentElement } = document;
    const scrollY = window.scrollY || window.pageYOffset;
    const scrollbarGap = window.innerWidth - documentElement.clientWidth;

    lockRef.current = {
      scrollY,
      href: window.location.href,
      bodyStyles: {
        position: body.style.position,
        top: body.style.top,
        left: body.style.left,
        right: body.style.right,
        width: body.style.width,
        overflow: body.style.overflow,
        paddingRight: body.style.paddingRight,
      },
      htmlOverflow: documentElement.style.overflow,
    };

    body.style.position = "fixed";
    body.style.top = `-${scrollY}px`;
    body.style.left = "0";
    body.style.right = "0";
    body.style.width = "100%";
    body.style.overflow = "hidden";
    if (scrollbarGap > 0) {
      body.style.paddingRight = `${scrollbarGap}px`;
    }
    documentElement.style.overflow = "hidden";

    return () => {
      const lock = lockRef.current;
      if (!lock) return;
      const hasNavigated =
        typeof window !== "undefined" &&
        lock.href &&
        window.location.href !== lock.href;
      body.style.position = lock.bodyStyles.position;
      body.style.top = lock.bodyStyles.top;
      body.style.left = lock.bodyStyles.left;
      body.style.right = lock.bodyStyles.right;
      body.style.width = lock.bodyStyles.width;
      body.style.overflow = lock.bodyStyles.overflow;
      body.style.paddingRight = lock.bodyStyles.paddingRight;
      documentElement.style.overflow = lock.htmlOverflow;
      if (!hasNavigated) {
        window.scrollTo(0, lock.scrollY);
      }
      lockRef.current = null;
    };
  }, [locked]);
}
