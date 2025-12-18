"use client";

import CustomerNavbar from "@/components/navbars/CustomerNavbar";
import { useAuth } from "@/components/AuthProvider";
import { Suspense, useEffect } from "react";
import { useRouter } from "next/navigation";

function CustomerRouteShell({ children = null }) {
  return <div className="pt-20 min-h-screen">{children}</div>;
}

export default function CustomerLayout({ children }) {
  const { authUser, role, loadingUser } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (loadingUser) return;

    if (!authUser) {
      router.replace("/");
      return;
    }

    if (role && role !== "customer") {
      router.replace("/business/dashboard");
    }
  }, [authUser, role, loadingUser, router]);

  // Block render until auth + role are fully resolved
  if (loadingUser || !authUser || role !== "customer") {
    return <CustomerRouteShell />;
  }

  return (
    <Suspense fallback={<CustomerRouteShell />}>
      <CustomerNavbar />
      <CustomerRouteShell>{children}</CustomerRouteShell>
    </Suspense>
  );
}
