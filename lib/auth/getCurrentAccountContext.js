import "server-only";

import { headers as nextHeaders } from "next/headers";
import { unstable_noStore as noStore } from "next/cache";
import {
  createSupabaseRouteHandlerClient,
  getSupabaseServerAuthedClient,
} from "@/lib/supabaseServer";
import {
  buildCurrentAccountContext,
  logCurrentAccountContext,
} from "@/lib/auth/currentAccountContext";
import {
  ensureUserProvisionedForUser,
  isTombstonedUserRow,
} from "@/lib/auth/ensureUserProvisioning";

function shouldLogProvisioningRecovery() {
  return (
    process.env.NODE_ENV !== "production" ||
    process.env.AUTH_DIAG_SERVER === "1" ||
    process.env.NEXT_PUBLIC_AUTH_DIAG === "1"
  );
}

function logAccountContextFailure(source, stage, error, meta = {}) {
  console.warn("[ACCOUNT_CONTEXT_FAILURE]", {
    source,
    stage,
    message: error?.message || String(error),
    ...meta,
  });
}

export async function getCurrentAccountContext({
  request = null,
  response = null,
  supabase: supabaseOverride = null,
  source = "server",
} = {}) {
  noStore();

  const supabase =
    supabaseOverride ||
    (request && response
      ? createSupabaseRouteHandlerClient(request, response)
      : await getSupabaseServerAuthedClient());

  if (!supabase?.auth?.getUser) {
    return buildCurrentAccountContext();
  }

  let user = null;
  let authError = null;
  try {
    const result = await supabase.auth.getUser();
    user = result?.data?.user ?? null;
    authError = result?.error ?? null;
  } catch (error) {
    logAccountContextFailure(source, "auth.getUser", error);
    return buildCurrentAccountContext();
  }

  if (authError || !user?.id) {
    return buildCurrentAccountContext();
  }

  const [profileResult, businessResult] = await Promise.allSettled([
    supabase.from("users").select("*").eq("id", user.id).maybeSingle(),
    supabase
      .from("businesses")
      .select("owner_user_id")
      .eq("owner_user_id", user.id)
      .maybeSingle(),
  ]);
  const profileValue =
    profileResult.status === "fulfilled" ? profileResult.value : { data: null, error: profileResult.reason };
  const businessValue =
    businessResult.status === "fulfilled" ? businessResult.value : { data: null, error: businessResult.reason };
  const initialProfile = profileValue?.data ?? null;
  const profileError = profileValue?.error ?? null;
  const businessRow = businessValue?.data ?? null;
  if (profileError || profileResult.status === "rejected") {
    logAccountContextFailure(source, "users.profile", profileError || profileResult.reason, {
      userId: user.id,
    });
  }
  if (businessValue?.error || businessResult.status === "rejected") {
    logAccountContextFailure(source, "businesses.owner_user_id", businessValue?.error || businessResult.reason, {
      userId: user.id,
    });
  }
  let profile = initialProfile ?? null;
  const profileTombstoned = isTombstonedUserRow(profile);
  const shouldRecoverProfile = (!profile && !profileError) || profileTombstoned;

  if (shouldRecoverProfile) {
    try {
      const recovery = await ensureUserProvisionedForUser({
        userId: user.id,
        email: user.email || "",
        fullName: user.user_metadata?.full_name || user.user_metadata?.name || "",
        avatarUrl:
          user.user_metadata?.avatar_url ||
          user.user_metadata?.picture ||
          user.user_metadata?.profile_photo_url ||
          "",
        fallbackRole: user.app_metadata?.role || user.user_metadata?.role || "customer",
        source,
        debug: shouldLogProvisioningRecovery(),
      });
      const { data: recoveredProfile, error: recoveredProfileError } = await supabase
        .from("users")
        .select("*")
        .eq("id", user.id)
        .maybeSingle();
      profile = recoveredProfile ?? null;
      if (shouldLogProvisioningRecovery()) {
        console.info("[AUTH_PROFILE_BOOTSTRAP]", {
          source,
          userId: user.id,
          authUserExists: true,
          profileExisted: Boolean(initialProfile),
          profileTombstoned,
          recoveryAttempted: true,
          recoveryCreated: recovery?.userCreated === true,
          recoveryRepaired: recovery?.userRepaired === true,
          recoveredProfileExists: Boolean(profile),
          recoveredProfileError: recoveredProfileError?.message || null,
        });
      }
    } catch (error) {
      if (shouldLogProvisioningRecovery()) {
        console.warn("[AUTH_PROFILE_BOOTSTRAP]", {
          source,
          userId: user.id,
          authUserExists: true,
          profileExisted: Boolean(initialProfile),
          profileTombstoned,
          recoveryAttempted: true,
          recoveredProfileExists: false,
          error: error?.message || String(error),
        });
      }
    }
  } else if (shouldLogProvisioningRecovery()) {
    console.info("[AUTH_PROFILE_BOOTSTRAP]", {
      source,
      userId: user.id,
      authUserExists: true,
      profileExisted: Boolean(profile),
      profileTombstoned,
      profileError: profileError?.message || null,
      recoveryAttempted: false,
    });
  }

  const context = buildCurrentAccountContext({
    user,
    profile,
    // Debug only. Purchase eligibility must come from public.users.role, never
    // from the existence of a businesses row or onboarding state.
    businessRowExists: Boolean(businessRow?.owner_user_id),
  });

  let host = request?.headers?.get?.("host") || null;
  if (!host) {
    try {
      host = (await nextHeaders()).get("host");
    } catch {
      host = null;
    }
  }

  logCurrentAccountContext({ source, host, context });
  return context;
}
