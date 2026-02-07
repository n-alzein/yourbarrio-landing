import HomeBrowse from "@/components/browse/HomeBrowse";
import { getHomeBrowseData } from "@/lib/browse/getHomeBrowseData";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function toSearchParamsObject(value) {
  if (!value) return {};
  if (typeof value.then === "function") return value;
  return value;
}

export default async function HomePage({ searchParams }) {
  const resolvedSearchParams = await toSearchParamsObject(searchParams);
  const city = resolvedSearchParams?.city || null;
  const zip = resolvedSearchParams?.zip || null;

  const initialData = await getHomeBrowseData({
    mode: "public",
    city,
    zip,
  });

  return <HomeBrowse mode="public" initialData={initialData} />;
}
