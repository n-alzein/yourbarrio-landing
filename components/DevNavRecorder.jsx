"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";

const MAX_EVENTS = 200;

function safeStringify(value) {
  try {
    if (value instanceof Error) {
      return {
        message: value.message,
        stack: value.stack,
        name: value.name,
      };
    }
    return JSON.parse(JSON.stringify(value, Object.getOwnPropertyNames(value)));
  } catch {
    try {
      return String(value);
    } catch {
      return "<unserializable>";
    }
  }
}

export default function DevNavRecorder() {
  const enabled = process.env.NODE_ENV === "development";

  const eventsRef = useRef([]);
  const lastClickRef = useRef(null);
  const pathname = usePathname();

  useEffect(() => {
    if (!enabled) return;
    const logEvent = (event) => {
      try {
        const entry = { ts: Date.now(), ...event };
        eventsRef.current.push(entry);
        if (eventsRef.current.length > MAX_EVENTS) {
          eventsRef.current = eventsRef.current.slice(-MAX_EVENTS);
        }
      } catch {
        /* ignore */
      }
    };

    const recordNavigation = () => {
      logEvent({
        type: "nav",
        pathname: window.location.pathname,
        search: window.location.search,
      });
    };
    recordNavigation();

    const handleClickCapture = (evt) => {
      try {
        const target = evt.target;
        const href =
          target?.closest?.("a")?.getAttribute?.("href") ||
          target?.getAttribute?.("href") ||
          null;
        const snippet = target?.outerHTML
          ? target.outerHTML.slice(0, 200)
          : target?.tagName || "unknown";
        const record = {
          type: "click",
          href,
          prevented: evt.defaultPrevented,
          tag: target?.tagName,
          snippet,
        };
        lastClickRef.current = { href, ts: Date.now(), snippet };
        logEvent(record);
      } catch {
        /* ignore */
      }
    };

    const handleVisibility = () => {
      logEvent({ type: "visibility", hidden: document.hidden });
    };

    const handleError = (event) => {
      logEvent({
        type: "error",
        message: event.message,
        source: event.filename,
        lineno: event.lineno,
        colno: event.colno,
        error: safeStringify(event.error),
      });
    };

    const handleRejection = (event) => {
      logEvent({
        type: "unhandledrejection",
        reason: safeStringify(event.reason),
      });
    };

    const patchHistory = (method) => {
      try {
        const desc = Object.getOwnPropertyDescriptor(history, method);
        if (desc && desc.writable === false && !desc.set) return null;
        const original = history[method];
        history[method] = function patched(...args) {
          try {
            logEvent({ type: `history.${method}`, args: safeStringify(args), stack: new Error().stack });
          } catch {
            /* ignore */
          }
          return original.apply(this, args);
        };
        return () => {
          try {
            history[method] = original;
          } catch {
            /* ignore */
          }
        };
      } catch {
        return null;
      }
    };

    const unpatchPush = patchHistory("pushState") || (() => {});
    const unpatchReplace = patchHistory("replaceState") || (() => {});

    window.__dumpNavLog = () => {
      console.log(JSON.stringify({ events: eventsRef.current, lastClick: lastClickRef.current }, null, 2));
    };

    const handlePopState = () => {
      logEvent({
        type: "popstate",
        pathname: window.location.pathname,
        search: window.location.search,
      });
    };

    document.addEventListener("click", handleClickCapture, { capture: true, passive: true });
    document.addEventListener("visibilitychange", handleVisibility);
    window.addEventListener("popstate", handlePopState);
    window.addEventListener("error", handleError);
    window.addEventListener("unhandledrejection", handleRejection);

    return () => {
      document.removeEventListener("click", handleClickCapture, { capture: true, passive: true });
      document.removeEventListener("visibilitychange", handleVisibility);
      window.removeEventListener("popstate", handlePopState);
      window.removeEventListener("error", handleError);
      window.removeEventListener("unhandledrejection", handleRejection);
      unpatchPush();
      unpatchReplace();
    };
  }, [enabled]);

  useEffect(() => {
    if (!enabled) return;
    const entry = {
      type: "path-change",
      ts: Date.now(),
      pathname,
      search: typeof window !== "undefined" ? window.location.search : "",
    };
    eventsRef.current.push(entry);
    if (eventsRef.current.length > MAX_EVENTS) {
      eventsRef.current = eventsRef.current.slice(-MAX_EVENTS);
    }
    return undefined;
  }, [enabled, pathname]);

  if (!enabled) {
    return null;
  }

  return null;
}
