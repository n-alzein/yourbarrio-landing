import { describe, expect, it } from "vitest";
import {
  canBusinessUseFeature,
  consumeBusinessUsage,
  getBusinessLimit,
  getBusinessRemainingUsage,
} from "@/lib/monetization/entitlements";
import { FEATURES } from "@/lib/monetization/features";
import { getMonthlyUsagePeriod } from "@/lib/monetization/periods";

const ids = {
  founding: "plan-founding",
  free: "plan-free",
  capacity: "feature-capacity",
  online: "feature-online",
  unique: "feature-unique",
  activeLimit: "feature-active-limit",
  photo: "feature-photo",
  photoLimit: "feature-photo-limit",
};

function feature(id: string, key: string, defaultValue: unknown = null) {
  return { id, key, default_value: defaultValue };
}

function makeClient(overrides: any[] = [], subscriptionPlanId = ids.founding, usageRows: any[] = []) {
  const tables: Record<string, any[]> = {
    monetization_features: [
      feature(ids.online, FEATURES.INVENTORY_ONLINE_STOCK, true),
      feature(ids.unique, FEATURES.INVENTORY_UNIQUE_ITEMS, false),
      feature(ids.capacity, FEATURES.INVENTORY_CAPACITY_BASED, false),
      feature(ids.activeLimit, FEATURES.LISTINGS_ACTIVE_LIMIT, 10),
      feature(ids.photo, FEATURES.AI_PHOTO_ENHANCEMENT, true),
      feature(ids.photoLimit, FEATURES.AI_PHOTO_ENHANCEMENT_MONTHLY_LIMIT, 20),
    ],
    monetization_plans: [
      { id: ids.founding, key: "founding_business" },
      { id: ids.free, key: "free" },
    ],
    business_subscriptions: [
      { id: "sub-1", business_id: "business-1", plan_id: subscriptionPlanId, status: "founding" },
    ],
    monetization_plan_entitlements: [
      { plan_id: ids.founding, feature_id: ids.online, value: true },
      { plan_id: ids.founding, feature_id: ids.unique, value: true },
      { plan_id: ids.founding, feature_id: ids.capacity, value: false },
      { plan_id: ids.founding, feature_id: ids.activeLimit, value: 50 },
      { plan_id: ids.founding, feature_id: ids.photo, value: true },
      { plan_id: ids.founding, feature_id: ids.photoLimit, value: 2 },
      { plan_id: ids.free, feature_id: ids.activeLimit, value: 10 },
    ],
    business_entitlement_overrides: overrides,
    business_feature_usage: usageRows,
  };

  class Query {
    table: string;
    filters: Array<[string, unknown]> = [];
    constructor(table: string) {
      this.table = table;
    }
    select() { return this; }
    eq(column: string, value: unknown) {
      this.filters.push([column, value]);
      return this;
    }
    order() { return this; }
    maybeSingle() {
      const data = this.rows()[0] || null;
      return Promise.resolve({ data, error: null });
    }
    single() { return this.maybeSingle(); }
    rows() {
      return (tables[this.table] || []).filter((row) =>
        this.filters.every(([column, value]) => row[column] === value)
      );
    }
    then(resolve: any) {
      return resolve({ data: this.rows(), error: null });
    }
  }

  return {
    tables,
    from(table: string) {
      return new Query(table);
    },
    async rpc(name: string, args: any) {
      if (name !== "consume_business_feature_usage") return { data: null, error: null };
      const featureRow = tables.monetization_features.find((row) => row.key === args.p_feature_key);
      const existing = tables.business_feature_usage.find(
        (row) =>
          row.business_id === args.p_business_id &&
          row.feature_id === featureRow.id &&
          row.period_start === args.p_period_start &&
          row.period_end === args.p_period_end
      );
      const current = Number(existing?.used_count || 0) + Number(existing?.reserved_count || 0);
      if (args.p_limit !== null && current + args.p_amount > args.p_limit) {
        return { data: false, error: null };
      }
      if (existing) existing.used_count += args.p_amount;
      else {
        tables.business_feature_usage.push({
          business_id: args.p_business_id,
          feature_id: featureRow.id,
          period_start: args.p_period_start,
          period_end: args.p_period_end,
          used_count: args.p_amount,
          reserved_count: 0,
        });
      }
      return { data: true, error: null };
    },
  };
}

describe("monetization entitlements", () => {
  it("allows founding online and unique inventory but not capacity inventory", async () => {
    const client = makeClient();
    await expect(canBusinessUseFeature("business-1", FEATURES.INVENTORY_ONLINE_STOCK, client)).resolves.toMatchObject({ allowed: true });
    await expect(canBusinessUseFeature("business-1", FEATURES.INVENTORY_UNIQUE_ITEMS, client)).resolves.toMatchObject({ allowed: true });
    await expect(canBusinessUseFeature("business-1", FEATURES.INVENTORY_CAPACITY_BASED, client)).resolves.toMatchObject({ allowed: false });
  });

  it("keeps the free active listing limit lower than founding", async () => {
    await expect(getBusinessLimit("business-1", FEATURES.LISTINGS_ACTIVE_LIMIT, makeClient())).resolves.toBe(50);
    await expect(getBusinessLimit("business-1", FEATURES.LISTINGS_ACTIVE_LIMIT, makeClient([], ids.free))).resolves.toBe(10);
  });

  it("applies grant overrides and lets deny overrides win", async () => {
    const grant = {
      business_id: "business-1",
      feature_id: ids.capacity,
      override_type: "grant",
      active: true,
      created_at: "2026-01-01",
    };
    await expect(canBusinessUseFeature("business-1", FEATURES.INVENTORY_CAPACITY_BASED, makeClient([grant]))).resolves.toMatchObject({ allowed: true, source: "override" });

    const deny = { ...grant, override_type: "deny", created_at: "2026-01-02" };
    await expect(canBusinessUseFeature("business-1", FEATURES.INVENTORY_CAPACITY_BASED, makeClient([grant, deny]))).resolves.toMatchObject({ allowed: false, source: "override" });
  });

  it("lets deny overrides beat grant, set_limit, and increase_limit overrides", async () => {
    const overrides = [
      {
        business_id: "business-1",
        feature_id: ids.activeLimit,
        override_type: "set_limit",
        value: 100,
        active: true,
      },
      {
        business_id: "business-1",
        feature_id: ids.activeLimit,
        override_type: "increase_limit",
        value: 25,
        active: true,
      },
      {
        business_id: "business-1",
        feature_id: ids.activeLimit,
        override_type: "deny",
        active: true,
      },
    ];

    await expect(getBusinessLimit("business-1", FEATURES.LISTINGS_ACTIVE_LIMIT, makeClient(overrides))).resolves.toBe(0);
  });

  it("ignores expired overrides", async () => {
    const expired = {
      business_id: "business-1",
      feature_id: ids.capacity,
      override_type: "grant",
      active: true,
      ends_at: "2020-01-01T00:00:00.000Z",
    };
    await expect(canBusinessUseFeature("business-1", FEATURES.INVENTORY_CAPACITY_BASED, makeClient([expired]))).resolves.toMatchObject({ allowed: false });
  });

  it("stacks multiple increase_limit overrides on the plan limit", async () => {
    const overrides = [
      {
        business_id: "business-1",
        feature_id: ids.activeLimit,
        override_type: "increase_limit",
        value: 10,
        active: true,
      },
      {
        business_id: "business-1",
        feature_id: ids.activeLimit,
        override_type: "increase_limit",
        value: 5,
        active: true,
      },
    ];

    await expect(getBusinessLimit("business-1", FEATURES.LISTINGS_ACTIVE_LIMIT, makeClient(overrides))).resolves.toBe(65);
  });

  it("stacks increase_limit overrides on top of set_limit", async () => {
    const overrides = [
      {
        business_id: "business-1",
        feature_id: ids.activeLimit,
        override_type: "set_limit",
        value: 80,
        active: true,
      },
      {
        business_id: "business-1",
        feature_id: ids.activeLimit,
        override_type: "increase_limit",
        value: 20,
        active: true,
      },
    ];

    await expect(getBusinessLimit("business-1", FEATURES.LISTINGS_ACTIVE_LIMIT, makeClient(overrides))).resolves.toBe(100);
  });

  it("tracks monthly usage and prevents usage over the monthly limit", async () => {
    const client = makeClient();
    await consumeBusinessUsage("business-1", FEATURES.AI_PHOTO_ENHANCEMENT, 1, {}, client);
    await expect(getBusinessRemainingUsage("business-1", FEATURES.AI_PHOTO_ENHANCEMENT, new Date(), client)).resolves.toMatchObject({
      limit: 2,
      used: 1,
      remaining: 1,
    });
    await consumeBusinessUsage("business-1", FEATURES.AI_PHOTO_ENHANCEMENT, 1, {}, client);
    await expect(consumeBusinessUsage("business-1", FEATURES.AI_PHOTO_ENHANCEMENT, 1, {}, client)).rejects.toThrow();
  });

  it("allows only one repeated consumption when one monthly use remains", async () => {
    const period = getMonthlyUsagePeriod();
    const client = makeClient([], ids.founding, [
      {
        business_id: "business-1",
        feature_id: ids.photo,
        period_start: period.periodStart,
        period_end: period.periodEnd,
        used_count: 1,
        reserved_count: 0,
      },
    ]);

    const results = await Promise.allSettled([
      consumeBusinessUsage("business-1", FEATURES.AI_PHOTO_ENHANCEMENT, 1, {}, client),
      consumeBusinessUsage("business-1", FEATURES.AI_PHOTO_ENHANCEMENT, 1, {}, client),
    ]);

    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    expect(results.filter((result) => result.status === "rejected")).toHaveLength(1);
    await expect(getBusinessRemainingUsage("business-1", FEATURES.AI_PHOTO_ENHANCEMENT, new Date(), client)).resolves.toMatchObject({
      used: 2,
      remaining: 0,
    });
  });

  it("calculates monthly usage periods on UTC month boundaries", () => {
    expect(getMonthlyUsagePeriod(new Date("2026-05-19T12:00:00Z"))).toEqual({
      periodStart: "2026-05-01",
      periodEnd: "2026-06-01",
    });
  });
});
