"use client";

import dynamic from "next/dynamic";

const DevNavRecorder = dynamic(() => import("./DevNavRecorder"), {
  ssr: false,
  loading: () => null,
});

export default function DevOnlyNavRecorderLoader() {
  if (process.env.NODE_ENV === "production") return null;
  if (process.env.NEXT_PUBLIC_DEV_NAV_RECORDER !== "1") return null;
  return <DevNavRecorder />;
}
