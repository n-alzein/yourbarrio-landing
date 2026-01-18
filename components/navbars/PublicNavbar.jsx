"use client";

import { usePathname } from "next/navigation";
import CustomerPublicNavbar from "@/components/navbars/CustomerPublicNavbar";
import BusinessMarketingNavbar from "@/components/navbars/BusinessMarketingNavbar";

export default function PublicNavbar() {
  const pathname = usePathname();
  if (
    pathname.startsWith("/business-auth") ||
    pathname.startsWith("/oauth") ||
    pathname.startsWith("/listings") ||
    pathname === "/profile"
  ) {
    return null;
  }
  const isBusinessLanding = pathname.startsWith("/business");
  return isBusinessLanding ? <BusinessMarketingNavbar /> : <CustomerPublicNavbar />;
}
