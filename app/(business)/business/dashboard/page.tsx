"use client";

import dynamic from "next/dynamic";
import { useEffect, useMemo, useState } from "react";
import DateRangeControls from "@/components/DateRangeControls";
import TopProductsTable from "@/components/TopProductsTable";
import RecentOrders from "@/components/RecentOrders";
import DashboardEmptyState from "@/components/DashboardEmptyState";
import type { DashboardData, DashboardFilters, DateRangeKey } from "@/lib/dashboardTypes";

const ChartSkeleton = ({ title }: { title: string }) => (
  <div className="h-full rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6 shadow-[0_12px_30px_rgba(15,23,42,0.08)]">
    <div className="flex items-center justify-between">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
          Loading
        </p>
        <h3 className="text-lg font-semibold text-slate-900">{title}</h3>
      </div>
      <span className="h-6 w-16 animate-pulse rounded-full bg-slate-200" />
    </div>
    <div className="mt-6 h-56 animate-pulse rounded-2xl bg-slate-100" />
  </div>
);

const SalesOverTimeChart = dynamic(
  () => import("@/components/Charts/SalesOverTimeChart"),
  {
    ssr: false,
    loading: () => <ChartSkeleton title="Sales over time" />,
  }
);
const ProfileViewsChart = dynamic(
  () => import("@/components/Charts/ProfileViewsChart"),
  {
    ssr: false,
    loading: () => <ChartSkeleton title="Profile views" />,
  }
);
type DashboardStatus = "loading" | "ready" | "empty" | "error";

const DEFAULT_FILTERS: DashboardFilters = {
  categories: [],
};

const formatDate = (date: Date) => date.toISOString().slice(0, 10);

const resolveDateRange = (range: DateRangeKey) => {
  const today = new Date();
  const start = new Date(today);
  if (range === "7d") {
    start.setDate(today.getDate() - 6);
  } else if (range === "30d") {
    start.setDate(today.getDate() - 29);
  }
  return { from: formatDate(start), to: formatDate(today) };
};

const DashboardErrorState = ({ onRetry }: { onRetry: () => void }) => (
  <div className="flex min-h-[360px] flex-col items-center justify-center rounded-2xl border border-dashed border-rose-200 bg-rose-50 p-10 text-center">
    <p className="text-sm font-semibold uppercase tracking-[0.2em] text-rose-500">
      Something went wrong
    </p>
    <h3 className="mt-3 text-2xl font-semibold text-rose-900">
      We could not load your dashboard
    </h3>
    <p className="mt-2 max-w-md text-sm text-rose-700">
      Please retry or check your filters and date range.
    </p>
    <button
      type="button"
      onClick={onRetry}
      className="mt-4 rounded-full bg-rose-600 px-4 py-2 text-xs font-semibold text-white"
    >
      Retry
    </button>
  </div>
);

const DashboardPage = () => {
  const [status, setStatus] = useState<DashboardStatus>("loading");
  const [data, setData] = useState<DashboardData | null>(null);
  const [categories, setCategories] = useState<string[]>([]);
  const [dateRange, setDateRange] = useState<DateRangeKey>("30d");
  const [filters, setFilters] = useState<DashboardFilters>(DEFAULT_FILTERS);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    const loadDashboard = async () => {
      setStatus("loading");
      const { from, to } = resolveDateRange(dateRange);
      const query = new URLSearchParams({
        from,
        to,
        compare: "none",
      });
      if (filters.categories.length > 0) {
        query.set("categories", filters.categories.join(","));
      }
      try {
        const response = await fetch(`/api/business/dashboard?${query.toString()}`, {
          cache: "no-store",
        });
        if (!response.ok) {
          throw new Error(`dashboard_fetch_failed:${response.status}`);
        }
        const payload = (await response.json()) as DashboardData;
        setData(payload);
        setCategories(payload.categories ?? []);
        const hasAnyData =
          payload.salesTimeSeries.length > 0 ||
          payload.profileViewsTimeSeries.length > 0 ||
          payload.topProducts.length > 0 ||
          payload.recentOrders.length > 0;
        setStatus(hasAnyData ? "ready" : "empty");
      } catch (err) {
        console.error("Dashboard load failed", err);
        setStatus("error");
      }
    };
    loadDashboard();
  }, [dateRange, filters, reloadKey]);

  const dashboardContent = useMemo(() => {
    if (!data) return null;
    return (
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-12">
        <section className="xl:col-span-6">
          <SalesOverTimeChart data={data.salesTimeSeries} />
        </section>
        <section className="xl:col-span-6">
          <ProfileViewsChart data={data.profileViewsTimeSeries} />
        </section>
        <section className="xl:col-span-6">
          <TopProductsTable products={data.topProducts} />
        </section>
        <section className="xl:col-span-6">
          <RecentOrders orders={data.recentOrders} />
        </section>
      </div>
    );
  }, [data]);

  return (
    <main
      className="business-theme min-h-screen -mt-8 md:-mt-10 px-4 pb-20 pt-10 sm:px-6"
      style={{
        backgroundImage:
          "radial-gradient(circle at 10% 10%, var(--glow-1), transparent 55%), radial-gradient(circle at 80% 0%, var(--glow-2), transparent 50%)",
      }}
    >
      <div className="mx-auto flex max-w-7xl flex-col gap-6">
        <DateRangeControls
          dateRange={dateRange}
          filters={filters}
          categories={categories}
          businessName={data?.businessName}
          lastUpdated={data?.lastUpdated ?? "Just now"}
          onDateRangeChange={setDateRange}
          onFiltersChange={setFilters}
        />

        {status === "loading" && (
          <div className="grid grid-cols-1 gap-6 xl:grid-cols-12">
            <section className="xl:col-span-6">
              <ChartSkeleton title="Sales over time" />
            </section>
            <section className="xl:col-span-6">
              <ChartSkeleton title="Profile views" />
            </section>
            <section className="xl:col-span-6">
              <ChartSkeleton title="Top products" />
            </section>
            <section className="xl:col-span-6">
              <ChartSkeleton title="Recent orders" />
            </section>
          </div>
        )}

        {status === "error" && (
          <DashboardErrorState onRetry={() => setReloadKey((prev) => prev + 1)} />
        )}

        {status === "empty" && <DashboardEmptyState />}

        {status === "ready" && dashboardContent}
      </div>
    </main>
  );
};

export default DashboardPage;
