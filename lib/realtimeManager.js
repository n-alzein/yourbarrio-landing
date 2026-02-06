const channels = new Set();

const visibilityListeners = new Set();
let visibilityInitialized = false;
let visibilityState = {
  hidden: false,
  pageHidden: false,
  paused: false,
};

const retryEntries = new Map();
let retryTimer = null;
let retryTimerAt = 0;

const perfCounters = {
  subscribeAttempts: 0,
  reconnectAttempts: 0,
};

function perfEnabled() {
  if (typeof window === "undefined") return false;
  try {
    const params = new URLSearchParams(window.location.search);
    return params.get("perf") === "1";
  } catch {
    return false;
  }
}

function notifyVisibility() {
  visibilityListeners.forEach((listener) => {
    try {
      listener({ ...visibilityState });
    } catch {
      // best effort
    }
  });
}

function computePaused(next) {
  return Boolean(next.hidden || next.pageHidden);
}

function updateVisibility(partial) {
  const next = {
    ...visibilityState,
    ...partial,
  };
  next.paused = computePaused(next);
  const changed =
    next.hidden !== visibilityState.hidden ||
    next.pageHidden !== visibilityState.pageHidden ||
    next.paused !== visibilityState.paused;
  if (!changed) return;
  visibilityState = next;
  notifyVisibility();
  if (!visibilityState.paused) {
    scheduleRetryTimer();
  } else {
    clearRetryTimer();
  }
}

function ensureVisibilityListeners() {
  if (visibilityInitialized || typeof window === "undefined") return;
  visibilityInitialized = true;
  visibilityState = {
    hidden: Boolean(document.hidden),
    pageHidden: false,
    paused: Boolean(document.hidden),
  };
  const handleVisibility = () =>
    updateVisibility({ hidden: Boolean(document.hidden) });
  const handlePageHide = () => updateVisibility({ pageHidden: true });
  const handlePageShow = () =>
    updateVisibility({
      pageHidden: false,
      hidden: Boolean(document.hidden),
    });
  document.addEventListener("visibilitychange", handleVisibility);
  window.addEventListener("pagehide", handlePageHide);
  window.addEventListener("pageshow", handlePageShow);
}

function clearRetryTimer() {
  if (retryTimer) {
    clearTimeout(retryTimer);
    retryTimer = null;
    retryTimerAt = 0;
  }
}

function scheduleRetryTimer() {
  if (typeof window === "undefined") return;
  if (visibilityState.paused) return;
  let nextAt = 0;
  retryEntries.forEach((entry) => {
    if (!entry.nextAt) return;
    if (!nextAt || entry.nextAt < nextAt) {
      nextAt = entry.nextAt;
    }
  });
  if (!nextAt) {
    clearRetryTimer();
    return;
  }
  if (retryTimer && retryTimerAt && retryTimerAt <= nextAt) return;
  clearRetryTimer();
  retryTimerAt = nextAt;
  retryTimer = setTimeout(runRetryCycle, Math.max(0, nextAt - Date.now()));
}

function runRetryCycle() {
  retryTimer = null;
  retryTimerAt = 0;
  if (visibilityState.paused) return;
  const now = Date.now();
  retryEntries.forEach((entry) => {
    if (entry.nextAt && entry.nextAt <= now) {
      entry.nextAt = 0;
      try {
        entry.callback?.();
      } catch {
        // best effort
      }
    }
  });
  scheduleRetryTimer();
}

export function registerChannel(channel) {
  if (!channel) return channel;
  channels.add(channel);
  return channel;
}

export function unregisterChannel(channel) {
  if (!channel) return;
  channels.delete(channel);
}

export function subscribeRealtimeVisibility(listener) {
  if (typeof listener !== "function") return () => {};
  ensureVisibilityListeners();
  visibilityListeners.add(listener);
  try {
    listener({ ...visibilityState });
  } catch {
    // best effort
  }
  return () => visibilityListeners.delete(listener);
}

export function isRealtimePaused() {
  ensureVisibilityListeners();
  return visibilityState.paused;
}

export function scheduleRealtimeRetry({
  key,
  callback,
  delayMs,
  bumpAttempts = true,
  maxAttempts = 5,
}) {
  if (!key || typeof callback !== "function") return null;
  const now = Date.now();
  const entry = retryEntries.get(key) || {
    attempts: 0,
    nextAt: 0,
    callback,
  };
  entry.callback = callback;

  if (delayMs == null) {
    if (entry.nextAt && entry.nextAt > now) {
      return {
        attempts: entry.attempts,
        delayMs: entry.nextAt - now,
        scheduled: false,
      };
    }
    if (bumpAttempts) {
      entry.attempts += 1;
    }
    if (entry.attempts > maxAttempts) {
      retryEntries.set(key, entry);
      return { attempts: entry.attempts, exhausted: true, scheduled: false };
    }
    delayMs = Math.min(30000, 1000 * 2 ** (entry.attempts - 1));
  } else if (bumpAttempts) {
    entry.attempts += 1;
    if (entry.attempts > maxAttempts) {
      retryEntries.set(key, entry);
      return { attempts: entry.attempts, exhausted: true, scheduled: false };
    }
  }

  const nextAt = now + delayMs;
  let scheduled = false;
  if (!entry.nextAt || nextAt < entry.nextAt) {
    entry.nextAt = nextAt;
    scheduled = true;
  }
  retryEntries.set(key, entry);
  scheduleRetryTimer();
  return { attempts: entry.attempts, delayMs, scheduled };
}

export function resetRealtimeRetry(key) {
  if (!key) return;
  retryEntries.delete(key);
  scheduleRetryTimer();
}

export function cancelRealtimeRetry(key) {
  if (!key) return;
  retryEntries.delete(key);
  scheduleRetryTimer();
}

export function clearRealtimeRetries() {
  retryEntries.clear();
  clearRetryTimer();
}

export function noteRealtimeSubscribeAttempt() {
  perfCounters.subscribeAttempts += 1;
}

export function noteRealtimeReconnectAttempt() {
  perfCounters.reconnectAttempts += 1;
}

export function logRealtimePerf(event, meta = {}) {
  if (!perfEnabled()) return;
  console.info("[realtime:perf]", {
    event,
    subscribeAttempts: perfCounters.subscribeAttempts,
    reconnectAttempts: perfCounters.reconnectAttempts,
    activeChannels: channels.size,
    ...meta,
  });
}

export async function stopRealtime(supabase) {
  if (!supabase) return;
  clearRealtimeRetries();
  if (typeof supabase.removeAllChannels === "function") {
    try {
      await supabase.removeAllChannels();
    } catch {
      // best effort
    }
  } else if (
    typeof supabase.getChannels === "function" &&
    typeof supabase.removeChannel === "function"
  ) {
    const active = supabase.getChannels() || [];
    await Promise.allSettled(active.map((channel) => supabase.removeChannel(channel)));
  }
  try {
    supabase.realtime?.disconnect?.();
  } catch {
    // best effort
  }
  channels.clear();
}
