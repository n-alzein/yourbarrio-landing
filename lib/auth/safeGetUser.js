import { authDiagLog } from "@/lib/auth/authDiag";

export async function safeGetUser(supabase, { token } = {}) {
  try {
    if (!supabase?.auth) {
      return { user: null, skipped: true, error: null };
    }

    if (token) {
      const { data, error } = await supabase.auth.getUser(token);
      if (error) {
        return { user: null, skipped: false, error };
      }
      return { user: data?.user ?? null, skipped: false, error: null };
    }

    const { data, error } = await supabase.auth.getSession();
    if (error) {
      authDiagLog("getSession:failed", { message: error?.message, status: error?.status });
      return { user: null, skipped: true, error };
    }
    if (!data?.session) {
      authDiagLog("getUser:skipped", { reason: "no_session" });
      return { user: null, skipped: true, error: null };
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
