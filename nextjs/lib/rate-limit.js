const requests = new Map();

export function rateLimit(ip, limit = 50, windowMs = 60 * 60 * 1000) {
  const now = Date.now();
  
  if (!requests.has(ip)) {
    requests.set(ip, []);
  }

  const timestamps = requests.get(ip).filter(ts => now - ts < windowMs);

  timestamps.push(now);
  requests.set(ip, timestamps);

  return timestamps.length <= limit;
}
