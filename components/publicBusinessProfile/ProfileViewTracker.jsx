"use client";

import { useEffect, useRef } from "react";

export default function ProfileViewTracker({ businessId }) {
  const sentRef = useRef(false);

  useEffect(() => {
    if (!businessId || sentRef.current) return;
    sentRef.current = true;

    fetch("/api/business/views", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ businessId }),
      keepalive: true,
    }).catch(() => {});
  }, [businessId]);

  return null;
}
