"use client";

import { useEffect, useRef } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { useModal } from "@/components/modals/ModalProvider";
import { setAuthIntent } from "@/lib/auth/authIntent";

export default function ProtectedRouteLoginPrompt({ role = "customer", redirectTo }) {
  const { openModal } = useModal();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const openedRef = useRef(false);

  useEffect(() => {
    if (openedRef.current) return;
    openedRef.current = true;

    const currentPath =
      redirectTo ||
      `${pathname || "/"}${searchParams?.toString() ? `?${searchParams.toString()}` : ""}`;
    setAuthIntent({ redirectTo: currentPath, role });
    openModal(role === "business" ? "business-login" : "customer-login", {
      next: currentPath,
    });
  }, [openModal, pathname, redirectTo, role, searchParams]);

  return null;
}
