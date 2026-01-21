"use client";

import { useReportWebVitals } from "next/web-vitals";
import { reportWebVitals } from "@/lib/webVitals";

export default function WebVitalsReporter() {
  useReportWebVitals((metric) => {
    reportWebVitals(metric);
  });
  return null;
}

