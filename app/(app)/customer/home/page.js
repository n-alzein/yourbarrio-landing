import CustomerHomeClient from "./CustomerHomeClient";
import { headers } from "next/headers";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function CustomerHomePage() {
  const headerList = await headers();
  const host = headerList.get("x-forwarded-host") || headerList.get("host");
  const proto = headerList.get("x-forwarded-proto") || "https";
  const baseUrl = host ? `${proto}://${host}` : "";
  const response = await fetch(`${baseUrl}/api/home-listings?limit=80`, {
    cache: "no-store",
  });
  if (!response.ok) {
    console.warn("[HOME_LISTINGS_PROD] fetch failed", {
      status: response.status,
    });
  }
  const payload = await response.json().catch(() => ({}));
  const initialListings = Array.isArray(payload?.listings) ? payload.listings : [];

  return <CustomerHomeClient initialListings={initialListings} />;
}
