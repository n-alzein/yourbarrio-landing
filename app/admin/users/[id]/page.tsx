import Link from "next/link";
import type { ReactNode } from "react";
import {
  addUserInternalNoteAction,
  startImpersonationAction,
  toggleUserInternalAction,
} from "@/app/admin/actions";
import AdminFlash from "@/app/admin/_components/AdminFlash";
import AdminUserDetailLayout from "@/app/admin/users/[id]/_components/AdminUserDetailLayout";
import AdminUserHeaderBar from "@/app/admin/users/[id]/_components/AdminUserHeaderBar";
import AdminUserProfileEditor from "@/app/admin/users/[id]/_components/AdminUserProfileEditor";
import AdminUserRoleEditor from "@/app/admin/users/[id]/_components/AdminUserRoleEditor";
import AdminUserSecurityActions from "@/app/admin/users/[id]/_components/AdminUserSecurityActions";
import DeleteUserButton from "@/app/admin/users/[ref]/_components/DeleteUserButton";
import { getActorAdminRoleKeys } from "@/lib/admin/getActorAdminRoleKeys";
import { canAdmin, requireAdminRole } from "@/lib/admin/permissions";
import { normalizeUserRef } from "@/lib/ids/normalizeUserRef";
import { getAdminDataClient } from "@/lib/supabase/admin";
import { getSupabaseServerAuthedClient } from "@/lib/supabaseServer";

export default async function AdminUserDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const admin = await requireAdminRole("admin_readonly");
  const authedClient = await getSupabaseServerAuthedClient();
  const actorUser = authedClient
    ? (await authedClient.auth.getUser()).data?.user || null
    : null;
  const actorRoleKeys = await getActorAdminRoleKeys(actorUser?.id);
  const { id } = await params;
  const normalizedRef = normalizeUserRef(id);
  const resolvedSearch = (await searchParams) || {};
  const diagEnabled =
    String(process.env.NEXT_PUBLIC_AUTH_DIAG || "") === "1" ||
    String(process.env.AUTH_GUARD_DIAG || "") === "1";

  const { client, usingServiceRole } = await getAdminDataClient({ mode: "service" });
  const resolvedUserId = normalizedRef.id;
  const resolvedPublicId = normalizedRef.public_id;
  const { data: accountRows, error: userError } = resolvedUserId
    ? await client.rpc("admin_get_account", { p_user_id: resolvedUserId })
    : resolvedPublicId
      ? await client.rpc("admin_get_account_by_public_id", { p_public_id: resolvedPublicId })
      : { data: null, error: null };
  const user = Array.isArray(accountRows) ? accountRows[0] || null : null;

  if (userError) {
    console.error("[admin] admin_get_account failed", {
      accountId: resolvedUserId || null,
      accountPublicId: resolvedPublicId || null,
      message: userError?.message,
      details: userError?.details,
      hint: userError?.hint,
      code: userError?.code,
    });
  }

  if (diagEnabled) {
    console.warn("[admin-user-detail] load", {
      userRef: id,
      userId: resolvedUserId || null,
      userPublicId: resolvedPublicId || null,
      usingServiceRole,
      errorCode: userError?.code || null,
      errorMessage: userError?.message || null,
    });
  }

  if (userError) {
    return (
      <section className="space-y-4">
        <h2 className="text-xl font-semibold">Unable to load account</h2>
        <p className="text-sm text-neutral-400">
          There was a problem loading this account. Try again in a moment.
        </p>
        <Link href="/admin/accounts" className="text-sm text-sky-300 hover:text-sky-200">
          Back to accounts
        </Link>
      </section>
    );
  }

  if (!user) {
    return (
      <section className="space-y-4">
        <h2 className="text-xl font-semibold">Account not found</h2>
        <Link href="/admin/accounts" className="text-sm text-sky-300 hover:text-sky-200">
          Back to accounts
        </Link>
      </section>
    );
  }

  const canSupport = admin.strictPermissionBypassUsed || canAdmin(admin.roles, "add_internal_note");
  const canImpersonate = admin.strictPermissionBypassUsed || canAdmin(admin.roles, "impersonate");
  const canOps = admin.strictPermissionBypassUsed || canAdmin(admin.roles, "toggle_internal_user");
  const canRoleFixes = admin.strictPermissionBypassUsed || canAdmin(admin.roles, "update_app_role");
  const canSuper = actorRoleKeys.includes("admin_super");

  return (
    <AdminUserDetailLayout
      header={<AdminUserHeaderBar user={user} />}
      flash={<AdminFlash searchParams={resolvedSearch} />}
      aside={<AdminUserAside user={user} canImpersonate={canImpersonate} />}
    >
        <div className="space-y-3">
          <SectionCard title="Key properties">
            <dl className="space-y-2 text-sm">
              <Field label="Email" value={user.email} />
              <Field label="Public ID" value={user.public_id || "-"} />
              <Field label="Full name" value={user.full_name} />
              <Field label="Phone" value={user.phone} />
              <Field label="Role" value={user.role} />
              <Field label="Business name" value={user.business_name} />
              <Field label="Category" value={user.category} />
              <Field label="Website" value={user.website} />
              <Field label="Address" value={user.address} />
              <Field label="Address 2" value={user.address_2} />
              <Field label="City" value={user.city} />
              <Field label="State" value={user.state} />
              <Field label="Postal" value={user.postal_code} />
              <Field label="Internal" value={String(Boolean(user.is_internal))} />
              <Field label="Created" value={user.created_at ? new Date(user.created_at).toLocaleString() : "-"} />
              <Field label="Updated" value={user.updated_at ? new Date(user.updated_at).toLocaleString() : "-"} />
            </dl>
          </SectionCard>

          {canRoleFixes ? (
            <AdminUserProfileEditor
              userId={user.id}
              initialValues={{
                full_name: user.full_name || "",
                phone: user.phone || "",
                business_name: user.business_name || "",
                category: user.category || "",
                website: user.website || "",
                address: user.address || "",
                address2: user.address_2 || "",
                city: user.city || "",
                state: user.state || "",
                postal_code: user.postal_code || "",
              }}
            />
          ) : null}

          {canImpersonate ? (
            <form action={startImpersonationAction} className="rounded-lg border border-neutral-800 bg-neutral-900 p-4">
              <h3 className="mb-2 font-medium">Quick action: start support mode (view-as)</h3>
              <input type="hidden" name="targetUserId" value={user.id} />
              <div className="grid gap-2 sm:grid-cols-2">
                <input
                  name="minutes"
                  type="number"
                  min={1}
                  max={480}
                  defaultValue={30}
                  className="rounded border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm"
                />
                <input
                  name="reason"
                  required
                  placeholder="Reason"
                  className="rounded border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm"
                />
              </div>
              <button
                type="submit"
                className="mt-2 rounded bg-amber-500 px-3 py-2 text-sm font-medium text-black hover:bg-amber-400"
              >
                Start view-as session
              </button>
            </form>
          ) : null}
        </div>

        <div className="space-y-3">
          {canRoleFixes ? <AdminUserRoleEditor userId={user.id} initialRole={user.role || "customer"} /> : null}

          {canOps ? (
            <form action={toggleUserInternalAction} className="rounded-lg border border-neutral-800 bg-neutral-900 p-4">
              <h3 className="mb-2 font-medium">Toggle internal user</h3>
              <input type="hidden" name="userId" value={user.id} />
              <input type="hidden" name="isInternal" value={String(!user.is_internal)} />
              <button type="submit" className="rounded bg-sky-600 px-3 py-2 text-sm hover:bg-sky-500">
                Set is_internal = {String(!user.is_internal)}
              </button>
            </form>
          ) : (
            <PlaceholderMessage message="You do not have permission to change internal-user flags." />
          )}
        </div>

        <div className="space-y-3">
          <AdminUserSecurityActions
            targetUserId={user.id}
            currentEmail={user.email || null}
            canManageSecurity={canSuper}
          />

          {canImpersonate ? (
            <form action={startImpersonationAction} className="rounded-lg border border-neutral-800 bg-neutral-900 p-4">
              <h3 className="mb-2 font-medium">Support mode controls</h3>
              <input type="hidden" name="targetUserId" value={user.id} />
              <div className="grid gap-2 sm:grid-cols-2">
                <input
                  name="minutes"
                  type="number"
                  min={1}
                  max={480}
                  defaultValue={30}
                  className="rounded border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm"
                />
                <input
                  name="reason"
                  required
                  placeholder="Reason"
                  className="rounded border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm"
                />
              </div>
              <button
                type="submit"
                className="mt-2 rounded bg-amber-500 px-3 py-2 text-sm font-medium text-black hover:bg-amber-400"
              >
                Start view-as session
              </button>
            </form>
          ) : null}

          <div className="rounded-lg border border-rose-900/70 bg-rose-950/30 p-4">
            <h3 className="mb-2 font-medium text-rose-100">Danger zone</h3>
            <p className="mb-3 text-sm text-rose-200/80">Permanently deleting a user cannot be undone.</p>
            <DeleteUserButton targetUserId={user.id} actorRoleKeys={actorRoleKeys} />
          </div>
        </div>

        <div className="space-y-3">
          <SectionCard title="Audit activity">
            <p className="text-sm text-neutral-400">
              Detailed per-user audit timeline is not available in this view yet.
            </p>
            <Link href="/admin/audit" className="mt-2 inline-block text-sm text-sky-300 hover:text-sky-200">
              Open global audit log
            </Link>
          </SectionCard>
        </div>

        <div className="space-y-3">
          {canSupport ? (
            <form action={addUserInternalNoteAction} className="rounded-lg border border-neutral-800 bg-neutral-900 p-4">
              <h3 className="mb-2 font-medium">Add internal note (audit log)</h3>
              <input type="hidden" name="userId" value={user.id} />
              <textarea
                name="note"
                required
                rows={4}
                className="w-full rounded border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm"
                placeholder="Internal note (saved in admin_audit_log.meta.note)"
              />
              <button type="submit" className="mt-2 rounded bg-sky-600 px-3 py-2 text-sm hover:bg-sky-500">
                Log note
              </button>
            </form>
          ) : (
            <PlaceholderMessage message="You do not have permission to add internal notes." />
          )}

          <SectionCard title="Notes roadmap">
            <p className="text-sm text-neutral-400">
              Shared admin notes with edit history can be added to this tab in a future iteration.
            </p>
          </SectionCard>
        </div>
    </AdminUserDetailLayout>
  );
}

function AdminUserAside({
  user,
  canImpersonate,
}: {
  user: {
    id: string;
    public_id: string | null;
    email: string | null;
    full_name: string | null;
    role: string | null;
    is_internal: boolean | null;
    created_at: string | null;
    updated_at: string | null;
  };
  canImpersonate: boolean;
}) {
  return (
    <div className="space-y-3">
      <SectionCard title="Identity">
        <dl className="space-y-2 text-sm">
          <Field label="Name" value={user.full_name} compact />
          <Field label="Email" value={user.email} compact />
          <Field label="Public ID" value={user.public_id || "-"} compact />
        </dl>
      </SectionCard>

      <SectionCard title="Status">
        <dl className="space-y-2 text-sm">
          <Field label="Role" value={user.role} compact />
          <Field label="Internal" value={user.is_internal ? "true" : "false"} compact />
          <Field label="Created" value={user.created_at ? new Date(user.created_at).toLocaleDateString() : "-"} compact />
          <Field label="Updated" value={user.updated_at ? new Date(user.updated_at).toLocaleDateString() : "-"} compact />
        </dl>
      </SectionCard>

      <SectionCard title="Links">
        <div className="space-y-2 text-sm">
          <Link href="/admin/accounts" className="block text-sky-300 hover:text-sky-200">
            Back to accounts
          </Link>
          <Link href="/admin/audit" className="block text-sky-300 hover:text-sky-200">
            Open audit log
          </Link>
          {canImpersonate ? <p className="text-neutral-400">Use Security tab for view-as controls.</p> : null}
        </div>
      </SectionCard>
    </div>
  );
}

function SectionCard({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="rounded-lg border border-neutral-800 bg-neutral-900 p-4">
      <h3 className="mb-2 font-medium">{title}</h3>
      {children}
    </section>
  );
}

function PlaceholderMessage({ message }: { message: string }) {
  return (
    <div className="rounded-lg border border-neutral-800 bg-neutral-900 p-4 text-sm text-neutral-400">{message}</div>
  );
}

function Field({
  label,
  value,
  compact = false,
}: {
  label: string;
  value: any;
  compact?: boolean;
}) {
  return (
    <div className={compact ? "grid grid-cols-[92px_1fr] gap-2" : "grid grid-cols-[120px_1fr] gap-2"}>
      <dt className="text-neutral-400">{label}</dt>
      <dd className="break-all">{value || "-"}</dd>
    </div>
  );
}
