const shouldLogMutations = () =>
  process.env.NODE_ENV !== "production";

function getClientId() {
  if (typeof globalThis === "undefined") return null;
  return globalThis.__ybSupabaseClientId || null;
}

function sanitizeError(error) {
  if (!error) return null;
  return {
    message: error?.message || String(error),
    code: error?.code || null,
    status: error?.status || null,
  };
}

export function logMutation(label, payload = {}) {
  if (!shouldLogMutations()) return;
  console.log("[MUTATION]", { label, clientId: getClientId(), ...payload });
}

export async function requireSession(supabase, { label = "mutation" } = {}) {
  if (!supabase?.auth?.getSession || !supabase?.auth?.getUser) {
    logMutation(label, { stage: "session", ok: false, error: "no_client" });
    throw new Error("Supabase client unavailable");
  }

  const { data, error } = await supabase.auth.getSession();
  const session = data?.session ?? null;
  logMutation(label, {
    stage: "session",
    ok: !error && Boolean(session),
    hasSession: Boolean(session),
    sessionUserId: session?.user?.id ?? null,
    hasAccessToken: Boolean(session?.access_token),
    error: sanitizeError(error),
  });

  if (error || !session) {
    throw new Error("Not authenticated");
  }

  const getUserResult = await supabase.auth.getUser();
  let user = getUserResult?.data?.user ?? null;
  let userError = getUserResult?.error ?? null;
  logMutation(label, {
    stage: "user",
    ok: !userError && Boolean(user),
    userId: user?.id ?? null,
    error: sanitizeError(userError),
  });

  if (userError || !user) {
    if (typeof supabase.auth.refreshSession === "function") {
      logMutation(label, { stage: "user_refresh", ok: false });
      try {
        await supabase.auth.refreshSession();
      } catch (refreshError) {
        logMutation(label, {
          stage: "user_refresh_error",
          error: sanitizeError(refreshError),
        });
      }
      const retry = await supabase.auth.getUser();
      user = retry?.data?.user ?? null;
      userError = retry?.error ?? null;
      logMutation(label, {
        stage: "user_retry",
        ok: !userError && Boolean(user),
        userId: user?.id ?? null,
        error: sanitizeError(userError),
      });
    }
    if (userError || !user) {
      throw new Error("Not authenticated");
    }
  }
  if (session?.user?.id && user?.id && session.user.id !== user.id) {
    logMutation(label, {
      stage: "user_mismatch",
      sessionUserId: session.user.id,
      userId: user.id,
    });
  }

  return session;
}
