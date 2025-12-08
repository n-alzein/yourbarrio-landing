"use client";

import CustomerNavbar from "@/components/navbars/CustomerNavbar";
import { useEffect, useMemo } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/components/AuthProvider";

export default function CustomerLayout({ children }) {
  const { user, loadingUser } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const currentPathWithQuery = useMemo(() => {
    const queryString = searchParams?.toString();
    return queryString ? `${pathname}?${queryString}` : pathname;
  }, [pathname, searchParams]);

  useEffect(() => {
    if (loadingUser) return;
    if (user) return;

    const redirectUrl = `/?redirect=${encodeURIComponent(currentPathWithQuery)}`;
    router.replace(redirectUrl);
  }, [currentPathWithQuery, loadingUser, router, user]);

  if (!user) {
    return <div className="pt-20 min-h-screen" />;
  }

  return (
    <>
      {/* Customer Navbar (auto-hides on business routes) */}
      <CustomerNavbar />

      {/* Page content — always padded under navbar */}
      <div className="pt-20 min-h-screen">
        {children}
      </div>
    </>
  );
}
