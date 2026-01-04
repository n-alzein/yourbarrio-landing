"use client";

export function installPreventDefaultTracer() {
  if (typeof window === "undefined") return undefined;
  if (process.env.NEXT_PUBLIC_HOME_BISECT_PD_TRACER !== "1") return undefined;
  if (window.__PD_SOURCE_TRACER__) return undefined;
  window.__PD_SOURCE_TRACER__ = Date.now();

  const patch = (proto, key) => {
    const original = proto[key];
    if (typeof original !== "function") return null;
    proto[key] = function patched(...args) {
      try {
        const target = this?.target || null;
        const link = target?.closest ? target.closest("a[href]") : null;
        if ((this?.type === "click" || this?.type === "pointerdown") && link) {
          // eslint-disable-next-line no-console
          console.warn("[PD_SOURCE]", {
            method: key,
            type: this?.type,
            href: link.getAttribute?.("href") || null,
            targetTag: target?.tagName,
            className: target?.className,
            stack: new Error().stack,
          });
        }
      } catch {
        /* ignore logging errors */
      }
      return original.apply(this, args);
    };
    return () => {
      try {
        proto[key] = original;
      } catch {
        /* ignore */
      }
    };
  };

  const cleanups = [
    patch(Event.prototype, "preventDefault"),
  ].filter(Boolean);

  return () => {
    cleanups.forEach((fn) => {
      try {
        fn();
      } catch {
        /* ignore */
      }
    });
    delete window.__PD_SOURCE_TRACER__;
  };
}
