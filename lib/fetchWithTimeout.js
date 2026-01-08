export async function fetchWithTimeout(url, options = {}) {
  const { timeoutMs, ...fetchOptions } = options || {};
  const safeTimeoutMs = Number.isFinite(timeoutMs) ? timeoutMs : 10000;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), safeTimeoutMs);

  try {
    const response = await fetch(url, {
      ...fetchOptions,
      signal: controller.signal,
    });
    return response;
  } finally {
    clearTimeout(timeoutId);
  }
}
