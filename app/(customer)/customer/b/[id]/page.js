import PublicBusinessProfilePage from "@/app/(public)/(marketing)/b/[id]/page";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default function CustomerBusinessProfilePage({ params, searchParams }) {
  return (
    <PublicBusinessProfilePage
      params={params}
      searchParams={searchParams}
      shell="customer"
    />
  );
}
