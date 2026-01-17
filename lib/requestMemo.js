const memo = new Map();

export async function memoizeRequest(key, fn, { ttlMs = 1500 } = {}) {
  const now = Date.now();
  const cached = memo.get(key);
  if (cached && now - cached.ts < ttlMs) {
    return cached.promise;
  }

  const promise = Promise.resolve()
    .then(fn)
    .finally(() => {
      const current = memo.get(key);
      if (current?.promise === promise) {
        setTimeout(() => {
          if (memo.get(key)?.promise === promise) {
            memo.delete(key);
          }
        }, ttlMs);
      }
    });

  memo.set(key, { promise, ts: now });
  return promise;
}
