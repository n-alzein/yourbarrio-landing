export const STRAPI_URL = (process.env.NEXT_PUBLIC_STRAPI_URL || "http://localhost:1337").replace(/\/+$/, "");
export function strapiAbsoluteUrl(pathOrUrl?: string | null) {
  if (!pathOrUrl) return null;
  if (pathOrUrl.startsWith("http")) return pathOrUrl;
  if (pathOrUrl.startsWith("/")) return `${STRAPI_URL}${pathOrUrl}`;
  return `${STRAPI_URL}/${pathOrUrl}`;
}
export async function fetchStrapiBanners() {
  const response = await fetch(`${STRAPI_URL}/api/banners?populate=*`, { next: { revalidate: 60 } });
  if (!response.ok) throw new Error(`Failed to fetch Strapi banners: ${response.status} ${response.statusText}`);
  const json = await response.json();
  return json?.data ?? [];
}
