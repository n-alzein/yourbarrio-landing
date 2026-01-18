import { Suspense } from "react";
import GlobalHeader from "@/components/nav/GlobalHeader";
import InactivityLogout from "@/components/auth/InactivityLogout";
import { AuthProvider } from "@/components/AuthProvider";
import { requireRole } from "@/lib/auth/server";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const metadata = {
  other: {
    "yb-shell": "customer",
  },
};

function CustomerRouteShell({ children = null }) {
  return <div className="pt-28 md:pt-20 min-h-screen">{children}</div>;
}

export default async function CustomerLayout({ children }) {
  const { user, profile } = await requireRole("customer");

  return (
    <AuthProvider
      initialUser={user}
      initialProfile={profile}
      initialRole="customer"
    >
      <GlobalHeader surface="customer" />
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
    </AuthProvider>
  );
}
