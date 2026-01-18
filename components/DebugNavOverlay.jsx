"use client";

import { useEffect, useState } from "react";
import { clearDebugLog, debugNavEnabled, getDebugLog } from "@/lib/debugNav";

function DebugNavOverlayInner() {
  const [events, setEvents] = useState(() => getDebugLog());

  useEffect(() => {
    const interval = setInterval(() => {
      setEvents(getDebugLog());
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  const last = events.slice(-10);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(JSON.stringify(events, null, 2));
    } catch (err) {
      console.warn("Copy failed", err);
    }
  };

  const handleClear = () => {
    clearDebugLog();
    setEvents([]);
  };

  return (
    <div
      style={{
        position: "fixed",
        bottom: 12,
        right: 12,
        width: 320,
        maxHeight: "40vh",
        overflow: "auto",
        background: "rgba(0,0,0,0.75)",
        color: "#f8fafc",
        fontFamily: "Menlo, monospace",
        fontSize: 11,
        padding: 10,
        borderRadius: 8,
        zIndex: 9999,
        boxShadow: "0 4px 12px rgba(0,0,0,0.3)",
        pointerEvents: "auto",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
        <div style={{ fontWeight: 700 }}>DEBUG_NAV=1</div>
        <div style={{ display: "flex", gap: 6 }}>
          <button
            onClick={handleCopy}
            style={{
              background: "#0ea5e9",
              color: "#0b1120",
              border: "none",
              borderRadius: 4,
              padding: "2px 6px",
              cursor: "pointer",
              fontSize: 10,
            }}
          >
            Copy
          </button>
          <button
            onClick={handleClear}
            style={{
              background: "#f87171",
              color: "#0b1120",
              border: "none",
              borderRadius: 4,
              padding: "2px 6px",
              cursor: "pointer",
              fontSize: 10,
            }}
          >
            Clear
          </button>
        </div>
      </div>
      {last.length === 0 ? (
        <div style={{ opacity: 0.6 }}>No events yet</div>
      ) : (
        last.map((e, idx) => (
          <div
            key={`${e.ts}-${idx}`}
            style={{
              borderTop: "1px solid rgba(255,255,255,0.08)",
              paddingTop: 4,
              marginTop: 4,
            }}
          >
            <div style={{ opacity: 0.8 }}>
              {new Date(e.ts).toLocaleTimeString()} · {e.type} · {e.msg}
            </div>
            <div style={{ whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
              {JSON.stringify(e.data || {}, null, 2)}
            </div>
            <div style={{ opacity: 0.6 }}>@ {e.href}</div>
          </div>
        ))
      )}
    </div>
  );
}

export default function DebugNavOverlay() {
  const enabled = debugNavEnabled();
  if (!enabled) return null;
  return <DebugNavOverlayInner />;
}
