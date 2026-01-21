"use client";

const DashboardEmptyState = () => {
  return (
    <div className="flex min-h-[360px] flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-white p-10 text-center">
      <p className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-500">
        No data
      </p>
      <h3 className="mt-3 text-2xl font-semibold text-slate-900">
        No activity in this range
      </h3>
      <p className="mt-2 max-w-md text-sm text-slate-600">
        Try expanding the date range or clearing filters to surface more performance data.
      </p>
    </div>
  );
};

export default DashboardEmptyState;
