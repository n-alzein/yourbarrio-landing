import HomeBrowse from "@/components/browse/HomeBrowse";
import { getHomeBrowseData } from "@/lib/browse/getHomeBrowseData";

export const revalidate = 300;

function toSearchParamsObject(value) {
  if (!value) return {};
  if (typeof value.then === "function") return value;
  return value;
}

export default async function CustomerHomePage({ searchParams }) {
  const resolvedSearchParams = await toSearchParamsObject(searchParams);
  const city = resolvedSearchParams?.city || null;
  const zip = resolvedSearchParams?.zip || null;

  const initialData = await getHomeBrowseData({
    mode: "customer",
    city,
    zip,
  });

  return <HomeBrowse mode="customer" initialData={initialData} />;
}
