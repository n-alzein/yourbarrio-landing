"use client";

import { useMemo } from "react";
import { useRouter } from "next/navigation";
import type { FunnelStep } from "@/lib/dashboardTypes";
import { chartColorTokens } from "@/lib/dashboardTypes";

type ConversionFunnelProps = {
  steps: FunnelStep[];
};

const formatCompact = (value: number) => {
  if (value >= 1000) return `${(value / 1000).toFixed(1)}k`;
  return value.toString();
};

const ConversionFunnel = ({ steps }: ConversionFunnelProps) => {
  const router = useRouter();
  const max = useMemo(() => Math.max(...steps.map((step) => step.value)), [steps]);

  return (
    <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6 shadow-[0_12px_30px_rgba(15,23,42,0.08)]">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
            Funnel
          </p>
          <h3 className="text-lg font-semibold text-slate-900">Conversion funnel</h3>
        </div>
        <button
          type="button"
          onClick={() => router.push("/business/dashboard/sales")}
          className="rounded-full border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-600 hover:border-slate-300"
          aria-label="View conversion details"
        >
          Drill down
        </button>
      </div>
      <div className="mt-6 space-y-4">
        {steps.map((step, index) => {
          const width = max === 0 ? 0 : (step.value / max) * 100;
          return (
            <div key={step.id} className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="font-semibold text-slate-700">{step.label}</span>
                <span className="text-slate-500">{formatCompact(step.value)}</span>
              </div>
              <div className="h-3 w-full rounded-full bg-slate-100">
                <div
                  className="h-3 rounded-full"
                  style={{
                    width: `${width}%`,
                    backgroundColor: chartColorTokens.primary,
                    opacity: 1 - index * 0.12,
                  }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default ConversionFunnel;
