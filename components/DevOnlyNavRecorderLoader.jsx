"use client";

import dynamic from "next/dynamic";

const DevNavRecorder = dynamic(() => import("./DevNavRecorder"), {
  ssr: false,
  loading: () => null,
});

export default function DevOnlyNavRecorderLoader() {
  if (process.env.NODE_ENV === "production") return null;
  return <DevNavRecorder />;
}
