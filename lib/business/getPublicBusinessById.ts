import { getPublicSupabaseServerClient } from "@/lib/supabasePublicServer";
import {
  applyPublicBusinessVisibility,
  isPublicBusinessMediaSelectError,
  mapPublicBusinessRow,
  PUBLIC_BUSINESS_LEGACY_SELECT,
  PUBLIC_BUSINESS_SELECT,
  type PublicBusiness,
  type PublicBusinessRow,
} from "@/lib/business/publicBusinessQuery";

const UUID_ANY_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function getPublicBusinessById(
  businessId: string,
  options: {
    client?: {
      from: (table: string) => any;
    } | null;
    viewerCanSeeInternalContent?: boolean;
  } = {}
): Promise<PublicBusiness | null> {
  const trimmedBusinessId = String(businessId || "").trim();
  if (!trimmedBusinessId || !UUID_ANY_RE.test(trimmedBusinessId)) return null;

  const supabase = options.client ?? getPublicSupabaseServerClient();
  const runQuery = (select: string) =>
    applyPublicBusinessVisibility(
      supabase
        .from("businesses")
        .select(select)
        .eq("id", trimmedBusinessId),
      options
    ).maybeSingle();

  let { data, error } = (await runQuery(PUBLIC_BUSINESS_SELECT)) as {
    data: PublicBusinessRow | null;
    error: { code?: string | null; message?: string | null } | null;
  };

  if (error && isPublicBusinessMediaSelectError(error)) {
    ({ data, error } = (await runQuery(PUBLIC_BUSINESS_LEGACY_SELECT)) as {
      data: PublicBusinessRow | null;
      error: { code?: string | null; message?: string | null } | null;
    });
  }

  if (error) {
    console.warn("[public-business] businesses id lookup failed", {
      businessId: trimmedBusinessId,
      code: error.code || null,
      message: error.message || null,
    });
    return null;
  }

  if (!data) return null;
  return mapPublicBusinessRow(data);
}

export default getPublicBusinessById;
