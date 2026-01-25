"use client";

import { useEffect } from "react";
import dynamic from "next/dynamic";
import { X } from "lucide-react";
import { createPortal } from "react-dom";

const CustomerMap = dynamic(() => import("./CustomerMap"), {
  ssr: false,
  loading: () => (
    <div className="h-full rounded-3xl border border-white/10 bg-white/5 backdrop-blur-xl shadow-xl p-6 text-white/70 text-sm">
      Loading map…
    </div>
  ),
});

export default function MapModal({
  open,
  onClose,
  mapEnabled,
  mapBusinesses,
  onBusinessesChange,
  onControlsReady,
  selectedBusiness,
  clickDiagEnabled,
}) {
  const portalTarget = typeof document === "undefined" ? null : document.body;

  useEffect(() => {
    if (!open) return undefined;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    document.documentElement.setAttribute("data-map-modal-open", "1");
    return () => {
      document.body.style.overflow = previous;
      document.documentElement.removeAttribute("data-map-modal-open");
    };
  }, [open]);

  useEffect(() => {
    if (!open) return undefined;
    const handleKeyDown = (event) => {
      if (event.key === "Escape") {
        onClose?.();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  const modal = (
    <div
      className="fixed inset-0 z-[5200] pointer-events-auto"
      onClick={(event) => event.stopPropagation()}
      onPointerDown={(event) => event.stopPropagation()}
    >
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />
      <div
        className="relative z-10 h-full w-full px-4 py-5 sm:px-6 sm:py-6 md:px-10 md:py-8 pointer-events-auto"
        onClick={(event) => event.stopPropagation()}
        onPointerDown={(event) => event.stopPropagation()}
      >
        <div className="mx-auto h-full w-full max-w-6xl">
          <div className="h-full rounded-3xl border border-white/10 bg-[#0d041c]/95 backdrop-blur-2xl shadow-2xl shadow-purple-950/40 flex flex-col pointer-events-auto">
            <div className="flex items-center justify-between px-4 py-3 sm:px-6 border-b border-white/10">
              <div>
                <p className="text-xs uppercase tracking-[0.22em] text-white/60">Map view</p>
                <h2 className="text-lg font-semibold text-white">Explore the neighborhood</h2>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="h-10 w-10 rounded-full border border-white/15 bg-white/5 text-white/80 hover:text-white hover:border-white/30 transition flex items-center justify-center"
                aria-label="Close map"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="flex-1 p-3 sm:p-4 pointer-events-auto">
              <CustomerMap
                mapEnabled={mapEnabled}
                mapBusinesses={mapBusinesses}
                onBusinessesChange={onBusinessesChange}
                onControlsReady={onControlsReady}
                selectedBusiness={selectedBusiness}
                clickDiagEnabled={clickDiagEnabled}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  return portalTarget ? createPortal(modal, portalTarget) : modal;
}
