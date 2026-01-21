"use client";

import Link from "next/link";
import type { AlertTask } from "@/lib/dashboardTypes";

type AlertsPanelProps = {
  alerts: AlertTask[];
  tasks: AlertTask[];
};

const getSeverityTone = (severity: AlertTask["severity"]) => {
  if (severity === "high") return "bg-rose-100 text-rose-700";
  if (severity === "medium") return "bg-amber-100 text-amber-700";
  return "bg-emerald-100 text-emerald-700";
};

const AlertsPanel = ({ alerts, tasks }: AlertsPanelProps) => {
  return (
    <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6 shadow-[0_12px_30px_rgba(15,23,42,0.08)]">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
            Attention
          </p>
          <h3 className="text-lg font-semibold text-slate-900">Alerts & tasks</h3>
        </div>
        <span className="rounded-full bg-slate-900 px-3 py-1 text-xs font-semibold text-white">
          {alerts.length + tasks.length} items
        </span>
      </div>
      <div className="mt-6 space-y-4">
        {[...alerts, ...tasks].map((item) => (
          <div
            key={item.id}
            className="rounded-2xl border border-slate-200 bg-white p-4"
          >
            <div className="flex items-start justify-between gap-4">
              <div className="space-y-1">
                <p className="text-sm font-semibold text-slate-900">{item.title}</p>
                <p className="text-xs text-slate-600">{item.description}</p>
              </div>
              <span
                className={`rounded-full px-2 py-1 text-[10px] font-semibold uppercase ${getSeverityTone(
                  item.severity
                )}`}
              >
                {item.kind}
              </span>
            </div>
            {item.actionLabel && item.href && (
              <div className="mt-3">
                <Link
                  href={item.href}
                  className="text-xs font-semibold text-slate-900 hover:text-slate-700"
                >
                  {item.actionLabel} →
                </Link>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

export default AlertsPanel;
