"use client";

import { useAuth } from "@/components/AuthProvider";

const enabled = () => process.env.NEXT_PUBLIC_CLICK_DIAG === "1";

export default function HomeStateBadge({ listingsCount = 0, ybCount = 0, selectedBusinessId = null, mapReady = false }) {
  const { user, profile, loadingUser } = useAuth();
  if (!enabled()) return null;

  return (
    <div
      style={{
        position: "fixed",
        top: 12,
        left: 12,
        zIndex: 5000,
        background: "rgba(0,0,0,0.7)",
        color: "white",
        padding: "8px 10px",
        borderRadius: "10px",
        fontSize: "11px",
        lineHeight: 1.4,
        pointerEvents: "none",
      }}
    >
      <div>AUTH: {loadingUser ? "loading" : user ? "yes" : "none"}</div>
      <div>ROLE: {profile?.role || "n/a"}</div>
      <div>Listings: {listingsCount}</div>
      <div>YB: {ybCount}</div>
      <div>Map: {mapReady ? "ready" : "pending"}</div>
      <div>Selected: {selectedBusinessId || "none"}</div>
    </div>
  );
}
