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

export async function getPublicBusinessByPublicId(
  publicId: string,
  options: {
    client?: {
      from: (table: string) => any;
    } | null;
    viewerCanSeeInternalContent?: boolean;
  } = {}
): Promise<PublicBusiness | null> {
  const trimmedPublicId = String(publicId || "").trim();
  if (!trimmedPublicId) return null;

  const supabase = options.client ?? getPublicSupabaseServerClient();
  const runQuery = (select: string) =>
    applyPublicBusinessVisibility(
      supabase
        .from("businesses")
        .select(select)
        .eq("public_id", trimmedPublicId),
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
    console.warn("[public-business] businesses public_id lookup failed", {
      publicId: trimmedPublicId,
      code: error.code || null,
      message: error.message || null,
    });
    return null;
  }

  if (!data) return null;
  return mapPublicBusinessRow(data);
}

export default getPublicBusinessByPublicId;
