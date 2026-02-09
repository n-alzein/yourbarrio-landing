import AccountsList from "@/app/admin/_components/AccountsList";

export default async function AdminAccountsPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = (await searchParams) || {};
  return (
    <AccountsList
      title="Accounts"
      description="All platform accounts across customer, business, and admin roles."
      basePath="/admin/accounts"
      searchParams={params}
    />
  );
}
