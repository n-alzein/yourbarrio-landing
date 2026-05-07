import AdminFlash from "@/app/admin/_components/AdminFlash";
import AdminPage from "@/app/admin/_components/AdminPage";
import AnnouncementsAdminClient from "@/app/admin/announcements/AnnouncementsAdminClient";
import { requireAdminRole } from "@/lib/admin/permissions";
import { getAdminServiceRoleClient } from "@/lib/supabase/admin";
import { listPlatformAnnouncements } from "@/lib/notices/platform-announcements";

export default async function AdminAnnouncementsPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const admin = await requireAdminRole("admin_support");
  const announcements = await listPlatformAnnouncements(getAdminServiceRoleClient()).catch(() => []);

  return (
    <AdminPage>
      <AdminFlash searchParams={searchParams} />
      <AnnouncementsAdminClient initialAnnouncements={announcements} roles={admin.roles} showInlinePageHeader />
    </AdminPage>
  );
}
