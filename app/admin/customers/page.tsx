import AccountsList from "@/app/admin/_components/AccountsList";

export default async function AdminCustomersPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = (await searchParams) || {};
  return (
    <AccountsList
      title="Customers"
      description="Customer accounts only."
      basePath="/admin/customers"
      searchParams={params}
      presetRole="customer"
    />
  );
}
