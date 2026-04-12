"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/AuthProvider";
import { getOrCreateConversation } from "@/lib/messages";

export default function MessageBusinessBridgePage({ params }) {
  const router = useRouter();
  const { user, role, supabase, loadingUser } = useAuth();
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;

    async function openConversation() {
      const resolvedParams = await Promise.resolve(params);
      const businessId = String(resolvedParams?.businessId || "").trim();
      if (!businessId || loadingUser) return;

      if (!user?.id) {
        router.replace(`/login?next=${encodeURIComponent(`/messages/${businessId}`)}`);
        return;
      }

      if (role === "business" || user.id === businessId) {
        router.replace("/customer/messages");
        return;
      }

      try {
        const conversationId = await getOrCreateConversation({
          supabase,
          businessId,
        });
        if (!active) return;
        if (conversationId) {
          router.replace(`/customer/messages/${conversationId}`);
          return;
        }
        setError("Could not open messages right now.");
      } catch (err) {
        if (!active) return;
        setError(err?.message || "Could not open messages right now.");
      }
    }

    openConversation();

    return () => {
      active = false;
    };
  }, [loadingUser, params, role, router, supabase, user?.id]);

  return (
    <div className="mx-auto flex min-h-[50vh] max-w-xl items-center justify-center px-6 py-16 text-center">
      <div>
        <h1 className="text-xl font-semibold text-slate-950">
          Opening conversation
        </h1>
        <p className="mt-3 text-sm text-slate-600">
          {error || "One moment while we connect you with this business."}
        </p>
      </div>
    </div>
  );
}
