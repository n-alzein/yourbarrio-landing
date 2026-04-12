"use client";

import { useRouter, useSearchParams } from "next/navigation";
import CustomerLoginModal from "@/components/modals/CustomerLoginModal";

export default function CustomerLoginInterceptPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next =
    searchParams.get("next") || searchParams.get("returnUrl") || searchParams.get("callbackUrl");

  if (process.env.NODE_ENV !== "production") {
    console.info("[auth-next] intercept normalized next:", next || "/");
  }

  return (
    <CustomerLoginModal
      next={next}
      onClose={() => {
        router.back();
      }}
    />
  );
}
