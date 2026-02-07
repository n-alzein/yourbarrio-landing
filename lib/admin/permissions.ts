import "server-only";

import { redirect } from "next/navigation";
import { getProfileCached, getSupabaseServerClient, getUserCached } from "@/lib/supabaseServer";

export const ADMIN_ROLES = [
  "admin_readonly",
  "admin_support",
  "admin_ops",
  "admin_super",
] as const;

export type AdminRole = (typeof ADMIN_ROLES)[number];

type AdminContext = {
  supabase: Awaited<ReturnType<typeof getSupabaseServerClient>>;
  user: { id: string; email?: string | null };
  profile: Record<string, any> | null;
  roles: AdminRole[];
  devAllowlistUsed: boolean;
  strictPermissionBypassUsed: boolean;
};

const ROLE_ORDER: Record<AdminRole, number> = {
  admin_readonly: 10,
  admin_support: 20,
  admin_ops: 30,
  admin_super: 40,
};

function parseDevAllowEmails() {
  if (process.env.NODE_ENV === "production") return [];
  const value = process.env.ADMIN_DEV_ALLOW_EMAILS || "";
  return value
    .split(",")
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);
}

function canBypassStrictPermissionsInDev() {
  return (
    process.env.NODE_ENV !== "production" &&
    String(process.env.ADMIN_DEV_BYPASS_PERMISSIONS || "").toLowerCase() === "true"
  );
}

function hasRoleOrHigher(roles: AdminRole[], requiredRole: AdminRole) {
  const needed = ROLE_ORDER[requiredRole];
  return roles.some((role) => ROLE_ORDER[role] >= needed);
}

async function checkIsAdminViaRpc(supabase: any) {
  try {
    const { data, error } = await supabase.rpc("is_admin");
    if (error) return null;
    if (typeof data === "boolean") return data;
    return Boolean(data);
  } catch {
    return null;
  }
}

async function getRolesFromTable(supabase: any, userId: string): Promise<AdminRole[]> {
  const { data, error } = await supabase
    .from("admin_role_members")
    .select("role_key")
    .eq("user_id", userId);

  if (error || !Array.isArray(data)) return [];

  return data
    .map((row) => row?.role_key)
    .filter((role: unknown): role is AdminRole =>
      typeof role === "string" && (ADMIN_ROLES as readonly string[]).includes(role)
    );
}

export async function getAdminRolesForUser(userId?: string): Promise<AdminRole[]> {
  if (!userId) return [];
  const supabase = await getSupabaseServerClient();
  if (!supabase) return [];

  const roles = await getRolesFromTable(supabase, userId);

  // Backward-compatible fallback until all admins move to admin_role_members.
  if (!roles.length) {
    const profile = await getProfileCached(userId, supabase);
    if (profile?.role === "admin" || profile?.is_internal === true) {
      return ["admin_readonly" as AdminRole];
    }
  }

  return roles;
}

export function isAdminDevAllowlistConfigured() {
  return parseDevAllowEmails().length > 0;
}

export async function requireAdmin(): Promise<AdminContext> {
  const supabase = await getSupabaseServerClient();
  if (!supabase) redirect("/");

  const { user } = await getUserCached(supabase);
  if (!user) redirect("/");

  const email = String(user.email || "").toLowerCase();
  const devAllowlistUsed = parseDevAllowEmails().includes(email);

  const rpcIsAdmin = await checkIsAdminViaRpc(supabase);
  const roles = await getAdminRolesForUser(user.id);
  const profile = await getProfileCached(user.id, supabase);
  const fallbackIsAdmin = Boolean(
    roles.length || profile?.role === "admin" || profile?.is_internal === true
  );

  const isAdmin = Boolean(devAllowlistUsed || rpcIsAdmin === true || fallbackIsAdmin);
  const resolvedRoles: AdminRole[] = [...roles];
  if (devAllowlistUsed && !resolvedRoles.includes("admin_readonly")) {
    resolvedRoles.push("admin_readonly");
  }

  if (!isAdmin) redirect("/");

  return {
    supabase,
    user: { id: user.id, email: user.email },
    profile,
    roles: resolvedRoles,
    devAllowlistUsed,
    strictPermissionBypassUsed: false,
  };
}

export async function requireAdminRole(requiredRole: AdminRole) {
  const context = await requireAdmin();

  if (context.devAllowlistUsed && canBypassStrictPermissionsInDev()) {
    return {
      ...context,
      strictPermissionBypassUsed: true,
    };
  }

  if (!hasRoleOrHigher(context.roles, requiredRole)) {
    redirect("/admin?error=forbidden");
  }

  return context;
}
