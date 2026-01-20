import {
  getBrowserSupabaseClient,
  getFreshBrowserSupabaseClient,
  getAuthGuardState,
} from "@/lib/supabaseClient";
import { withTimeout } from "@/lib/withTimeout";
import { fetchWithTimeout } from "@/lib/fetchWithTimeout";

export async function runSupabaseQuery({
  client,
  fn,
  label = "Supabase query",
  timeoutMs = 10000,
  retryFresh = true,
}) {
  const initialClient = client ?? getBrowserSupabaseClient();
  if (!initialClient) {
    throw new Error("Supabase client unavailable");
  }

  await refreshAuthCookies(initialClient);

  const run = (activeClient) =>
    withTimeout(fn(activeClient), timeoutMs, `${label} timed out`);

  try {
    return await run(initialClient);
  } catch (err) {
    const message = String(err?.message || "");
    const timedOut = message.toLowerCase().includes("timed out");
    if (!retryFresh || !timedOut) {
      throw err;
    }

    const freshClient = getFreshBrowserSupabaseClient();
    if (!freshClient) {
      throw err;
    }

    await refreshAuthCookies(freshClient);
    return await run(freshClient);
  }
}

let lastRefreshAt = 0;
let refreshPromise = null;

async function refreshAuthCookies(client) {
  if (typeof window === "undefined") return;
  const now = Date.now();
  const guard = getAuthGuardState();
  if (guard.cooldownMsRemaining > 0 || guard.refreshDisabledMsRemaining > 0) {
    return undefined;
  }
  if (refreshPromise) {
    return refreshPromise;
  }
  if (now - lastRefreshAt < 30000) {
    return undefined;
  }

  refreshPromise = (async () => {
    try {
      let payload = {};
      try {
        const sessionResult = await withTimeout(
          client.auth.getSession(),
          8000,
          "Auth session fetch timed out"
        );
        const session = sessionResult?.data?.session;
        if (session?.access_token && session?.refresh_token) {
          payload = {
            access_token: session.access_token,
            refresh_token: session.refresh_token,
          };
        }
      } catch (err) {
        console.warn("Auth session lookup failed", err);
      }

      await fetchWithTimeout("/api/auth/refresh", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(payload),
        timeoutMs: 8000,
      });
    } catch (err) {
      console.warn("Auth cookie refresh failed", err);
    } finally {
      lastRefreshAt = Date.now();
      refreshPromise = null;
    }
  })();

  return refreshPromise;
}
