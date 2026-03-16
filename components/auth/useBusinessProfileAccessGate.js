"use client";

import { useCallback } from "react";
import { useAuth } from "@/components/AuthProvider";
import { useModal } from "@/components/modals/ModalProvider";
import { setAuthIntent } from "@/lib/auth/authIntent";

function getCurrentPath() {
  if (typeof window === "undefined") return "/";
  return `${window.location.pathname}${window.location.search}${window.location.hash}`;
}

export default function useBusinessProfileAccessGate() {
  const { user } = useAuth();
  const { openModal } = useModal();

  return useCallback(
    (event, destination) => {
      if (user?.id) return true;

      event?.preventDefault?.();
      event?.stopPropagation?.();

      const currentPath = getCurrentPath();
      const targetPath =
        typeof destination === "string" && destination.trim()
          ? destination.trim()
          : currentPath;
      setAuthIntent({ redirectTo: targetPath, role: "customer" });
      openModal("customer-login", { next: targetPath });

      if (process.env.NODE_ENV !== "production") {
        console.info("[AUTH_PROFILE_CLICK_TRACE] blocked_business_profile_navigation", {
          currentPath,
          targetPath,
        });
      }

      return false;
    },
    [openModal, user?.id]
  );
}
