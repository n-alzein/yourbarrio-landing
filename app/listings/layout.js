"use client";

import dynamic from "next/dynamic";

// Avoid SSR mismatch by loading navbar only on the client
const CustomerNavbar = dynamic(() => import("@/components/navbars/CustomerNavbar"), {
  ssr: false,
});

export default function ListingsLayout({ children }) {
  return (
    <>
      <CustomerNavbar />
      {children}
    </>
  );
}
