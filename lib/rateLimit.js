// Lightweight, in-memory rate limiter for API routes.
// Usage:
//   const limiter = rateLimit({ interval: 60_000, uniqueTokenPerInterval: 500 });
//   await limiter.check(20, "PLACES_API");
export default function rateLimit({ interval = 60_000, uniqueTokenPerInterval = 500 } = {}) {
  const tokenBuckets = new Map();

  const check = (limit, token) => {
    if (!token) {
      // Without a token, refuse to proceed to avoid unlimited bursts.
      throw new Error("Rate limit token missing");
    }

    const now = Date.now();
    const windowStart = now - interval;
    const bucket = tokenBuckets.get(token) || [];
    const recent = bucket.filter((ts) => ts > windowStart);

    if (recent.length >= limit) {
      throw new Error("Rate limit exceeded");
    }

    recent.push(now);

    // Avoid unbounded memory growth.
    if (recent.length > uniqueTokenPerInterval) {
      recent.splice(0, recent.length - uniqueTokenPerInterval);
    }

    tokenBuckets.set(token, recent);
    return true;
  };

  return { check };
}
