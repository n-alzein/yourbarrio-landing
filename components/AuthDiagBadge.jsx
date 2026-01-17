"use client";

import { useEffect, useState } from "react";
import {
  authDiagEnabled,
  getAuthDiagSnapshot,
  initAuthDiagnostics,
  subscribeAuthDiag,
} from "@/lib/authDiagnostics";

const initialSnapshot = {
  total: 0,
  endpoints: { token: 0, user: 0, other: 0 },
};

export default function AuthDiagBadge() {
  const enabled = authDiagEnabled();
  const [snapshot, setSnapshot] = useState(initialSnapshot);

  useEffect(() => {
    if (!enabled) return;
    initAuthDiagnostics();
    setSnapshot(getAuthDiagSnapshot());
    const unsubscribe = subscribeAuthDiag(setSnapshot);
    return () => unsubscribe();
  }, [enabled]);

  if (!enabled) return null;

  return (
    <div
      style={{
        position: "fixed",
        bottom: 12,
        left: 12,
        background: "rgba(15, 23, 42, 0.85)",
        color: "#e2e8f0",
        fontFamily: "Menlo, monospace",
        fontSize: 11,
        padding: "8px 10px",
        borderRadius: 8,
        zIndex: 9999,
        boxShadow: "0 4px 12px rgba(0,0,0,0.3)",
        pointerEvents: "none",
      }}
    >
      <div style={{ fontWeight: 700, marginBottom: 4 }}>AUTH_DIAG=1</div>
      <div>Total: {snapshot.total}</div>
      <div>
        /token: {snapshot.endpoints.token} · /user:{" "}
        {snapshot.endpoints.user} · other: {snapshot.endpoints.other}
      </div>
    </div>
  );
}
