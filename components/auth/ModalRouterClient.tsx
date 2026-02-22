"use client";

import { useEffect, useMemo } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { isCustomerNearbyPublicAllowed } from "@/lib/routes/isCustomerNearbyPublic";

const MODAL_ALIASES: Record<string, string> = {
  signin: "customer-login",
  login: "customer-login",
  signup: "customer-signup",
};

function resolveModalType(modalParam: string | null) {
  if (!modalParam) return null;
  const normalized = modalParam.trim().toLowerCase();
  if (!normalized) return null;
  return MODAL_ALIASES[normalized] || normalized;
}

function readNearbyPublicCookie() {
  if (typeof document === "undefined") return false;
  return document.cookie
    .split(";")
    .some((cookie) => cookie.trim() === "yb_nearby_public=1");
}

export default function ModalRouterClient({
  openModal,
}: {
  openModal: (type: string, props?: Record<string, unknown>) => void;
}) {
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();

  const modalParam = searchParams.get("modal");
  const next = searchParams.get("next") || searchParams.get("returnUrl") || null;
  const resolvedModalType = useMemo(() => resolveModalType(modalParam), [modalParam]);

  useEffect(() => {
    if (!resolvedModalType) return;
    const isNearbyPublic = isCustomerNearbyPublicAllowed(
      pathname || "",
      readNearbyPublicCookie()
    );

    if (!isNearbyPublic) {
      openModal(resolvedModalType, {
        ...(next ? { next } : {}),
      });
    }

    const params = new URLSearchParams(searchParams.toString());
    params.delete("modal");

    const nextSearch = params.toString();
    const nextUrl = `${pathname}${nextSearch ? `?${nextSearch}` : ""}`;
    router.replace(nextUrl, { scroll: false });
  }, [next, openModal, pathname, resolvedModalType, router, searchParams]);

  return null;
}
