export function installNetTrace({ enabled, tag } = {}) {
  if (!enabled || typeof window === "undefined") return;
  if (window.__netTraceInstalled) return;
  const label = tag || "NET";
  const originalFetch = window.fetch;
  if (typeof originalFetch !== "function") return;

  window.__netTraceInstalled = true;
  window.fetch = async (input, init) => {
    const url = typeof input === "string" ? input : input?.url;
    const method = init?.method || (input?.method || "GET");
    const start = performance.now();
    console.log(`[${label}][fetch:start]`, { url, method });
    try {
      const response = await originalFetch(input, init);
      const durationMs = Math.round(performance.now() - start);
      if (!response.ok) {
        let snippet = "";
        try {
          snippet = (await response.clone().text()).slice(0, 200);
        } catch {
          snippet = "";
        }
        console.error(`[${label}][fetch:error]`, {
          url,
          method,
          status: response.status,
          durationMs,
          body: snippet,
        });
      } else {
        console.log(`[${label}][fetch:ok]`, {
          url,
          method,
          status: response.status,
          durationMs,
        });
      }
      return response;
    } catch (error) {
      const durationMs = Math.round(performance.now() - start);
      console.error(`[${label}][fetch:throw]`, {
        url,
        method,
        durationMs,
        name: error?.name,
        message: error?.message,
      });
      throw error;
    }
  };
}
