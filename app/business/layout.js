"use client";

import BusinessNavbar from "@/components/navbars/BusinessNavbar";
import { useAuth } from "@/components/AuthProvider";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

export default function BusinessLayout({ children }) {
  const { authUser, role, loadingUser } = useAuth();
  const router = useRouter();

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
