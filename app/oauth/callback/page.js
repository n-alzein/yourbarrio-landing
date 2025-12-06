"use client";
export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

import { useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { getBrowserSupabaseClient } from "@/lib/supabaseClient";

export default function OAuthCallbackPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    async function run() {
      const supabase = getBrowserSupabaseClient();

      const code = searchParams.get("code");
      if (!code) {
        router.replace("/auth/login?oauth=missing-code");
        return;
      }

      const { data, error } = await supabase.auth.exchangeCodeForSession(code);

      if (error) {
        router.replace("/auth/login?oauth=failed");
        return;
      }

      const user = data.session?.user;
      if (!user) {
        router.replace("/auth/login?oauth=no-user");
        return;
      }

      const fullName =
        user.user_metadata?.full_name ||
        user.user_metadata?.name ||
        "";

      const avatar =
        user.user_metadata?.avatar_url || null;

      const { data: existing } = await supabase
        .from("users")
        .select("id, role")
        .eq("id", user.id)
        .maybeSingle();

      if (!existing) {
        await supabase.from("users").insert({
          id: user.id,
          email: user.email,
          role: "customer",
          full_name: fullName,
          profile_photo_url: avatar,
          created_at: new Date().toISOString(),
        });
      }

      const role = existing?.role ?? "customer";

      router.replace(role === "business"
        ? "/business/dashboard"
        : "/customer/home");
    }

    run();
  }, []);

  return (
    <div className="min-h-screen flex items-center justify-center text-white">
      <p className="text-xl">Logging you in…</p>
    </div>
  );
}
