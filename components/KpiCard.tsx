"use client";

import Link from "next/link";
import type { KpiMetric } from "@/lib/dashboardTypes";
import { chartColorTokens } from "@/lib/dashboardTypes";

const getDeltaTone = (deltaPct: number) => {
  if (deltaPct > 0) return "bg-emerald-100 text-emerald-700";
  if (deltaPct < 0) return "bg-rose-100 text-rose-700";
  return "bg-slate-100 text-slate-600";
};

const formatDelta = (deltaPct: number) =>
  `${deltaPct > 0 ? "+" : ""}${deltaPct.toFixed(1)}%`;

const buildSparklinePath = (points: number[]) => {
  if (points.length === 0) return "";
  const max = Math.max(...points);
  const min = Math.min(...points);
  const range = max - min || 1;
  return points
    .map((point, index) => {
      const x = (index / (points.length - 1)) * 100;
      const y = 100 - ((point - min) / range) * 100;
      return `${index === 0 ? "M" : "L"}${x},${y}`;
    })
    .join(" ");
};

type KpiCardProps = {
  metric: KpiMetric;
};

const KpiCard = ({ metric }: KpiCardProps) => {
  const sparklinePath = buildSparklinePath(metric.sparklinePoints);

  return (
    <Link
      href={metric.href}
      className="group relative flex h-full flex-col justify-between rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 shadow-[0_12px_30px_rgba(15,23,42,0.08)] transition hover:-translate-y-1 hover:shadow-[0_18px_40px_rgba(15,23,42,0.12)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900"
      aria-label={`View ${metric.label} details`}
    >
      <div className="space-y-2">
        <div className="flex items-start justify-between gap-3">
          <p className="text-sm font-semibold text-slate-600">{metric.label}</p>
          <span
            className={`rounded-full px-2 py-1 text-xs font-semibold ${getDeltaTone(
              metric.deltaPct
            )}`}
          >
            {formatDelta(metric.deltaPct)}
          </span>
        </div>
        <p className="text-2xl font-semibold text-slate-900">{metric.value}</p>
      </div>
      <div className="mt-4 flex items-end justify-between">
        <span className="text-xs text-slate-500">Last 7 days</span>
        <svg
          className="h-10 w-24"
          viewBox="0 0 100 100"
          role="img"
          aria-label={`${metric.label} sparkline`}
        >
          <path
            d={sparklinePath}
            fill="none"
            stroke={chartColorTokens.primary}
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </div>
    </Link>
  );
};

export default KpiCard;
