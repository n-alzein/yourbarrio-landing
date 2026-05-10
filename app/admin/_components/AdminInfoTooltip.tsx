"use client";

import { Info } from "lucide-react";

type AdminInfoTooltipProps = {
  label: string;
  children: string;
};

export default function AdminInfoTooltip({ label, children }: AdminInfoTooltipProps) {
  return (
    <span className="group/tooltip relative inline-flex shrink-0 items-center">
      <button
        type="button"
        aria-label={label}
        className="inline-flex h-4 w-4 items-center justify-center rounded-full text-neutral-600 outline-none transition-colors hover:text-neutral-400 focus-visible:text-neutral-300"
      >
        <Info className="h-3 w-3" aria-hidden="true" strokeWidth={2} />
      </button>
      <span
        role="tooltip"
        className="pointer-events-none absolute left-0 top-full z-50 mt-1.5 hidden w-56 rounded-md border border-neutral-800 bg-neutral-950 px-2.5 py-2 text-left text-[11px] font-normal leading-relaxed text-neutral-300 shadow-xl shadow-black/40 group-hover/tooltip:block group-focus-within/tooltip:block sm:left-1/2 sm:-translate-x-1/2"
      >
        {children}
      </span>
    </span>
  );
}
