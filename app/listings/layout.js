"use client";

import { Suspense } from "react";
import dynamic from "next/dynamic";

// Avoid SSR mismatch by loading navbar only on the client
const CustomerNavbar = dynamic(() => import("@/components/navbars/CustomerNavbar"), {
  ssr: false,
});

function ListingsRouteFallback() {
  return <div className="pt-20 min-h-screen" />;
}

export default function ListingsLayout({ children }) {
  return (
    <Suspense fallback={<ListingsRouteFallback />}>
      <CustomerNavbar />
      {children}
    </Suspense>
  );
}
