"use client";

import NavGate from "@/components/navbars/NavGate";
import PublicNavbar from "@/components/navbars/PublicNavbar";
import BusinessNavbar from "@/components/navbars/BusinessNavbar";
import CustomerNavbar from "@/components/navbars/CustomerNavbar";
import { useAuth } from "@/components/AuthProvider";

export default function PublicLayout({ children }) {
  const { role, loadingUser } = useAuth();
  if (loadingUser) {
    return <>{children}</>;
  }
  const showBusinessNav = role === "business";
  const showCustomerNav = role === "customer";

  return (
    <>
      {showBusinessNav ? (
        <BusinessNavbar />
      ) : showCustomerNav ? (
        <CustomerNavbar />
      ) : (
        <NavGate>
          <PublicNavbar />
        </NavGate>
      )}
      {children}
    </>
  );
}
