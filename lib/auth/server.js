/*
AUTH AUDIT REPORT
- Client auth calls: business-auth login/register pages, customer login/signup modals.
- Navbar auth decisions: CustomerNavbar/BusinessNavbar read AuthProvider state (now server-seeded).
- Middleware: no auth calls; matcher only targets protected groups.
- Server layouts/pages: auth/role enforcement now handled in group layouts.
- Flicker sources before refactor: client-side redirects on public landing, client navbars waiting on AuthProvider loading,
  AuthProvider polling/refresh logic, middleware auth checks on broad matcher.
*/
"use server";

import { cache } from "react";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabaseServer";
import { PATHS } from "@/lib/auth/paths";
import { getVerifiedUserServer } from "@/lib/auth/getVerifiedUserServer";

const getServerSupabase = cache(async () => {
  return createSupabaseServerClient();
});

export const getServerAuth = cache(async () => {
  const supabase = await getServerSupabase();
  const user = await getVerifiedUserServer(supabase);

  if (!user) {
    return { supabase, user: null };
  }

  return { supabase, user: user ?? null };
});

export async function getProfile(userId, supabaseOverride) {
  const supabase = supabaseOverride ?? (await getServerSupabase());
  if (!userId) return null;

  const { data, error } = await supabase
    .from("users")
    .select("*")
    .eq("id", userId)
    .maybeSingle();

  if (error) {
    return null;
  }

  return data ?? null;
}

export async function requireUser() {
  const { supabase, user } = await getServerAuth();
  if (!user) {
    redirect(PATHS.auth.customerLogin);
  }
  return { supabase, user };
}

export async function requireRole(role) {
  const { supabase, user } = await getServerAuth();

  if (!user) {
    const loginTarget =
      role === "business" ? PATHS.auth.businessLogin : PATHS.auth.customerLogin;
    redirect(loginTarget);
  }

  const profile = await getProfile(user.id, supabase);
  const resolvedRole = profile?.role || user?.app_metadata?.role || null;

  if (role === "customer" && resolvedRole !== "customer") {
    redirect(PATHS.business.dashboard);
  }

  if (role === "business" && resolvedRole !== "business") {
    redirect(PATHS.customer.home);
  }

  return { supabase, user, profile };
}

/*
VERIFICATION CHECKLIST
- Cold load /customer/home: CustomerNavbar renders immediately when authed; unauthenticated redirects server-side to /.
- Cold load /business/dashboard: BusinessNavbar renders immediately when authed; unauthenticated redirects server-side to /business-auth/login.
- Navigate between customer pages: no public navbar flashes.
- Open 2 tabs: no redirect loops.
- Auth request count stable (no refresh_token loops).
*/
