"use client";

import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { TimeSeriesPoint } from "@/lib/dashboardTypes";
import { chartColorTokens } from "@/lib/dashboardTypes";

type SalesOverTimeChartProps = {
  data: TimeSeriesPoint[];
  compareEnabled: boolean;
};

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div
      className="dashboard-tooltip rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs shadow-lg"
      style={{ color: "#0f172a" }}
    >
      <p className="font-semibold" style={{ color: "#0f172a" }}>
        {label}
      </p>
      <div className="mt-1 space-y-1">
        {payload.map((entry: any) => (
          <div key={entry.name} className="flex items-center justify-between gap-3">
            <span style={{ color: "#1f2937" }}>{entry.name}</span>
            <span className="font-semibold" style={{ color: "#0f172a" }}>
              {entry.value}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};

const SalesOverTimeChart = ({ data, compareEnabled }: SalesOverTimeChartProps) => {
  return (
    <div className="relative h-full rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6 shadow-[0_12px_30px_rgba(15,23,42,0.08)]">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
            Sales
          </p>
          <h3 className="text-lg font-semibold text-slate-900">Sales over time</h3>
        </div>
      </div>
      <div className="mt-6 h-64">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 10, right: 16, left: -10, bottom: 0 }}>
            <defs>
              <linearGradient id="salesPrimary" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={chartColorTokens.primary} stopOpacity={0.4} />
                <stop offset="100%" stopColor={chartColorTokens.primary} stopOpacity={0.05} />
              </linearGradient>
              <linearGradient id="salesCompare" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={chartColorTokens.compare} stopOpacity={0.35} />
                <stop offset="100%" stopColor={chartColorTokens.compare} stopOpacity={0.04} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="4 4" stroke="var(--dashboard-chart-grid)" vertical={false} />
            <XAxis
              dataKey="date"
              tickLine={false}
              axisLine={false}
              tick={{ fontSize: 11, fill: "var(--dashboard-chart-axis)" }}
            />
            <YAxis
              tickLine={false}
              axisLine={false}
              tick={{ fontSize: 11, fill: "var(--dashboard-chart-axis)" }}
            />
            <Tooltip content={<CustomTooltip />} />
            {compareEnabled && (
              <Area
                type="monotone"
                dataKey="compareValue"
                name="Compare"
                stroke={chartColorTokens.compare}
                strokeWidth={2}
                fill="url(#salesCompare)"
                dot={false}
                activeDot={{ r: 4 }}
              />
            )}
            <Area
              type="monotone"
              dataKey="value"
              name="Sales"
              stroke={chartColorTokens.primary}
              strokeWidth={2.5}
              fill="url(#salesPrimary)"
              dot={false}
              activeDot={{ r: 4 }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

export default SalesOverTimeChart;
