export function isSafariDesktop() {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent || "";
  const isSafari =
    ua.includes("Safari") &&
    !ua.includes("Chrome") &&
    !ua.includes("Chromium") &&
    !ua.includes("Android");
  const isIOS = /iPhone|iPad|iPod/i.test(ua);
  return isSafari && !isIOS;
}

export function layersDebugEnabled() {
  if (typeof window === "undefined") return false;
  try {
    const params = new URLSearchParams(window.location.search);
    if (params.get("perf") === "1") return true;
  } catch {
    // best effort
  }
  try {
    return window.localStorage?.getItem("PERF_DEBUG") === "1";
  } catch {
    return false;
  }
}
