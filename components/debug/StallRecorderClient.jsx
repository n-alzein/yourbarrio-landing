"use client";

import { useEffect } from "react";
import { startStallRecorder, stopStallRecorder } from "@/lib/stallRecorder";

export default function StallRecorderClient() {
  useEffect(() => {
    startStallRecorder();
    return () => stopStallRecorder();
  }, []);

  return null;
}
