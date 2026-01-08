const isServer = typeof window === "undefined";

export function isPerfEnabled() {
  if (!isServer) return false;
  return (
    process.env.DEBUG_PERF === "true" ||
    process.env.NEXT_PUBLIC_DEBUG_PERF === "true"
  );
}

export function perfLog(...args) {
  if (!isPerfEnabled()) return;
  console.log(...args);
}

export function perfTimer(label) {
  if (!isPerfEnabled() || typeof console.time !== "function") {
    return () => {};
  }
  const id = `${label}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  console.time(id);
  return () => {
    try {
      console.timeEnd(id);
    } catch {}
  };
}
