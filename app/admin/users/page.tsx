import Link from "next/link";
import AdminFlash from "@/app/admin/_components/AdminFlash";
import { requireAdminRole } from "@/lib/admin/permissions";
import { getAdminDataClient } from "@/lib/supabase/admin";

const PAGE_SIZE = 20;

function asString(value: string | string[] | undefined, fallback = "") {
  return typeof value === "string" ? value : fallback;
}

export default async function AdminUsersPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireAdminRole("admin_readonly");
  const params = (await searchParams) || {};
  const q = asString(params.q).trim();
  const role = asString(params.role).trim();
  const city = asString(params.city).trim();
  const isInternal = asString(params.is_internal).trim();
  const createdFrom = asString(params.from).trim();
  const createdTo = asString(params.to).trim();
  const page = Math.max(1, Number(asString(params.page, "1")) || 1);
  const from = (page - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;

  const { client } = await getAdminDataClient();
  let query = client
    .from("users")
    .select(
      "id, email, full_name, phone, business_name, role, is_internal, city, created_at",
      { count: "exact" }
    )
    .order("created_at", { ascending: false });

  if (q) {
    query = query.or(
      `full_name.ilike.%${q}%,email.ilike.%${q}%,phone.ilike.%${q}%,business_name.ilike.%${q}%`
    );
  }
  if (role) query = query.eq("role", role);
  if (city) query = query.ilike("city", `%${city}%`);
  if (isInternal === "true" || isInternal === "false") {
    query = query.eq("is_internal", isInternal === "true");
  }
  if (createdFrom) query = query.gte("created_at", `${createdFrom}T00:00:00.000Z`);
  if (createdTo) query = query.lte("created_at", `${createdTo}T23:59:59.999Z`);

  const { data: rows, count } = await query.range(from, to);
  const totalPages = Math.max(1, Math.ceil((count || 0) / PAGE_SIZE));

  const pageParams = new URLSearchParams();
  if (q) pageParams.set("q", q);
  if (role) pageParams.set("role", role);
  if (city) pageParams.set("city", city);
  if (isInternal) pageParams.set("is_internal", isInternal);
  if (createdFrom) pageParams.set("from", createdFrom);
  if (createdTo) pageParams.set("to", createdTo);

  return (
    <section className="space-y-4">
      <header>
        <h2 className="text-xl font-semibold">Users</h2>
        <p className="text-sm text-neutral-400">Directory view with search, filters, and pagination.</p>
      </header>

      <AdminFlash searchParams={params} />

      <form className="grid gap-2 rounded-lg border border-neutral-800 bg-neutral-900 p-3 md:grid-cols-7">
        <input
          name="q"
          defaultValue={q}
          placeholder="Search name, email, phone, business"
          className="rounded border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm md:col-span-2"
        />
        <input name="role" defaultValue={role} placeholder="role" className="rounded border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm" />
        <input name="city" defaultValue={city} placeholder="city" className="rounded border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm" />
        <select name="is_internal" defaultValue={isInternal} className="rounded border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm">
          <option value="">is_internal: any</option>
          <option value="true">internal true</option>
          <option value="false">internal false</option>
        </select>
        <input type="date" name="from" defaultValue={createdFrom} className="rounded border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm" />
        <input type="date" name="to" defaultValue={createdTo} className="rounded border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm" />
        <div className="md:col-span-7">
          <button type="submit" className="rounded bg-sky-600 px-3 py-2 text-sm font-medium hover:bg-sky-500">
            Apply filters
          </button>
        </div>
      </form>

      <div className="overflow-auto rounded-lg border border-neutral-800 bg-neutral-900">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="text-left text-neutral-400">
              <th className="px-3 py-2">Name</th>
              <th className="px-3 py-2">Email</th>
              <th className="px-3 py-2">Role</th>
              <th className="px-3 py-2">Internal</th>
              <th className="px-3 py-2">City</th>
              <th className="px-3 py-2">Created</th>
            </tr>
          </thead>
          <tbody>
            {(rows || []).map((user: any) => (
              <tr key={user.id} className="border-t border-neutral-800">
                <td className="px-3 py-2">
                  <Link href={`/admin/users/${user.id}`} className="text-sky-300 hover:text-sky-200">
                    {user.full_name || user.business_name || user.id}
                  </Link>
                </td>
                <td className="px-3 py-2">{user.email || "-"}</td>
                <td className="px-3 py-2">{user.role || "-"}</td>
                <td className="px-3 py-2">{String(Boolean(user.is_internal))}</td>
                <td className="px-3 py-2">{user.city || "-"}</td>
                <td className="px-3 py-2">{user.created_at ? new Date(user.created_at).toLocaleDateString() : "-"}</td>
              </tr>
            ))}
            {!rows?.length ? (
              <tr>
                <td colSpan={6} className="px-3 py-4 text-neutral-400">
                  No users found.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between">
        <p className="text-sm text-neutral-400">
          Page {page} of {totalPages} ({count || 0} users)
        </p>
        <div className="flex gap-2">
          {page > 1 ? (
            <Link href={`/admin/users?${new URLSearchParams({ ...Object.fromEntries(pageParams), page: String(page - 1) }).toString()}`} className="rounded border border-neutral-700 px-3 py-1 text-sm hover:border-neutral-500">
              Previous
            </Link>
          ) : null}
          {page < totalPages ? (
            <Link href={`/admin/users?${new URLSearchParams({ ...Object.fromEntries(pageParams), page: String(page + 1) }).toString()}`} className="rounded border border-neutral-700 px-3 py-1 text-sm hover:border-neutral-500">
              Next
            </Link>
          ) : null}
        </div>
      </div>
    </section>
  );
}
