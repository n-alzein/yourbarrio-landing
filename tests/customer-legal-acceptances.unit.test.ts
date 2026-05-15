import { beforeEach, describe, expect, it, vi } from "vitest";
import fs from "node:fs";
import path from "node:path";

const { getCurrentAccountContextMock, getSupabaseServerClientMock } = vi.hoisted(() => ({
  getCurrentAccountContextMock: vi.fn(),
  getSupabaseServerClientMock: vi.fn(),
}));

vi.mock("server-only", () => ({}));

vi.mock("@/lib/auth/getCurrentAccountContext", () => ({
  getCurrentAccountContext: getCurrentAccountContextMock,
}));

vi.mock("@/lib/supabase/server", () => ({
  getSupabaseServerClient: getSupabaseServerClientMock,
}));

async function importRoute() {
  vi.resetModules();
  return import("../app/api/account/legal-acceptances/route.js");
}

async function importHelper() {
  vi.resetModules();
  return import("../lib/auth/userLegalAcceptances.js");
}

function makeInsertClient({ error = null } = {}) {
  const upsert = vi.fn(async () => ({ error }));
  const from = vi.fn(() => ({ upsert }));
  return { from, upsert };
}

describe("customer legal acceptances", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getCurrentAccountContextMock.mockResolvedValue({
      user: { id: "11111111-1111-4111-8111-111111111111" },
      isAuthenticated: true,
    });
  });

  it("rejects account completion when customer consent is missing", async () => {
    const { POST } = await importRoute();

    const response = await POST(
      new Request("https://yourbarrio.test/api/account/legal-acceptances", {
        method: "POST",
        body: JSON.stringify({ customer_terms_accepted: false }),
      })
    );
    const payload = await response.json();

    expect(response.status).toBe(400);
    expect(payload.error).toBe(
      "You need to accept the Terms of Service and acknowledge the Privacy Policy before creating your account."
    );
    expect(getCurrentAccountContextMock).not.toHaveBeenCalled();
  });

  it("requires an authenticated customer before recording consent", async () => {
    getCurrentAccountContextMock.mockResolvedValueOnce({
      user: null,
      isAuthenticated: false,
    });
    const { POST } = await importRoute();

    const response = await POST(
      new Request("https://yourbarrio.test/api/account/legal-acceptances", {
        method: "POST",
        body: JSON.stringify({ customer_terms_accepted: true }),
      })
    );

    expect(response.status).toBe(401);
  });

  it("records terms and privacy acknowledgement with May 2026 versions and user agent", async () => {
    const client = makeInsertClient();
    getSupabaseServerClientMock.mockReturnValue(client);
    const { POST } = await importRoute();

    const response = await POST(
      new Request("https://yourbarrio.test/api/account/legal-acceptances", {
        method: "POST",
        headers: { "user-agent": "Vitest Browser" },
        body: JSON.stringify({
          customer_terms_accepted: true,
          source: "oauth_completion",
        }),
      })
    );

    expect(response.status).toBe(200);
    expect(client.from).toHaveBeenCalledWith("user_legal_acceptances");
    expect(client.upsert).toHaveBeenCalledWith(
      [
        expect.objectContaining({
          user_id: "11111111-1111-4111-8111-111111111111",
          consent_type: "terms_of_service",
          version: "May 2026",
          source: "oauth_completion",
          user_agent: "Vitest Browser",
        }),
        expect.objectContaining({
          user_id: "11111111-1111-4111-8111-111111111111",
          consent_type: "privacy_policy_acknowledgement",
          version: "May 2026",
          source: "oauth_completion",
          user_agent: "Vitest Browser",
        }),
      ],
      {
        onConflict: "user_id,consent_type,version",
        ignoreDuplicates: true,
      }
    );
  });

  it("uses duplicate-safe versioned upserts for repeated same-version consent", async () => {
    const client = makeInsertClient();
    getSupabaseServerClientMock.mockReturnValue(client);
    const { recordCustomerLegalAcceptances } = await importHelper();

    await recordCustomerLegalAcceptances({
      userId: "11111111-1111-4111-8111-111111111111",
      source: "signup",
      userAgent: "Vitest Browser",
    });

    expect(client.upsert).toHaveBeenCalledWith(expect.any(Array), {
      onConflict: "user_id,consent_type,version",
      ignoreDuplicates: true,
    });
  });

  it("keeps the customer app gate scoped to post-rollout customers and allows the completion page", () => {
    const layoutSource = fs.readFileSync(
      path.join(process.cwd(), "app/(customer)/layout.js"),
      "utf8"
    );

    expect(layoutSource).toContain("CUSTOMER_LEGAL_ACCEPTANCE_ROLLOUT");
    expect(layoutSource).toContain('requestPath !== "/customer/onboarding"');
    expect(layoutSource).toContain("hasCurrentCustomerLegalAcceptances");
    expect(layoutSource).toContain("/customer/onboarding?next=");
  });

  it("hardens user legal acceptances with RLS, own-row reads, and server-only writes", () => {
    const migrationSource = fs.readFileSync(
      path.join(
        process.cwd(),
        "supabase/migrations/20260514123000_harden_user_legal_acceptances_rls.sql"
      ),
      "utf8"
    );

    expect(migrationSource).toContain(
      "ALTER TABLE public.user_legal_acceptances ENABLE ROW LEVEL SECURITY"
    );
    expect(migrationSource).toContain(
      "REVOKE ALL ON TABLE public.user_legal_acceptances FROM anon"
    );
    expect(migrationSource).toContain(
      "REVOKE ALL ON TABLE public.user_legal_acceptances FROM authenticated"
    );
    expect(migrationSource).toContain(
      "GRANT SELECT ON TABLE public.user_legal_acceptances TO authenticated"
    );
    expect(migrationSource).toContain(
      "GRANT ALL ON TABLE public.user_legal_acceptances TO service_role"
    );
    expect(migrationSource).toContain("FOR SELECT");
    expect(migrationSource).toContain("USING (user_id = (SELECT auth.uid()))");
    expect(migrationSource).not.toContain("FOR INSERT");
    expect(migrationSource).not.toContain("FOR UPDATE");
    expect(migrationSource).not.toContain("FOR DELETE");
  });

  it("does not expose direct client writes to user legal acceptances", () => {
    const signupSource = fs.readFileSync(
      path.join(process.cwd(), "components/modals/CustomerSignupModal.jsx"),
      "utf8"
    );
    const completionSource = fs.readFileSync(
      path.join(
        process.cwd(),
        "app/(customer)/customer/onboarding/CustomerLegalCompletionClient.jsx"
      ),
      "utf8"
    );
    const helperSource = fs.readFileSync(
      path.join(process.cwd(), "lib/auth/userLegalAcceptances.js"),
      "utf8"
    );

    expect(signupSource).toContain('fetch("/api/account/legal-acceptances"');
    expect(completionSource).toContain('fetch("/api/account/legal-acceptances"');
    expect(signupSource).not.toContain('.from("user_legal_acceptances")');
    expect(completionSource).not.toContain('.from("user_legal_acceptances")');
    expect(helperSource).toContain('import "server-only"');
    expect(helperSource).toContain("getSupabaseServerClient");
    expect(helperSource).toContain('.from("user_legal_acceptances")');
  });

  it("uses concise legal completion copy", () => {
    const completionSource = fs.readFileSync(
      path.join(
        process.cwd(),
        "app/(customer)/customer/onboarding/CustomerLegalCompletionClient.jsx"
      ),
      "utf8"
    );

    expect(completionSource).toContain("Complete your account");
    expect(completionSource).toContain(
      "Before continuing, please accept the Terms of Service and acknowledge"
    );
  });
});
