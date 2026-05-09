"use client";

import { useLayoutEffect } from "react";
import { usePathname } from "next/navigation";
import NoticeBannerHost from "@/components/common/NoticeBannerHost";

const STALE_PUBLIC_BANNER_HEIGHT_VARS = [
  "--beta-banner-height",
  "--yb-announcement-height",
  "--yb-platform-announcement-height",
  "--yb-notice-banner-height",
  "--public-announcement-height",
  "--public-route-announcement-height",
];

function resetPublicBannerOffsets() {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  STALE_PUBLIC_BANNER_HEIGHT_VARS.forEach((name) => {
    root.style.setProperty(name, "0px");
  });
}

export default function PublicRouteShell({
  children = null,
  className = "",
  gap = "none",
}) {
  const pathname = usePathname() || "/";
  const showNoticeBanner = !(pathname === "/b" || pathname.startsWith("/b/"));
  const offsetGap =
    gap === "none"
      ? "0px"
      : gap === "compact"
      ? "clamp(8px, 1.5vw, 12px)"
      : "clamp(16px, 2vw, 24px)";

  const lightThemeVars = {
    "--bg-solid": "#ffffff",
    "--bg-gradient-start": "#f7f7f8",
    "--bg-gradient-end": "#eef2ff",
    "--glow-1": "rgba(79, 70, 229, 0.1)",
    "--glow-2": "rgba(14, 165, 233, 0.08)",
    "--public-nav-offset": "max(81px, var(--yb-nav-content-offset, 81px))",
    "--public-shell-gap": offsetGap,
  };

  useLayoutEffect(() => {
    if (showNoticeBanner) return undefined;
    resetPublicBannerOffsets();
    return resetPublicBannerOffsets;
  }, [showNoticeBanner, pathname]);

  return (
    <div
      className={`public-shell-content min-h-screen bg-[var(--yb-bg)] text-[var(--yb-text)]${className ? ` ${className}` : ""}`}
      data-testid="public-shell-content"
      data-theme="light"
      data-route-theme="light"
      data-shell-gap={gap}
      style={{
        ...lightThemeVars,
        paddingTop: "var(--public-nav-offset)",
      }}
    >
      {showNoticeBanner ? <NoticeBannerHost audience="all" /> : null}
      <div style={{ paddingTop: "var(--public-shell-gap)" }}>{children}</div>
    </div>
  );
}
