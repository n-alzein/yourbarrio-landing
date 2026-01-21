"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
} from "recharts";
import type { ChannelPerformance } from "@/lib/dashboardTypes";
import { chartColorTokens } from "@/lib/dashboardTypes";

type ChannelPerformanceProps = {
  channels: ChannelPerformance[];
};

type SortKey = "revenue" | "sessions" | "orders" | "conversionRate";

const formatCurrency = (value: number) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value);

const ChannelPerformanceCard = ({ channels }: ChannelPerformanceProps) => {
  const [sortKey, setSortKey] = useState<SortKey>("revenue");
  const [sortDesc, setSortDesc] = useState(true);

  const sortedChannels = useMemo(() => {
    const data = [...channels];
    data.sort((a, b) => {
      const diff = a[sortKey] - b[sortKey];
      return sortDesc ? diff * -1 : diff;
    });
    return data;
  }, [channels, sortKey, sortDesc]);

  const toggleSort = (key: SortKey) => {
    if (key === sortKey) {
      setSortDesc((prev) => !prev);
    } else {
      setSortKey(key);
      setSortDesc(true);
    }
  };

  return (
    <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6 shadow-[0_12px_30px_rgba(15,23,42,0.08)]">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
            Marketing
          </p>
          <h3 className="text-lg font-semibold text-slate-900">Channel performance</h3>
        </div>
        <Link
          href="/business/dashboard/marketing"
          className="rounded-full border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-600 hover:border-slate-300"
          aria-label="View marketing breakdown"
        >
          Drill down
        </Link>
      </div>
      <div className="mt-6 grid gap-6 lg:grid-cols-[220px_1fr]">
        <div className="h-56">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={channels}
                dataKey="sharePct"
                nameKey="label"
                innerRadius={55}
                outerRadius={85}
                paddingAngle={3}
                stroke="var(--dashboard-chart-card)"
              >
                {channels.map((channel) => (
                  <Cell
                    key={channel.id}
                    fill={chartColorTokens[channel.colorToken]}
                  />
                ))}
              </Pie>
              <Tooltip
                content={({ active, payload }: any) => {
                  if (!active || !payload?.length) return null;
                  const entry = payload[0].payload as ChannelPerformance;
                  return (
                    <div
                      className="dashboard-tooltip rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs shadow-lg"
                      style={{ color: "#0f172a" }}
                    >
                      <p className="font-semibold" style={{ color: "#0f172a" }}>
                        {entry.label}
                      </p>
                      <p style={{ color: "#1f2937" }}>Share {entry.sharePct}%</p>
                    </div>
                  );
                }}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>
        <div className="overflow-hidden rounded-2xl border border-slate-200">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-wider text-slate-500">
              <tr>
                <th className="px-4 py-3 text-left">Channel</th>
                <th
                  className="px-4 py-3 text-right"
                  aria-sort={
                    sortKey === "sessions"
                      ? sortDesc
                        ? "descending"
                        : "ascending"
                      : "none"
                  }
                >
                  <button
                    type="button"
                    onClick={() => toggleSort("sessions")}
                    className="font-semibold text-slate-500 hover:text-slate-700"
                  >
                    Sessions
                  </button>
                </th>
                <th
                  className="px-4 py-3 text-right"
                  aria-sort={
                    sortKey === "orders" ? (sortDesc ? "descending" : "ascending") : "none"
                  }
                >
                  <button
                    type="button"
                    onClick={() => toggleSort("orders")}
                    className="font-semibold text-slate-500 hover:text-slate-700"
                  >
                    Orders
                  </button>
                </th>
                <th
                  className="px-4 py-3 text-right"
                  aria-sort={
                    sortKey === "conversionRate"
                      ? sortDesc
                        ? "descending"
                        : "ascending"
                      : "none"
                  }
                >
                  <button
                    type="button"
                    onClick={() => toggleSort("conversionRate")}
                    className="font-semibold text-slate-500 hover:text-slate-700"
                  >
                    Conv.
                  </button>
                </th>
                <th
                  className="px-4 py-3 text-right"
                  aria-sort={
                    sortKey === "revenue" ? (sortDesc ? "descending" : "ascending") : "none"
                  }
                >
                  <button
                    type="button"
                    onClick={() => toggleSort("revenue")}
                    className="font-semibold text-slate-500 hover:text-slate-700"
                  >
                    Revenue
                  </button>
                </th>
              </tr>
            </thead>
            <tbody>
              {sortedChannels.map((channel) => (
                <tr key={channel.id} className="border-t border-slate-200">
                  <td className="px-4 py-3">
                    <Link
                      href={channel.href}
                      className="flex items-center gap-2 font-semibold text-slate-700 hover:text-slate-900"
                    >
                      <span
                        className="h-2 w-2 rounded-full"
                        style={{ backgroundColor: chartColorTokens[channel.colorToken] }}
                      />
                      {channel.label}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-right text-slate-600">
                    {channel.sessions.toLocaleString()}
                  </td>
                  <td className="px-4 py-3 text-right text-slate-600">
                    {channel.orders.toLocaleString()}
                  </td>
                  <td className="px-4 py-3 text-right text-slate-600">
                    {channel.conversionRate.toFixed(1)}%
                  </td>
                  <td className="px-4 py-3 text-right font-semibold text-slate-900">
                    {formatCurrency(channel.revenue)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default ChannelPerformanceCard;
