"use client";

/**
 * Opens the business auth route in a popup tab and appends ?popup=1 so that
 * the auth page knows to close itself after a successful login/signup.
 */
export function openBusinessAuthPopup(path) {
  if (typeof window === "undefined") return;

  const separator = path.includes("?") ? "&" : "?";
  const targetUrl = `${path}${separator}popup=1`;
  const origin = window.location.origin;

  const handleMessage = (event) => {
    if (event.origin !== origin) return;
    const data = event.data;
    if (!data || data.type !== "YB_BUSINESS_AUTH_SUCCESS") return;
    clearTimeout(cleanupTimer);
    window.removeEventListener("message", handleMessage);
    if (data.target) {
      window.location.assign(data.target);
    } else {
      window.location.reload();
    }
  };
  window.addEventListener("message", handleMessage);
  const cleanupTimer = setTimeout(() => {
    window.removeEventListener("message", handleMessage);
  }, 2 * 60 * 1000);

  const popup = window.open(targetUrl, "_blank");

  // Popup blockers shouldn't trigger because this runs inside a user action,
  // but fall back to same-tab navigation if it does.
  if (!popup) {
    clearTimeout(cleanupTimer);
    window.removeEventListener("message", handleMessage);
    window.location.href = targetUrl;
    return;
  }

  popup.focus();
}
