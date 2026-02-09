import AccountsList from "@/app/admin/_components/AccountsList";

export default async function AdminAdminsPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = (await searchParams) || {};
  return (
    <AccountsList
      title="Admins"
      description="Internal/admin staff accounts."
      basePath="/admin/admins"
      searchParams={params}
      presetRole="admin"
    />
  );
}
