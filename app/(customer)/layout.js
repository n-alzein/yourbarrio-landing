import { Suspense } from "react";
import AppShell from "@/components/AppShell";
import GlobalHeader from "@/components/nav/GlobalHeader";
import InactivityLogout from "@/components/auth/InactivityLogout";
import AuthSeed from "@/components/auth/AuthSeed";
import AuthRedirectGuard from "@/components/auth/AuthRedirectGuard";
import { requireRole } from "@/lib/auth/server";
import { PATHS } from "@/lib/auth/paths";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const metadata = {
  other: {
    "yb-shell": "customer",
  },
};

function CustomerRouteShell({ children = null }) {
  return <div className="pt-14 md:pt-12 min-h-screen">{children}</div>;
}

export default async function CustomerLayout({ children }) {
  const { user, profile } = await requireRole("customer");

  return (
    <AppShell>
      <AuthSeed user={user} profile={profile} role="customer" />
      <AuthRedirectGuard redirectTo={PATHS.auth.customerLogin}>
        <Suspense fallback={null}>
          <GlobalHeader surface="customer" />
        </Suspense>
        <InactivityLogout />
        <CustomerRouteShell>
          <Suspense
            fallback={
              <div className="min-h-screen px-6 md:px-10 pt-24 text-white">
                <div className="max-w-5xl mx-auto rounded-2xl border border-white/10 bg-white/5 p-8">
                  Loading your account...
                </div>
              </div>
            }
          >
            {children}
          </Suspense>
        </CustomerRouteShell>
      </AuthRedirectGuard>
    </AppShell>
  );
}
