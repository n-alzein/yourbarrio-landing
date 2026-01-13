import CustomerHomeClient from "./CustomerHomeClient";
import { headers } from "next/headers";

export default async function CustomerHomePage() {
  const headerList = await headers();
  const host = headerList.get("host");
  const proto = headerList.get("x-forwarded-proto") || "http";
  const baseUrl = host ? `${proto}://${host}` : "";
  const response = await fetch(`${baseUrl}/api/home-listings?limit=80`, {
    next: { revalidate: 30 },
  });
  const payload = await response.json().catch(() => ({}));
  const initialListings = Array.isArray(payload?.listings) ? payload.listings : [];

  return <CustomerHomeClient initialListings={initialListings} />;
}
