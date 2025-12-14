"use client";

import { useEffect, useRef } from "react";
import { X } from "lucide-react";

export default function BaseModal({
  title,
  description,
  onClose,
  children,
}) {
  const contentRef = useRef(null);

  // Focus first interactive element and restore focus on close
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

  const handleBackdropClick = () => {
    onClose?.();
  };

  const handleContentClick = (event) => {
    event.stopPropagation();
  };

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center px-4 py-8"
      data-allow-overlay="1"
      role="presentation"
      onClick={handleBackdropClick}
    >
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />

      <div
        ref={contentRef}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="
          relative w-full max-w-lg
          rounded-2xl border border-slate-200
          bg-white text-slate-900
          shadow-[0_25px_80px_-12px_rgba(0,0,0,0.25)]
          overflow-hidden
          max-h-[80vh]
        "
        onClick={handleContentClick}
      >
        <div className="relative p-6 flex items-start justify-between gap-4">
          <div className="space-y-1">
            {title ? (
              <h2 className="text-xl font-semibold tracking-tight text-slate-900">
                {title}
              </h2>
            ) : null}
            {description ? (
              <p className="text-sm text-slate-600 leading-relaxed">
                {description}
              </p>
            ) : null}
          </div>

          <button
            type="button"
            aria-label="Close"
            onClick={onClose}
            className="h-9 w-9 flex items-center justify-center rounded-xl border border-slate-200 bg-white hover:bg-slate-50 transition active:scale-95"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="relative px-6 pb-6 overflow-y-auto">
          {children}
        </div>
      </div>
    </div>
  );
}
