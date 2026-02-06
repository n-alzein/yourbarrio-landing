import "server-only";
import { headers, cookies } from "next/headers";

export function perfTimingEnabled() {
  try {
    const perfHeader = headers().get("x-perf");
    if (perfHeader === "1") return true;
  } catch {
    // best effort
  }
  try {
    const perfCookie = cookies().get("yb-perf");
    if (perfCookie?.value === "1") return true;
  } catch {
    // best effort
  }
  return false;
}

export function createServerTiming(labelPrefix = "") {
  const timings = [];
  const start = () => performance.now();
  const end = (name, startedAt) => {
    const duration = performance.now() - startedAt;
    timings.push({ name: `${labelPrefix}${name}`, duration });
    return duration;
  };
  const header = () =>
    timings
      .map((item) => `${item.name};dur=${Math.round(item.duration)}`)
      .join(", ");
  return { start, end, header, timings };
}

export function logServerTiming(label, payload = {}) {
  if (!perfTimingEnabled()) return;
  try {
    const path = headers().get("x-perf-path") || headers().get("x-mw-path");
    console.log("[SSR_TIMING]", { label, path, ...payload });
  } catch {
    console.log("[SSR_TIMING]", { label, ...payload });
  }
}
