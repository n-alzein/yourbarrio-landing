"use client";

import { usePathname } from "next/navigation";

export default function GlobalHeaderGate({ children }) {
  const pathname = usePathname();
  const isBusinessAuth = pathname?.startsWith("/business-auth");
  const isBusinessHome = pathname === "/business";
  if (isBusinessAuth || isBusinessHome) return null;
  return children;
}
