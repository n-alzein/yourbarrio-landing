"use client";

import { usePathname } from "next/navigation";

export default function GlobalHeaderGate({ children }) {
  const pathname = usePathname();
  if (pathname?.startsWith("/business-auth")) return null;
  return children;
}
