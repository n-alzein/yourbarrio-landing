import { createModerationFlagAction, updateModerationFlagAction } from "@/app/admin/actions";
import AdminFlash from "@/app/admin/_components/AdminFlash";
import { requireAdminRole } from "@/lib/admin/permissions";
import { getAdminDataClient } from "@/lib/supabase/admin";

const PAGE_SIZE = 20;

function asString(value: string | string[] | undefined, fallback = "") {
  return typeof value === "string" ? value : fallback;
}

export default async function AdminModerationPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireAdminRole("admin_support");
  const params = (await searchParams) || {};
  const q = asString(params.q).trim();
  const status = asString(params.status).trim();
  const page = Math.max(1, Number(asString(params.page, "1")) || 1);
  const from = (page - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;

  const { client } = await getAdminDataClient();
  let query = client
    .from("moderation_flags")
    .select("id, reason, details, status, target_user_id, target_business_id, admin_notes, created_at, updated_at", {
      count: "exact",
    })
    .order("created_at", { ascending: false });

  if (status) query = query.eq("status", status);
  if (q) query = query.or(`reason.ilike.%${q}%,details.ilike.%${q}%`);

  const { data: rows, count } = await query.range(from, to);
  const totalPages = Math.max(1, Math.ceil((count || 0) / PAGE_SIZE));

  const pageParams = new URLSearchParams();
  if (q) pageParams.set("q", q);
  if (status) pageParams.set("status", status);

  return (
    <section className="space-y-4">
      <header>
        <h2 className="text-xl font-semibold">Moderation flags</h2>
        <p className="text-sm text-neutral-400">Queue with status workflow and admin notes.</p>
      </header>

      <AdminFlash searchParams={params} />

      <form action={createModerationFlagAction} className="grid gap-2 rounded-lg border border-neutral-800 bg-neutral-900 p-3 md:grid-cols-2">
        <h3 className="md:col-span-2 text-sm font-semibold text-neutral-300">Create moderation flag</h3>
        <input name="targetUserId" placeholder="target_user_id (optional)" className="rounded border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm" />
        <input name="targetBusinessId" placeholder="target_business_id (optional)" className="rounded border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm" />
        <input name="reason" required placeholder="reason" className="rounded border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm md:col-span-2" />
        <textarea name="details" rows={3} placeholder="details" className="rounded border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm md:col-span-2" />
        <button type="submit" className="rounded bg-sky-600 px-3 py-2 text-sm font-medium hover:bg-sky-500 md:col-span-2">
          Create flag
        </button>
      </form>

      <form className="grid gap-2 rounded-lg border border-neutral-800 bg-neutral-900 p-3 md:grid-cols-3">
        <input name="q" defaultValue={q} placeholder="search reason/details" className="rounded border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm" />
        <select name="status" defaultValue={status} className="rounded border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm">
          <option value="">status: any</option>
          <option value="open">open</option>
          <option value="triaged">triaged</option>
          <option value="resolved">resolved</option>
          <option value="dismissed">dismissed</option>
        </select>
        <button type="submit" className="rounded bg-sky-600 px-3 py-2 text-sm font-medium hover:bg-sky-500">
          Apply filters
        </button>
      </form>

      <div className="space-y-3">
        {(rows || []).map((row: any) => (
          <form key={row.id} action={updateModerationFlagAction} className="rounded-lg border border-neutral-800 bg-neutral-900 p-4">
            <input type="hidden" name="id" value={row.id} />
            <div className="grid gap-2 md:grid-cols-4">
              <div className="md:col-span-2">
                <p className="text-sm font-medium">{row.reason}</p>
                <p className="text-xs text-neutral-400">{row.details || "No details"}</p>
                <p className="mt-1 text-xs font-mono text-neutral-500">{row.id}</p>
              </div>
              <select name="status" defaultValue={row.status} className="rounded border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm">
                <option value="open">open</option>
                <option value="triaged">triaged</option>
                <option value="resolved">resolved</option>
                <option value="dismissed">dismissed</option>
              </select>
              <button type="submit" className="rounded bg-sky-600 px-3 py-2 text-sm font-medium hover:bg-sky-500">
                Save
              </button>
              <textarea
                name="adminNotes"
                rows={2}
                defaultValue={row.admin_notes || ""}
                placeholder="admin notes"
                className="rounded border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm md:col-span-4"
              />
            </div>
          </form>
        ))}
        {!rows?.length ? (
          <div className="rounded-lg border border-neutral-800 bg-neutral-900 p-4 text-sm text-neutral-400">
            No moderation flags found.
          </div>
        ) : null}
      </div>

      <div className="flex items-center justify-between">
        <p className="text-sm text-neutral-400">
          Page {page} of {totalPages} ({count || 0} flags)
        </p>
        <div className="flex gap-2">
          {page > 1 ? (
            <a href={`/admin/moderation?${new URLSearchParams({ ...Object.fromEntries(pageParams), page: String(page - 1) }).toString()}`} className="rounded border border-neutral-700 px-3 py-1 text-sm hover:border-neutral-500">
              Previous
            </a>
          ) : null}
          {page < totalPages ? (
            <a href={`/admin/moderation?${new URLSearchParams({ ...Object.fromEntries(pageParams), page: String(page + 1) }).toString()}`} className="rounded border border-neutral-700 px-3 py-1 text-sm hover:border-neutral-500">
              Next
            </a>
          ) : null}
        </div>
      </div>
    </section>
  );
}
