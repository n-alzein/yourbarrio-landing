import { authDiagLog } from "@/lib/auth/authDiag";
import { getAuthGuardState } from "@/lib/supabaseClient";

export async function subscribeIfSession(client, buildChannel, diagLabel = "") {
  if (!client || typeof buildChannel !== "function") return null;
  const guard = getAuthGuardState();
  if (guard.refreshDisabledMsRemaining > 0 || guard.cooldownMsRemaining > 0) {
    authDiagLog("realtime:skip_guard", {
      label: diagLabel,
      refreshDisabledMsRemaining: guard.refreshDisabledMsRemaining,
      cooldownMsRemaining: guard.cooldownMsRemaining,
    });
    return null;
  }
  try {
    const { data, error } = await client.auth.getSession();
    if (error) {
      authDiagLog("realtime:session_error", {
        label: diagLabel,
        message: error?.message,
        status: error?.status,
      });
      return null;
    }
    if (!data?.session) {
      authDiagLog("realtime:skip_no_session", { label: diagLabel });
      return null;
    }
  } catch (err) {
    authDiagLog("realtime:session_throw", {
      label: diagLabel,
      message: err?.message || String(err),
    });
    return null;
  }

  const channel = buildChannel(client);
  if (!channel) return null;
  if (typeof channel.subscribe === "function") {
    channel.subscribe();
  }
  return channel;
}
