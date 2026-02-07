import { createSupportTicketAction, updateSupportTicketAction } from "@/app/admin/actions";
import AdminFlash from "@/app/admin/_components/AdminFlash";
import { requireAdminRole } from "@/lib/admin/permissions";
import { getAdminDataClient } from "@/lib/supabase/admin";

const PAGE_SIZE = 20;

function asString(value: string | string[] | undefined, fallback = "") {
  return typeof value === "string" ? value : fallback;
}

export default async function AdminSupportPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireAdminRole("admin_support");
  const params = (await searchParams) || {};
  const q = asString(params.q).trim();
  const status = asString(params.status).trim();
  const priority = asString(params.priority).trim();
  const page = Math.max(1, Number(asString(params.page, "1")) || 1);
  const from = (page - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;

  const { client } = await getAdminDataClient();
  let query = client
    .from("support_tickets")
    .select(
      "id, requester_user_id, assigned_admin_user_id, subject, body, status, priority, admin_notes, created_at, updated_at",
      { count: "exact" }
    )
    .order("created_at", { ascending: false });

  if (status) query = query.eq("status", status);
  if (priority) query = query.eq("priority", priority);
  if (q) query = query.or(`subject.ilike.%${q}%,body.ilike.%${q}%`);

  const { data: rows, count } = await query.range(from, to);
  const totalPages = Math.max(1, Math.ceil((count || 0) / PAGE_SIZE));

  const pageParams = new URLSearchParams();
  if (q) pageParams.set("q", q);
  if (status) pageParams.set("status", status);
  if (priority) pageParams.set("priority", priority);

  return (
    <section className="space-y-4">
      <header>
        <h2 className="text-xl font-semibold">Support tickets</h2>
        <p className="text-sm text-neutral-400">Assign, prioritize, and resolve support work.</p>
      </header>

      <AdminFlash searchParams={params} />

      <form action={createSupportTicketAction} className="grid gap-2 rounded-lg border border-neutral-800 bg-neutral-900 p-3 md:grid-cols-2">
        <h3 className="md:col-span-2 text-sm font-semibold text-neutral-300">Create support ticket</h3>
        <input name="requesterUserId" placeholder="requester_user_id (optional)" className="rounded border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm" />
        <select name="priority" defaultValue="normal" className="rounded border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm">
          <option value="low">low</option>
          <option value="normal">normal</option>
          <option value="high">high</option>
          <option value="urgent">urgent</option>
        </select>
        <input name="subject" required placeholder="subject" className="rounded border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm md:col-span-2" />
        <textarea name="body" rows={3} placeholder="body" className="rounded border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm md:col-span-2" />
        <button type="submit" className="rounded bg-sky-600 px-3 py-2 text-sm font-medium hover:bg-sky-500 md:col-span-2">
          Create ticket
        </button>
      </form>

      <form className="grid gap-2 rounded-lg border border-neutral-800 bg-neutral-900 p-3 md:grid-cols-4">
        <input name="q" defaultValue={q} placeholder="search subject/body" className="rounded border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm" />
        <select name="status" defaultValue={status} className="rounded border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm">
          <option value="">status: any</option>
          <option value="open">open</option>
          <option value="pending">pending</option>
          <option value="resolved">resolved</option>
          <option value="closed">closed</option>
        </select>
        <select name="priority" defaultValue={priority} className="rounded border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm">
          <option value="">priority: any</option>
          <option value="low">low</option>
          <option value="normal">normal</option>
          <option value="high">high</option>
          <option value="urgent">urgent</option>
        </select>
        <button type="submit" className="rounded bg-sky-600 px-3 py-2 text-sm font-medium hover:bg-sky-500">
          Apply filters
        </button>
      </form>

      <div className="space-y-3">
        {(rows || []).map((row: any) => (
          <form key={row.id} action={updateSupportTicketAction} className="rounded-lg border border-neutral-800 bg-neutral-900 p-4">
            <input type="hidden" name="id" value={row.id} />
            <div className="grid gap-2 md:grid-cols-4">
              <div className="md:col-span-2">
                <p className="text-sm font-medium">{row.subject}</p>
                <p className="text-xs text-neutral-400">{row.body || "No body"}</p>
                <p className="mt-1 text-xs font-mono text-neutral-500">{row.id}</p>
              </div>
              <select name="status" defaultValue={row.status} className="rounded border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm">
                <option value="open">open</option>
                <option value="pending">pending</option>
                <option value="resolved">resolved</option>
                <option value="closed">closed</option>
              </select>
              <select name="priority" defaultValue={row.priority} className="rounded border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm">
                <option value="low">low</option>
                <option value="normal">normal</option>
                <option value="high">high</option>
                <option value="urgent">urgent</option>
              </select>
              <input
                name="assignedAdminUserId"
                defaultValue={row.assigned_admin_user_id || ""}
                placeholder="assigned_admin_user_id"
                className="rounded border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm md:col-span-2"
              />
              <button type="submit" className="rounded bg-sky-600 px-3 py-2 text-sm font-medium hover:bg-sky-500 md:col-span-2">
                Save ticket
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
            No support tickets found.
          </div>
        ) : null}
      </div>

      <div className="flex items-center justify-between">
        <p className="text-sm text-neutral-400">
          Page {page} of {totalPages} ({count || 0} tickets)
        </p>
        <div className="flex gap-2">
          {page > 1 ? (
            <a href={`/admin/support?${new URLSearchParams({ ...Object.fromEntries(pageParams), page: String(page - 1) }).toString()}`} className="rounded border border-neutral-700 px-3 py-1 text-sm hover:border-neutral-500">
              Previous
            </a>
          ) : null}
          {page < totalPages ? (
            <a href={`/admin/support?${new URLSearchParams({ ...Object.fromEntries(pageParams), page: String(page + 1) }).toString()}`} className="rounded border border-neutral-700 px-3 py-1 text-sm hover:border-neutral-500">
              Next
            </a>
          ) : null}
        </div>
      </div>
    </section>
  );
}
