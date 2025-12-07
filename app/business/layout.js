"use client";

import BusinessNavbar from "@/components/navbars/BusinessNavbar";
import { useAuth } from "@/components/AuthProvider";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

export default function BusinessLayout({ children }) {
  const { authUser, role, loadingUser } = useAuth();
  const router = useRouter();

  // Redirect the opener tab to dashboard when a popup login succeeds
  useEffect(() => {
    function handleStorage(event) {
      if (event.key === "business_auth_success") {
        router.replace("/business/dashboard");
        router.refresh();
      }
    }

    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }, [router]);

  useEffect(() => {
    if (loadingUser) return;

    // Not logged in → allow login page to show
    if (!authUser) return;

    // Logged in but NOT business → redirect away
    if (role && role !== "business") {
      router.replace("/customer/home");
    }
  }, [authUser, role, loadingUser, router]);

  // Avoid flicker on load
  if (loadingUser) return <div className="min-h-screen" />;

  return (
    <>
      <BusinessNavbar />
      <div className="pt-20 min-h-screen">{children}</div>
    </>
  );
}
