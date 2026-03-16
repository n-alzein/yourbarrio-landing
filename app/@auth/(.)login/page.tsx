"use client";

import { useRouter } from "next/navigation";
import CustomerLoginModal from "@/components/modals/CustomerLoginModal";

export default function CustomerLoginInterceptPage() {
  const router = useRouter();

  return (
    <CustomerLoginModal
      onClose={() => {
        router.back();
      }}
    />
  );
}
