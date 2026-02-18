export const ADMIN_ROLE_KEYS = [
  "admin_readonly",
  "admin_support",
  "admin_ops",
  "admin_super",
] as const;

export type AdminRoleKey = (typeof ADMIN_ROLE_KEYS)[number];

export function normalizeLegacyAdminRole(value: unknown): AdminRoleKey | null {
  if (typeof value !== "string") return null;
  const role = value.trim().toLowerCase();
  if (!role) return null;
  if (role === "super_admin" || role === "admin_super") return "admin_super";
  if (role === "admin_ops") return "admin_ops";
  if (role === "admin_support") return "admin_support";
  if (role === "admin_readonly" || role === "admin") return "admin_readonly";
  return null;
}
