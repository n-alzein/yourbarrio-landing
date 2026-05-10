import { getPublicSupabaseServerClient } from "@/lib/supabasePublicServer";
import {
  applyPublicBusinessVisibility,
  isPublicBusinessCoverMediaSelectError,
  mapPublicBusinessRow,
  PUBLIC_BUSINESS_LEGACY_SELECT,
  PUBLIC_BUSINESS_SELECT,
  type PublicBusiness,
  type PublicBusinessRow,
} from "@/lib/business/publicBusinessQuery";

const UUID_ANY_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function getPublicBusinessByOwnerId(
  ownerUserId: string,
  options: {
    client?: {
      from: (table: string) => any;
    } | null;
    viewerCanSeeInternalContent?: boolean;
  } = {}
): Promise<PublicBusiness | null> {
  const trimmedOwnerUserId = String(ownerUserId || "").trim();
  if (!trimmedOwnerUserId || !UUID_ANY_RE.test(trimmedOwnerUserId)) return null;

  const supabase = options.client ?? getPublicSupabaseServerClient();
  const runQuery = (select: string) =>
    applyPublicBusinessVisibility(
      supabase
        .from("businesses")
        .select(select)
        .eq("owner_user_id", trimmedOwnerUserId),
      options
    ).maybeSingle();

  let { data, error } = (await runQuery(PUBLIC_BUSINESS_SELECT)) as {
    data: PublicBusinessRow | null;
    error: { code?: string | null; message?: string | null } | null;
  };

  if (error && isPublicBusinessCoverMediaSelectError(error)) {
    ({ data, error } = (await runQuery(PUBLIC_BUSINESS_LEGACY_SELECT)) as {
      data: PublicBusinessRow | null;
      error: { code?: string | null; message?: string | null } | null;
    });
  }

  if (error) {
    console.warn("[public-business] businesses lookup failed", {
      ownerUserId: trimmedOwnerUserId,
      code: error.code || null,
      message: error.message || null,
    });
    return null;
  }

  if (!data) return null;

  return mapPublicBusinessRow(data);
}

export default getPublicBusinessByOwnerId;
