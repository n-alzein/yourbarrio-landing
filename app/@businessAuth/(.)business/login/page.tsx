"use client";

import { useRouter } from "next/navigation";
import BusinessLoginModal from "@/components/modals/BusinessLoginModal";

export default function BusinessLoginInterceptPage() {
  const router = useRouter();

  return (
    <BusinessLoginModal
      onClose={() => {
        router.back();
      }}
    />
  );
}
