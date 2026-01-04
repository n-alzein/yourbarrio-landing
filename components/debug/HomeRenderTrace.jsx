"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { useAuth } from "@/components/AuthProvider";

const diagEnabled = () => process.env.NEXT_PUBLIC_CLICK_DIAG === "1";

export default function HomeRenderTrace({ blocker }) {
  const pathname = usePathname();
  const { authUser, user: profile, role, loadingUser } = useAuth();

  const enabled = diagEnabled();
  const ts = Date.now();

  if (enabled) {
    // eslint-disable-next-line no-console
    console.log("[HOME_TRACE] render", {
      ts,
      pathname,
      blocker,
      loadingUser,
      hasUser: !!authUser,
      hasProfile: !!profile,
      role: role || profile?.role || authUser?.role || authUser?.user_metadata?.role || null,
    });
    if (typeof window !== "undefined") {
      window.__HOME_RENDERED__ = { ts, blocker };
    }
  }

  useEffect(() => {
    if (!enabled || typeof document === "undefined") return undefined;
    const main = document.querySelector("main");
    if (!main) return undefined;
    try {
      const styles = window.getComputedStyle(main);
      const rect = main.getBoundingClientRect();
      // eslint-disable-next-line no-console
      console.log("[HOME_TRACE] mainStyle", {
        display: styles.display,
        visibility: styles.visibility,
        opacity: styles.opacity,
      });
      // eslint-disable-next-line no-console
      console.log("[HOME_TRACE] mainRect", {
        width: rect.width,
        height: rect.height,
        top: rect.top,
        left: rect.left,
      });
    } catch {
      /* ignore */
    }
    return undefined;
  }, [enabled]);

  if (!enabled) return null;

  return (
    <div
      style={{
        position: "fixed",
        bottom: 12,
        left: 12,
        zIndex: 6000,
        background: "rgba(0,0,0,0.75)",
        color: "white",
        padding: "6px 10px",
        borderRadius: "10px",
        fontSize: "11px",
        lineHeight: 1.4,
        pointerEvents: "none",
      }}
    >
      {blocker ? `BLOCKED: ${blocker}` : "HOME OK"}
    </div>
  );
}
