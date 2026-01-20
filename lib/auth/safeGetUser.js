import { authDiagLog } from "@/lib/auth/authDiag";
import { getAuthGuardState } from "@/lib/supabase/browser";

export async function getOptionalSession(supabase) {
  if (!supabase?.auth?.getSession) {
    return { session: null, skipped: true, error: null };
  }

  try {
    const { data, error } = await supabase.auth.getSession();
    if (error) {
      authDiagLog("getSession:failed", { message: error?.message, status: error?.status });
      return { session: null, skipped: true, error };
    }
    return { session: data?.session ?? null, skipped: !data?.session, error: null };
  } catch (err) {
    authDiagLog("getSession:failed", { message: err?.message || String(err) });
    return { session: null, skipped: true, error: err };
  }
}

export async function getOptionalUser(supabase, { token } = {}) {
  try {
    if (!supabase?.auth) {
      return { user: null, skipped: true, error: null };
    }

    if (typeof window !== "undefined") {
      const guard = getAuthGuardState();
      if (guard.refreshDisabledMsRemaining > 0 || guard.cooldownMsRemaining > 0) {
        authDiagLog("getUser:skipped", {
          reason: guard.refreshDisabledMsRemaining > 0 ? "refresh_disabled" : "rate_limited",
        });
        return { user: null, skipped: true, error: null };
      }
    }

    if (token) {
      const { data, error } = await supabase.auth.getUser(token);
      if (error) {
        return { user: null, skipped: false, error };
      }
      return { user: data?.user ?? null, skipped: false, error: null };
    }

    const { session, error: sessionError } = await getOptionalSession(supabase);
    if (sessionError || !session) {
      return { user: null, skipped: true, error: sessionError ?? null };
    }

    const { data: userData, error: userError } = await supabase.auth.getUser();
    if (userError) {
      return { user: null, skipped: false, error: userError };
    }
    return { user: userData?.user ?? null, skipped: false, error: null };
  } catch (err) {
    authDiagLog("safeGetUser:threw", { message: err?.message || String(err) });
    return { user: null, skipped: true, error: err };
  }
}

export async function safeGetUser(supabase, { token } = {}) {
  return getOptionalUser(supabase, { token });
}
