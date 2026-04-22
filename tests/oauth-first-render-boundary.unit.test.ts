import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

function read(relPath: string) {
  return fs.readFileSync(path.join(process.cwd(), relPath), "utf8");
}

describe("OAuth first render auth boundary", () => {
  it("server-seeds root auth before the public client shell renders", () => {
    const rootLayout = read("app/layout.js");
    const publicLayout = read("app/(public)/layout.js");
    const handoffRoute = read("app/auth/handoff/route.js");
    const appShell = read("components/AppShell.jsx");
    const authProvider = read("components/AuthProvider.jsx");

    expect(rootLayout).toContain("getCurrentAccountContext");
    expect(rootLayout).toContain('source: "root-layout"');
    expect(rootLayout).toContain("initialAuth={initialAuth}");
    expect(rootLayout).toContain("[AUTH_SERVER_RENDER]");
    expect(rootLayout).toContain('export const dynamic = "force-dynamic"');

    expect(publicLayout).toContain("getCurrentAccountContext");
    expect(publicLayout).toContain('source: "public-layout"');
    expect(publicLayout).toContain("forcedAuth={forcedAuth}");
    expect(publicLayout).toContain('export const dynamic = "force-dynamic"');

    expect(handoffRoute).toContain('export const dynamic = "force-dynamic"');
    expect(handoffRoute).toContain("getCurrentAccountContext");
    expect(handoffRoute).toContain('source: "auth-handoff"');
    expect(handoffRoute).toContain("yb_auth_fresh");

    expect(appShell).toContain("initialAuth = null");
    expect(appShell).toContain("initialUser={initialAuth?.user ?? null}");
    expect(appShell).toContain("initialProfile={initialAuth?.profile ?? null}");
    expect(appShell).toContain("initialRole={initialAuth?.role ?? null}");
    expect(appShell).toContain('searchParams?.get("yb_auth_handoff") === "1"');
    expect(appShell).toContain("initialAuthResolved={initialAuthResolved}");

    expect(authProvider).toContain("primeAuthStateForInitialRender");
    expect(authProvider).toContain('authStatus: "authenticated"');
    expect(authProvider).toContain("initialAuthResolved");
    expect(authProvider).toContain('const AUTH_HANDOFF_PARAM = "yb_auth_handoff"');
  });
});
