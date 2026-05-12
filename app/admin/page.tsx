import Link from "next/link";
import AdminPage from "@/app/admin/_components/AdminPage";
import AdminFlash from "@/app/admin/_components/AdminFlash";
import AdminInfoTooltip from "@/app/admin/_components/AdminInfoTooltip";
import AdminListingActivityChart from "@/app/admin/_components/AdminListingActivityChart";
import AdminSection from "@/app/admin/_components/AdminSection";
import AdminUserSignupsChart from "@/app/admin/_components/AdminUserSignupsChart";
import { getCustomerBusinessAccountTotal } from "@/lib/admin/accountGrowth";
import { getAdminDashboardKpis } from "@/lib/admin/dashboardKpis";
import { requireAdminRole } from "@/lib/admin/permissions";
import { getAdminDataClient } from "@/lib/supabase/admin";

/**
 * Dashboard metrics source notes:
 * - "Total accounts" should come from unique rows in `public.users` (primary key `id`).
 * - Prior overcount came from `admin_total_users_count()` reading `auth.users`, which can include auth-only users
 *   that are not platform accounts in `public.users`, inflating the dashboard total.
 */

function formatBucketLabel(bucketStart: string) {
  const [year, month, day] = bucketStart.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}

export default async function AdminDashboardPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireAdminRole("admin_readonly");
  const { client } = await getAdminDataClient({ mode: "service" });
  const diagEnabled =
    String(process.env.AUTH_GUARD_DIAG || "") === "1" ||
    String(process.env.NEXT_PUBLIC_AUTH_DIAG || "") === "1";

  const kpis = await getAdminDashboardKpis(client);

  const signupRows = kpis.users.signupSeries30d;
  const signupChartData = signupRows.map((row) => ({
    bucketStart: String(row.bucketStart),
    label: formatBucketLabel(String(row.bucketStart)),
    customerCount: Number(row.customerCount || 0),
    businessCount: Number(row.businessCount || 0),
  }));
  const listingActivityData = kpis.listingActivity.map((row) => ({
    bucketStart: String(row.bucketStart),
    label: formatBucketLabel(String(row.bucketStart)),
    realCreated: Number(row.realCreated || 0),
    demoInternalCreated: Number(row.demoInternalCreated || 0),
    totalCreated: Number(row.totalCreated || 0),
  }));

  if (diagEnabled) {
    console.warn("[admin-dashboard] totals diagnostics", {
      totalUsersFromPublicUsers: kpis.users.total,
      signupsSeriesRows: signupRows.length,
      launchReadyBusinesses: kpis.businesses.launchReady,
      publishedRealListings: kpis.listings.publishedReal,
      distinctApplied: true,
      totalUsersDisplayed: kpis.users.total,
    });
  }

  const pendingVerificationCount = kpis.businesses.pendingVerification;
  const issueCount = kpis.issues.total;

  return (
    <AdminPage className="space-y-0">
      <AdminFlash searchParams={searchParams} />

      <header className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between sm:gap-3">
        <div>
          <h2 className="text-lg font-semibold tracking-normal text-neutral-50 sm:text-2xl">Dashboard</h2>
          <p className="mt-0.5 text-[11px] text-neutral-500 sm:mt-1 sm:text-sm">
            Admin platform summary and latest activity.
          </p>
        </div>
      </header>

      <div className="mt-4 grid gap-4 md:mt-6 lg:grid-cols-2">
        <AdminSection
          title="Launch snapshot"
          description="Prelaunch readiness and supply blockers"
          action={<p className="text-[11px] text-neutral-600 sm:text-xs">Live admin data</p>}
        >
          <LaunchSnapshotList
            rows={[
              {
                label: "Launch-ready businesses",
                value: `${kpis.businesses.launchReady.toLocaleString()} / ${kpis.targets.launchReadyBusinesses.toLocaleString()}`,
                definition:
                  "Real, non-internal businesses with required profile details and at least one published real listing.",
              },
              {
                label: "Published real listings",
                value: kpis.listings.publishedReal,
                definition: "Published listings excluding demo/seeded, internal, or test content.",
              },
              {
                label: "Businesses pending verification",
                value: kpis.businesses.pendingVerification,
                tone: kpis.businesses.pendingVerification > 0 ? "attention" : "default",
              },
              {
                label: "Businesses with no published listings",
                value: kpis.businesses.missingPublishedListings,
                tone: kpis.businesses.missingPublishedListings > 0 ? "attention" : "default",
                definition: "Real businesses that do not yet have a published real listing.",
              },
              {
                label: "Demo/internal listings",
                value: kpis.listings.publishedDemoOrInternal,
                definition:
                  "Published listings excluded from real inventory because they are demo/seeded, internal, test, suspended, or missing a business.",
              },
            ]}
          />
        </AdminSection>

        <AdminSection title="Customer snapshot" description="Testing activity and early intent">
          <LaunchSnapshotList
            rows={[
              {
                label: "Customer intent",
                value: kpis.customerIntent.score,
                definition: "Recent saves, cart additions, and orders used as early testing signals.",
              },
              {
                label: "New customers 7d",
                value: kpis.users.newCustomers7d,
              },
              {
                label: "Saved businesses",
                value: kpis.customerIntent.savedBusinessesTotal,
              },
              {
                label: "Saved listings",
                value: kpis.customerIntent.savedListingsTotal,
              },
              {
                label: "Active carts",
                value: kpis.customerIntent.activeCarts,
                definition: "Current active cart records, not necessarily 7-day activity.",
              },
              {
                label: "Orders 7d",
                value: kpis.customerIntent.orders7d,
              },
            ]}
          />
        </AdminSection>
      </div>

      <div className="mt-6 md:mt-8">
        <AdminSection title="Needs attention">
          <NeedsAttentionList
            pendingVerificationCount={pendingVerificationCount}
            missingPublishedListings={kpis.businesses.missingPublishedListings}
            missingImages={kpis.listings.missingImage}
            issueCount={issueCount}
            moderationIssueCount={kpis.issues.openModerationFlags}
          />
        </AdminSection>
      </div>

      <div className="mt-6 md:mt-8">
        <AdminSection title="Business activation" description="Where businesses are getting stuck before launch readiness">
          <BusinessActivationFunnel
            stages={[
              {
                label: "Business accounts",
                value: kpis.businessActivation.businessAccounts,
                helper: "role = business",
              },
              {
                label: "Profiles completed",
                value: kpis.businessActivation.profilesCompleted,
                helper: "required public fields",
              },
              {
                label: "Pending verification",
                value: kpis.businessActivation.verificationSubmitted,
                helper: "pending admin review",
              },
              {
                label: "Has real listing",
                value: kpis.businessActivation.hasPublishedRealListing,
                helper: "published real inventory",
              },
              {
                label: "Launch-ready",
                value: kpis.businessActivation.launchReady,
                helper: "profile + real listing",
              },
            ]}
          />
        </AdminSection>
      </div>

      <section className="mt-9 md:mt-10">
        <div>
          <h3 className="text-sm font-semibold text-neutral-100 sm:text-base">Marketplace activity</h3>
          <p className="mt-1 hidden text-sm text-neutral-500 sm:block">Inventory creation and published marketplace composition.</p>
        </div>
        <div className="mt-4 grid gap-4 md:mt-5 lg:grid-cols-2">
          <AdminSection title="Listing activity" description="Listings created in the last 30 days">
            <AdminListingActivityChart data={listingActivityData} />
          </AdminSection>

          <AdminSection title="Published inventory" description="Real versus demo/internal published listings">
            <MarketplaceComposition
              real={kpis.marketplaceComposition.publishedReal}
              demoInternal={kpis.marketplaceComposition.publishedDemoInternal}
              total={kpis.marketplaceComposition.publishedTotal}
            />
          </AdminSection>
        </div>
      </section>

      <section className="mt-6 md:mt-8">
        <AdminSection title="Account growth" description="New customer and business accounts in the last 30 days">
          <AccountGrowthTotals
            customers={kpis.users.customersTotal}
            businesses={kpis.users.businessesTotal}
          />
          <AdminUserSignupsChart data={signupChartData} compact />
        </AdminSection>
      </section>
    </AdminPage>
  );
}

function LaunchSnapshotList({
  rows,
}: {
  rows: Array<{
    label: string;
    value: number | string | null;
    definition?: string;
    tone?: "default" | "attention";
  }>;
}) {
  return (
    <div className="divide-y divide-neutral-800/70">
      {rows.map((row) => (
        <LaunchSnapshotRow key={row.label} {...row} />
      ))}
    </div>
  );
}

function LaunchSnapshotRow({
  label,
  value,
  definition,
  tone = "default",
}: {
  label: string;
  value: number | string | null;
  definition?: string;
  tone?: "default" | "attention";
}) {
  const displayValue =
    value === null ? "N/A" : typeof value === "number" ? value.toLocaleString() : value;
  const valueClass =
    tone === "attention" ? "text-amber-200" : "text-neutral-50";

  return (
    <div className="flex items-center justify-between gap-4 py-2.5 first:pt-0 last:pb-0">
      <div className="flex min-w-0 items-center gap-1.5">
        <p className="text-[13px] font-medium text-neutral-300 sm:text-sm">{label}</p>
        {definition ? <AdminInfoTooltip label={`${label} definition`}>{definition}</AdminInfoTooltip> : null}
      </div>
      <p className={`shrink-0 text-right text-sm font-semibold tabular-nums sm:text-base ${valueClass}`}>
        {displayValue}
      </p>
    </div>
  );
}

function BusinessActivationFunnel({
  stages,
}: {
  stages: Array<{ label: string; value: number; helper: string }>;
}) {
  const maxValue = Math.max(...stages.map((stage) => stage.value), 1);

  return (
    <div className="space-y-2 sm:space-y-2.5">
      {stages.map((stage, index) => {
        const width = Math.max((stage.value / maxValue) * 100, stage.value > 0 ? 6 : 0);
        return (
          <div
            key={stage.label}
            className="grid grid-cols-[auto_minmax(92px,1fr)_minmax(38px,0.6fr)_auto] items-center gap-2 sm:grid-cols-[minmax(0,180px)_1fr_minmax(72px,auto)]"
          >
            <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-white/[0.04] text-[10px] font-semibold text-neutral-400 sm:hidden">
              {index + 1}
            </span>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="hidden h-5 w-5 shrink-0 items-center justify-center rounded-full bg-white/[0.04] text-[10px] font-semibold text-neutral-400 sm:flex">
                  {index + 1}
                </span>
                <p className="truncate text-sm font-medium text-neutral-100">{stage.label}</p>
              </div>
              <p className="mt-0.5 truncate text-[10px] text-neutral-500 sm:pl-7 sm:text-[11px]">{stage.helper}</p>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-neutral-950/80 sm:h-2">
              <div
                className="h-full rounded-full bg-neutral-500/70"
                style={{ width: `${width}%` }}
                aria-hidden="true"
              />
            </div>
            <p className="shrink-0 text-right text-sm font-semibold tabular-nums text-neutral-100 sm:text-base">
              {stage.value.toLocaleString()}
            </p>
          </div>
        );
      })}
    </div>
  );
}

function MarketplaceComposition({
  real,
  demoInternal,
  total,
}: {
  real: number;
  demoInternal: number;
  total: number;
}) {
  const realPercent = total > 0 ? (real / total) * 100 : 0;
  const demoPercent = total > 0 ? (demoInternal / total) * 100 : 0;

  return (
    <div className="space-y-4">
      <div className="flex items-end justify-between gap-3">
        <div>
          <p className="text-2xl font-semibold text-neutral-50">{total.toLocaleString()}</p>
          <p className="mt-1 text-xs text-neutral-500">published listings</p>
        </div>
        <div className="text-right text-xs text-neutral-500">
          <p>
            <span className="font-semibold text-neutral-100">{real.toLocaleString()}</span> real
          </p>
          <p>
            <span className="font-semibold text-neutral-100">{demoInternal.toLocaleString()}</span> demo/internal
          </p>
        </div>
      </div>

      <div className="h-3 overflow-hidden rounded-full bg-neutral-950/80">
        <div className="flex h-full w-full">
          <div className="h-full bg-emerald-400/80" style={{ width: `${realPercent}%` }} aria-hidden="true" />
          <div className="h-full bg-violet-300/70" style={{ width: `${demoPercent}%` }} aria-hidden="true" />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div className="rounded-md bg-white/[0.025] px-3 py-2">
          <div className="flex items-center gap-1.5 text-[11px] text-neutral-500">
            <span className="h-2 w-2 rounded-full bg-emerald-400/80" />
            Real inventory
          </div>
          <p className="mt-1 text-sm font-semibold text-neutral-100">{real.toLocaleString()}</p>
        </div>
        <div className="rounded-md bg-white/[0.025] px-3 py-2">
          <div className="flex items-center gap-1.5 text-[11px] text-neutral-500">
            <span className="h-2 w-2 rounded-full bg-violet-300/70" />
            Demo/internal
          </div>
          <p className="mt-1 text-sm font-semibold text-neutral-100">{demoInternal.toLocaleString()}</p>
        </div>
      </div>
    </div>
  );
}

function AccountGrowthTotals({
  customers,
  businesses,
}: {
  customers: number;
  businesses: number;
}) {
  const customerBusinessTotal = getCustomerBusinessAccountTotal({ customers, businesses });

  return (
    <div className="mb-3 grid gap-2 sm:grid-cols-3">
      <AccountGrowthTotal label="Total customers" value={customers} />
      <AccountGrowthTotal label="Total businesses" value={businesses} />
      <AccountGrowthTotal label="Customer + business accounts" value={customerBusinessTotal} />
    </div>
  );
}

function AccountGrowthTotal({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-md bg-white/[0.025] px-3 py-2">
      <p className="text-[11px] font-medium text-neutral-500">{label}</p>
      <p className="mt-1 text-sm font-semibold text-neutral-100 sm:text-base">{value.toLocaleString()}</p>
    </div>
  );
}

function NeedsAttentionList({
  pendingVerificationCount,
  missingPublishedListings,
  missingImages,
  issueCount,
  moderationIssueCount,
}: {
  pendingVerificationCount: number;
  missingPublishedListings: number;
  missingImages: number;
  issueCount: number;
  moderationIssueCount: number;
}) {
  const rows = [
    pendingVerificationCount > 0 ? (
      <AttentionRow
        key="verification"
        label={`${pendingVerificationCount.toLocaleString()} ${
          pendingVerificationCount === 1 ? "business is" : "businesses are"
        } waiting for verification`}
        detail="Review pending requests before they appear fully trusted."
        href="/admin/verification"
        actionLabel="Open queue"
      />
    ) : null,
    missingPublishedListings > 0 ? (
      <AttentionRow
        key="missing-listings"
        label={`${missingPublishedListings.toLocaleString()} businesses have no published real listings`}
        detail="Use the business list to identify owners who need listing help."
        href="/admin/businesses"
        actionLabel="View businesses"
      />
    ) : null,
    missingImages > 0 ? (
      <AttentionRow
        key="missing-images"
        label={`${missingImages.toLocaleString()} real listings are missing images`}
        detail="Listings with missing media are less useful during testing."
        href="/admin/listings"
        actionLabel="View listings"
      />
    ) : null,
    issueCount > 0 ? (
      <AttentionRow
        key="issues"
        label={`${issueCount.toLocaleString()} open moderation/support issues`}
        detail="Open moderation flags and support tickets only."
        href={moderationIssueCount > 0 ? "/admin/moderation" : "/admin/support"}
        actionLabel="Review issues"
      />
    ) : null,
  ].filter(Boolean);

  if (!rows.length) {
    return <p className="text-sm text-neutral-400">No urgent admin actions right now.</p>;
  }

  return <div className="space-y-2">{rows}</div>;
}

function AttentionRow({
  label,
  detail,
  href,
  actionLabel,
}: {
  label: string;
  detail: string;
  href: string;
  actionLabel: string;
}) {
  return (
    <div className="flex flex-col gap-2 border-t border-neutral-800/70 pt-2 first:border-t-0 first:pt-0 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        <p className="text-sm text-neutral-100">{label}</p>
        <p className="mt-0.5 text-xs text-neutral-500">{detail}</p>
      </div>
      <Link
        href={href}
        className="inline-flex min-h-9 shrink-0 items-center justify-center rounded-md bg-[#6e34ff]/15 px-3 py-1.5 text-xs font-medium text-[#ddd6fe] hover:bg-[#6e34ff]/25 sm:min-h-0"
      >
        {actionLabel}
      </Link>
    </div>
  );
}
