type StallEntry = {
  t: number;
  type: string;
  data?: Record<string, unknown> | null;
};

type StallRecorderState = {
  enabled: boolean;
  started: boolean;
  buffer: StallEntry[];
  idx: number;
  filled: boolean;
  lastFrameAt: number;
  lastStallLogAt: number;
  rafId: number | null;
  intervalId: number | null;
  pointerMoveCount: number;
  eventCounts: Record<string, number>;
  cleanup: Array<() => void>;
};

const MAX_ENTRIES = 500;
const TICK_MS = 250;
const STALL_MS = 250;
const STALL_LOG_COOLDOWN_MS = 5000;

const state: StallRecorderState = {
  enabled: false,
  started: false,
  buffer: new Array(MAX_ENTRIES),
  idx: 0,
  filled: false,
  lastFrameAt: 0,
  lastStallLogAt: 0,
  rafId: null,
  intervalId: null,
  pointerMoveCount: 0,
  eventCounts: {},
  cleanup: [],
};

function perfEnabled() {
  if (typeof window === "undefined") return false;
  try {
    if (process.env.NEXT_PUBLIC_PERF_DEBUG === "1") return true;
  } catch {
    // best effort
  }
  try {
    const params = new URLSearchParams(window.location.search);
    if (params.get("perf") === "1") return true;
  } catch {
    // best effort
  }
  try {
    return window.localStorage?.getItem("PERF_DEBUG") === "1";
  } catch {
    return false;
  }
}

function pushEntry(type: string, data?: Record<string, unknown> | null) {
  const entry: StallEntry = { t: performance.now(), type, data: data || null };
  state.buffer[state.idx] = entry;
  state.idx = (state.idx + 1) % MAX_ENTRIES;
  if (state.idx === 0) state.filled = true;
}

export function mark(type: string, data?: Record<string, unknown>) {
  if (!state.enabled) return;
  pushEntry(type, data || null);
}

function summarizeRecent(windowMs: number) {
  const now = performance.now();
  const counts: Record<string, number> = {};
  const recent: StallEntry[] = [];
  const total = state.filled ? MAX_ENTRIES : state.idx;
  for (let i = 0; i < total; i += 1) {
    const idx = (state.idx - 1 - i + MAX_ENTRIES) % MAX_ENTRIES;
    const entry = state.buffer[idx];
    if (!entry) continue;
    if (now - entry.t > windowMs) break;
    counts[entry.type] = (counts[entry.type] || 0) + 1;
    if (recent.length < 12) recent.push(entry);
  }
  return { counts, recent: recent.reverse() };
}

export function dumpStallRecorder(reason: string) {
  if (!state.enabled) return;
  const summary = summarizeRecent(5000);
  console.log("[STALL]", {
    reason,
    gapMs: Math.round(performance.now() - state.lastFrameAt),
    recentCounts: summary.counts,
    recentMarks: summary.recent,
  });
}

function handleEvent(type: string, data?: Record<string, unknown>) {
  state.eventCounts[type] = (state.eventCounts[type] || 0) + 1;
  if (type !== "pointermove") {
    pushEntry(type, data || null);
  }
}

function startRafLoop() {
  state.lastFrameAt = performance.now();
  const tick = (now: number) => {
    const delta = now - state.lastFrameAt;
    if (delta > STALL_MS) {
      if (now - state.lastStallLogAt > STALL_LOG_COOLDOWN_MS) {
        state.lastStallLogAt = now;
        dumpStallRecorder("raf_stall");
      }
    }
    state.lastFrameAt = now;
    state.rafId = requestAnimationFrame(tick);
  };
  state.rafId = requestAnimationFrame(tick);
}

function stopRafLoop() {
  if (state.rafId != null) {
    cancelAnimationFrame(state.rafId);
    state.rafId = null;
  }
}

function installEventListeners() {
  const add = (target: EventTarget, type: string, handler: EventListener, options?: AddEventListenerOptions) => {
    target.addEventListener(type, handler, options);
    state.cleanup.push(() => target.removeEventListener(type, handler, options));
  };

  add(document, "pointerdown", (event) => {
    const target = event.target as HTMLElement | null;
    handleEvent("pointerdown", { tag: target?.tagName || null });
  }, { passive: true, capture: true });

  add(document, "click", (event) => {
    const target = event.target as HTMLElement | null;
    handleEvent("click", { tag: target?.tagName || null });
  }, { passive: true, capture: true });

  add(document, "keydown", (event) => {
    const key = (event as KeyboardEvent).key;
    handleEvent("keydown", { key });
  }, { passive: true, capture: true });

  add(document, "wheel", () => {
    handleEvent("wheel");
  }, { passive: true, capture: true });

  add(document, "scroll", () => {
    handleEvent("scroll");
  }, { passive: true, capture: true });

  add(document, "pointermove", () => {
    state.pointerMoveCount += 1;
  }, { passive: true, capture: true });

  add(window, "popstate", () => {
    handleEvent("popstate", { path: window.location?.pathname || null });
  }, { passive: true });
}

function installHistoryHooks() {
  if (typeof history === "undefined") return;
  const wrap = (method: "pushState" | "replaceState") => {
    const original = history[method];
    if (typeof original !== "function") return;
    history[method] = function (...args) {
      const url = args[2];
      handleEvent(method, { url: typeof url === "string" ? url : null });
      return original.apply(this, args as never);
    };
    state.cleanup.push(() => {
      history[method] = original;
    });
  };
  try {
    wrap("pushState");
    wrap("replaceState");
  } catch {
    // best effort
  }
}

function installObserverHooks() {
  const wrapObserver = (key: "ResizeObserver" | "IntersectionObserver") => {
    const ctor = (globalThis as unknown as Record<string, unknown>)[key];
    if (typeof ctor !== "function") return;
    const descriptor = Object.getOwnPropertyDescriptor(globalThis, key);
    if (descriptor && descriptor.writable === false) return;
    const Wrapped = function (callback: (...args: unknown[]) => void) {
      const wrappedCallback = (...args: unknown[]) => {
        handleEvent(key, { count: Array.isArray(args[0]) ? args[0].length : null });
        return callback(...args);
      };
      return new (ctor as new (cb: (...args: unknown[]) => void) => unknown)(wrappedCallback);
    } as unknown as typeof ResizeObserver;
    try {
      (globalThis as unknown as Record<string, unknown>)[key] = Wrapped;
      state.cleanup.push(() => {
        (globalThis as unknown as Record<string, unknown>)[key] = ctor;
      });
    } catch {
      // best effort
    }
  };
  wrapObserver("ResizeObserver");
  wrapObserver("IntersectionObserver");
}

function installFetchHook() {
  if (typeof window === "undefined") return;
  const original = window.fetch;
  if (typeof original !== "function") return;
  const descriptor = Object.getOwnPropertyDescriptor(window, "fetch");
  if (descriptor && descriptor.writable === false) return;
  window.fetch = async (...args) => {
    const url = args[0] instanceof Request ? args[0].url : String(args[0] || "");
    const startedAt = performance.now();
    mark("fetch_start", { url });
    try {
      const response = await original(...args);
      const durationMs = Math.round(performance.now() - startedAt);
      mark("fetch_end", { url, status: response.status, durationMs });
      return response;
    } catch (err) {
      const durationMs = Math.round(performance.now() - startedAt);
      mark("fetch_error", { url, durationMs });
      throw err;
    }
  };
  state.cleanup.push(() => {
    window.fetch = original;
  });
}

function installResourceObserver() {
  if (typeof PerformanceObserver === "undefined") return;
  try {
    const observer = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        const name = (entry as PerformanceEntry).name || "";
        if (!name) continue;
        mark("resource", {
          name,
          durationMs: Math.round(entry.duration || 0),
        });
      }
    });
    observer.observe({ entryTypes: ["resource"] });
    state.cleanup.push(() => observer.disconnect());
  } catch {
    // best effort
  }
}

function startTicker() {
  state.intervalId = window.setInterval(() => {
    const moves = state.pointerMoveCount;
    if (moves > 0) {
      pushEntry("pointermove_batch", { count: moves });
      state.pointerMoveCount = 0;
    }
    const snapshot = { ...state.eventCounts };
    state.eventCounts = {};
    pushEntry("tick", snapshot);
  }, TICK_MS);
}

function stopTicker() {
  if (state.intervalId != null) {
    clearInterval(state.intervalId);
    state.intervalId = null;
  }
}

export function startStallRecorder() {
  if (state.started) return;
  state.enabled = perfEnabled();
  if (!state.enabled) return;
  state.started = true;
  installEventListeners();
  installHistoryHooks();
  installObserverHooks();
  installFetchHook();
  installResourceObserver();
  startTicker();
  startRafLoop();
  mark("stall_recorder_start");
}

export function stopStallRecorder() {
  if (!state.started) return;
  stopRafLoop();
  stopTicker();
  state.cleanup.forEach((fn) => {
    try {
      fn();
    } catch {
      // best effort
    }
  });
  state.cleanup = [];
  state.started = false;
  state.enabled = false;
}
