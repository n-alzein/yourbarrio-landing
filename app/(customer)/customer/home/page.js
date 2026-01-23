import { headers } from "next/headers";
import StrapiBannersServer from "@/components/banners/StrapiBannersServer";
import CustomerHomeClient from "./CustomerHomeClient";

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

  return (
    <>
      <div className="mt-0 mb-8 md:mb-10 relative z-10">
        <StrapiBannersServer />
      </div>
      <CustomerHomeClient initialListings={initialListings} />
    </>
  );
}
