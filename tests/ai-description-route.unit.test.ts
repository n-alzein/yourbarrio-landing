import { beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "@/app/api/ai/description/route";
import { getBusinessDayWindow } from "@/lib/ai/descriptionUsage";

const {
  getBusinessDataClientForRequestMock,
  getServiceRoleClientMock,
} = vi.hoisted(() => ({
  getBusinessDataClientForRequestMock: vi.fn(),
  getServiceRoleClientMock: vi.fn(),
}));

vi.mock("@/lib/business/getBusinessDataClientForRequest", () => ({
  getBusinessDataClientForRequest: getBusinessDataClientForRequestMock,
}));

vi.mock("@/lib/supabase/server", () => ({
  getSupabaseServerClient: getServiceRoleClientMock,
}));

function createRequest(body = {}) {
  return new Request("http://localhost:3000/api/ai/description", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      type: "business",
      surface: "business-profile",
      action: "generate",
      name: "Barrio Boutique",
      category: "boutique",
      ...body,
    }),
  });
}

function createUsageReadClient({
  businessCount = 0,
  targetCount = 0,
  captureFilters,
} = {}) {
  return {
    from: vi.fn((table) => {
      if (table !== "ai_description_usage") {
        throw new Error(`Unexpected table: ${table}`);
      }

      const filters = {};
      const chain = {
        select: vi.fn(() => chain),
        eq: vi.fn((field, value) => {
          filters[field] = value;
          return chain;
        }),
        gte: vi.fn((field, value) => {
          filters[field] = value;
          return chain;
        }),
        lt: vi.fn((field, value) => {
          filters[`${field}_lt`] = value;
          return chain;
        }),
        then: (resolve, reject) =>
          Promise.resolve().then(() => {
            captureFilters?.({ ...filters });
            return {
              count: filters.target_id ? targetCount : businessCount,
              error: null,
            };
          }).then(resolve, reject),
      };

      return chain;
    }),
  };
}

function createBusinessAccessMock(options = {}) {
  return {
    ok: true,
    status: 200,
    error: null,
    businessId: "biz-11111111-1111-4111-8111-111111111111",
    effectiveUserId: "user-11111111-1111-4111-8111-111111111111",
    client: createUsageReadClient(options),
  };
}

function createServiceRoleClientMock({ insertError = null } = {}) {
  const insert = vi.fn().mockResolvedValue({ error: insertError });
  return {
    from: vi.fn((table) => {
      if (table !== "ai_description_usage") {
        throw new Error(`Unexpected table: ${table}`);
      }
      return { insert };
    }),
    insert,
  };
}

describe("POST /api/ai/description", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.OPENAI_API_KEY = "test-openai-key";
    delete process.env.OPENAI_DESCRIPTION_ASSISTANT_MODEL;
    vi.stubGlobal("fetch", vi.fn());
  });

  it("falls back to gpt-5.4-nano when no override model is configured", async () => {
    getBusinessDataClientForRequestMock.mockResolvedValue(createBusinessAccessMock());
    getServiceRoleClientMock.mockReturnValue(createServiceRoleClientMock());
    const fetchMock = vi.mocked(global.fetch);
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({
        output_text: "A polished neighborhood boutique with thoughtful local style.",
        usage: {
          input_tokens: 100,
          output_tokens: 20,
          total_tokens: 120,
        },
      }),
    } as Response);

    const response = await POST(createRequest() as never);

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      description: "A polished neighborhood boutique with thoughtful local style.",
    });

    const upstreamPayload = JSON.parse(fetchMock.mock.calls[0][1]?.body as string);
    expect(upstreamPayload.model).toBe("gpt-5.4-nano");
  });

  it("uses OPENAI_DESCRIPTION_ASSISTANT_MODEL when provided", async () => {
    process.env.OPENAI_DESCRIPTION_ASSISTANT_MODEL = "gpt-5.4-mini";
    getBusinessDataClientForRequestMock.mockResolvedValue(createBusinessAccessMock());
    getServiceRoleClientMock.mockReturnValue(createServiceRoleClientMock());
    const fetchMock = vi.mocked(global.fetch);
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({
        output_text: "Updated description.",
      }),
    } as Response);

    const response = await POST(createRequest() as never);

    expect(response.status).toBe(200);
    const upstreamPayload = JSON.parse(fetchMock.mock.calls[0][1]?.body as string);
    expect(upstreamPayload.model).toBe("gpt-5.4-mini");
  });

  it("extracts description text from output content when output_text is missing", async () => {
    getBusinessDataClientForRequestMock.mockResolvedValue(createBusinessAccessMock());
    getServiceRoleClientMock.mockReturnValue(createServiceRoleClientMock());
    vi.mocked(global.fetch).mockResolvedValue({
      ok: true,
      json: async () => ({
        output: [
          {
            type: "message",
            content: [
              {
                type: "output_text",
                text: "A thoughtful neighborhood boutique with polished, everyday style.  ",
              },
            ],
          },
        ],
        usage: {
          input_tokens: 100,
          output_tokens: 20,
          total_tokens: 120,
        },
      }),
    } as Response);

    const response = await POST(createRequest() as never);

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      description: "A thoughtful neighborhood boutique with polished, everyday style.",
    });
  });

  it("returns 429 when the daily business limit has been reached before calling OpenAI", async () => {
    getBusinessDataClientForRequestMock.mockResolvedValue(
      createBusinessAccessMock({ businessCount: 20 })
    );

    const response = await POST(createRequest() as never);

    expect(response.status).toBe(429);
    expect(await response.json()).toEqual({
      error: "You’ve reached today’s AI description limit. You can try again tomorrow.",
    });
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it("returns 429 when the per-target daily limit has been reached before calling OpenAI", async () => {
    getBusinessDataClientForRequestMock.mockResolvedValue(
      createBusinessAccessMock({ businessCount: 2, targetCount: 5 })
    );

    const response = await POST(
      createRequest({
        surface: "listing-editor",
        type: "listing",
        targetId: "11111111-1111-4111-8111-111111111111",
      }) as never
    );

    expect(response.status).toBe(429);
    expect(await response.json()).toEqual({
      error: "You’ve reached today’s AI description limit. You can try again tomorrow.",
    });
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it("uses Los Angeles business-day boundaries when UTC date differs from the local date", async () => {
    vi.useFakeTimers();
    try {
      vi.setSystemTime(new Date("2026-04-27T05:30:00.000Z"));
      const capturedFilters = [];

      getBusinessDataClientForRequestMock.mockResolvedValue({
        ok: true,
        status: 200,
        error: null,
        businessId: "biz-11111111-1111-4111-8111-111111111111",
        effectiveUserId: "user-11111111-1111-4111-8111-111111111111",
        client: createUsageReadClient({
          captureFilters: (filters) => capturedFilters.push(filters),
        }),
      });
      getServiceRoleClientMock.mockReturnValue(createServiceRoleClientMock());
      vi.mocked(global.fetch).mockResolvedValue({
        ok: true,
        json: async () => ({ output_text: "Boundary-safe description." }),
      } as Response);

      const response = await POST(createRequest() as never);

      expect(response.status).toBe(200);
      const dayWindow = getBusinessDayWindow(new Date("2026-04-27T05:30:00.000Z"));
      expect(dayWindow.dayKey).toBe("2026-04-26");
      expect(dayWindow.startIso).toBe("2026-04-26T07:00:00.000Z");
      expect(dayWindow.endIso).toBe("2026-04-27T07:00:00.000Z");
      expect(capturedFilters[0]).toMatchObject({
        business_id: "biz-11111111-1111-4111-8111-111111111111",
        created_at: "2026-04-26T07:00:00.000Z",
        created_at_lt: "2026-04-27T07:00:00.000Z",
      });
    } finally {
      vi.useRealTimers();
    }
  });

  it("logs usage after a successful generation", async () => {
    const access = createBusinessAccessMock();
    const serviceClient = createServiceRoleClientMock();
    getBusinessDataClientForRequestMock.mockResolvedValue(access);
    getServiceRoleClientMock.mockReturnValue(serviceClient);

    const fetchMock = vi.mocked(global.fetch);
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({
        output_text: "Clean, local style with a thoughtful neighborhood feel.",
        usage: {
          input_tokens: 100,
          output_tokens: 20,
          total_tokens: 120,
        },
      }),
    } as Response);

    const response = await POST(
      createRequest({
        targetId: "11111111-1111-4111-8111-111111111111",
      }) as never
    );

    expect(response.status).toBe(200);
    expect(serviceClient.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        business_id: access.businessId,
        user_id: access.effectiveUserId,
        surface: "business-profile",
        target_id: "11111111-1111-4111-8111-111111111111",
        action: "generate",
        model: "gpt-5.4-nano",
        prompt_tokens: 100,
        completion_tokens: 20,
        total_tokens: 120,
        estimated_cost_cents: 0.0045,
      })
    );
  });

  it("returns 500 with a friendly message when OpenAI fails", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    getBusinessDataClientForRequestMock.mockResolvedValue(createBusinessAccessMock());
    getServiceRoleClientMock.mockReturnValue(createServiceRoleClientMock());
    vi.mocked(global.fetch).mockResolvedValue({
      ok: false,
      status: 503,
      json: async () => ({
        error: { message: "upstream temporarily unavailable" },
      }),
    } as Response);

    const response = await POST(createRequest() as never);

    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({
      error: "AI suggestion unavailable right now. Please try again later.",
    });
    expect(errorSpy).toHaveBeenCalledWith(
      "[ai-description] generation_failed",
      expect.objectContaining({
        businessId: "biz-11111111-1111-4111-8111-111111111111",
        userId: "user-11111111-1111-4111-8111-111111111111",
        error: expect.any(Error),
      })
    );
  });

  it("does not fail generation when usage logging fails", async () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    getBusinessDataClientForRequestMock.mockResolvedValue(createBusinessAccessMock());
    getServiceRoleClientMock.mockReturnValue(
      createServiceRoleClientMock({
        insertError: { message: "insert failed", code: "42501" },
      })
    );
    const fetchMock = vi.mocked(global.fetch);
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({
        output_text: "Still returns the generated description.",
      }),
    } as Response);

    const response = await POST(createRequest() as never);

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      description: "Still returns the generated description.",
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(warnSpy).toHaveBeenCalledWith(
      "[ai-description] usage_log_failed",
      expect.objectContaining({
        message: "insert failed",
        code: "42501",
      })
    );
  });
});
