"use client";

import { useMemo, useState } from "react";
import type { DashboardFilters, DateRangeKey } from "@/lib/dashboardTypes";

const DATE_RANGES: { value: DateRangeKey; label: string }[] = [
  { value: "7d", label: "7d" },
  { value: "30d", label: "30d" },
];

type DateRangeControlsProps = {
  dateRange: DateRangeKey;
  filters: DashboardFilters;
  categories: string[];
  businessName?: string;
  businessAvatarUrl?: string | null;
  lastUpdated: string;
  onDateRangeChange: (value: DateRangeKey) => void;
  onFiltersChange: (filters: DashboardFilters) => void;
};

const DateRangeControls = ({
  dateRange,
  filters,
  categories,
  businessName,
  businessAvatarUrl,
  lastUpdated,
  onDateRangeChange,
  onFiltersChange,
}: DateRangeControlsProps) => {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const displayName = businessName || "YourBarrio";
  const initials = displayName
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");

  const activeFilters = useMemo(() => {
    return (
      filters.categories.length
    );
  }, [filters]);

  const toggleFilter = (value: string) => {
    const next = new Set(filters.categories);
    if (next.has(value)) {
      next.delete(value);
    } else {
      next.add(value);
    }
    onFiltersChange({ ...filters, categories: Array.from(next) });
  };

  const resetFilters = () => {
    onFiltersChange({ categories: [] });
  };

  return (
    <section className="flex flex-col gap-4 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6 shadow-[0_12px_30px_rgba(15,23,42,0.08)]">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-start gap-4">
          <div className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-full bg-slate-900 text-xs font-semibold uppercase text-white">
            {businessAvatarUrl ? (
              <img
                src={businessAvatarUrl}
                alt={`${displayName} avatar`}
                className="h-full w-full object-cover"
              />
            ) : (
              initials || "BY"
            )}
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
              Overview
            </p>
            <h1 className="text-2xl font-semibold text-slate-900">
              {displayName} Command Center
            </h1>
            <p className="text-sm text-slate-600">
              Fast scan of revenue, conversion, and inventory signals.
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <div
            className="flex items-center rounded-full border border-[var(--border)] bg-white/80 p-1"
            role="group"
            aria-label="Date range"
          >
            {DATE_RANGES.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => onDateRangeChange(option.value)}
                className={`rounded-full px-3 py-1 text-xs font-semibold transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900 ${
                  dateRange === option.value
                    ? "bg-slate-900 text-white dashboard-toggle-active"
                    : "text-slate-600 hover:text-slate-900"
                }`}
                aria-pressed={dateRange === option.value}
              >
                {option.label}
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={() => setDrawerOpen(true)}
            className="flex items-center gap-2 rounded-full border border-[var(--border)] bg-white/80 px-4 py-2 text-xs font-semibold text-slate-700 transition hover:border-slate-400 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900"
            aria-label="Open filters"
          >
            Filters
            {activeFilters > 0 && (
              <span className="rounded-full bg-slate-900 px-2 py-0.5 text-[10px] font-semibold text-white">
                {activeFilters}
              </span>
            )}
          </button>
          <div className="text-xs text-slate-500">
            Last updated <span className="font-semibold text-slate-700">{lastUpdated}</span>
          </div>
        </div>
      </div>
      {drawerOpen && (
        <div
          className="fixed inset-0 z-40 flex justify-end bg-slate-900/40 p-4 pt-24"
          role="dialog"
          aria-modal="true"
          aria-label="Filters"
        >
          <div className="flex h-auto w-full max-h-[65vh] max-w-sm flex-col rounded-2xl bg-white p-5 shadow-2xl">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-slate-900">Filters</h2>
              <button
                type="button"
                onClick={() => setDrawerOpen(false)}
                className="rounded-full border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-600 hover:border-slate-300"
              >
                Close
              </button>
            </div>
            <div className="mt-4 flex-1 space-y-6 overflow-auto pr-1">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                  Categories
                </p>
                <div className="mt-3 grid gap-2">
                  {categories.length === 0 && (
                    <p className="text-xs text-slate-500">
                      No categories available for this business.
                    </p>
                  )}
                  {categories.map((option) => (
                    <label
                      key={option}
                      className="flex items-center justify-between rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-700"
                    >
                      <span>{option}</span>
                      <input
                        type="checkbox"
                        className="h-4 w-4 rounded border-slate-300 text-slate-900 focus:ring-slate-900"
                        checked={filters.categories.includes(option)}
                        onChange={() => toggleFilter(option)}
                        aria-label={`Filter ${option}`}
                      />
                    </label>
                  ))}
                </div>
              </div>
            </div>
            <div className="mt-4 flex items-center justify-between">
              <button
                type="button"
                onClick={resetFilters}
                className="text-xs font-semibold text-slate-500 hover:text-slate-700"
              >
                Reset filters
              </button>
              <button
                type="button"
                onClick={() => setDrawerOpen(false)}
                className="dashboard-apply-filters rounded-full bg-slate-900 px-4 py-2 text-xs font-semibold text-white"
              >
                Apply filters
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
};

export default DateRangeControls;
