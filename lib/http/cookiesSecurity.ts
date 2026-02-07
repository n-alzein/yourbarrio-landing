import "server-only";

import { headers } from "next/headers";

function parseForwardedProto(value: string | null): string {
  if (!value) return "";
  return value.split(",")[0]?.trim().toLowerCase() || "";
}

function isLocalHost(host: string): boolean {
  if (!host) return false;
  const normalized = host.split(":")[0]?.toLowerCase() || "";
  return (
    normalized.includes("localhost") ||
    normalized.includes("127.0.0.1") ||
    normalized.endsWith(".local")
  );
}

export async function shouldUseSecureCookies(): Promise<boolean> {
  let proto = "";
  let host = "";

  try {
    const headerStore = await headers();
    proto = parseForwardedProto(headerStore.get("x-forwarded-proto"));
    host = (headerStore.get("host") || "").trim();
  } catch {
    proto = "";
    host = "";
  }

  if (isLocalHost(host)) return false;
  if (proto === "https") return true;
  return process.env.NODE_ENV === "production";
}
