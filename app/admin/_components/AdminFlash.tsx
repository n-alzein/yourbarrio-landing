export default async function AdminFlash({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>> | Record<string, string | string[] | undefined>;
}) {
  const resolved = searchParams ? await Promise.resolve(searchParams) : {};
  const success = typeof resolved?.success === "string" ? resolved.success : "";
  const error = typeof resolved?.error === "string" ? resolved.error : "";

  if (!success && !error) return null;

  return (
    <div className="space-y-2">
      {success ? (
        <div className="rounded-md border border-emerald-700 bg-emerald-950/60 px-3 py-2 text-sm text-emerald-200">
          {success}
        </div>
      ) : null}
      {error ? (
        <div className="rounded-md border border-red-700 bg-red-950/60 px-3 py-2 text-sm text-red-200">
          {error}
        </div>
      ) : null}
    </div>
  );
}
