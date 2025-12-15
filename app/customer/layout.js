"use client";

import CustomerNavbar from "@/components/navbars/CustomerNavbar";
import { Suspense, useEffect, useMemo } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/components/AuthProvider";

function CustomerLayoutContent({ children }) {
  const { user, authUser, loadingUser } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const currentPathWithQuery = useMemo(() => {
    const queryString = searchParams?.toString();
    return queryString ? `${pathname}?${queryString}` : pathname;
  }, [pathname, searchParams]);

  // Belt-and-suspenders: hide/remove any public nav that might have rendered before hydration
  useEffect(() => {
    const hide = () => {
      const nodes = document.querySelectorAll("nav[data-public-nav]");
      nodes.forEach((el) => {
        el.style.display = "none";
      });
    };
    hide();
    const obs = new MutationObserver(hide);
    obs.observe(document.body, { childList: true, subtree: true });
    return () => obs.disconnect();
  }, []);

  return (
    <>
      {/* Force-hide any public nav that might be mounted from the root layout */}
      <style jsx global>{`
        nav[data-public-nav] {
          display: none !important;
        }
      `}</style>

      {/* Customer Navbar (auto-hides on business routes) */}
      <CustomerNavbar />

      {/* Page content — always padded under navbar */}
      <div className="pt-20 min-h-screen">
        {/* Soft notice if we haven't resolved auth yet */}
        {loadingUser && !authUser ? (
          <div className="mb-3 px-4 py-2 text-sm text-white/80 bg-white/5 border border-white/10 rounded-xl max-w-4xl mx-auto">
            Loading your account...
          </div>
        ) : null}
        {children}
      </div>
    </>
  );
}

export default function CustomerLayout(props) {
  return (
    <Suspense fallback={<div className="pt-20 min-h-screen" />}>
      <CustomerLayoutContent {...props} />
    </Suspense>
  );
}
