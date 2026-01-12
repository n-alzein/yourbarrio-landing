"use client";

import NavGate from "@/components/navbars/NavGate";
import PublicNavbar from "@/components/navbars/PublicNavbar";
import BusinessNavbar from "@/components/navbars/BusinessNavbar";
import { useAuth } from "@/components/AuthProvider";

export default function PublicLayout({ children }) {
  const { role, loadingUser } = useAuth();
  if (loadingUser) {
    return <>{children}</>;
  }
  const showBusinessNav = role === "business";

  return (
    <>
      {showBusinessNav ? (
        <BusinessNavbar />
      ) : (
        <NavGate>
          <PublicNavbar />
        </NavGate>
      )}
      {children}
    </>
  );
}
