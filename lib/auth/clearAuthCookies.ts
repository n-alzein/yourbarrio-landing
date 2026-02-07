import "server-only";

import { cookies, headers } from "next/headers";
import { shouldUseSecureCookies } from "@/lib/http/cookiesSecurity";
import {
  IMPERSONATE_SESSION_COOKIE,
  IMPERSONATE_USER_COOKIE,
} from "@/lib/admin/supportMode";

function shouldClearCookie(name: string) {
  if (!name) return false;
  if (name.startsWith("sb-")) return true;
  if (name.startsWith("__Host-sb-")) return true;

  const exactNames = new Set([
    "supabase-auth-token",
    "supabase.auth.token",
    IMPERSONATE_USER_COOKIE,
    IMPERSONATE_SESSION_COOKIE,
  ]);

  return exactNames.has(name);
}

function getDomainCandidates(host: string | null) {
  const baseHost = (host || "").split(":")[0] || "";
  const domains: Array<string | undefined> = [undefined, ".yourbarrio.com", "www.yourbarrio.com"];
  if (baseHost && !domains.includes(baseHost)) domains.push(baseHost);
  return domains;
}

export async function clearAllAuthCookies() {
  const diagEnabled = String(process.env.NEXT_PUBLIC_AUTH_DIAG || "") === "1";

  let cookieStore = null as Awaited<ReturnType<typeof cookies>> | null;
  try {
    cookieStore = await cookies();
  } catch {
    return;
  }

  const all = cookieStore.getAll();
  const names = Array.from(new Set(all.map((cookie) => cookie.name))).filter(shouldClearCookie);
  if (!names.length) return;

  let host: string | null = null;
  try {
    const headerStore = await headers();
    host = headerStore.get("host");
  } catch {
    host = null;
  }
  const domains = getDomainCandidates(host);
  const paths = ["/", "/admin"];
  const secure = await shouldUseSecureCookies();

  const baseOptions = {
    maxAge: 0,
    expires: new Date(0),
    secure,
    sameSite: "lax" as const,
  };

  if (diagEnabled) {
    console.warn("[AUTH_DIAG] clearAllAuthCookies:start", {
      names,
      domains,
      paths,
    });
  }

  for (const name of names) {
    try {
      cookieStore.delete(name);
    } catch {}

    for (const domain of domains) {
      for (const path of paths) {
        try {
          cookieStore.set(name, "", {
            ...baseOptions,
            path,
            ...(domain ? { domain } : {}),
          });
        } catch {}
      }
    }
  }

  if (diagEnabled) {
    const remaining = cookieStore
      .getAll()
      .map((cookie) => cookie.name)
      .filter((name) => names.includes(name));
    console.warn("[AUTH_DIAG] clearAllAuthCookies:end", {
      remaining,
    });
  }
}

/*
MANUAL REGRESSION CHECKLIST
1) Log in as admin and start support mode (customer target).
2) Use "Go to user home" and verify /customer/home loads with banner.
3) Start support mode (business target) and verify /business/dashboard loads with banner.
4) Click admin logout once and verify public navbar on / with no lingering avatar/session.
*/
