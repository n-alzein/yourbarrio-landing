import "server-only";

import { getSupabaseServerClient } from "@/lib/supabase/server";

export const CUSTOMER_TERMS_VERSION = "May 2026";
export const CUSTOMER_PRIVACY_VERSION = "May 2026";

const SUPPORTED_SOURCES = new Set([
  "signup",
  "oauth_completion",
  "checkout",
  "reacceptance",
]);

export function normalizeCustomerLegalAcceptanceSource(value) {
  const source = String(value || "").trim();
  return SUPPORTED_SOURCES.has(source) ? source : "signup";
}

export async function recordCustomerLegalAcceptances({
  userId,
  source = "signup",
  userAgent = "",
} = {}) {
  const normalizedUserId = String(userId || "").trim();
  if (!normalizedUserId) {
    throw new Error("Missing user id for legal acceptance");
  }

  const serviceClient = getSupabaseServerClient();
  if (!serviceClient) {
    throw new Error("Missing service role Supabase client");
  }

  const acceptedAt = new Date().toISOString();
  const normalizedSource = normalizeCustomerLegalAcceptanceSource(source);
  const normalizedUserAgent = String(userAgent || "").trim() || null;
  const rows = [
    {
      user_id: normalizedUserId,
      consent_type: "terms_of_service",
      version: CUSTOMER_TERMS_VERSION,
      accepted_at: acceptedAt,
      source: normalizedSource,
      user_agent: normalizedUserAgent,
    },
    {
      user_id: normalizedUserId,
      consent_type: "privacy_policy_acknowledgement",
      version: CUSTOMER_PRIVACY_VERSION,
      accepted_at: acceptedAt,
      source: normalizedSource,
      user_agent: normalizedUserAgent,
    },
  ];

  const { error } = await serviceClient
    .from("user_legal_acceptances")
    .upsert(rows, {
      onConflict: "user_id,consent_type,version",
      ignoreDuplicates: true,
    });

  if (error) {
    throw new Error(error.message || "Failed to record legal acceptance");
  }

  return { inserted: rows.length, source: normalizedSource };
}

export async function hasCurrentCustomerLegalAcceptances(userId) {
  const normalizedUserId = String(userId || "").trim();
  if (!normalizedUserId) return false;

  const serviceClient = getSupabaseServerClient();
  if (!serviceClient) {
    throw new Error("Missing service role Supabase client");
  }

  const { data, error } = await serviceClient
    .from("user_legal_acceptances")
    .select("consent_type,version")
    .eq("user_id", normalizedUserId)
    .in("consent_type", ["terms_of_service", "privacy_policy_acknowledgement"])
    .in("version", [CUSTOMER_TERMS_VERSION, CUSTOMER_PRIVACY_VERSION]);

  if (error) {
    throw new Error(error.message || "Failed to read legal acceptances");
  }

  const accepted = new Set(
    (data || []).map((row) => `${row.consent_type}:${row.version}`)
  );
  return (
    accepted.has(`terms_of_service:${CUSTOMER_TERMS_VERSION}`) &&
    accepted.has(`privacy_policy_acknowledgement:${CUSTOMER_PRIVACY_VERSION}`)
  );
}
