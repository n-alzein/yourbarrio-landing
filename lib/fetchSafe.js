import { logDataDiag } from "@/lib/dataDiagnostics";

const isAbortLike = (err) => {
  const message = err?.message || "";
  return (
    err?.name === "AbortError" ||
    err?.code === "ABORT_ERR" ||
    message.includes("AbortError") ||
    message.includes("aborted")
  );
};

export function createFetchSafe(fn, { label } = {}) {
  const controller = new AbortController();
  const startedAt = Date.now();

  const run = async () => {
    logDataDiag("request:start", { label });
    try {
      const result = await fn({ signal: controller.signal });
      logDataDiag("request:finish", {
        label,
        durationMs: Date.now() - startedAt,
      });
      return { ok: true, result, aborted: false, error: null };
    } catch (err) {
      if (isAbortLike(err)) {
        logDataDiag("request:aborted", { label });
        return { ok: false, result: null, aborted: true, error: err };
      }
      logDataDiag("request:error", {
        label,
        durationMs: Date.now() - startedAt,
        message: err?.message || String(err),
      });
      return { ok: false, result: null, aborted: false, error: err };
    }
  };

  const abort = () => {
    if (!controller.signal.aborted) controller.abort();
  };

  return { run, abort, signal: controller.signal };
}
