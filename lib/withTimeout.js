export function withTimeout(promise, timeoutMs = 10000, message = "Request timed out") {
  let timeoutId;
  const timeout = new Promise((_, reject) => {
    timeoutId = setTimeout(() => {
      const err = new Error(message);
      err.name = "TimeoutError";
      reject(err);
    }, timeoutMs);
  });

  return Promise.race([promise, timeout]).finally(() => clearTimeout(timeoutId));
}
