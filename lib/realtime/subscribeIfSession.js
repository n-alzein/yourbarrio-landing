import { authDiagLog } from "@/lib/auth/authDiag";
import { getAuthGuardState } from "@/lib/supabase/browser";

export async function subscribeIfSession(
  client,
  buildChannel,
  diagLabel = "",
  onStatus
) {
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
    if (typeof client.realtime?.setAuth === "function") {
      try {
        client.realtime.setAuth(data.session.access_token);
      } catch {
        // best effort
      }
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
    if (typeof onStatus === "function") {
      channel.subscribe((status, err) => onStatus(status, err));
    } else {
      channel.subscribe();
    }
  }
  return channel;
}
