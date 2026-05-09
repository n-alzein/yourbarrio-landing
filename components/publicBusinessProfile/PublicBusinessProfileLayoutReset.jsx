"use client";

import { useLayoutEffect } from "react";

const STALE_BANNER_HEIGHT_VARS = [
  "--beta-banner-height",
  "--yb-announcement-height",
  "--yb-platform-announcement-height",
  "--yb-notice-banner-height",
  "--public-announcement-height",
  "--public-route-announcement-height",
  "--business-beta-banner-height",
];

function resetProfileBannerOffsets() {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  STALE_BANNER_HEIGHT_VARS.forEach((name) => {
    root.style.setProperty(name, "0px");
  });
}

export default function PublicBusinessProfileLayoutReset() {
  useLayoutEffect(() => {
    resetProfileBannerOffsets();
    return () => {
      resetProfileBannerOffsets();
    };
  }, []);

  return null;
}
