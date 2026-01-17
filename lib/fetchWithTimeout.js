export async function fetchWithTimeout(url, options = {}) {
  const { timeoutMs, signal, ...fetchOptions } = options || {};
  const safeTimeoutMs = Number.isFinite(timeoutMs) ? timeoutMs : 10000;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), safeTimeoutMs);

  try {
    if (signal) {
      if (signal.aborted) {
        controller.abort(signal.reason);
      } else {
        signal.addEventListener(
          "abort",
          () => controller.abort(signal.reason),
          { once: true }
        );
      }
    }
    const response = await fetch(url, {
      ...fetchOptions,
      signal: controller.signal,
    });
    return response;
  } finally {
    clearTimeout(timeoutId);
  }
}
