"use client";

import { useEffect } from "react";
import { checkNavIntentOnLoad, installSafariNavGuard } from "@/lib/nav/safariNavGuard";

export default function SafariNavGuardClient() {
  useEffect(() => {
    checkNavIntentOnLoad();
    const cleanup = installSafariNavGuard();
    return () => cleanup?.();
  }, []);

  return null;
}
