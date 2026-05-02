"use client";

import { useEffect, useRef, useState } from "react";

const DEBUG_PARAM = "yb-gap-debug";
const OUTLINE_ATTR = "data-yb-gap-debug-outline";

function isIPhone() {
  if (typeof navigator === "undefined") return false;
  return /iPhone|iPod/i.test(navigator.userAgent || "");
}

function isDebugUrl() {
  if (typeof window === "undefined") return false;
  if (window.location.pathname !== "/") return false;
  return new URLSearchParams(window.location.search).get(DEBUG_PARAM) === "1";
}

function rectFor(element) {
  if (!element) return null;
  const rect = element.getBoundingClientRect();
  return {
    top: Number(rect.top.toFixed(2)),
    bottom: Number(rect.bottom.toFixed(2)),
    left: Number(rect.left.toFixed(2)),
    right: Number(rect.right.toFixed(2)),
    width: Number(rect.width.toFixed(2)),
    height: Number(rect.height.toFixed(2)),
  };
}

function classNameFor(element) {
  if (!element) return null;
  return typeof element.className === "string"
    ? element.className
    : String(element.getAttribute("class") || "");
}

function styleFor(element) {
  if (!element) return null;
  const style = window.getComputedStyle(element);
  return {
    tag: element.tagName,
    id: element.id || "",
    className: classNameFor(element) || "",
    testId: element.getAttribute?.("data-testid") || "",
    backgroundColor: style.backgroundColor,
    display: style.display,
    position: style.position,
    top: style.top,
    height: style.height,
    paddingTop: style.paddingTop,
    paddingBottom: style.paddingBottom,
    marginTop: style.marginTop,
    marginBottom: style.marginBottom,
    transform: style.transform,
    overflow: style.overflow,
    zIndex: style.zIndex,
  };
}

function parentChainFor(element) {
  const chain = [];
  let current = element;
  while (current && chain.length < 8) {
    chain.push({
      tag: current.tagName,
      id: current.id || "",
      className: classNameFor(current) || "",
      testId: current.getAttribute?.("data-testid") || "",
      rect: rectFor(current),
      style: styleFor(current),
    });
    current = current.parentElement;
  }
  return chain;
}

function getVars() {
  const rootStyle = window.getComputedStyle(document.documentElement);
  return {
    ybNavH: rootStyle.getPropertyValue("--yb-nav-h").trim(),
    ybNavContentOffset: rootStyle.getPropertyValue("--yb-nav-content-offset").trim(),
    ybNavLayoutH: rootStyle.getPropertyValue("--yb-nav-layout-h").trim(),
  };
}

function getViewport() {
  return {
    innerWidth: window.innerWidth,
    innerHeight: window.innerHeight,
    scrollY: Number(window.scrollY.toFixed(2)),
    visualViewport: window.visualViewport
      ? {
          width: Number(window.visualViewport.width.toFixed(2)),
          height: Number(window.visualViewport.height.toFixed(2)),
          offsetTop: Number(window.visualViewport.offsetTop.toFixed(2)),
          offsetLeft: Number(window.visualViewport.offsetLeft.toFixed(2)),
          pageTop: Number(window.visualViewport.pageTop.toFixed(2)),
          scale: window.visualViewport.scale,
        }
      : null,
  };
}

function collectDiagnostics() {
  const navbar = document.querySelector("nav.yb-navbar");
  const main = document.querySelector("[data-app-shell-main='1']");
  const publicShell = document.querySelector("[data-testid='public-shell-content']");
  const heroWrapper = document.querySelector("[data-home-hero-wrapper='1']");
  const hero = document.querySelector("[data-testid='home-hero']");

  const navbarRect = rectFor(navbar);
  const heroRect = rectFor(hero);
  const gap = navbarRect && heroRect ? Number((heroRect.top - navbarRect.bottom).toFixed(2)) : null;
  const sampleX = Math.max(0, Math.floor(window.innerWidth / 2));
  const sampleY =
    navbarRect && heroRect && gap && gap > 0
      ? Math.floor(navbarRect.bottom + Math.max(1, Math.min(gap - 1, gap / 2)))
      : Math.floor((navbarRect?.bottom || 0) + 4);
  const gapElement = document.elementFromPoint(sampleX, sampleY);

  return {
    timestamp: new Date().toISOString(),
    href: window.location.href,
    viewport: getViewport(),
    vars: getVars(),
    samplePoint: { x: sampleX, y: sampleY },
    gap,
    rects: {
      navbar: navbarRect,
      main: rectFor(main),
      publicShell: rectFor(publicShell),
      heroWrapper: rectFor(heroWrapper),
      hero: heroRect,
    },
    styles: {
      navbar: styleFor(navbar),
      main: styleFor(main),
      publicShell: styleFor(publicShell),
      heroWrapper: styleFor(heroWrapper),
      hero: styleFor(hero),
      gapElement: styleFor(gapElement),
    },
    gapElementParentChain: parentChainFor(gapElement),
  };
}

function setOutline(element, color, label, previous) {
  if (!element) return;
  if (!previous.has(element)) {
    previous.set(element, {
      outline: element.style.outline,
      outlineOffset: element.style.outlineOffset,
    });
  }
  element.style.outline = `3px solid ${color}`;
  element.style.outlineOffset = "-3px";
  element.setAttribute(OUTLINE_ATTR, label);
}

function clearOutlines(previous) {
  previous.forEach((style, element) => {
    element.style.outline = style.outline;
    element.style.outlineOffset = style.outlineOffset;
    element.removeAttribute(OUTLINE_ATTR);
  });
  previous.clear();
}

function applyOutlines(diagnostics, previous) {
  clearOutlines(previous);
  setOutline(document.querySelector("nav.yb-navbar"), "#ef4444", "navbar", previous);
  setOutline(document.querySelector("[data-app-shell-main='1']"), "#2563eb", "main", previous);
  setOutline(document.querySelector("[data-testid='public-shell-content']"), "#2563eb", "public-shell", previous);
  setOutline(document.querySelector("[data-home-hero-wrapper='1']"), "#22c55e", "hero-wrapper", previous);
  setOutline(document.querySelector("[data-testid='home-hero']"), "#16a34a", "hero", previous);
  const point = diagnostics?.samplePoint;
  const gapElement = point ? document.elementFromPoint(point.x, point.y) : null;
  setOutline(gapElement, "#f97316", "gap-element", previous);
}

export default function HomeGapDebugOverlay() {
  const [diagnostics, setDiagnostics] = useState(null);
  const [copyStatus, setCopyStatus] = useState("");
  const previousOutlinesRef = useRef(new Map());

  useEffect(() => {
    const enabled = isDebugUrl() && isIPhone();
    if (!enabled) {
      clearOutlines(previousOutlinesRef.current);
      return undefined;
    }

    const previousOutlines = previousOutlinesRef.current;
    let rafId = 0;
    const update = () => {
      cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(() => {
        const next = collectDiagnostics();
        setDiagnostics(next);
        applyOutlines(next, previousOutlines);
      });
    };

    update();
    const intervalId = window.setInterval(update, 750);
    window.addEventListener("pageshow", update);
    window.addEventListener("popstate", update);
    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, { passive: true });
    window.visualViewport?.addEventListener("resize", update);
    window.visualViewport?.addEventListener("scroll", update);

    return () => {
      cancelAnimationFrame(rafId);
      window.clearInterval(intervalId);
      window.removeEventListener("pageshow", update);
      window.removeEventListener("popstate", update);
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", update);
      window.visualViewport?.removeEventListener("resize", update);
      window.visualViewport?.removeEventListener("scroll", update);
      clearOutlines(previousOutlines);
    };
  }, []);

  if (!diagnostics) return null;

  const gapElement = diagnostics.styles.gapElement;
  const copyDiagnostics = async () => {
    const text = JSON.stringify(diagnostics, null, 2);
    try {
      await navigator.clipboard.writeText(text);
      setCopyStatus("Copied");
    } catch {
      setCopyStatus("Copy failed");
    }
    window.setTimeout(() => setCopyStatus(""), 1800);
  };

  return (
    <div
      data-testid="home-gap-debug-overlay"
      style={{
        position: "fixed",
        left: 8,
        right: 8,
        bottom: 8,
        zIndex: 99999,
        maxHeight: "48vh",
        overflow: "auto",
        border: "1px solid rgba(255,255,255,0.22)",
        borderRadius: 8,
        background: "rgba(15,23,42,0.94)",
        color: "#f8fafc",
        fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
        fontSize: 11,
        lineHeight: 1.35,
        padding: 10,
        boxShadow: "0 18px 42px rgba(0,0,0,0.35)",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
        <strong>YB gap debug</strong>
        <button
          type="button"
          onClick={copyDiagnostics}
          style={{
            border: "1px solid rgba(255,255,255,0.28)",
            borderRadius: 6,
            background: "#ffffff",
            color: "#0f172a",
            padding: "4px 7px",
            fontSize: 11,
            fontWeight: 700,
          }}
        >
          Copy diagnostics
        </button>
      </div>
      {copyStatus ? <div style={{ marginTop: 4, color: "#bbf7d0" }}>{copyStatus}</div> : null}
      <div style={{ marginTop: 8 }}>
        <div>navbar bottom: {diagnostics.rects.navbar?.bottom ?? "n/a"}</div>
        <div>hero top: {diagnostics.rects.hero?.top ?? "n/a"}</div>
        <div>gap: {diagnostics.gap ?? "n/a"}</div>
        <div>scrollY: {diagnostics.viewport.scrollY}</div>
        <div>--yb-nav-h: {diagnostics.vars.ybNavH || "unset"}</div>
        <div>--yb-nav-content-offset: {diagnostics.vars.ybNavContentOffset || "unset"}</div>
        <div>
          visualViewport:{" "}
          {diagnostics.viewport.visualViewport
            ? `h=${diagnostics.viewport.visualViewport.height} offsetTop=${diagnostics.viewport.visualViewport.offsetTop}`
            : "n/a"}
        </div>
      </div>
      <div style={{ marginTop: 8, color: "#fed7aa" }}>
        <div>
          elementFromPoint: {gapElement?.tag || "n/a"}
          {gapElement?.id ? `#${gapElement.id}` : ""}
        </div>
        <div>class: {gapElement?.className || "(none)"}</div>
        <div>bg: {gapElement?.backgroundColor || "n/a"}</div>
        <div>
          box: h={gapElement?.height || "n/a"} pt={gapElement?.paddingTop || "n/a"} mt=
          {gapElement?.marginTop || "n/a"}
        </div>
        <div>
          pos: {gapElement?.position || "n/a"} top={gapElement?.top || "n/a"} transform=
          {gapElement?.transform || "n/a"}
        </div>
      </div>
      <div style={{ marginTop: 8, color: "#bfdbfe" }}>
        outlines: red navbar, blue shell/main, green hero, orange detected element
      </div>
    </div>
  );
}
