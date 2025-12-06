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

      // 1️⃣ Exchange PKCE code
      const { data, error } = await supabase.auth.exchangeCodeForSession(code);

      if (error) {
        console.error("OAuth exchange error:", error);
        router.replace("/auth/login?oauth=failed");
        return;
      }

      const session = data.session;
      const user = session?.user;

      if (!user) {
        router.replace("/auth/login?oauth=no-user");
        return;
      }

// 2️⃣ Extract metadata
const fullName =
  user.user_metadata?.full_name ||
  user.user_metadata?.name ||
  "";

const avatar =
  user.user_metadata?.avatar_url || // stable Google avatar
  null;                             // NO picture fallback


      // 3️⃣ Check if profile row exists
      const { data: existing } = await supabase
        .from("users")
        .select("id, role")
        .eq("id", user.id)
        .maybeSingle();

      // 4️⃣ Insert row if not exists
      if (!existing) {
        const insertPayload = {
          id: user.id,
          email: user.email,
          role: "customer",          // default
          full_name: fullName,
          profile_photo_url: avatar,
          created_at: new Date().toISOString(),
        };

        const { error: insertErr } = await supabase
          .from("users")
          .insert(insertPayload);

        if (insertErr) {
          console.error("Insert error:", insertErr);
          router.replace("/auth/login?oauth=insert-failed");
          return;
        }
      }

      // 5️⃣ Decide destination
      const role = existing?.role ?? "customer";

      if (role === "business") {
        router.replace("/business/dashboard");
      } else {
        router.replace("/customer/home");
      }
    }

    run();
  }, []);

  return (
    <div className="min-h-screen flex items-center justify-center text-white">
      <p className="text-xl">Logging you in…</p>
    </div>
  );
}
