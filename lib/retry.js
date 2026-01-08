const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export async function retry(fn, options = {}) {
  const retries = Number.isInteger(options.retries) ? options.retries : 1;
  const delayMs = Number.isFinite(options.delayMs) ? options.delayMs : 400;
  const factor = Number.isFinite(options.factor) ? options.factor : 2;
  const onRetry = typeof options.onRetry === "function" ? options.onRetry : null;

  let attempt = 0;
  let lastError;
  while (attempt <= retries) {
    try {
      return await fn(attempt);
    } catch (err) {
      lastError = err;
      if (attempt >= retries) break;
      if (onRetry) onRetry(err, attempt + 1);
      const backoff = Math.round(delayMs * Math.pow(factor, attempt));
      await sleep(backoff);
      attempt += 1;
    }
  }

  throw lastError;
}
