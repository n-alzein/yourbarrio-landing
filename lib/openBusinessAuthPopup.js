"use client";

/**
 * Opens the business auth route in a popup tab and appends ?popup=1 so that
 * the auth page knows to close itself after a successful login/signup.
 */
export function openBusinessAuthPopup(path) {
  if (typeof window === "undefined") return;

  const separator = path.includes("?") ? "&" : "?";
  const targetUrl = `${path}${separator}popup=1`;

  const popup = window.open(targetUrl, "_blank");

  // Popup blockers shouldn't trigger because this runs inside a user action,
  // but fall back to same-tab navigation if it does.
  if (!popup) {
    window.location.href = targetUrl;
    return;
  }

  popup.focus();
}
