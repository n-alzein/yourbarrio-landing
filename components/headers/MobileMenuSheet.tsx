"use client";

import type { ReactNode, RefObject } from "react";
import { useEffect } from "react";

type MobileMenuSheetProps = {
  open: boolean;
  onClose: () => void;
  initialFocusRef?: RefObject<HTMLElement>;
  children: ReactNode;
  title?: string;
};

export default function MobileMenuSheet({
  open,
  onClose,
  initialFocusRef,
  children,
  title = "Menu",
}: MobileMenuSheetProps) {
  useEffect(() => {
    if (!open) return;
    const { body } = document;
    const previousOverflow = body.style.overflow;
    body.style.overflow = "hidden";
    return () => {
      body.style.overflow = previousOverflow;
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose, open]);

  useEffect(() => {
    if (!open) return;
    const focusTarget = initialFocusRef?.current;
    if (focusTarget) {
      focusTarget.focus();
    }
  }, [initialFocusRef, open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[60] md:hidden">
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-xl"
        onClick={onClose}
        aria-hidden
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="absolute inset-x-0 top-4 mx-4 overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-b from-purple-950/95 via-purple-900/85 to-fuchsia-900/85 text-white shadow-2xl"
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/10">
          <div className="text-sm font-semibold text-white">{title}</div>
          <button
            type="button"
            onClick={onClose}
            className="h-9 w-9 rounded-full border border-white/20 text-white/80 transition hover:bg-white/10"
            aria-label="Close menu"
          >
            ✕
          </button>
        </div>
        <div className="px-5 py-6">{children}</div>
      </div>
    </div>
  );
}
