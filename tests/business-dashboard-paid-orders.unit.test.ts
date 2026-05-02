import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  getBusinessDataClientForRequestMock,
  getBusinessByUserIdMock,
  getSupabaseServiceClientMock,
  reconcilePendingStripeOrdersMock,
} = vi.hoisted(() => ({
  getBusinessDataClientForRequestMock: vi.fn(),
  getBusinessByUserIdMock: vi.fn(),
  getSupabaseServiceClientMock: vi.fn(),
  reconcilePendingStripeOrdersMock: vi.fn(),
}));

vi.mock("@/lib/business/getBusinessDataClientForRequest", () => ({
  getBusinessDataClientForRequest: getBusinessDataClientForRequestMock,
}));

vi.mock("@/lib/business/getBusinessByUserId", () => ({
  getBusinessByUserId: getBusinessByUserIdMock,
}));

vi.mock("@/lib/supabase/server", () => ({
  getSupabaseServerClient: getSupabaseServiceClientMock,
}));

vi.mock("@/lib/orders/persistence", () => ({
  reconcilePendingStripeOrders: reconcilePendingStripeOrdersMock,
}));

vi.mock("@/lib/avatarUrl", () => ({
  resolveAvatarUrl: vi.fn(() => null),
}));

vi.mock("@/lib/taxonomy/compat", () => ({
  getListingCategoryLabel: vi.fn((row, fallback = "Uncategorized") => row?.category || fallback),
}));

import { GET } from "@/app/api/business/dashboard/route";

type TableRows = Record<string, any[]>;

function getComparableTime(row: any, field: string) {
  const value = row?.[field];
  return value ? new Date(value).getTime() : Number.NaN;
}

class QueryBuilder {
  private rows: any[];
  private sortField: string | null = null;
  private sortAscending = true;
  private limitCount: number | null = null;

  constructor(rows: any[]) {
    this.rows = [...rows];
  }

  select() {
    return this;
  }

  eq(field: string, value: any) {
    this.rows = this.rows.filter((row) => row?.[field] === value);
    return this;
  }

  in(field: string, values: any[]) {
    this.rows = this.rows.filter((row) => values.includes(row?.[field]));
    return this;
  }

  gte(field: string, value: string) {
    const threshold = new Date(value).getTime();
    this.rows = this.rows.filter((row) => getComparableTime(row, field) >= threshold);
    return this;
  }

  lte(field: string, value: string) {
    const threshold = new Date(value).getTime();
    this.rows = this.rows.filter((row) => getComparableTime(row, field) <= threshold);
    return this;
  }

  order(field: string, options: { ascending?: boolean } = {}) {
    this.sortField = field;
    this.sortAscending = options.ascending !== false;
    return this;
  }

  limit(count: number) {
    this.limitCount = count;
    return this;
  }

  then(resolve: (value: { data: any[]; error: null }) => unknown) {
    let data = [...this.rows];
    if (this.sortField) {
      const field = this.sortField;
      const direction = this.sortAscending ? 1 : -1;
      data.sort((a, b) => {
        const aValue = a?.[field];
        const bValue = b?.[field];
        return aValue > bValue ? direction : aValue < bValue ? -direction : 0;
      });
    }
    if (typeof this.limitCount === "number") {
      data = data.slice(0, this.limitCount);
    }
    return Promise.resolve(resolve({ data, error: null }));
  }
}

function createSupabaseMock(rows: TableRows) {
  return {
    from: vi.fn((table: string) => new QueryBuilder(rows[table] || [])),
  };
}

function order(status: string, overrides: Record<string, any> = {}) {
  const suffix = status.replace(/[^a-z0-9]+/gi, "-");
  return {
    id: `order-${suffix}`,
    order_number: `YB-${suffix.toUpperCase()}`,
    created_at: "2026-05-01T12:00:00.000Z",
    total: 24,
    status,
    contact_name: `${status} Customer`,
    user_id: "customer-1",
    vendor_id: "business-user-1",
    ...overrides,
  };
}

async function loadDashboard(orders: any[], listings: any[] = [
  {
    id: "listing-1",
    title: "Candle",
    category: "Home",
    inventory_quantity: 5,
    status: "published",
    admin_hidden: false,
    deleted_at: null,
    business_id: "business-1",
  },
]) {
  const supabase = createSupabaseMock({
    orders,
    business_views: [],
    listings,
    order_items: orders.map((row) => ({
      order_id: row.id,
      listing_id: "listing-1",
      title: "Candle",
      quantity: 1,
      unit_price: 24,
    })),
    users: [{ id: "customer-1", full_name: "Test Customer", business_name: null }],
  });

  getBusinessDataClientForRequestMock.mockResolvedValue({
    ok: true,
    status: 200,
    client: supabase,
    effectiveUserId: "business-user-1",
    businessId: "business-1",
    effectiveProfile: { business_name: "Test Business" },
    authUserMetadata: {},
  });
  getBusinessByUserIdMock.mockResolvedValue({ business_name: "Test Business" });
  getSupabaseServiceClientMock.mockReturnValue(null);
  reconcilePendingStripeOrdersMock.mockResolvedValue({ action: "skipped" });

  const response = await GET(
    new Request(
      "http://localhost:3000/api/business/dashboard?from=2026-05-01T00:00:00.000Z&to=2026-05-01T23:59:59.999Z&compare=none"
    )
  );

  expect(response.status).toBe(200);
  return response.json();
}

describe("business dashboard paid order filtering", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("does not show a started Stripe checkout with no payment completion", async () => {
    const payload = await loadDashboard([
      order("pending_payment", {
        stripe_checkout_session_id: "cs_test_started",
      }),
    ]);

    expect(payload.recentOrders).toEqual([]);
    expect(payload.orderCount).toBe(0);
  });

  it("shows completed Stripe payments after they become requested orders", async () => {
    const payload = await loadDashboard([
      order("requested", {
        stripe_checkout_session_id: "cs_test_paid",
        stripe_payment_intent_id: "pi_test_succeeded",
        paid_at: "2026-05-01T12:01:00.000Z",
      }),
    ]);

    expect(payload.recentOrders).toHaveLength(1);
    expect(payload.recentOrders[0]).toMatchObject({
      id: "YB-REQUESTED",
      status: "pending",
      total: 24,
    });
    expect(payload.orderCount).toBe(1);
  });

  it("does not show failed or canceled checkout attempts", async () => {
    const payload = await loadDashboard([
      order("payment_failed", { stripe_checkout_session_id: "cs_test_failed" }),
      order("cancelled", { stripe_checkout_session_id: "cs_test_cancelled" }),
    ]);

    expect(payload.recentOrders).toEqual([]);
    expect(payload.orderCount).toBe(0);
  });

  it("counts only seller-visible listings and keeps drafts in the dashboard product count", async () => {
    const payload = await loadDashboard([], [
      {
        id: "published-visible",
        title: "Published visible",
        category: "Home",
        inventory_quantity: 5,
        status: "published",
        admin_hidden: false,
        deleted_at: null,
        business_id: "business-1",
      },
      {
        id: "draft-visible",
        title: "Draft visible",
        category: "Home",
        inventory_quantity: 0,
        status: "draft",
        admin_hidden: false,
        deleted_at: null,
        business_id: "business-1",
      },
      {
        id: "admin-hidden",
        title: "Admin hidden",
        category: "Home",
        inventory_quantity: 2,
        status: "published",
        admin_hidden: true,
        deleted_at: null,
        business_id: "business-1",
      },
      {
        id: "seller-deleted",
        title: "Seller deleted",
        category: "Home",
        inventory_quantity: 2,
        status: "published",
        admin_hidden: false,
        seller_deleted: true,
        deleted_at: null,
        business_id: "business-1",
      },
      {
        id: "soft-deleted",
        title: "Soft deleted",
        category: "Home",
        inventory_quantity: 2,
        status: "published",
        admin_hidden: false,
        deleted_at: "2026-05-01T12:00:00.000Z",
        business_id: "business-1",
      },
      {
        id: "archived",
        title: "Archived",
        category: "Home",
        inventory_quantity: 2,
        status: "archived",
        admin_hidden: false,
        deleted_at: null,
        business_id: "business-1",
      },
    ]);

    expect(payload.listingCount).toBe(2);
    expect(payload.totalLiveProductsCount).toBe(1);
  });
});
