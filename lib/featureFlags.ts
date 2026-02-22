import "server-only";

import { revalidateTag, unstable_cache } from "next/cache";
import { getAdminServiceRoleClient } from "@/lib/supabase/admin";

export const CUSTOMER_NEARBY_PUBLIC_FLAG_KEY = "customer_nearby_public";

const FLAG_CACHE_SECONDS = 45;
const FEATURE_FLAG_TAG_PREFIX = "feature-flag";
const ALLOWED_FLAG_KEYS = new Set<string>([CUSTOMER_NEARBY_PUBLIC_FLAG_KEY]);
const cachedReaders = new Map<string, () => Promise<boolean>>();

function getFeatureFlagTag(key: string) {
  return `${FEATURE_FLAG_TAG_PREFIX}:${key}`;
}

function getCachedReader(key: string) {
  const existing = cachedReaders.get(key);
  if (existing) return existing;

  const reader = unstable_cache(
    async () => {
      const client = getAdminServiceRoleClient();
      const { data, error } = await client
        .from("feature_flags")
        .select("enabled")
        .eq("key", key)
        .maybeSingle();

      if (error) {
        throw new Error(error.message || "Failed to read feature flag");
      }

      return data?.enabled === true;
    },
    [`feature-flag-read:${key}`],
    {
      revalidate: FLAG_CACHE_SECONDS,
      tags: [getFeatureFlagTag(key)],
    }
  );

  cachedReaders.set(key, reader);
  return reader;
}

async function assertActorIsSuperAdmin(actorUserId: string) {
  const normalizedActorUserId = String(actorUserId || "").trim();
  if (!normalizedActorUserId) {
    throw new Error("Missing actor user id");
  }

  const client = getAdminServiceRoleClient();
  const { count, error } = await client
    .from("admin_role_members")
    .select("user_id", { count: "exact", head: true })
    .eq("user_id", normalizedActorUserId)
    .eq("role_key", "admin_super");

  if (error) {
    throw new Error(error.message || "Failed to verify super admin role");
  }

  if (!Number(count || 0)) {
    throw new Error("Forbidden");
  }
}

export async function getFeatureFlag(key: string): Promise<boolean> {
  const normalizedKey = String(key || "").trim();
  if (!ALLOWED_FLAG_KEYS.has(normalizedKey)) {
    return false;
  }

  try {
    return await getCachedReader(normalizedKey)();
  } catch {
    return false;
  }
}

export async function setFeatureFlag(
  key: string,
  enabled: boolean,
  actorUserId: string
): Promise<void> {
  const normalizedKey = String(key || "").trim();
  if (!ALLOWED_FLAG_KEYS.has(normalizedKey)) {
    throw new Error("Unsupported feature flag");
  }

  const normalizedActorUserId = String(actorUserId || "").trim();
  await assertActorIsSuperAdmin(normalizedActorUserId);

  const client = getAdminServiceRoleClient();
  const { error } = await client
    .from("feature_flags")
    .upsert({
      key: normalizedKey,
      enabled: Boolean(enabled),
      updated_by: normalizedActorUserId,
    }, { onConflict: "key", ignoreDuplicates: false });

  if (error) {
    throw new Error(error.message || "Failed to update feature flag");
  }

  revalidateTag(getFeatureFlagTag(normalizedKey), "max");
}
