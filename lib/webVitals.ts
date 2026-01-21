export function reportWebVitals(metric) {
  if (!metric) return;
  const payload = {
    id: metric.id,
    name: metric.name,
    value: metric.value,
    rating: metric.rating,
    delta: metric.delta,
    navigationType: metric.navigationType,
  };

  if (process.env.NODE_ENV !== "production") {
    console.log("[web-vitals]", payload);
    return;
  }

  if (typeof window !== "undefined" && typeof window.__ybWebVitals === "function") {
    window.__ybWebVitals(payload);
  }
}

