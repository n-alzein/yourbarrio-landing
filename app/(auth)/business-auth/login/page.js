import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function BusinessLoginPage({ searchParams }) {
  const resolvedSearchParams = await searchParams;
  const params = new URLSearchParams();
  Object.entries(resolvedSearchParams || {}).forEach(([key, value]) => {
    if (typeof value === "string") params.set(key, value);
  });
  const query = params.toString();
  redirect(`/business/login${query ? `?${query}` : ""}`);
}
