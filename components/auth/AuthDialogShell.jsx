"use client";

import { useEffect, useRef } from "react";
import { X } from "lucide-react";

export default function AuthDialogShell({ children, onClose, label = "Authentication" }) {
  const contentRef = useRef(null);

  useEffect(() => {
    if (typeof document === "undefined") return undefined;

    const previouslyFocused = document.activeElement;
    const focusable = contentRef.current?.querySelector(
      "input, button, select, textarea, [tabindex]:not([tabindex='-1'])"
    );
    focusable?.focus();

    return () => {
      previouslyFocused?.focus?.();
    };
  }, []);

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-transparent px-4 py-8"
      data-allow-overlay="1"
      role="presentation"
      onClick={() => onClose?.()}
    >
      <div className="absolute inset-0 bg-black/60" />
      <div
        ref={contentRef}
        role="dialog"
        aria-modal="true"
        aria-label={label}
        className="relative z-10 flex w-full max-w-lg justify-center"
        onClick={(event) => event.stopPropagation()}
      >
        <button
          type="button"
          aria-label="Close"
          onClick={() => onClose?.()}
          className="absolute right-3 top-3 z-20 flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 bg-white/95 text-slate-900 shadow-sm transition hover:bg-white"
        >
          <X className="h-5 w-5" />
        </button>
        {children}
      </div>
    </div>
  );
}
