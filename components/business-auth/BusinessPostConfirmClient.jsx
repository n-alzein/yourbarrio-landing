"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { PATHS } from "@/lib/auth/paths";
import { getRoleLandingPath, normalizeAppRole } from "@/lib/auth/redirects";
import {
  BUSINESS_PROFILE_SELECT,
  getBusinessRedirectDestination,
} from "@/lib/auth/businessPasswordGate";
import { isBusinessOnboardingComplete } from "@/lib/business/onboardingCompletion";

const SESSION_RETRY_ATTEMPTS = 8;
const SESSION_RETRY_DELAY_MS = 500;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export default function BusinessPostConfirmClient() {
  const router = useRouter();
  const [statusMessage, setStatusMessage] = useState("Finalizing your account...");
  const redirectedRef = useRef(false);

  useEffect(() => {
    let cancelled = false;

    async function resolveDestination() {
      const { getSupabaseBrowserClient } = await import("@/lib/supabase/browser");
      const supabase = getSupabaseBrowserClient();

      for (let attempt = 1; attempt <= SESSION_RETRY_ATTEMPTS; attempt += 1) {
        if (cancelled || redirectedRef.current) return;

        if (attempt > 1) {
          setStatusMessage("Still securing your session...");
        }

        const {
          data: { session },
        } = await supabase.auth.getSession();
        const {
          data: { user },
        } = await supabase.auth.getUser();

        console.warn("[BUSINESS_REDIRECT_TRACE] post_confirm_attempt", {
          pathname: PATHS.auth.businessPostConfirm,
          attempt,
          sessionExists: Boolean(session),
          userExists: Boolean(user?.id),
          userId: user?.id || null,
        });

        if (!session || !user?.id) {
          if (attempt < SESSION_RETRY_ATTEMPTS) {
            await sleep(SESSION_RETRY_DELAY_MS);
            continue;
          }

          redirectedRef.current = true;
          router.replace(
            `${PATHS.auth.businessLogin}?next=${encodeURIComponent(PATHS.auth.businessPostConfirm)}`
          );
          return;
        }

        const fallbackRole =
          normalizeAppRole(user.app_metadata?.role) ||
          normalizeAppRole(user.user_metadata?.role);

        const { data: userRow } = await supabase
          .from("users")
          .select("role,is_internal,password_set")
          .eq("id", user.id)
          .maybeSingle();

        const role =
          userRow?.is_internal === true
            ? "admin"
            : normalizeAppRole(userRow?.role) || fallbackRole;

        if (role !== "business") {
          redirectedRef.current = true;
          router.replace(role ? getRoleLandingPath(role) : PATHS.public.root);
          return;
        }

        const { data: businessRow } = await supabase
          .from("businesses")
          .select(BUSINESS_PROFILE_SELECT)
          .eq("owner_user_id", user.id)
          .maybeSingle();

        const passwordSet = userRow?.password_set === true;
        const onboardingComplete = isBusinessOnboardingComplete(businessRow);
        const destination = getBusinessRedirectDestination({
          passwordSet,
          onboardingComplete,
        });

        console.warn("[BUSINESS_REDIRECT_TRACE] post_confirm_resolved", {
          pathname: PATHS.auth.businessPostConfirm,
          sessionExists: true,
          userExists: true,
          userId: user.id,
          role,
          password_set: passwordSet,
          onboardingState: onboardingComplete,
          redirectDestination: destination,
          redirectReason: "post_confirm_client_resolution",
        });

        redirectedRef.current = true;
        router.replace(destination);
        router.refresh();
        return;
      }
    }

    void resolveDestination();

    return () => {
      cancelled = true;
    };
  }, [router]);

  return (
    <div className="w-full max-w-md rounded-2xl border border-[var(--yb-border)] bg-white p-8 shadow-sm animate-fadeIn">
      <h1 className="text-3xl font-extrabold tracking-tight text-slate-900">
        Finalizing sign-in
      </h1>
      <p className="mt-3 text-sm leading-6 text-slate-600">{statusMessage}</p>
    </div>
  );
}
