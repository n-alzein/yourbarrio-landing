import "server-only";

const VERIFIED_BUSINESS_STATUSES = new Set(["auto_verified", "manually_verified"]);
const PRELAUNCH_TARGET_BUSINESSES = 10;
const PRELAUNCH_TARGET_REAL_LISTINGS = 50;

type CountQueryBuilder = {
  select: (columns: string, options?: { count?: "exact"; head?: boolean }) => any;
};

type AdminDataClient = {
  from: (table: string) => CountQueryBuilder & any;
};

type UserKpiRow = {
  id: string;
  role: string | null;
  created_at: string | null;
};

type BusinessKpiRow = {
  owner_user_id: string | null;
  business_name: string | null;
  city: string | null;
  category: string | null;
  description: string | null;
  is_internal: boolean | null;
  is_seeded: boolean | null;
  verification_status: string | null;
  created_at: string | null;
};

type ListingKpiRow = {
  id: string;
  business_id: string | null;
  title: string | null;
  description: string | null;
  price: number | null;
  photo_url: string | null;
  cover_image_id: string | null;
  status: string | null;
  is_seeded: boolean | null;
  is_internal: boolean | null;
  is_test: boolean | null;
  admin_hidden: boolean | null;
  deleted_at: string | null;
  created_at: string | null;
};

export type AdminDashboardKpis = {
  targets: {
    launchReadyBusinesses: number;
    publishedRealListings: number;
  };
  users: {
    total: number;
    customersTotal: number;
    businessesTotal: number;
    newCustomers7d: number;
    newBusinesses7d: number;
    signupSeries7d: Array<{
      bucketStart: string;
      customerCount: number;
      businessCount: number;
    }>;
    signupSeries30d: Array<{
      bucketStart: string;
      customerCount: number;
      businessCount: number;
    }>;
    signupSeriesYtd: Array<{
      bucketStart: string;
      customerCount: number;
      businessCount: number;
    }>;
  };
  businesses: {
    total: number;
    launchReady: number;
    pendingVerification: number;
    approvedVerification: number;
    missingPublishedListings: number;
    incompleteProfiles: number;
    withAnyListing: number;
    withPublishedListing: number;
  };
  businessActivation: {
    businessAccounts: number;
    profilesCompleted: number;
    verificationSubmitted: number;
    hasPublishedRealListing: number;
    launchReady: number;
  };
  listings: {
    publishedReal: number;
    publishedDemoOrInternal: number;
    draft: number;
    published: number;
    missingImage: number;
    missingPrice: number;
    missingDescription: number;
    adminHidden: number;
  };
  customerIntent: {
    savedBusinessesTotal: number | null;
    savedBusinesses7d: number | null;
    savedListingsTotal: number | null;
    savedListings7d: number | null;
    activeCarts: number | null;
    cartAdds7d: number | null;
    orders7d: number | null;
    score: number;
  };
  listingActivity: Array<{
    bucketStart: string;
    realCreated: number;
    demoInternalCreated: number;
    totalCreated: number;
  }>;
  listingActivity7d: Array<{
    bucketStart: string;
    realCreated: number;
    demoInternalCreated: number;
    totalCreated: number;
  }>;
  listingActivityYtd: Array<{
    bucketStart: string;
    realCreated: number;
    demoInternalCreated: number;
    totalCreated: number;
  }>;
  marketplaceComposition: {
    publishedReal: number;
    publishedDemoInternal: number;
    publishedTotal: number;
  };
  issues: {
    openModerationFlags: number;
    openSupportTickets: number;
    total: number;
  };
};

function isFilled(value: unknown) {
  return typeof value === "string" && value.trim().length > 0;
}

function isRecent(value: string | null, since: Date) {
  if (!value) return false;
  const time = new Date(value).getTime();
  return Number.isFinite(time) && time >= since.getTime();
}

function normalizeStatus(value: string | null | undefined) {
  return String(value || "").trim().toLowerCase();
}

function isEligibleBusiness(row: BusinessKpiRow | undefined) {
  return Boolean(row) && row?.is_internal !== true && row?.is_seeded !== true && normalizeStatus(row?.verification_status) !== "suspended";
}

function isVerifiedBusiness(row: BusinessKpiRow | undefined) {
  return VERIFIED_BUSINESS_STATUSES.has(normalizeStatus(row?.verification_status));
}

function hasCompleteLaunchProfile(row: BusinessKpiRow) {
  // Conservative first-pass definition: require the core public fields currently used by the app.
  return isFilled(row.business_name) && isFilled(row.city) && isFilled(row.category) && isFilled(row.description);
}

function isPublishedListing(row: ListingKpiRow) {
  const status = normalizeStatus(row.status);
  return status === "published" && row.admin_hidden !== true && !isFilled(row.deleted_at);
}

function isActiveInventoryListing(row: ListingKpiRow) {
  const status = normalizeStatus(row.status);
  return status !== "archived" && status !== "deleted" && row.admin_hidden !== true && !isFilled(row.deleted_at);
}

function isRealListing(row: ListingKpiRow, business: BusinessKpiRow | undefined) {
  return (
    isPublishedListing(row) &&
    row.is_seeded !== true &&
    row.is_internal !== true &&
    row.is_test !== true &&
    isEligibleBusiness(business)
  );
}

function isDemoOrInternalListing(row: ListingKpiRow, business: BusinessKpiRow | undefined) {
  return isPublishedListing(row) && !isRealListing(row, business);
}

function isRealInventoryListing(row: ListingKpiRow, business: BusinessKpiRow | undefined) {
  return (
    isActiveInventoryListing(row) &&
    row.is_seeded !== true &&
    row.is_internal !== true &&
    row.is_test !== true &&
    isEligibleBusiness(business)
  );
}

function hasListingImage(row: ListingKpiRow) {
  return isFilled(row.photo_url) || isFilled(row.cover_image_id);
}

async function safeCount(
  client: AdminDataClient,
  table: string,
  apply?: (query: any) => any,
  options: { optional?: boolean } = {}
) {
  try {
    let query = client.from(table).select("id", { count: "exact", head: true });
    if (apply) query = apply(query);
    const { count, error } = await query;
    if (error) throw error;
    return Number(count || 0);
  } catch (error) {
    if (!options.optional) {
      console.warn("[admin-dashboard-kpis] count failed", { table, error });
    }
    return options.optional ? null : 0;
  }
}

async function safeRows<T>(client: AdminDataClient, table: string, select: string) {
  try {
    const { data, error } = await client.from(table).select(select);
    if (error) throw error;
    return (Array.isArray(data) ? data : []) as T[];
  } catch (error) {
    console.warn("[admin-dashboard-kpis] row fetch failed", { table, error });
    return [] as T[];
  }
}

function nullableCount(value: number | null) {
  return typeof value === "number" ? value : 0;
}

function formatDateKey(date: Date) {
  return date.toISOString().slice(0, 10);
}

function buildSignupSeries(rows: UserKpiRow[], days = 30) {
  const today = new Date();
  const end = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()));
  const start = new Date(end);
  start.setUTCDate(start.getUTCDate() - (days - 1));

  const byDate = new Map<string, { bucketStart: string; customerCount: number; businessCount: number }>();
  for (let offset = 0; offset < days; offset += 1) {
    const bucket = new Date(start);
    bucket.setUTCDate(start.getUTCDate() + offset);
    const key = formatDateKey(bucket);
    byDate.set(key, { bucketStart: key, customerCount: 0, businessCount: 0 });
  }

  for (const row of rows) {
    if (!row.created_at) continue;
    const createdAt = new Date(row.created_at);
    if (!Number.isFinite(createdAt.getTime()) || createdAt < start || createdAt >= new Date(end.getTime() + 24 * 60 * 60 * 1000)) {
      continue;
    }
    const bucket = byDate.get(formatDateKey(createdAt));
    if (!bucket) continue;
    if (normalizeStatus(row.role) === "business") {
      bucket.businessCount += 1;
    } else {
      bucket.customerCount += 1;
    }
  }

  return Array.from(byDate.values());
}

function getYtdDayCount() {
  const today = new Date();
  const end = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()));
  const start = new Date(Date.UTC(end.getUTCFullYear(), 0, 1));
  return Math.floor((end.getTime() - start.getTime()) / (24 * 60 * 60 * 1000)) + 1;
}

function buildListingActivitySeries(
  rows: ListingKpiRow[],
  businessByOwnerId: Map<string, BusinessKpiRow>,
  days = 30
) {
  const today = new Date();
  const end = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()));
  const start = new Date(end);
  start.setUTCDate(start.getUTCDate() - (days - 1));

  const byDate = new Map<
    string,
    { bucketStart: string; realCreated: number; demoInternalCreated: number; totalCreated: number }
  >();
  for (let offset = 0; offset < days; offset += 1) {
    const bucket = new Date(start);
    bucket.setUTCDate(start.getUTCDate() + offset);
    const key = formatDateKey(bucket);
    byDate.set(key, { bucketStart: key, realCreated: 0, demoInternalCreated: 0, totalCreated: 0 });
  }

  for (const row of rows) {
    if (!row.created_at || !isActiveInventoryListing(row)) continue;
    const createdAt = new Date(row.created_at);
    if (!Number.isFinite(createdAt.getTime()) || createdAt < start || createdAt >= new Date(end.getTime() + 24 * 60 * 60 * 1000)) {
      continue;
    }

    const bucket = byDate.get(formatDateKey(createdAt));
    if (!bucket) continue;

    const business = row.business_id ? businessByOwnerId.get(row.business_id) : undefined;
    bucket.totalCreated += 1;
    if (isRealInventoryListing(row, business)) {
      bucket.realCreated += 1;
    } else {
      bucket.demoInternalCreated += 1;
    }
  }

  return Array.from(byDate.values());
}

export async function getAdminDashboardKpis(client: AdminDataClient): Promise<AdminDashboardKpis> {
  const since7d = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  const [
    totalUsers,
    customersTotal,
    businessAccountsTotal,
    newCustomers7d,
    newBusinesses7d,
    openModerationFlags,
    openSupportTickets,
    pendingVerificationCount,
    savedBusinessesTotal,
    savedBusinesses7d,
    savedListingsTotal,
    savedListings7d,
    activeCarts,
    cartAdds7d,
    orders7d,
    users,
    businesses,
    listings,
  ] = await Promise.all([
    safeCount(client, "users"),
    safeCount(client, "users", (q) => q.eq("role", "customer")),
    safeCount(client, "users", (q) => q.eq("role", "business")),
    safeCount(client, "users", (q) => q.eq("role", "customer").gte("created_at", since7d.toISOString())),
    safeCount(client, "users", (q) => q.eq("role", "business").gte("created_at", since7d.toISOString())),
    safeCount(client, "moderation_flags", (q) => q.eq("status", "open")),
    safeCount(client, "support_tickets", (q) => q.in("status", ["open", "pending"])),
    // Must match the sidebar badge and verification queue source of truth.
    safeCount(client, "businesses", (q) => q.eq("verification_status", "pending")),
    safeCount(client, "saved_businesses", undefined, { optional: true }),
    safeCount(client, "saved_businesses", (q) => q.gte("created_at", since7d.toISOString()), { optional: true }),
    safeCount(client, "saved_listings", undefined, { optional: true }),
    safeCount(client, "saved_listings", (q) => q.gte("created_at", since7d.toISOString()), { optional: true }),
    safeCount(client, "carts", (q) => q.eq("status", "active"), { optional: true }),
    safeCount(client, "cart_items", (q) => q.gte("created_at", since7d.toISOString()), { optional: true }),
    safeCount(client, "orders", (q) => q.gte("created_at", since7d.toISOString()), { optional: true }),
    safeRows<UserKpiRow>(client, "users", "id,role,created_at"),
    safeRows<BusinessKpiRow>(
      client,
      "businesses",
      "owner_user_id,business_name,city,category,description,is_internal,is_seeded,verification_status,created_at"
    ),
    safeRows<ListingKpiRow>(
      client,
      "listings",
      "id,business_id,title,description,price,photo_url,cover_image_id,status,is_seeded,is_internal,is_test,admin_hidden,deleted_at,created_at"
    ),
  ]);

  const businessByOwnerId = new Map(
    businesses
      .filter((business) => isFilled(business.owner_user_id))
      .map((business) => [String(business.owner_user_id), business])
  );
  const eligibleBusinesses = businesses.filter(isEligibleBusiness);
  const listingsByBusinessId = new Map<string, ListingKpiRow[]>();

  for (const listing of listings) {
    if (!isFilled(listing.business_id)) continue;
    const key = String(listing.business_id);
    const current = listingsByBusinessId.get(key) || [];
    current.push(listing);
    listingsByBusinessId.set(key, current);
  }

  const realPublishedListings = listings.filter((listing) =>
    isRealListing(listing, listing.business_id ? businessByOwnerId.get(listing.business_id) : undefined)
  );
  const publishedListings = listings.filter(isPublishedListing);
  const draftListings = listings.filter((listing) => normalizeStatus(listing.status) === "draft");
  const demoOrInternalPublishedListings = publishedListings.filter((listing) => {
    const business = listing.business_id ? businessByOwnerId.get(listing.business_id) : undefined;
    return isDemoOrInternalListing(listing, business);
  });
  const realInventoryListings = listings.filter((listing) => {
    const business = listing.business_id ? businessByOwnerId.get(listing.business_id) : undefined;
    return isRealInventoryListing(listing, business);
  });

  const businessLaunchState = eligibleBusinesses.map((business) => {
    const businessListings = business.owner_user_id ? listingsByBusinessId.get(business.owner_user_id) || [] : [];
    const realPublishedForBusiness = businessListings.filter((listing) => isRealListing(listing, business));
    return {
      business,
      completeProfile: hasCompleteLaunchProfile(business),
      hasAnyListing: businessListings.some(
        (listing) => listing.is_seeded !== true && listing.is_internal !== true && listing.is_test !== true
      ),
      hasPublishedListing: realPublishedForBusiness.length > 0,
      launchReady: hasCompleteLaunchProfile(business) && realPublishedForBusiness.length > 0,
    };
  });

  const customerIntentScore =
    nullableCount(savedBusinesses7d) + nullableCount(savedListings7d) + nullableCount(cartAdds7d) + nullableCount(orders7d);

  return {
    targets: {
      // Prelaunch defaults only; adjust before public launch once marketplace targets are finalized.
      launchReadyBusinesses: PRELAUNCH_TARGET_BUSINESSES,
      publishedRealListings: PRELAUNCH_TARGET_REAL_LISTINGS,
    },
    users: {
      total: totalUsers || 0,
      customersTotal: customersTotal || 0,
      businessesTotal: businessAccountsTotal || 0,
      newCustomers7d: newCustomers7d || 0,
      newBusinesses7d: newBusinesses7d || 0,
      signupSeries7d: buildSignupSeries(users, 7),
      signupSeries30d: buildSignupSeries(users, 30),
      signupSeriesYtd: buildSignupSeries(users, getYtdDayCount()),
    },
    businesses: {
      total: eligibleBusinesses.length,
      launchReady: businessLaunchState.filter((state) => state.launchReady).length,
      pendingVerification: pendingVerificationCount || 0,
      approvedVerification: eligibleBusinesses.filter(isVerifiedBusiness).length,
      missingPublishedListings: businessLaunchState.filter((state) => !state.hasPublishedListing).length,
      incompleteProfiles: businessLaunchState.filter((state) => !state.completeProfile).length,
      withAnyListing: businessLaunchState.filter((state) => state.hasAnyListing).length,
      withPublishedListing: businessLaunchState.filter((state) => state.hasPublishedListing).length,
    },
    businessActivation: {
      businessAccounts: businessAccountsTotal || 0,
      profilesCompleted: businessLaunchState.filter((state) => state.completeProfile).length,
      verificationSubmitted: pendingVerificationCount || 0,
      hasPublishedRealListing: businessLaunchState.filter((state) => state.hasPublishedListing).length,
      launchReady: businessLaunchState.filter((state) => state.launchReady).length,
    },
    listings: {
      publishedReal: realPublishedListings.length,
      publishedDemoOrInternal: demoOrInternalPublishedListings.length,
      draft: draftListings.length,
      published: publishedListings.length,
      missingImage: realInventoryListings.filter((listing) => !hasListingImage(listing)).length,
      missingPrice: realInventoryListings.filter((listing) => listing.price === null).length,
      missingDescription: realInventoryListings.filter((listing) => !isFilled(listing.description)).length,
      adminHidden: listings.filter((listing) => listing.admin_hidden === true).length,
    },
    customerIntent: {
      savedBusinessesTotal,
      savedBusinesses7d,
      savedListingsTotal,
      savedListings7d,
      activeCarts,
      cartAdds7d,
      orders7d,
      score: customerIntentScore,
    },
    listingActivity: buildListingActivitySeries(listings, businessByOwnerId, 30),
    listingActivity7d: buildListingActivitySeries(listings, businessByOwnerId, 7),
    listingActivityYtd: buildListingActivitySeries(listings, businessByOwnerId, getYtdDayCount()),
    marketplaceComposition: {
      publishedReal: realPublishedListings.length,
      publishedDemoInternal: demoOrInternalPublishedListings.length,
      publishedTotal: publishedListings.length,
    },
    issues: {
      openModerationFlags: openModerationFlags || 0,
      openSupportTickets: openSupportTickets || 0,
      total: (openModerationFlags || 0) + (openSupportTickets || 0),
    },
  };
}
