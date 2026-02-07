import Link from "next/link";
import AdminFlash from "@/app/admin/_components/AdminFlash";
import { requireAdminRole } from "@/lib/admin/permissions";
import { getAdminDataClient } from "@/lib/supabase/admin";

async function getCount(client: any, table: string, apply?: (query: any) => any) {
  let query = client.from(table).select("id", { count: "exact", head: true });
  if (apply) query = apply(query);
  const { count } = await query;
  return count || 0;
}

export default async function AdminDashboardPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireAdminRole("admin_readonly");
  const { client } = await getAdminDataClient();
  const { data: newUsers7dCount } = await client.rpc("count_new_users_last_days", { p_days: 7 });

  const [totalUsers, totalBusinesses, newUsers7d, openModeration, openSupport, recentAudit] =
    await Promise.all([
      getCount(client, "users"),
      getCount(client, "users", (q) => q.eq("role", "business")),
      Promise.resolve(Number(newUsers7dCount || 0)),
      getCount(client, "moderation_flags", (q) => q.eq("status", "open")),
      getCount(client, "support_tickets", (q) => q.in("status", ["open", "pending"])),
      client
        .from("admin_audit_log")
        .select("id, action, target_type, target_id, actor_user_id, created_at")
        .order("created_at", { ascending: false })
        .limit(20),
    ]);

  const auditRows = recentAudit.data || [];

  return (
    <section className="space-y-4">
      <AdminFlash searchParams={searchParams} />
      <header>
        <h2 className="text-xl font-semibold">Dashboard</h2>
        <p className="text-sm text-neutral-400">Admin platform summary and latest activity.</p>
      </header>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <StatCard label="Total users" value={totalUsers} />
        <StatCard label="Total businesses" value={totalBusinesses} />
        <StatCard label="New users (7d)" value={newUsers7d} />
        <StatCard label="Open moderation flags" value={openModeration} />
        <StatCard label="Open support tickets" value={openSupport} />
      </div>

      <div className="rounded-lg border border-neutral-800 bg-neutral-900 p-4">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="font-medium">Recent audit activity</h3>
          <Link href="/admin/audit" className="text-sm text-sky-300 hover:text-sky-200">
            View all
          </Link>
        </div>
        <div className="overflow-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="text-left text-neutral-400">
                <th className="py-2 pr-3">Time</th>
                <th className="py-2 pr-3">Action</th>
                <th className="py-2 pr-3">Target</th>
                <th className="py-2 pr-3">Actor</th>
              </tr>
            </thead>
            <tbody>
              {auditRows.map((row: any) => (
                <tr key={row.id} className="border-t border-neutral-800">
                  <td className="py-2 pr-3">{new Date(row.created_at).toLocaleString()}</td>
                  <td className="py-2 pr-3">{row.action}</td>
                  <td className="py-2 pr-3">{row.target_type || "-"}:{row.target_id || "-"}</td>
                  <td className="py-2 pr-3 font-mono text-xs">{row.actor_user_id || "system"}</td>
                </tr>
              ))}
              {!auditRows.length ? (
                <tr>
                  <td className="py-3 text-neutral-400" colSpan={4}>
                    No audit records yet.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border border-neutral-800 bg-neutral-900 p-4">
      <div className="text-sm text-neutral-400">{label}</div>
      <div className="mt-1 text-2xl font-semibold">{value.toLocaleString()}</div>
    </div>
  );
}
