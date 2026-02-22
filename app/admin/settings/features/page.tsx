import AdminFlash from "@/app/admin/_components/AdminFlash";
import AdminPage from "@/app/admin/_components/AdminPage";
import FeatureFlagToggleClient from "@/app/admin/settings/features/_components/FeatureFlagToggleClient";
import { requireAdminAnyRole } from "@/lib/admin/permissions";
import {
  CUSTOMER_NEARBY_PUBLIC_FLAG_KEY,
  getFeatureFlag,
} from "@/lib/featureFlags";

export default async function AdminFeatureSettingsPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireAdminAnyRole(["admin_super"]);

  const params = (await searchParams) || {};
  const enabled = await getFeatureFlag(CUSTOMER_NEARBY_PUBLIC_FLAG_KEY);

  return (
    <AdminPage>
      <AdminFlash searchParams={params} />
      <header>
        <h2 className="text-xl font-semibold">Feature Settings</h2>
        <p className="text-sm text-neutral-400">Super admin controls for platform feature flags.</p>
      </header>

      <section className="rounded-lg border border-neutral-800 bg-neutral-900 p-4" data-testid="feature-flag-card">
        <div className="space-y-1">
          <h3 className="text-base font-semibold">Public access to Nearby page</h3>
          <p className="text-sm text-neutral-400">Allow unauthenticated users to access /customer/nearby.</p>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-3">
          <FeatureFlagToggleClient initialEnabled={enabled} />
        </div>
      </section>
    </AdminPage>
  );
}
