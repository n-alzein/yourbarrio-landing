import "server-only";

type AdminUserRoleFilter = "customer" | "business" | "all";

type FetchAdminUsersParams = {
  client: any;
  role?: AdminUserRoleFilter;
  includeInternal?: boolean;
  q?: string;
  city?: string;
  createdFrom?: string;
  createdTo?: string;
  from?: number;
  to?: number;
};

type SharedFilters = Pick<FetchAdminUsersParams, "q" | "city" | "createdFrom" | "createdTo">;
type LocalFilters = SharedFilters & Pick<FetchAdminUsersParams, "includeInternal">;

type AdminUserRow = {
  id: string;
  email: string | null;
  full_name: string | null;
  phone: string | null;
  business_name: string | null;
  role: string | null;
  city: string | null;
  created_at: string | null;
  is_internal: boolean;
};

type AdminUsersDiag = {
  rpcUsed?: boolean;
  rpcError?: { code?: string; message?: string; details?: string | null };
  profilesProbeError?: { code?: string; message?: string; details?: string | null };
  profilesQueryError?: { code?: string; message?: string; details?: string | null };
  profilesFirstPageCount?: number;
  profilesUsed?: boolean;
};

type AdminUsersResult = {
  rows: AdminUserRow[];
  count: number;
  fallbackUsed: boolean;
  error?: any;
  diag?: AdminUsersDiag;
};

const diagEnabled =
  String(process.env.NEXT_PUBLIC_AUTH_DIAG || "") === "1" ||
  String(process.env.AUTH_GUARD_DIAG || "") === "1";

function isMissingIsInternalColumn(error: any) {
  const message = String(error?.message || "");
  const details = String(error?.details || "");
  return error?.code === "PGRST204" || /is_internal/i.test(message) || /is_internal/i.test(details);
}

function applySharedFilters(query: any, { q, city, createdFrom, createdTo }: SharedFilters) {
  if (q) {
    query = query.or(
      `full_name.ilike.%${q}%,email.ilike.%${q}%,phone.ilike.%${q}%,business_name.ilike.%${q}%`
    );
  }
  if (city) query = query.ilike("city", `%${city}%`);
  if (createdFrom) query = query.gte("created_at", `${createdFrom}T00:00:00.000Z`);
  if (createdTo) query = query.lte("created_at", `${createdTo}T23:59:59.999Z`);
  return query;
}

function applyRoleFilter(query: any, role: AdminUserRoleFilter) {
  if (role === "business") return query.eq("role", "business");
  return query;
}

function normalizeRows(rows: any[] | null): AdminUserRow[] {
  return (rows || []).map((row) => ({
    id: String(row?.id || ""),
    email: row?.email ?? null,
    full_name: row?.full_name ?? null,
    phone: row?.phone ?? null,
    business_name: row?.business_name ?? null,
    role: row?.role ?? null,
    city: row?.city ?? null,
    created_at: row?.created_at ?? null,
    is_internal: row?.is_internal === true,
  }));
}

function normalizeProfileRow(row: any): AdminUserRow | null {
  const id = row?.user_id || row?.id;
  if (!id) return null;
  return {
    id: String(id),
    email: row?.email ?? row?.user_email ?? null,
    full_name: row?.full_name ?? row?.name ?? null,
    phone: row?.phone ?? null,
    business_name: null,
    role: "customer",
    city: row?.city ?? null,
    created_at: row?.created_at ?? row?.updated_at ?? null,
    is_internal: false,
  };
}

function sortByCreatedAtDesc(rows: AdminUserRow[]) {
  return [...rows].sort((a, b) => {
    const aTs = a.created_at ? Date.parse(a.created_at) : 0;
    const bTs = b.created_at ? Date.parse(b.created_at) : 0;
    return bTs - aTs;
  });
}

function buildSearchOr(q: string) {
  return `full_name.ilike.%${q}%,email.ilike.%${q}%,phone.ilike.%${q}%,business_name.ilike.%${q}%`;
}

function buildCustomerSearchOr(q: string) {
  return [
    `and(role.neq.business,full_name.ilike.%${q}%)`,
    `and(role.neq.business,email.ilike.%${q}%)`,
    `and(role.neq.business,phone.ilike.%${q}%)`,
    `and(role.neq.business,business_name.ilike.%${q}%)`,
    `and(role.is.null,full_name.ilike.%${q}%)`,
    `and(role.is.null,email.ilike.%${q}%)`,
    `and(role.is.null,phone.ilike.%${q}%)`,
    `and(role.is.null,business_name.ilike.%${q}%)`,
  ].join(",");
}

function applyUsersRoleAndSearchFilters(query: any, role: AdminUserRoleFilter, q: string) {
  const hasQ = Boolean(q);
  if (role === "business") {
    query = query.eq("role", "business");
    if (hasQ) query = query.or(buildSearchOr(q));
    return query;
  }
  if (role === "customer") {
    if (hasQ) {
      // Single OR clause: customer role semantics + text search branches.
      query = query.or(buildCustomerSearchOr(q));
    } else {
      // Single OR clause (no search): include null role and all non-business roles.
      query = query.or("role.is.null,role.neq.business");
    }
    return query;
  }
  if (hasQ) query = query.or(buildSearchOr(q));
  return query;
}

async function logRoleCountsDiag(client: any, source: string) {
  if (!diagEnabled) return;
  const [total, business, customer, userRole, nullRole] = await Promise.all([
    client.from("users").select("id", { count: "exact", head: true }),
    client.from("users").select("id", { count: "exact", head: true }).eq("role", "business"),
    client.from("users").select("id", { count: "exact", head: true }).eq("role", "customer"),
    client.from("users").select("id", { count: "exact", head: true }).eq("role", "user"),
    client.from("users").select("id", { count: "exact", head: true }).is("role", null),
  ]);
  console.warn("[admin-users] customer query returned 0 rows", {
    source,
    total: total.count || 0,
    role_business: business.count || 0,
    role_customer: customer.count || 0,
    role_user: userRole.count || 0,
    role_null: nullRole.count || 0,
  });
}

function applyLocalFilters(rows: AdminUserRow[], params: LocalFilters) {
  const qNorm = (params.q || "").trim().toLowerCase();
  const cityNorm = (params.city || "").trim().toLowerCase();
  const fromTs = params.createdFrom ? Date.parse(`${params.createdFrom}T00:00:00.000Z`) : null;
  const toTs = params.createdTo ? Date.parse(`${params.createdTo}T23:59:59.999Z`) : null;

  let filtered = rows;
  if (params.includeInternal === true) filtered = filtered.filter((r) => r.is_internal === true);
  if (params.includeInternal === false) filtered = filtered.filter((r) => r.is_internal !== true);

  filtered = filtered.filter((row) => {
    if (qNorm) {
      const haystack = [row.full_name || "", row.email || "", row.phone || "", row.business_name || ""]
        .join(" ")
        .toLowerCase();
      if (!haystack.includes(qNorm)) return false;
    }
    if (cityNorm && !String(row.city || "").toLowerCase().includes(cityNorm)) return false;
    if (fromTs || toTs) {
      const createdTs = row.created_at ? Date.parse(row.created_at) : NaN;
      if (fromTs && (!Number.isFinite(createdTs) || createdTs < fromTs)) return false;
      if (toTs && (!Number.isFinite(createdTs) || createdTs > toTs)) return false;
    }
    return true;
  });

  return filtered;
}

async function fetchUsersFromUsers(params: FetchAdminUsersParams): Promise<AdminUsersResult> {
  const {
    client,
    role = "all",
    includeInternal,
    q = "",
    city = "",
    createdFrom = "",
    createdTo = "",
    from = 0,
    to = 19,
  } = params;

  let primaryQuery = client
    .from("users")
    .select("id, email, full_name, phone, business_name, role, is_internal, city, created_at", {
      count: "exact",
    })
    .order("created_at", { ascending: false });

  primaryQuery = applyRoleFilter(primaryQuery, role);

  if (includeInternal === true) {
    primaryQuery = primaryQuery.eq("is_internal", true);
  } else if (includeInternal === false) {
    primaryQuery = primaryQuery.not("is_internal", "is", true);
  }

  primaryQuery = applySharedFilters(primaryQuery, { q: "", city, createdFrom, createdTo });
  primaryQuery = applyUsersRoleAndSearchFilters(primaryQuery, role, q);

  const primary = await primaryQuery.range(from, to);
  if (!primary.error) {
    if (role === "customer" && (primary.count || 0) === 0) {
      await logRoleCountsDiag(client, "users-primary");
    }
    return { rows: normalizeRows(primary.data), count: primary.count || 0, fallbackUsed: false };
  }

  if (!isMissingIsInternalColumn(primary.error)) {
    return { rows: [], count: 0, fallbackUsed: false, error: primary.error };
  }

  if (diagEnabled) {
    console.warn("[admin-users] is_internal missing; using staging-compatible query", {
      code: primary.error.code,
      message: primary.error.message,
    });
  }

  let fallbackQuery = client
    .from("users")
    .select("id, email, full_name, phone, business_name, role, city, created_at", {
      count: "exact",
    })
    .order("created_at", { ascending: false });

  fallbackQuery = applyRoleFilter(fallbackQuery, role);
  fallbackQuery = applySharedFilters(fallbackQuery, { q: "", city, createdFrom, createdTo });
  fallbackQuery = applyUsersRoleAndSearchFilters(fallbackQuery, role, q);

  if (includeInternal === true) {
    return { rows: [], count: 0, fallbackUsed: true };
  }

  const fallback = await fallbackQuery.range(from, to);
  if (fallback.error) {
    return { rows: [], count: 0, fallbackUsed: true, error: fallback.error };
  }

  if (role === "customer" && (fallback.count || 0) === 0) {
    await logRoleCountsDiag(client, "users-fallback");
  }

  return { rows: normalizeRows(fallback.data), count: fallback.count || 0, fallbackUsed: true };
}

async function fetchCustomerUsersFromProfiles(params: FetchAdminUsersParams): Promise<AdminUsersResult> {
  const { client, q = "", city = "", createdFrom = "", createdTo = "", from = 0, to = 19 } = params;
  const diag: AdminUsersDiag = {};

  const probe = await client.from("profiles").select("id").limit(1);
  if (probe.error) {
    diag.profilesProbeError = {
      code: probe.error.code,
      message: probe.error.message,
      details: probe.error.details,
    };
    if (diagEnabled) {
      console.warn("[admin-users] profiles probe failed", diag.profilesProbeError);
    }
    return { rows: [], count: 0, fallbackUsed: true, error: probe.error, diag };
  }

  const batchSize = 500;
  const maxRows = 5000;
  const collected: any[] = [];

  for (let offset = 0; offset < maxRows; offset += batchSize) {
    const { data, error } = await client
      .from("profiles")
      .select("*")
      .range(offset, offset + batchSize - 1);

    if (offset === 0) {
      diag.profilesFirstPageCount = (data || []).length;
      if (diagEnabled) {
        console.warn("[admin-users] profiles first page", {
          firstPageCount: diag.profilesFirstPageCount,
        });
      }
    }

    if (error) {
      diag.profilesQueryError = {
        code: error.code,
        message: error.message,
        details: error.details,
      };
      if (diagEnabled) {
        console.warn("[admin-users] profiles query failed", diag.profilesQueryError);
      }
      return { rows: [], count: 0, fallbackUsed: true, error, diag };
    }

    const chunk = data || [];
    collected.push(...chunk);
    if (chunk.length < batchSize) break;
  }

  const normalized = collected
    .map((row) => normalizeProfileRow(row))
    .filter(Boolean) as AdminUserRow[];
  const filtered = applyLocalFilters(normalized, { q, city, createdFrom, createdTo });
  const sorted = sortByCreatedAtDesc(filtered);

  diag.profilesUsed = true;
  if (diagEnabled) {
    console.warn("[admin-users] using profiles for customers", {
      totalProfilesCustomers: sorted.length,
    });
  }

  return {
    rows: sorted.slice(from, to + 1),
    count: sorted.length,
    fallbackUsed: true,
    diag,
  };
}

async function fetchUsersViaRpc(params: FetchAdminUsersParams): Promise<AdminUsersResult> {
  const { client, role = "all", q = "", city = "", from = 0, to = 19 } = params;
  const diag: AdminUsersDiag = { rpcUsed: true };
  const rpcTo = Math.max(to, 2000);

  const { data, error } = await client.rpc("admin_list_users", {
    p_role: role,
    p_q: q || null,
    p_city: city || null,
    p_from: 0,
    p_to: rpcTo,
  });

  if (error) {
    diag.rpcError = {
      code: error.code,
      message: error.message,
      details: error.details,
    };
    if (diagEnabled) {
      console.warn("[admin-users] admin_list_users rpc failed", diag.rpcError);
    }
    return { rows: [], count: 0, fallbackUsed: false, error, diag };
  }

  const normalized = normalizeRows(Array.isArray(data) ? data : []);
  const filtered = applyLocalFilters(normalized, params);
  const sorted = sortByCreatedAtDesc(filtered);

  if (diagEnabled) {
    console.warn("[admin-users] admin_list_users rpc used", {
      fetched: normalized.length,
      filtered: sorted.length,
      role,
    });
  }

  return {
    rows: sorted.slice(from, to + 1),
    count: sorted.length,
    fallbackUsed: true,
    diag,
  };
}

export async function fetchAdminUsers(params: FetchAdminUsersParams): Promise<AdminUsersResult> {
  const { role = "all", includeInternal, from = 0, to = 19 } = params;

  if (role === "business") {
    return fetchUsersFromUsers({ ...params, role: "business" });
  }

  const rpcResult = await fetchUsersViaRpc(params);
  if (!rpcResult.error) return rpcResult;

  if (role === "customer") {
    const usersResult = await fetchUsersFromUsers({ ...params, role: "customer", includeInternal });
    if (!usersResult.error && usersResult.count > 0) {
      return {
        ...usersResult,
        diag: {
          ...(usersResult.diag || {}),
          ...(rpcResult.diag || {}),
        },
      };
    }

    const profilesResult = await fetchCustomerUsersFromProfiles(params);
    if (profilesResult.error) {
      return {
        ...usersResult,
        diag: {
          ...(rpcResult.diag || {}),
          ...(profilesResult.diag || {}),
        },
      };
    }

    return {
      ...profilesResult,
      diag: {
        ...(rpcResult.diag || {}),
        ...(profilesResult.diag || {}),
      },
    };
  }

  const usersAllResult = await fetchUsersFromUsers({
    ...params,
    role: "all",
    includeInternal,
    from: 0,
    to,
  });

  if (includeInternal === true) {
    return {
      rows: usersAllResult.rows.slice(from, to + 1),
      count: usersAllResult.count,
      fallbackUsed: usersAllResult.fallbackUsed,
      error: usersAllResult.error,
      diag: rpcResult.diag,
    };
  }

  const usersCustomerResult = await fetchUsersFromUsers({
    ...params,
    role: "customer",
    includeInternal: false,
    from: 0,
    to,
  });

  const shouldUseProfilesForCustomers = !usersCustomerResult.error && usersCustomerResult.count === 0;

  let mergedRows = usersAllResult.rows;
  let totalCount = usersAllResult.count;
  let mergedDiag: AdminUsersDiag = {
    ...(rpcResult.diag || {}),
  };

  if (shouldUseProfilesForCustomers) {
    const profilesResult = await fetchCustomerUsersFromProfiles({ ...params, from: 0, to });
    if (!profilesResult.error) {
      const seen = new Set(mergedRows.map((row) => row.id));
      const uniqueProfiles = profilesResult.rows.filter((row) => !seen.has(row.id));
      mergedRows = sortByCreatedAtDesc([...mergedRows, ...uniqueProfiles]);
      totalCount += profilesResult.count;
      mergedDiag = {
        ...mergedDiag,
        ...(profilesResult.diag || {}),
      };
    }
  }

  return {
    rows: mergedRows.slice(from, to + 1),
    count: totalCount,
    fallbackUsed:
      usersAllResult.fallbackUsed || usersCustomerResult.fallbackUsed || shouldUseProfilesForCustomers,
    error: usersAllResult.error,
    diag: mergedDiag,
  };
}
