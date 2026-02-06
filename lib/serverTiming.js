import "server-only";
import { headers, cookies } from "next/headers";

export async function perfTimingEnabled() {
  try {
    const headerStore = await headers();
    const perfHeader = headerStore.get("x-perf");
    if (perfHeader === "1") return true;
  } catch {
    // best effort
  }
  try {
    const cookieStore = await cookies();
    const perfCookie = cookieStore.get("yb-perf");
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

export async function logServerTiming(label, payload = {}) {
  if (!(await perfTimingEnabled())) return;
  try {
    const headerStore = await headers();
    const path = headerStore.get("x-perf-path") || headerStore.get("x-mw-path");
    console.log("[SSR_TIMING]", { label, path, ...payload });
  } catch {
    console.log("[SSR_TIMING]", { label, ...payload });
  }
}
