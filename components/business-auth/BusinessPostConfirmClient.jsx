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

const MAX_WAIT_MS = 10_000;
const RETRY_DELAY_MS = 500;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export default function BusinessPostConfirmClient() {
  const router = useRouter();
  const redirectedRef = useRef(false);
  const [statusMessage, setStatusMessage] = useState("Finalizing your account...");

  useEffect(() => {
    let cancelled = false;

    async function resolveBusinessDestination() {
      const { getSupabaseBrowserClient } = await import("@/lib/supabase/browser");
      const supabase = getSupabaseBrowserClient();
      const startedAt = Date.now();
      let attempt = 0;

      while (!cancelled && !redirectedRef.current && Date.now() - startedAt < MAX_WAIT_MS) {
        attempt += 1;

        const {
          data: sessionData,
        } = await supabase.auth.getSession();
        const {
          data: userData,
        } = await supabase.auth.getUser();

        const session = sessionData?.session ?? null;
        const user = userData?.user ?? null;

        console.warn("[BUSINESS_REDIRECT_TRACE] post_confirm_attempt", {
          pathname: PATHS.auth.businessPostConfirm,
          attempt,
          sessionExists: Boolean(session),
          userExists: Boolean(user?.id),
          userId: user?.id || null,
          destinationChosen: null,
        });

        if (!session || !user?.id) {
          setStatusMessage("Still securing your session...");
          await sleep(RETRY_DELAY_MS);
          continue;
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

        let destination = PATHS.auth.businessLogin;

        if (role === "business") {
          const { data: businessRow } = await supabase
            .from("businesses")
            .select(BUSINESS_PROFILE_SELECT)
            .eq("owner_user_id", user.id)
            .maybeSingle();

          destination = getBusinessRedirectDestination({
            passwordSet: userRow?.password_set === true,
            onboardingComplete: isBusinessOnboardingComplete(businessRow),
          });
        } else if (role) {
          destination = getRoleLandingPath(role);
        }

        console.warn("[BUSINESS_REDIRECT_TRACE] post_confirm_attempt", {
          pathname: PATHS.auth.businessPostConfirm,
          attempt,
          sessionExists: true,
          userExists: true,
          userId: user.id,
          destinationChosen: destination,
        });

        redirectedRef.current = true;
        router.replace(destination);
        router.refresh();
        return;
      }

      console.warn("[BUSINESS_REDIRECT_TRACE] post_confirm_timeout", {
        pathname: PATHS.auth.businessPostConfirm,
        elapsedMs: Date.now() - startedAt,
        sessionExists: false,
        userExists: false,
        destinationChosen: `${PATHS.auth.businessLogin}?next=${encodeURIComponent(PATHS.auth.businessCreatePassword)}`,
      });

      redirectedRef.current = true;
      router.replace(
        `${PATHS.auth.businessLogin}?next=${encodeURIComponent(PATHS.auth.businessCreatePassword)}`
      );
    }

    void resolveBusinessDestination();

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
