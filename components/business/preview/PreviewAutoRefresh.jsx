"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function PreviewAutoRefresh({ businessId }) {
  const router = useRouter();

  useEffect(() => {
    if (!businessId || typeof window === "undefined") return undefined;

    const handleRefresh = (payload) => {
      if (payload?.businessId !== businessId) return;
      router.refresh();
    };

    const handleStorage = (event) => {
      if (event.key !== "yb_preview_update" || !event.newValue) return;
      try {
        const parsed = JSON.parse(event.newValue);
        handleRefresh(parsed);
      } catch {}
    };

    let channel = null;
    if (typeof BroadcastChannel !== "undefined") {
      channel = new BroadcastChannel("yb-business-preview");
      channel.onmessage = (event) => handleRefresh(event?.data);
    }

    window.addEventListener("storage", handleStorage);

    return () => {
      window.removeEventListener("storage", handleStorage);
      if (channel) channel.close();
    };
  }, [businessId, router]);

  return null;
}
