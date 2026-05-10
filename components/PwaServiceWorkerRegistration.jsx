"use client";

import { useEffect } from "react";

const ENABLE_DEV_SERVICE_WORKER =
  process.env.NEXT_PUBLIC_ENABLE_PWA_SW_DEV === "1";

export default function PwaServiceWorkerRegistration() {
  useEffect(() => {
    const isProduction = process.env.NODE_ENV === "production";

    if (!isProduction && !ENABLE_DEV_SERVICE_WORKER) {
      return;
    }

    if (!("serviceWorker" in navigator)) {
      return;
    }

    const registerServiceWorker = () => {
      navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch((error) => {
        if (!isProduction) {
          console.warn("[PWA] Service worker registration failed", error);
        }
      });
    };

    if (document.readyState === "complete") {
      registerServiceWorker();
      return;
    }

    window.addEventListener("load", registerServiceWorker, { once: true });

    return () => {
      window.removeEventListener("load", registerServiceWorker);
    };
  }, []);

  return null;
}
