import "server-only";
import { normalizeIdValue, parseEntityDisplayId } from "@/lib/entityIds";

/**
 * Admin accounts data source notes:
 * - Role source of truth is `users.role`, with admin membership from `admin_role_members.role_key`.
 * - `is_internal` source of truth is `users.is_internal` (or false when missing in legacy envs).
 * - Internal users are NOT admins by role semantics; internal is a separate operational flag.
 * - Root cause of silent "No accounts found": errors from data queries were previously ignored by the UI,
 *   so schema/RLS failures looked like empty data.
 */

export type AdminUserRoleFilter = "all" | "customer" | "business" | "admin";
export type AdminBusinessInventoryFilter = "none" | "no-published-listings";

export type FetchAdminUsersParams = {
  client: any;
  usingServiceRole: boolean;
  role?: AdminUserRoleFilter;
  businessInventoryFilter?: AdminBusinessInventoryFilter;
  includeInternal?: boolean;
  q?: string;
  from?: number;
  to?: number;
};

export type AdminUserRow = {
  id: string;
  public_id: string | null;
  email: string | null;
  full_name: string | null;
  phone: string | null;
  business_name: string | null;
  role: string | null;
  account_role: "customer" | "business" | "admin";
  city: string | null;
  created_at: string | null;
  is_internal: boolean;
  admin_role_keys: string[];
};

export type AdminUsersDiag = {
  path: "service-query" | "service-rpc-fallback" | "actor-rpc" | "service-business-id-query";
  usingServiceRole: boolean;
  rpcUsed?: boolean;
  serviceError?: { code?: string; message?: string; details?: string | null };
  rpcError?: { code?: string; message?: string; details?: string | null };
  probes?: {
    usersTotal: number;
    businessesTotal: number;
    internalTotal: number;
    adminRoleMembersTotal: number;
  };
};

type AdminUsersResult = {
  rows: AdminUserRow[];
  count: number;
  fallbackUsed: boolean;
  error?: any;
  diag: AdminUsersDiag;
};

type BusinessInventoryRow = {
  owner_user_id: string | null;
  public_id?: string | null;
  business_name?: string | null;
  is_internal: boolean | null;
  is_seeded: boolean | null;
  verification_status: string | null;
};

type ListingInventoryRow = {
  business_id: string | null;
  status: string | null;
  is_seeded: boolean | null;
  is_internal: boolean | null;
  is_test: boolean | null;
  admin_hidden: boolean | null;
  deleted_at: string | null;
};

const adminDiagEnabled =
  String(process.env.AUTH_GUARD_DIAG || "") === "1" ||
  String(process.env.NEXT_PUBLIC_AUTH_DIAG || "") === "1";
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function sanitizeSearchTerm(term: string) {
  return term.replace(/[%(),]/g, " ").trim();
}

function buildSearchOr(q: string) {
  const safe = sanitizeSearchTerm(q);
  if (!safe) return "";
  const clauses = [
    `full_name.ilike.%${safe}%`,
    `email.ilike.%${safe}%`,
    `phone.ilike.%${safe}%`,
    `business_name.ilike.%${safe}%`,
    `public_id.ilike.%${safe}%`,
  ];
  if (UUID_REGEX.test(safe)) {
    clauses.push(`id.eq.${safe.toLowerCase()}`);
  }
  return clauses.join(",");
}

async function resolveBusinessOwnerIdsForSearch(client: any, q: string): Promise<{
  ownerUserIds: string[];
  exactIdentifierAttempted: boolean;
}> {
  const raw = String(q || "").trim();
  if (!raw) {
    return { ownerUserIds: [], exactIdentifierAttempted: false };
  }

  const parsed = parseEntityDisplayId(raw);
  const normalized = normalizeIdValue(raw);
  const ownerUserIds = new Set<string>();
  const uuidCandidates = Array.from(
    new Set([raw, normalized].filter((value) => value && UUID_REGEX.test(value)))
  );
  const publicIdCandidates = Array.from(
    new Set([raw, normalized].filter((value) => value && !UUID_REGEX.test(value)))
  );

  const exactIdentifierAttempted = Boolean(parsed?.type === "business" || uuidCandidates.length);

  for (const candidate of uuidCandidates) {
    const { data } = await client
      .from("businesses")
      .select("owner_user_id")
      .or(`id.eq.${candidate},owner_user_id.eq.${candidate}`);

    for (const row of Array.isArray(data) ? data : []) {
      const ownerUserId = String(row?.owner_user_id || "").trim();
      if (ownerUserId) ownerUserIds.add(ownerUserId);
    }
  }

  for (const candidate of publicIdCandidates) {
    const { data } = await client
      .from("businesses")
      .select("owner_user_id")
      .ilike("public_id", candidate.toLowerCase());

    for (const row of Array.isArray(data) ? data : []) {
      const ownerUserId = String(row?.owner_user_id || "").trim();
      if (ownerUserId) ownerUserIds.add(ownerUserId);
    }
  }

  return {
    ownerUserIds: Array.from(ownerUserIds),
    exactIdentifierAttempted,
  };
}

function normalizeRole(value: string | null | undefined) {
  const role = String(value || "").trim().toLowerCase();
  if (role === "business") return "business" as const;
  if (role === "admin") return "admin" as const;
  return "customer" as const;
}

function normalizeStatus(value: string | null | undefined) {
  return String(value || "").trim().toLowerCase();
}

function isFilled(value: unknown) {
  return typeof value === "string" && value.trim().length > 0;
}

function isEligibleRealBusiness(row: BusinessInventoryRow | undefined) {
  return Boolean(row) && row?.is_internal !== true && row?.is_seeded !== true && normalizeStatus(row?.verification_status) !== "suspended";
}

function isPublishedListing(row: ListingInventoryRow) {
  return normalizeStatus(row.status) === "published" && row.admin_hidden !== true && !isFilled(row.deleted_at);
}

function isPublishedRealListing(row: ListingInventoryRow, business: BusinessInventoryRow | undefined) {
  return (
    isPublishedListing(row) &&
    row.is_seeded !== true &&
    row.is_internal !== true &&
    row.is_test !== true &&
    isEligibleRealBusiness(business)
  );
}

function matchesAdminUserSearch(row: AdminUserRow, q: string, business?: BusinessInventoryRow) {
  const safe = String(q || "").trim().toLowerCase();
  if (!safe) return true;
  const haystack = [
    row.id,
    row.public_id,
    row.email,
    row.full_name,
    row.phone,
    row.business_name,
    row.city,
    business?.public_id,
    business?.business_name,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  return haystack.includes(safe);
}

function normalizeRows(
  rows: any[] | null,
  adminRoleKeysByUserId: Map<string, string[]>
): AdminUserRow[] {
  return (rows || []).map((row) => {
    const id = String(row?.id || "");
    const role = normalizeRole(row?.role ?? null);
    const roleKeysFromRow = Array.isArray(row?.admin_role_keys)
      ? row.admin_role_keys
          .map((value: unknown) => String(value || "").trim())
          .filter(Boolean)
      : [];
    const roleKeys = adminRoleKeysByUserId.get(id) || roleKeysFromRow;
    const isInternal = row?.is_internal === true;
    const hasAdminAccess = role === "admin" || roleKeys.length > 0;
    return {
      id,
      public_id: row?.public_id ?? null,
      email: row?.email ?? null,
      full_name: row?.full_name ?? null,
      phone: row?.phone ?? null,
      business_name: row?.business_name ?? null,
      role: row?.role ?? null,
      account_role: hasAdminAccess ? "admin" : role === "business" ? "business" : "customer",
      city: row?.city ?? null,
      created_at: row?.created_at ?? null,
      is_internal: isInternal,
      admin_role_keys: roleKeys,
    };
  });
}

async function getBusinessInternalByOwnerId(client: any, ownerIds: string[]) {
  const uniqueOwnerIds = Array.from(new Set(ownerIds.filter(Boolean)));
  if (uniqueOwnerIds.length === 0) return new Map<string, boolean>();

  const { data, error } = await client
    .from("businesses")
    .select("owner_user_id,is_internal")
    .in("owner_user_id", uniqueOwnerIds);

  if (error || !Array.isArray(data)) {
    return new Map<string, boolean>();
  }

  return new Map(
    data
      .map((row: any) => [String(row?.owner_user_id || ""), row?.is_internal === true] as const)
      .filter(([ownerId]) => Boolean(ownerId))
  );
}

function applyBusinessInternalState(rows: AdminUserRow[], businessInternalByOwnerId: Map<string, boolean>) {
  return rows.map((row) =>
    row.account_role === "business"
      ? {
          ...row,
          is_internal: businessInternalByOwnerId.get(row.id) === true,
        }
      : row
  );
}

async function getAdminRoleMembers(client: any) {
  const roleKeysByUserId = new Map<string, string[]>();
  const { data, error } = await client
    .from("admin_role_members")
    .select("user_id, role_key");

  if (!error && Array.isArray(data)) {
    for (const row of data) {
      const userId = String(row?.user_id || "");
      const roleKey = String(row?.role_key || "").trim();
      if (!userId || !roleKey) continue;
      const existing = roleKeysByUserId.get(userId) || [];
      existing.push(roleKey);
      roleKeysByUserId.set(userId, existing);
    }
  }

  return {
    roleKeysByUserId,
    adminIds: Array.from(roleKeysByUserId.keys()),
    error,
  };
}

function applyRoleFilter(query: any, role: AdminUserRoleFilter, adminIds: string[]) {
  if (role === "business") {
    query = query.eq("role", "business");
    if (adminIds.length) {
      query = query.not("id", "in", `(${adminIds.join(",")})`);
    }
    return query;
  }
  if (role === "customer") {
    query = query.or("role.eq.customer,role.eq.user,role.is.null");
    if (adminIds.length) {
      query = query.not("id", "in", `(${adminIds.join(",")})`);
    }
    return query;
  }
  if (role === "admin") {
    const adminClauses = ["role.eq.admin"];
    if (adminIds.length) {
      adminClauses.push(`id.in.(${adminIds.join(",")})`);
    }
    return query.or(adminClauses.join(","));
  }
  return query;
}

async function runZeroRowProbes(client: any) {
  const [usersTotal, businessesTotal, internalTotal, adminRoleMembersTotal] =
    await Promise.all([
      client.from("users").select("id", { count: "exact", head: true }),
      client.from("users").select("id", { count: "exact", head: true }).eq("role", "business"),
      client.from("users").select("id", { count: "exact", head: true }).eq("is_internal", true),
      client.from("admin_role_members").select("user_id", { count: "exact", head: true }),
    ]);

  const probeResult = {
    usersTotal: usersTotal.count || 0,
    businessesTotal: businessesTotal.count || 0,
    internalTotal: internalTotal.count || 0,
    adminRoleMembersTotal: adminRoleMembersTotal.count || 0,
  };
  console.warn("[admin-accounts] zero-row probes", probeResult);
  return probeResult;
}

async function fetchViaRpc({
  client,
  role,
  includeInternal,
  q,
  from,
  to,
  usingServiceRole,
  path,
  serviceError,
}: {
  client: any;
  role: AdminUserRoleFilter;
  includeInternal: boolean | undefined;
  q: string;
  from: number;
  to: number;
  usingServiceRole: boolean;
  path: AdminUsersDiag["path"];
  serviceError?: { code?: string; message?: string; details?: string | null };
}): Promise<AdminUsersResult> {
  const { data, error } = await client.rpc("admin_list_accounts", {
    p_role: role,
    p_internal: includeInternal ?? null,
    p_q: q || null,
    p_from: from,
    p_to: to,
  });

  const diag: AdminUsersDiag = {
    path,
    usingServiceRole,
    rpcUsed: true,
    serviceError,
  };

  if (error) {
    diag.rpcError = {
      code: error.code,
      message: error.message,
      details: error.details,
    };
    return {
      rows: [],
      count: 0,
      fallbackUsed: true,
      error,
      diag,
    };
  }

  const rawRows = Array.isArray(data) ? data : [];
  const rows = normalizeRows(rawRows, new Map());
  const count =
    rawRows.length > 0
      ? Number(rawRows[0]?.total_count || rows.length)
      : 0;

  if (adminDiagEnabled && count === 0) {
    diag.probes = await runZeroRowProbes(client);
  }

  return {
    rows,
    count,
    fallbackUsed: true,
    diag,
  };
}

async function fetchBusinessesByOwnerIds({
  client,
  ownerUserIds,
  includeInternal,
  usingServiceRole,
}: {
  client: any;
  ownerUserIds: string[];
  includeInternal: boolean | undefined;
  usingServiceRole: boolean;
}): Promise<AdminUsersResult> {
  const { roleKeysByUserId, error: adminRoleMembersError } = await getAdminRoleMembers(client);
  const { data, error } = await client
    .from("users")
    .select("id, public_id, email, full_name, phone, business_name, role, is_internal, city, created_at")
    .in("id", Array.from(new Set(ownerUserIds)));

  const diag: AdminUsersDiag = {
    path: "service-business-id-query",
    usingServiceRole,
  };

  if (adminRoleMembersError) {
    console.warn("[admin-accounts] admin_role_members read failed", {
      code: adminRoleMembersError.code,
      message: adminRoleMembersError.message,
      details: adminRoleMembersError.details,
    });
  }

  if (error) {
    return {
      rows: [],
      count: 0,
      fallbackUsed: false,
      error,
      diag,
    };
  }

  const normalized = normalizeRows(Array.isArray(data) ? data : [], roleKeysByUserId).filter(
    (row) => row.account_role === "business"
  );
  const businessInternalByOwnerId = await getBusinessInternalByOwnerId(
    client,
    normalized.map((row) => row.id)
  );
  const withBusinessInternal = applyBusinessInternalState(normalized, businessInternalByOwnerId);
  const filtered =
    typeof includeInternal === "boolean"
      ? withBusinessInternal.filter((row) => row.is_internal === includeInternal)
      : withBusinessInternal;

  filtered.sort((left, right) =>
    String(right.created_at || "").localeCompare(String(left.created_at || ""))
  );

  return {
    rows: filtered,
    count: filtered.length,
    fallbackUsed: false,
    diag,
  };
}

async function fetchBusinessesWithoutPublishedRealListings({
  client,
  includeInternal,
  q,
  from,
  to,
  usingServiceRole,
}: {
  client: any;
  includeInternal: boolean | undefined;
  q: string;
  from: number;
  to: number;
  usingServiceRole: boolean;
}): Promise<AdminUsersResult> {
  const { roleKeysByUserId, error: adminRoleMembersError } = await getAdminRoleMembers(client);
  const [businessesResult, listingsResult] = await Promise.all([
    client
      .from("businesses")
      .select("owner_user_id, public_id, business_name, is_internal, is_seeded, verification_status"),
    client
      .from("listings")
      .select("business_id, status, is_seeded, is_internal, is_test, admin_hidden, deleted_at"),
  ]);

  const diag: AdminUsersDiag = {
    path: "service-business-id-query",
    usingServiceRole,
  };

  if (adminRoleMembersError) {
    console.warn("[admin-accounts] admin_role_members read failed", {
      code: adminRoleMembersError.code,
      message: adminRoleMembersError.message,
      details: adminRoleMembersError.details,
    });
  }

  const error = businessesResult.error || listingsResult.error;
  if (error) {
    return {
      rows: [],
      count: 0,
      fallbackUsed: false,
      error,
      diag,
    };
  }

  const businessByOwnerId = new Map<string, BusinessInventoryRow>();
  for (const business of (Array.isArray(businessesResult.data) ? businessesResult.data : []) as BusinessInventoryRow[]) {
    const ownerId = String(business?.owner_user_id || "").trim();
    if (!ownerId || !isEligibleRealBusiness(business)) continue;
    if (includeInternal === true) continue;
    if (includeInternal === false && business.is_internal === true) continue;
    businessByOwnerId.set(ownerId, business);
  }

  const ownersWithPublishedRealListing = new Set<string>();
  for (const listing of (Array.isArray(listingsResult.data) ? listingsResult.data : []) as ListingInventoryRow[]) {
    const ownerId = String(listing?.business_id || "").trim();
    if (!ownerId) continue;
    const business = businessByOwnerId.get(ownerId);
    if (isPublishedRealListing(listing, business)) {
      ownersWithPublishedRealListing.add(ownerId);
    }
  }

  const ownerUserIds = Array.from(businessByOwnerId.keys()).filter(
    (ownerId) => !ownersWithPublishedRealListing.has(ownerId)
  );

  if (!ownerUserIds.length) {
    return {
      rows: [],
      count: 0,
      fallbackUsed: false,
      diag,
    };
  }

  const { data, error: usersError } = await client
    .from("users")
    .select("id, public_id, email, full_name, phone, business_name, role, is_internal, city, created_at")
    .in("id", ownerUserIds);

  if (usersError) {
    return {
      rows: [],
      count: 0,
      fallbackUsed: false,
      error: usersError,
      diag,
    };
  }

  const normalized = normalizeRows(Array.isArray(data) ? data : [], roleKeysByUserId).filter(
    (row) => row.account_role === "business"
  );
  const filtered = normalized
    .map((row) => ({
      ...row,
      is_internal: businessByOwnerId.get(row.id)?.is_internal === true,
    }))
    .filter((row) => matchesAdminUserSearch(row, q, businessByOwnerId.get(row.id)));

  filtered.sort((left, right) =>
    String(right.created_at || "").localeCompare(String(left.created_at || ""))
  );

  return {
    rows: filtered.slice(from, to + 1),
    count: filtered.length,
    fallbackUsed: false,
    diag,
  };
}

export async function fetchAdminUsers(params: FetchAdminUsersParams): Promise<AdminUsersResult> {
  const {
    client,
    usingServiceRole,
    role = "all",
    businessInventoryFilter = "none",
    includeInternal,
    q = "",
    from = 0,
    to = 19,
  } = params;

  const trimmedQuery = String(q || "").trim();
  if (usingServiceRole && role === "business" && businessInventoryFilter === "no-published-listings") {
    return fetchBusinessesWithoutPublishedRealListings({
      client,
      includeInternal,
      q,
      from,
      to,
      usingServiceRole: true,
    });
  }

  if (usingServiceRole && role === "business" && trimmedQuery) {
    const businessMatch = await resolveBusinessOwnerIdsForSearch(client, trimmedQuery);
    if (businessMatch.ownerUserIds.length > 0) {
      return fetchBusinessesByOwnerIds({
        client,
        ownerUserIds: businessMatch.ownerUserIds,
        includeInternal,
        usingServiceRole: true,
      });
    }
    if (businessMatch.exactIdentifierAttempted) {
      return {
        rows: [],
        count: 0,
        fallbackUsed: false,
        diag: {
          path: "service-business-id-query",
          usingServiceRole: true,
        },
      };
    }
  }

  if (!usingServiceRole) {
    return fetchViaRpc({
      client,
      role,
      includeInternal,
      q,
      from,
      to,
      usingServiceRole: false,
      path: "actor-rpc",
    });
  }

  if (role === "business" || typeof includeInternal === "boolean") {
    return fetchViaRpc({
      client,
      role,
      includeInternal,
      q,
      from,
      to,
      usingServiceRole: true,
      path: "service-rpc-fallback",
    });
  }

  const { roleKeysByUserId, adminIds, error: adminRoleMembersError } =
    await getAdminRoleMembers(client);

  let query = client
    .from("users")
    .select("id, public_id, email, full_name, phone, business_name, role, is_internal, city, created_at", {
      count: "exact",
    })
    .order("created_at", { ascending: false });

  query = applyRoleFilter(query, role, adminIds);

  if (includeInternal === true) {
    query = query.eq("is_internal", true);
  } else if (includeInternal === false) {
    query = query.not("is_internal", "is", true);
  }

  const searchOr = buildSearchOr(q);
  if (searchOr) {
    query = query.or(searchOr);
  }

  const { data, count, error } = await query.range(from, to);
  const diag: AdminUsersDiag = {
    path: "service-query",
    usingServiceRole: true,
  };

  if (adminRoleMembersError) {
    console.warn("[admin-accounts] admin_role_members read failed", {
      code: adminRoleMembersError.code,
      message: adminRoleMembersError.message,
      details: adminRoleMembersError.details,
    });
  }

  if (error) {
    const serviceError = {
      code: error.code,
      message: error.message,
      details: error.details,
    };
    return fetchViaRpc({
      client,
      role,
      includeInternal,
      q,
      from,
      to,
      usingServiceRole: true,
      path: "service-rpc-fallback",
      serviceError,
    });
  }

  if (adminDiagEnabled && (count || 0) === 0) {
    diag.probes = await runZeroRowProbes(client);
  }

  const normalized = normalizeRows(data, roleKeysByUserId);
  const businessInternalByOwnerId = await getBusinessInternalByOwnerId(
    client,
    normalized
      .filter((row) => row.account_role === "business")
      .map((row) => row.id)
  );

  return {
    rows: applyBusinessInternalState(normalized, businessInternalByOwnerId),
    count: count || 0,
    fallbackUsed: false,
    diag,
  };
}
