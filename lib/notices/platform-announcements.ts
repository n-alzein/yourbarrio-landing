import "server-only";

import { getAdminServiceRoleClient } from "@/lib/supabase/admin";
import { getSupabaseServerAuthedClient } from "@/lib/supabaseServer";
import type { Notice, NoticeAudience, NoticeVariant } from "@/lib/notices/resolve-notices";

export const PLATFORM_ANNOUNCEMENT_AUDIENCES = ["all", "guests", "customers", "businesses"] as const;
export const PLATFORM_ANNOUNCEMENT_VARIANTS = ["info", "warning", "critical"] as const;
export const PLATFORM_ANNOUNCEMENT_STATUSES = ["draft", "active", "archived"] as const;

export type PlatformAnnouncementAudience = (typeof PLATFORM_ANNOUNCEMENT_AUDIENCES)[number];
export type PlatformAnnouncementVariant = (typeof PLATFORM_ANNOUNCEMENT_VARIANTS)[number];
export type PlatformAnnouncementStatus = (typeof PLATFORM_ANNOUNCEMENT_STATUSES)[number];

export type PlatformAnnouncement = {
  id: string;
  title: string | null;
  message: string;
  cta_label: string | null;
  cta_href: string | null;
  audience: PlatformAnnouncementAudience;
  variant: PlatformAnnouncementVariant;
  priority: number;
  starts_at: string | null;
  ends_at: string | null;
  dismissible: boolean;
  status: PlatformAnnouncementStatus;
  created_by?: string | null;
  updated_by?: string | null;
  created_at: string;
  updated_at: string;
};

const ACTIVE_SELECT =
  "id,title,message,cta_label,cta_href,audience,variant,priority,starts_at,ends_at,dismissible,status,created_at,updated_at";

const ADMIN_SELECT =
  "id,title,message,cta_label,cta_href,audience,variant,priority,starts_at,ends_at,dismissible,status,created_by,updated_by,created_at,updated_at";

const VARIANT_NOTICE_BASE_PRIORITY: Record<PlatformAnnouncementVariant, number> = {
  critical: 1000,
  warning: 900,
  info: 800,
};

export function normalizeViewerAudience(role?: string | null): "guest" | "customer" | "business" {
  const normalized = String(role || "").trim().toLowerCase();
  if (normalized === "business") return "business";
  if (normalized === "customer" || normalized === "user") return "customer";
  return "guest";
}

export function eligibleAnnouncementAudiences(
  viewerAudience: "guest" | "customer" | "business"
): PlatformAnnouncementAudience[] {
  if (viewerAudience === "business") return ["all", "businesses"];
  if (viewerAudience === "customer") return ["all", "customers"];
  return ["all", "guests"];
}

function isPlatformAnnouncementRow(row: any): row is PlatformAnnouncement {
  return Boolean(row?.id && row?.message && row?.audience && row?.variant && row?.status);
}

export function platformAnnouncementToNotice(row: PlatformAnnouncement): Notice {
  const version = row.updated_at || row.created_at || "";
  return {
    id: `platform-announcement:${row.id}:${version}`,
    variant: row.variant as NoticeVariant,
    priority: VARIANT_NOTICE_BASE_PRIORITY[row.variant] + Number(row.priority || 0),
    audience: "all" as NoticeAudience,
    title: row.title || undefined,
    message: row.message,
    ctaLabel: row.cta_label || undefined,
    ctaHref: row.cta_href || undefined,
    dismissible: row.dismissible,
    sticky: false,
  };
}

export async function resolveCurrentViewerAudience() {
  const authedClient = await getSupabaseServerAuthedClient();
  if (!authedClient) return "guest" as const;

  const {
    data: { user },
  } = await authedClient.auth.getUser();
  if (!user?.id) return "guest" as const;

  const serviceClient = getAdminServiceRoleClient();
  const { data } = await serviceClient
    .from("users")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  return normalizeViewerAudience(data?.role || user.app_metadata?.role || user.user_metadata?.role);
}

export async function getActivePlatformAnnouncementForAudience(
  viewerAudience: "guest" | "customer" | "business"
): Promise<PlatformAnnouncement | null> {
  const serviceClient = getAdminServiceRoleClient();
  const now = new Date().toISOString();
  const audiences = eligibleAnnouncementAudiences(viewerAudience);

  const { data, error } = await serviceClient
    .from("platform_announcements")
    .select(ACTIVE_SELECT)
    .eq("status", "active")
    .in("audience", audiences)
    .or(`starts_at.is.null,starts_at.lte.${now}`)
    .or(`ends_at.is.null,ends_at.gt.${now}`)
    .order("priority", { ascending: false })
    .order("updated_at", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(10);

  if (error || !Array.isArray(data)) return null;

  const rows = data.filter(isPlatformAnnouncementRow);
  rows.sort((a, b) => {
    const priorityDelta = Number(b.priority || 0) - Number(a.priority || 0);
    if (priorityDelta !== 0) return priorityDelta;
    const updatedDelta = new Date(b.updated_at || b.created_at).getTime() - new Date(a.updated_at || a.created_at).getTime();
    return Number.isFinite(updatedDelta) ? updatedDelta : 0;
  });

  return rows[0] || null;
}

export async function listPlatformAnnouncements(client: any): Promise<PlatformAnnouncement[]> {
  const { data, error } = await client
    .from("platform_announcements")
    .select(ADMIN_SELECT)
    .order("updated_at", { ascending: false })
    .order("created_at", { ascending: false });

  if (error) throw new Error(error.message || "Unable to list announcements");
  return Array.isArray(data) ? data.filter(isPlatformAnnouncementRow) : [];
}
