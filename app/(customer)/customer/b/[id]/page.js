import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function CustomerBusinessProfilePage({ params, searchParams }) {
  const resolvedParams = await Promise.resolve(params);
  const resolvedSearchParams = await Promise.resolve(searchParams);
  const id = String(resolvedParams?.id || "").trim();
  const target = new URL(`/b/${encodeURIComponent(id)}`, "https://yourbarrio.local");

  Object.entries(resolvedSearchParams || {}).forEach(([key, rawValue]) => {
    if (Array.isArray(rawValue)) {
      rawValue.forEach((value) => {
        if (typeof value === "string") {
          target.searchParams.append(key, value);
        }
      });
      return;
    }
    if (typeof rawValue === "string") {
      target.searchParams.append(key, rawValue);
    }
  });

  redirect(`${target.pathname}${target.search}`);
}
