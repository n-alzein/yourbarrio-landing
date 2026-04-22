import { NextResponse } from "next/server";
import { unstable_noStore as noStore } from "next/cache";
import { getCurrentAccountContext } from "@/lib/auth/getCurrentAccountContext";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const AUTH_HANDOFF_PARAM = "yb_auth_handoff";
const AUTH_FRESH_PARAM = "yb_auth_fresh";

function shouldLogAuthHandoff() {
  return (
    process.env.NODE_ENV !== "production" ||
    process.env.AUTH_DIAG_SERVER === "1" ||
    process.env.NEXT_PUBLIC_AUTH_DIAG === "1"
  );
}

function normalizeNextPath(input) {
  if (typeof input !== "string") return "/";
  const trimmed = input.trim();
  if (!trimmed || !trimmed.startsWith("/") || trimmed.startsWith("//")) return "/";
  try {
    const parsed = new URL(trimmed, "https://yourbarrio.local");
    if (parsed.pathname.startsWith("/api/") || parsed.pathname.startsWith("/_next/")) {
      return "/";
    }
    return `${parsed.pathname}${parsed.search}`;
  } catch {
    return "/";
  }
}

function addFreshAuthParams(path) {
  const parsed = new URL(path, "https://yourbarrio.local");
  parsed.searchParams.set(AUTH_HANDOFF_PARAM, "1");
  parsed.searchParams.set(AUTH_FRESH_PARAM, Date.now().toString(36));
  return `${parsed.pathname}${parsed.search}`;
}

export async function GET(request) {
  noStore();
  const requestUrl = new URL(request.url);
  const nextPath = normalizeNextPath(requestUrl.searchParams.get("next"));
  const context = await getCurrentAccountContext({
    source: "auth-handoff",
  });
  const hasUser = Boolean(context?.user?.id);
  const targetPath = hasUser
    ? addFreshAuthParams(nextPath)
    : `/login?next=${encodeURIComponent(nextPath)}&auth=session_missing`;
  const response = NextResponse.redirect(new URL(targetPath, request.url), 303);
  response.headers.set("Cache-Control", "no-store, max-age=0");
  response.headers.set("x-auth-handoff-user", hasUser ? "1" : "0");
  response.headers.set("x-auth-handoff-destination", targetPath);

  if (shouldLogAuthHandoff()) {
    console.info("[AUTH_HANDOFF]", {
      requestUrl: requestUrl.toString(),
      nextPath,
      hasUser,
      userId: context?.user?.id || null,
      hasProfile: Boolean(context?.profile?.id),
      role: context?.role || null,
      destination: targetPath,
    });
  }

  return response;
}
