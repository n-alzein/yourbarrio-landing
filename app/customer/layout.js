"use client";

import CustomerNavbar from "@/components/navbars/CustomerNavbar";

export default function CustomerLayout({ children }) {
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
