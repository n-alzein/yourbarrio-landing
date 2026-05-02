"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

const DEBUG_KEY = "yb-home-gap-debug";

function rectFor(element) {
  if (!element) return null;
  const rect = element.getBoundingClientRect();
  return {
    top: rect.top,
    bottom: rect.bottom,
    height: rect.height,
    left: rect.left,
    width: rect.width,
  };
}

function styleFor(element) {
  if (!element) return null;
  const style = window.getComputedStyle(element);
  return {
    display: style.display,
    position: style.position,
    paddingTop: style.paddingTop,
    marginTop: style.marginTop,
    top: style.top,
    transform: style.transform,
    backgroundColor: style.backgroundColor,
  };
}

function isDebugEnabled() {
  if (new URLSearchParams(window.location.search).get(DEBUG_KEY) === "1") return true;
  try {
    return window.localStorage?.getItem(DEBUG_KEY) === "1";
  } catch {
    return false;
  }
}

function collectHomeGapDiagnostics(reason) {
  const nav = document.querySelector("nav.yb-navbar");
  const main = document.querySelector("[data-app-shell-main='1']");
  const publicShell = document.querySelector("[data-testid='public-shell-content']");
  const heroWrapper = document.querySelector("[data-home-hero-wrapper='1']");
  const hero = document.querySelector("[data-testid='home-hero']");
  const navRect = rectFor(nav);
  const heroRect = rectFor(hero);
  const midpointX = Math.max(0, Math.floor(window.innerWidth / 2));
  const sampleStart = Math.max(0, Math.floor(navRect?.bottom || 0));
  const sampleEnd = Math.max(sampleStart, Math.floor(heroRect?.top || sampleStart));
  const samples = [];

  for (let y = sampleStart; y <= sampleEnd; y += Math.max(1, Math.ceil((sampleEnd - sampleStart) / 6))) {
    const element = document.elementFromPoint(midpointX, y);
    samples.push({
      y,
      tag: element?.tagName || null,
      id: element?.id || null,
      className: String(element?.className || ""),
      testId: element?.getAttribute?.("data-testid") || null,
      backgroundColor: element ? window.getComputedStyle(element).backgroundColor : null,
    });
  }

  return {
    reason,
    href: window.location.href,
    scrollY: window.scrollY,
    viewport: {
      innerWidth: window.innerWidth,
      innerHeight: window.innerHeight,
      visualViewport: window.visualViewport
        ? {
            width: window.visualViewport.width,
            height: window.visualViewport.height,
            offsetTop: window.visualViewport.offsetTop,
            pageTop: window.visualViewport.pageTop,
            scale: window.visualViewport.scale,
          }
        : null,
    },
    vars: {
      ybNavH: window.getComputedStyle(document.documentElement).getPropertyValue("--yb-nav-h"),
      ybNavContentOffset: window
        .getComputedStyle(document.documentElement)
        .getPropertyValue("--yb-nav-content-offset"),
      ybHomeNavClearance: window
        .getComputedStyle(document.documentElement)
        .getPropertyValue("--yb-home-nav-clearance"),
    },
    rects: {
      nav: navRect,
      main: rectFor(main),
      publicShell: rectFor(publicShell),
      heroWrapper: rectFor(heroWrapper),
      hero: heroRect,
    },
    styles: {
      nav: styleFor(nav),
      main: styleFor(main),
      publicShell: styleFor(publicShell),
      heroWrapper: styleFor(heroWrapper),
      hero: styleFor(hero),
    },
    gapPx: navRect && heroRect ? heroRect.top - navRect.bottom : null,
    samples,
  };
}

export default function HomeNavClearanceClient() {
  const pathname = usePathname();

  useEffect(() => {
    if (pathname !== "/" || typeof window === "undefined") return undefined;

    let frameId = 0;
    const debug = isDebugEnabled();

    const measure = (reason) => {
      if (frameId) cancelAnimationFrame(frameId);
      frameId = requestAnimationFrame(() => {
        frameId = 0;
        const nav = document.querySelector("nav.yb-navbar");
        if (!nav) return;
        const rect = nav.getBoundingClientRect();
        const clearance = Math.max(0, Math.round(rect.bottom));
        document.documentElement.style.setProperty("--yb-home-nav-clearance", `${clearance}px`);

        if (debug) {
          const payload = collectHomeGapDiagnostics(reason);
          window.__ybHomeGapDiagnostics = payload;
          console.info("[YB_HOME_GAP]", payload);
        }
      });
    };

    measure("mount");

    const onPageShow = (event) => measure(event?.persisted ? "pageshow.persisted" : "pageshow");
    const onFocus = () => measure("focus");
    const onResize = () => measure("resize");
    const onScroll = () => measure("scroll");

    window.addEventListener("pageshow", onPageShow);
    window.addEventListener("focus", onFocus);
    window.addEventListener("resize", onResize);
    window.addEventListener("scroll", onScroll, { passive: true });
    window.visualViewport?.addEventListener("resize", onResize);
    window.visualViewport?.addEventListener("scroll", onScroll);

    const timeoutIds = [60, 250, 750].map((delay) =>
      window.setTimeout(() => measure(`settle.${delay}`), delay)
    );

    return () => {
      if (frameId) cancelAnimationFrame(frameId);
      timeoutIds.forEach((id) => window.clearTimeout(id));
      window.removeEventListener("pageshow", onPageShow);
      window.removeEventListener("focus", onFocus);
      window.removeEventListener("resize", onResize);
      window.removeEventListener("scroll", onScroll);
      window.visualViewport?.removeEventListener("resize", onResize);
      window.visualViewport?.removeEventListener("scroll", onScroll);
    };
  }, [pathname]);

  return null;
}
