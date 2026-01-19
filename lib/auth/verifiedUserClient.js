import { getBrowserSupabaseClient } from "@/lib/supabaseClient";
import { safeGetUser } from "@/lib/auth/safeGetUser";

const VERIFIED_TTL_MS = 60000;
const BACKOFF_BASE_MS = 30000;
const BACKOFF_MAX_MS = 60000;

let cachedUser = null;
let cachedAt = 0;
let inflight = null;
let cooldownUntil = 0;
let backoffMs = 0;
let authChangeSuppressed = false;

const listeners = new Set();
let authSubscription = null;
function now() {
  return Date.now();
}

function isFresh() {
  return cachedAt && now() - cachedAt < VERIFIED_TTL_MS;
}

function setCooldown() {
  const base = backoffMs ? Math.min(BACKOFF_MAX_MS, backoffMs * 2) : BACKOFF_BASE_MS;
  const jitter = Math.floor(base * (0.2 * Math.random()));
  backoffMs = base;
  cooldownUntil = now() + base + jitter;
}

function clearCooldown() {
  cooldownUntil = 0;
  backoffMs = 0;
}

function isCooldownActive() {
  return now() < cooldownUntil;
}

function handleAuthError(error) {
  const status = error?.status || error?.statusCode;
  if (status === 400 || status === 401) {
    cachedUser = null;
    cachedAt = 0;
    clearCooldown();
    return;
  }
  if (status === 429) {
    setCooldown();
  }
}

export async function getVerifiedUser() {
  if (isFresh()) {
    return cachedUser;
  }

  if (isCooldownActive()) {
    return cachedUser;
  }

  if (inflight) {
    return inflight;
  }

  const supabase = getBrowserSupabaseClient();
  if (!supabase) {
    return cachedUser;
  }

  inflight = safeGetUser(supabase)
    .then(({ user, error }) => {
      if (error) {
        handleAuthError(error);
        return cachedUser;
      }

      cachedUser = user ?? null;
      if (user) {
        cachedAt = now();
        clearCooldown();
      } else {
        cachedAt = 0;
      }
      return cachedUser;
    })
    .catch((error) => {
      handleAuthError(error);
      return cachedUser;
    })
    .finally(() => {
      inflight = null;
    });

  return inflight;
}

export function clearVerifiedUserCache() {
  cachedUser = null;
  cachedAt = 0;
  inflight = null;
  clearCooldown();
}

function notifyListeners(payload) {
  listeners.forEach((listener) => listener(payload));
}

function ensureAuthSubscription() {
  if (authSubscription) return;
  const supabase = getBrowserSupabaseClient();
  if (!supabase) return;

  const { data } = supabase.auth.onAuthStateChange(async (event) => {
    if (authChangeSuppressed) return;
    if (event === "SIGNED_OUT") {
      clearVerifiedUserCache();
      notifyListeners({ event, user: null });
      return;
    }

    const user = await getVerifiedUser();
    notifyListeners({ event, user });
  });

  authSubscription = data?.subscription || null;
}

function releaseAuthSubscription() {
  if (!authSubscription) return;
  authSubscription.unsubscribe();
  authSubscription = null;
}

export function subscribeAuthChanges(listener) {
  listeners.add(listener);
  ensureAuthSubscription();

  return () => {
    listeners.delete(listener);
    if (listeners.size === 0) {
      releaseAuthSubscription();
    }
  };
}

export function setAuthChangeSuppressed(nextValue) {
  authChangeSuppressed = Boolean(nextValue);
}
