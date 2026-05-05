"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { BadgeCheck, Landmark, Loader2 } from "lucide-react";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import DateRangeControls from "@/components/DateRangeControls";
import TopProductsTable from "@/components/TopProductsTable";
import RecentOrders from "@/components/RecentOrders";
import type { BusinessStripeStatus } from "@/lib/stripe/status";
import type {
  DashboardData,
  DashboardFilters,
  DateRangeKey,
  TimeSeriesPoint,
} from "@/lib/dashboardTypes";

const SalesOverTimeChart = dynamic(
  () => import("@/components/Charts/SalesOverTimeChart"),
  {
    ssr: false,
    loading: () => <PanelSkeleton className="h-[320px]" />,
  }
);
const ProfileViewsChart = dynamic(
  () => import("@/components/Charts/ProfileViewsChart"),
  {
    ssr: false,
    loading: () => <PanelSkeleton className="h-[320px]" />,
  }
);

type StripeConnectStatus = BusinessStripeStatus;
type DashboardFetchState = "idle" | "loading" | "refreshing" | "error";
type PayoutCardState = "ready" | "needs_action" | "issue";
type PayoutCardViewModel = {
  state: PayoutCardState;
  title: string;
  body: string;
  actionLabel: string;
};
type SetupItem = {
  id: string;
  label: string;
  complete: boolean;
};

const DEFAULT_FILTERS: DashboardFilters = {
  categories: [],
};
const DASHBOARD_CACHE_KEY = "yb:business-dashboard:v1";
const DASHBOARD_SKELETON_DELAY_MS = 200;
const DEFAULT_SETUP_ITEMS: SetupItem[] = [
  { id: "profile", label: "Profile complete", complete: false },
  { id: "product", label: "First product", complete: false },
  { id: "profile_visibility", label: "Profile ready", complete: false },
];

let dashboardMemoryCache: DashboardData | null = null;

const startOfLocalDay = (date: Date) =>
  new Date(date.getFullYear(), date.getMonth(), date.getDate(), 0, 0, 0, 0);

const endOfLocalDay = (date: Date) =>
  new Date(date.getFullYear(), date.getMonth(), date.getDate(), 23, 59, 59, 999);

const resolveDateRange = (range: DateRangeKey) => {
  const today = new Date();
  const start = startOfLocalDay(today);
  const end = endOfLocalDay(today);
  if (range === "7d") {
    start.setDate(start.getDate() - 6);
  } else if (range === "30d") {
    start.setDate(start.getDate() - 29);
  }
  return { from: start.toISOString(), to: end.toISOString() };
};

const formatCurrency = (value: number) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value);

const formatNumber = (value: number) => new Intl.NumberFormat("en-US").format(value);

const sumSeries = (series: TimeSeriesPoint[]) =>
  series.reduce((total, point) => total + Number(point.value || 0), 0);

const countNonZeroPoints = (series: TimeSeriesPoint[]) =>
  series.filter((point) => Number(point.value || 0) > 0).length;

const hasMeaningfulSeries = (series: TimeSeriesPoint[]) => {
  const nonZeroPoints = countNonZeroPoints(series);
  const total = sumSeries(series);
  return nonZeroPoints >= 3 || (nonZeroPoints >= 2 && total >= 10);
};

const rangeLabel: Record<DateRangeKey, string> = {
  today: "Today",
  "7d": "Last 7 days",
  "30d": "Last 30 days",
  custom: "Selected range",
};

const DashboardErrorState = ({ onRetry }: { onRetry: () => void }) => (
  <div className="flex min-h-[300px] flex-col items-center justify-center rounded-[28px] border border-dashed border-rose-200 bg-rose-50 p-10 text-center">
    <p className="text-sm font-semibold uppercase tracking-[0.2em] text-rose-500">
      Something went wrong
    </p>
    <h3 className="mt-3 text-2xl font-semibold text-rose-900">
      We could not load your dashboard
    </h3>
    <p className="mt-2 max-w-md text-sm text-rose-700">
      Retry and we&apos;ll pull your latest business activity again.
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

const readDashboardCache = () => {
  if (dashboardMemoryCache) return dashboardMemoryCache;
  if (typeof window === "undefined") return null;
  try {
    const raw = window.sessionStorage.getItem(DASHBOARD_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as DashboardData;
    dashboardMemoryCache = parsed;
    return parsed;
  } catch {
    return null;
  }
};

const writeDashboardCache = (nextData: DashboardData) => {
  dashboardMemoryCache = nextData;
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(DASHBOARD_CACHE_KEY, JSON.stringify(nextData));
  } catch {
    // Ignore storage failures and keep the in-memory cache.
  }
};

function useDelayedVisibility(active: boolean, delayMs = DASHBOARD_SKELETON_DELAY_MS) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!active) {
      const resetTimeout = window.setTimeout(() => setVisible(false), 0);
      return () => window.clearTimeout(resetTimeout);
    }

    const timeout = window.setTimeout(() => setVisible(true), delayMs);
    return () => window.clearTimeout(timeout);
  }, [active, delayMs]);

  return active && visible;
}

function PanelSkeleton({ className = "" }: { className?: string }) {
  return (
    <div
      className={`dashboard-panel p-5 sm:p-6 ${className}`}
    >
      <div className="h-3 w-24 animate-pulse rounded-md bg-slate-200" />
      <div className="mt-3 h-8 w-40 animate-pulse rounded-md bg-slate-100" />
      <div className="mt-5 h-32 animate-pulse rounded-[18px] bg-slate-100" />
    </div>
  );
}

function SectionShell({
  className = "",
  showSkeleton = false,
  lines = 3,
}: {
  className?: string;
  showSkeleton?: boolean;
  lines?: number;
}) {
  return (
    <div className={`dashboard-panel p-5 sm:p-6 ${className}`}>
      <div className="h-3 w-24 rounded-md bg-slate-200/70" />
      <div className="mt-3 h-8 w-40 rounded-md bg-slate-100/80" />
      <div className="mt-5 space-y-3">
        {Array.from({ length: lines }).map((_, index) => (
          <div
            key={index}
            className={`h-10 rounded-[14px] bg-slate-100/85 ${
              showSkeleton ? "animate-pulse" : ""
            }`}
          />
        ))}
      </div>
    </div>
  );
}

function ContentFade({
  ready,
  children,
}: {
  ready: boolean;
  children: ReactNode;
}) {
  return (
    <div
      className={`transition-opacity duration-200 ${
        ready ? "opacity-100" : "opacity-80"
      }`}
    >
      {children}
    </div>
  );
}

function PerformanceSnapshot({
  totalSales,
  totalViews,
  totalOrders,
  dateRange,
}: {
  totalSales: number;
  totalViews: number;
  totalOrders: number;
  dateRange: DateRangeKey;
}) {
  const showStarterGuidance = totalSales === 0 && totalViews === 0 && totalOrders === 0;
  const showConversionGuidance = totalViews > 0 && totalOrders === 0;
  const kpis = [
    {
      label: "Sales",
      value: formatCurrency(totalSales),
      helper: "Revenue",
    },
    {
      label: "Views",
      value: formatNumber(totalViews),
      helper: "Storefront visits",
    },
    {
      label: "Orders",
      value: formatNumber(totalOrders),
      helper: "New purchases",
    },
  ];

  return (
    <section className="dashboard-panel overflow-hidden">
      <div className="flex flex-col gap-1 border-b border-slate-100/70 px-5 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <div>
          <p className="text-[0.66rem] font-semibold uppercase tracking-[0.18em] text-slate-400/80">
            Performance snapshot
          </p>
        </div>
        <p className="text-[0.72rem] font-medium text-slate-400/80">{rangeLabel[dateRange]}</p>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3">
        {kpis.map((kpi, index) => (
          <div
            key={kpi.label}
            className={`px-5 py-3.5 sm:px-6 sm:py-4 ${
              index > 0 ? "border-t border-slate-100/65 sm:border-l sm:border-t-0" : ""
            }`}
          >
            <p className="text-[0.62rem] font-medium uppercase tracking-[0.16em] text-slate-400/75">
              {kpi.label}
            </p>
            <p className="mt-1.5 text-[1.45rem] font-semibold leading-tight tracking-[-0.035em] text-slate-950 sm:text-[1.65rem]">
              {kpi.value}
            </p>
            <p className="mt-0.5 text-[0.8rem] text-slate-500/90">{kpi.helper}</p>
          </div>
        ))}
      </div>
      {showStarterGuidance || showConversionGuidance ? (
        <div className="flex flex-col gap-3 border-t border-slate-100/70 bg-slate-50/35 px-5 py-3.5 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <p className="max-w-2xl text-sm leading-6 text-slate-500">
            {showStarterGuidance
              ? "Start by publishing products and sharing your profile."
              : "People are finding your shop. Add more products or improve photos to convert visits."}
          </p>
          {showStarterGuidance ? (
            <div className="flex flex-wrap gap-2">
              <Link
                href="/business/listings/new"
                className="yb-primary-button inline-flex h-9 items-center justify-center rounded-lg px-3 text-xs font-semibold !text-white hover:!text-white focus-visible:!text-white"
              >
                Add product
              </Link>
              <Link
                href="/business/profile"
                className="inline-flex h-9 items-center justify-center rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-600 transition hover:border-slate-300 hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgba(var(--brand-rgb),0.35)] focus-visible:ring-offset-2"
              >
                View profile
              </Link>
            </div>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}

function DashboardSection({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="space-y-3">
      <p className="text-[0.68rem] font-semibold uppercase tracking-[0.2em] text-slate-400/85">
        {title}
      </p>
      {children}
    </section>
  );
}

function ChartEmptyState({
  eyebrow,
  title,
}: {
  eyebrow: string;
  title: string;
}) {
  return (
    <div className="dashboard-panel relative h-full p-5 transition duration-200 hover:-translate-y-[1px] hover:border-slate-300 sm:p-6">
      <div>
        <p className="text-[0.66rem] font-semibold uppercase tracking-[0.2em] text-slate-400/85">
          {eyebrow}
        </p>
        <h3 className="text-lg font-semibold text-slate-900">{title}</h3>
      </div>
      <div className="dashboard-panel-inner mt-6 flex h-[240px] flex-col items-center justify-center p-6 text-center sm:h-[260px]">
        <p className="text-base font-semibold text-slate-900">Not enough activity yet</p>
        <p className="mt-2 max-w-sm text-sm leading-6 text-slate-500">
          Your charts will appear once customers start viewing and ordering from your shop.
        </p>
      </div>
    </div>
  );
}

function getPayoutViewModel(
  stripeStatus: StripeConnectStatus | null
): PayoutCardViewModel {
  const isPayoutReady =
    stripeStatus?.uiStatus === "active" ||
    (stripeStatus?.hasStripeAccount &&
      stripeStatus.chargesEnabled &&
      stripeStatus.payoutsEnabled &&
      stripeStatus.detailsSubmitted);

  if (isPayoutReady) {
    return {
      state: "ready",
      title: "Payouts enabled",
      body: "You're all set to receive payouts from your sales.",
      actionLabel: "Manage payouts",
    };
  }

  if (
    stripeStatus?.hasStripeAccount &&
    stripeStatus.uiStatus !== "restricted"
  ) {
    return {
      state: "needs_action",
      title: "Complete payouts to start getting paid",
      body: "Finish your Stripe setup so payouts can be sent to your bank account.",
      actionLabel: "Finish setup",
    };
  }

  return {
    state: "issue",
    title: "Complete payouts to start getting paid",
    body: "Finish your Stripe setup so payouts can be sent to your bank account.",
    actionLabel: "Fix setup",
  };
}

function getPayoutReadinessViewModel(
  stripeStatus: StripeConnectStatus | null,
  loading: boolean
) {
  if (loading) return null;
  const payoutViewModel = getPayoutViewModel(stripeStatus);
  if (payoutViewModel.state === "ready") return null;

  return {
    state: payoutViewModel.state,
    label: "Payments not ready",
    description: "Finish Stripe setup before payouts can be sent.",
  } as const;
}

function StripeStatusCard({
  status,
  loading,
  actionLoading,
  error,
  onAction,
  onRetry,
}: {
  status: StripeConnectStatus | null;
  loading: boolean;
  actionLoading: boolean;
  error: string;
  onAction: () => void;
  onRetry: () => void;
}) {
  const viewModel = getPayoutViewModel(status);
  const showAction = !loading;
  const isReady = viewModel.state === "ready";
  const statusLabel = loading ? "Checking setup" : "Ready to get paid";
  const showStatusBadge = loading || isReady;

  return (
    <section className="dashboard-panel p-5 sm:p-6">
      <div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
        <div className="flex gap-4">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[14px] border border-slate-200 bg-slate-50 text-slate-700">
            {loading ? (
              <Loader2 className="h-5 w-5 animate-spin text-slate-400" />
            ) : isReady ? (
              <BadgeCheck className="h-5 w-5 text-emerald-600" />
            ) : (
              <Landmark className="h-5 w-5 text-amber-600" />
            )}
          </div>
          <div>
            <p className="text-[0.68rem] font-semibold uppercase tracking-[0.2em] text-slate-400/85">
              Payouts
            </p>
            <div className="mt-1 flex flex-wrap items-center gap-2">
              <h2 className="text-xl font-semibold text-slate-950">
                {loading ? "Checking payout setup" : viewModel.title}
              </h2>
              {showStatusBadge ? (
                <span
                  className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[0.68rem] font-semibold uppercase tracking-[0.14em] ${
                    isReady
                      ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                      : "border-slate-200 bg-slate-50 text-slate-500"
                  }`}
                >
                  {statusLabel}
                </span>
              ) : null}
            </div>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">
              {loading
                ? "We're checking whether your payout setup is ready."
                : viewModel.body}
            </p>
            <p className="mt-3 text-xs font-medium text-slate-400">
              Powered by Stripe
            </p>
            {error ? (
              <p className="mt-2 text-sm text-rose-600">
                We couldn&apos;t refresh your payout status. Try again.
              </p>
            ) : null}
          </div>
        </div>
        <div className="flex shrink-0 flex-col gap-2 md:items-end">
          {showAction ? (
            <button
              type="button"
              onClick={onAction}
              disabled={loading || actionLoading}
              className="yb-primary-button inline-flex min-w-[190px] items-center justify-center gap-2 rounded-full px-5 py-2.5 text-sm font-semibold !text-white hover:!text-white focus-visible:!text-white active:!text-white disabled:cursor-not-allowed disabled:!text-white disabled:opacity-60"
            >
              {actionLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              {actionLoading ? "Opening Stripe..." : viewModel.actionLabel}
            </button>
          ) : null}
          <button
            type="button"
            onClick={onRetry}
            disabled={loading || actionLoading}
            className="inline-flex items-center justify-center rounded-full px-3 py-1.5 text-xs font-semibold text-slate-400 transition hover:bg-slate-50 hover:text-slate-600 disabled:cursor-not-allowed disabled:opacity-60"
          >
            Refresh status
          </button>
        </div>
      </div>
    </section>
  );
}

const DashboardPage = () => {
  const [data, setData] = useState<DashboardData | null>(() => dashboardMemoryCache);
  const [fetchState, setFetchState] = useState<DashboardFetchState>(() =>
    dashboardMemoryCache ? "refreshing" : "loading"
  );
  const [loadError, setLoadError] = useState("");
  const [dateRange, setDateRange] = useState<DateRangeKey>("30d");
  const [filters, setFilters] = useState<DashboardFilters>(DEFAULT_FILTERS);
  const [reloadKey, setReloadKey] = useState(0);
  const [stripeStatus, setStripeStatus] = useState<StripeConnectStatus | null>(null);
  const [stripeLoading, setStripeLoading] = useState(true);
  const [stripeError, setStripeError] = useState("");
  const [stripeActionLoading, setStripeActionLoading] = useState(false);
  const hasDataRef = useRef(Boolean(data));
  const showSectionSkeletons = useDelayedVisibility(!data && fetchState === "loading");

  useEffect(() => {
    hasDataRef.current = Boolean(data);
  }, [data]);

  useEffect(() => {
    if (data) return;
    const cachedData = readDashboardCache();
    if (!cachedData) return;
    setData(cachedData);
    setFetchState("refreshing");
  }, [data]);

  useEffect(() => {
    let cancelled = false;

    const loadDashboard = async () => {
      if (!cancelled) {
        setFetchState(hasDataRef.current ? "refreshing" : "loading");
        setLoadError("");
      }
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
        if (cancelled) return;
        setData(payload);
        writeDashboardCache(payload);
        setFetchState("idle");
      } catch (err) {
        if (cancelled) return;
        console.error("Dashboard load failed", err);
        setLoadError("We could not load your dashboard.");
        setFetchState(hasDataRef.current ? "idle" : "error");
      }
    };

    loadDashboard();

    const handleVisibilityRefresh = () => {
      if (document.visibilityState === "visible") {
        loadDashboard();
      }
    };

    window.addEventListener("focus", loadDashboard);
    document.addEventListener("visibilitychange", handleVisibilityRefresh);

    return () => {
      cancelled = true;
      window.removeEventListener("focus", loadDashboard);
      document.removeEventListener("visibilitychange", handleVisibilityRefresh);
    };
  }, [dateRange, filters, reloadKey]);

  const loadStripeStatus = async () => {
    setStripeLoading(true);
    setStripeError("");
    try {
      const response = await fetch("/api/stripe/connect/status", {
        cache: "no-store",
      });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload?.error || "Failed to load Stripe status");
      }
      setStripeStatus(payload as StripeConnectStatus);
    } catch (err: any) {
      setStripeError(err?.message || "Failed to load Stripe status");
    } finally {
      setStripeLoading(false);
    }
  };

  useEffect(() => {
    loadStripeStatus();
  }, []);

  const handleStripeAction = async () => {
    setStripeActionLoading(true);
    setStripeError("");
    try {
      const response = await fetch("/api/stripe/connect/start", {
        method: "POST",
        credentials: "include",
      });
      const payload = await response.json();
      if (!response.ok || !payload?.url) {
        throw new Error(payload?.error || "Failed to start Stripe onboarding");
      }
      window.location.href = payload.url;
    } catch (err: any) {
      setStripeError(err?.message || "Failed to start Stripe onboarding");
      setStripeActionLoading(false);
    }
  };

  const dashboardState = useMemo(() => {
    const source = data;
    const totalSales = source ? sumSeries(source.salesTimeSeries) : 0;
    const totalViews = source
      ? typeof source.viewCount === "number"
        ? source.viewCount
        : sumSeries(source.profileViewsTimeSeries)
      : 0;
    const totalOrders = source ? source.orderCount ?? source.recentOrders.length : 0;
    const listingCount = source?.listingCount ?? 0;

    const salesHasChart = source ? hasMeaningfulSeries(source.salesTimeSeries) : false;
    const viewsHasChart = source ? hasMeaningfulSeries(source.profileViewsTimeSeries) : false;

    const setupItems = [
      { id: "profile", label: "Profile complete", complete: Boolean(source?.businessName) },
      { id: "product", label: "First product", complete: listingCount > 0 },
      { id: "profile_visibility", label: "Profile ready", complete: Boolean(source?.businessName) },
    ];

    return {
      setupItems,
      salesHasChart,
      viewsHasChart,
      totalSales,
      totalViews,
      totalOrders,
    };
  }, [data]);

  const categories = data?.categories ?? [];
  const hasDashboardData = Boolean(data && dashboardState);
  const showFatalError = fetchState === "error" && !hasDashboardData;
  const dashboardLastUpdated = data?.lastUpdated ?? "Just now";
  const dashboardName = data?.businessName;
  const dashboardAvatarUrl = data?.businessAvatarUrl ?? null;
  const setupItems = dashboardState?.setupItems ?? DEFAULT_SETUP_ITEMS;
  const payoutReadiness = getPayoutReadinessViewModel(stripeStatus, stripeLoading);

  return (
    <main
      className="business-theme min-h-screen px-4 pb-20 sm:px-6"
      style={{ backgroundColor: "#f6f7fb" }}
    >
      <div className="mx-auto flex max-w-7xl flex-col gap-6 sm:gap-[1.625rem]">
        {showFatalError ? (
          <DashboardErrorState onRetry={() => setReloadKey((prev) => prev + 1)} />
        ) : (
          <>
            <DateRangeControls
              dateRange={dateRange}
              filters={filters}
              categories={categories}
              businessName={dashboardName}
              businessAvatarUrl={dashboardAvatarUrl}
              lastUpdated={dashboardLastUpdated}
              setupItems={setupItems}
              payoutReadiness={payoutReadiness}
              onDateRangeChange={setDateRange}
              onFiltersChange={setFilters}
            />

            {loadError && hasDashboardData ? (
              <div className="rounded-[14px] border border-amber-200 bg-amber-50/90 px-4 py-3 text-sm text-amber-800">
                {loadError}
              </div>
            ) : null}

            <ContentFade ready={hasDashboardData}>
              <StripeStatusCard
                status={stripeStatus}
                loading={stripeLoading}
                actionLoading={stripeActionLoading}
                error={stripeError}
                onAction={handleStripeAction}
                onRetry={loadStripeStatus}
              />
            </ContentFade>

            {hasDashboardData && dashboardState ? (
              <ContentFade ready>
                <PerformanceSnapshot
                  totalSales={dashboardState.totalSales}
                  totalViews={dashboardState.totalViews}
                  totalOrders={dashboardState.totalOrders}
                  dateRange={dateRange}
                />
              </ContentFade>
            ) : (
              <SectionShell className="h-[174px]" showSkeleton={showSectionSkeletons} lines={2} />
            )}

            {hasDashboardData && dashboardState && data ? (
              <DashboardSection title="Performance">
                <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
                  <div className="min-w-0">
                    {dashboardState.salesHasChart ? (
                      <SalesOverTimeChart data={data.salesTimeSeries} />
                    ) : (
                      <ChartEmptyState eyebrow="Sales" title="Sales over time" />
                    )}
                  </div>
                  <div className="min-w-0">
                    {dashboardState.viewsHasChart ? (
                      <ProfileViewsChart data={data.profileViewsTimeSeries} />
                    ) : (
                      <ChartEmptyState eyebrow="Traffic" title="Profile views" />
                    )}
                  </div>
                </div>
              </DashboardSection>
            ) : !hasDashboardData ? (
              <DashboardSection title="Performance">
                <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
                  <SectionShell className="h-[320px]" showSkeleton={showSectionSkeletons} lines={3} />
                  <SectionShell className="h-[320px]" showSkeleton={showSectionSkeletons} lines={3} />
                </div>
              </DashboardSection>
            ) : null}

            {hasDashboardData && data ? (
              <ContentFade ready>
                <DashboardSection title="Operations">
                  <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
                    <div className="min-w-0">
                      <TopProductsTable
                        products={data.topProducts}
                        totalLiveProductsCount={data.totalLiveProductsCount ?? data.listingCount ?? 0}
                      />
                    </div>
                    <div className="min-w-0">
                      <RecentOrders orders={data.recentOrders} />
                    </div>
                  </div>
                </DashboardSection>
              </ContentFade>
            ) : null}
            {!hasDashboardData ? (
              <DashboardSection title="Operations">
                <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
                  <SectionShell className="h-[360px]" showSkeleton={showSectionSkeletons} lines={4} />
                  <SectionShell className="h-[360px]" showSkeleton={showSectionSkeletons} lines={4} />
                </div>
              </DashboardSection>
            ) : null}
          </>
        )}
      </div>
    </main>
  );
};

export default DashboardPage;
