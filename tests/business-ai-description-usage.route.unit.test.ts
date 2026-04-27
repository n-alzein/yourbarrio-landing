import { beforeEach, describe, expect, it, vi } from "vitest";
import { GET } from "@/app/api/business/ai-description-usage/route";

const { getBusinessDataClientForRequestMock } = vi.hoisted(() => ({
  getBusinessDataClientForRequestMock: vi.fn(),
}));

vi.mock("@/lib/business/getBusinessDataClientForRequest", () => ({
  getBusinessDataClientForRequest: getBusinessDataClientForRequestMock,
}));

function createUsageAnalyticsClient({
  todayCount = 0,
  recentUsage = [],
  last30Usage = [],
} = {}) {
  return {
    from: vi.fn((table) => {
      if (table !== "ai_description_usage") {
        throw new Error(`Unexpected table: ${table}`);
      }

      const state = {
        head: false,
        count: false,
        limit: null,
      };

      const chain = {
        select: vi.fn((columns, options = {}) => {
          state.head = options.head === true;
          state.count = options.count === "exact";
          state.columns = columns;
          return chain;
        }),
        eq: vi.fn(() => chain),
        gte: vi.fn(() => chain),
        lt: vi.fn(() => chain),
        order: vi.fn(() => chain),
        limit: vi.fn((value) => {
          state.limit = value;
          return chain;
        }),
        then: (resolve, reject) => {
          let result;
          if (state.head && state.count) {
            result = { count: todayCount, error: null };
          } else if (state.limit === 20) {
            result = { data: recentUsage, error: null };
          } else {
            result = { data: last30Usage, error: null };
          }
          return Promise.resolve(result).then(resolve, reject);
        },
      };

      return chain;
    }),
  };
}

describe("GET /api/business/ai-description-usage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns usage counts scoped to the authenticated business", async () => {
    getBusinessDataClientForRequestMock.mockResolvedValue({
      ok: true,
      status: 200,
      error: null,
      businessId: "biz-11111111-1111-4111-8111-111111111111",
      effectiveUserId: "user-11111111-1111-4111-8111-111111111111",
      client: createUsageAnalyticsClient({
        todayCount: 7,
        recentUsage: [
          {
            id: "usage-1",
            surface: "listing-editor",
            action: "generate",
            model: "gpt-5.4-nano",
            created_at: "2026-04-26T18:00:00.000Z",
          },
        ],
        last30Usage: [
          { surface: "onboarding", created_at: "2026-04-20T00:00:00.000Z" },
          { surface: "listing-editor", created_at: "2026-04-21T00:00:00.000Z" },
          { surface: "listing-editor", created_at: "2026-04-22T00:00:00.000Z" },
          { surface: "business-profile", created_at: "2026-04-23T00:00:00.000Z" },
        ],
      }),
    });

    const response = await GET();

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      todayCount: 7,
      timezone: "America/Los_Angeles",
      todayLimit: 20,
      remainingToday: 13,
      bySurface: {
        onboarding: 1,
        "listing-editor": 2,
        "business-profile": 1,
      },
      recentUsage: [
        {
          id: "usage-1",
          surface: "listing-editor",
          action: "generate",
          model: "gpt-5.4-nano",
          created_at: "2026-04-26T18:00:00.000Z",
        },
      ],
    });
  });
});
