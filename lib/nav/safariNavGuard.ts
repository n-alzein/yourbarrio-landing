import { isSafariDesktop, layersDebugEnabled } from "@/lib/safariLayers";

let navGuardTimer: ReturnType<typeof setTimeout> | null = null;
const NAV_CLASS = "nav-in-progress";

function isPerfEnabled() {
  return layersDebugEnabled();
}

function addNavClass() {
  if (typeof document === "undefined") return;
  document.documentElement.classList.add(NAV_CLASS);
}

function removeNavClass() {
  if (typeof document === "undefined") return;
  document.documentElement.classList.remove(NAV_CLASS);
}

export function markNavInProgress(href?: string | null) {
  if (!isSafariDesktop()) return;
  addNavClass();
  if (navGuardTimer) clearTimeout(navGuardTimer);
  navGuardTimer = setTimeout(() => {
    removeNavClass();
    navGuardTimer = null;
  }, 1500);

  if (isPerfEnabled() && typeof window !== "undefined") {
    try {
      const payload = { t: Date.now(), href: href || null };
      window.sessionStorage.setItem("yb-nav-intent", JSON.stringify(payload));
      console.log("[NAV_GUARD] intent", payload);
    } catch {
      // best effort
    }
  }
}

function isInternalHref(href: string) {
  if (!href) return false;
  if (href.startsWith("/")) return true;
  try {
    const url = new URL(href, window.location.href);
    return url.origin === window.location.origin;
  } catch {
    return false;
  }
}

function shouldHandleAnchor(anchor: HTMLAnchorElement) {
  if (!anchor) return false;
  if (anchor.hasAttribute("download")) return false;
  const target = anchor.getAttribute("target");
  if (target && target !== "_self") return false;
  const rel = anchor.getAttribute("rel") || "";
  if (rel.includes("external")) return false;
  const href = anchor.getAttribute("href") || "";
  return isInternalHref(href);
}

export function installSafariNavGuard() {
  if (typeof document === "undefined") return () => {};
  if (!isSafariDesktop()) return () => {};

  const handler = (event: Event) => {
    const target = event.target as HTMLElement | null;
    const anchor = target?.closest?.("a[href]") as HTMLAnchorElement | null;
    if (!anchor || !shouldHandleAnchor(anchor)) return;
    markNavInProgress(anchor.getAttribute("href"));
  };

  document.addEventListener("pointerdown", handler, true);
  document.addEventListener("click", handler, true);

  return () => {
    document.removeEventListener("pointerdown", handler, true);
    document.removeEventListener("click", handler, true);
  };
}

export function checkNavIntentOnLoad() {
  if (!isPerfEnabled() || typeof window === "undefined") return;
  try {
    const raw = window.sessionStorage.getItem("yb-nav-intent");
    if (!raw) return;
    window.sessionStorage.removeItem("yb-nav-intent");
    const payload = JSON.parse(raw);
    console.log("[NAV_GUARD] load", {
      ...payload,
      reloadedAt: Date.now(),
    });
  } catch {
    // best effort
  }
}
