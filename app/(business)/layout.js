import { Suspense } from "react";
import BusinessNavbar from "@/components/navbars/BusinessNavbar";
import InactivityLogout from "@/components/auth/InactivityLogout";
import { AuthProvider } from "@/components/AuthProvider";
import { requireRole } from "@/lib/auth/server";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const metadata = {
  other: {
    "yb-shell": "business",
  },
};

function BusinessRouteShell({ children = null }) {
  return <div className="pt-8 md:pt-10 min-h-screen">{children}</div>;
}

export default async function BusinessLayout({ children }) {
  const { user, profile } = await requireRole("business");

  return (
    <AuthProvider
      initialUser={user}
      initialProfile={profile}
      initialRole="business"
    >
      <BusinessNavbar requireAuth />
      <InactivityLogout />
      <BusinessRouteShell>
        <Suspense
          fallback={
            <div className="min-h-screen px-6 md:px-10 pt-24 text-white">
              <div className="max-w-5xl mx-auto rounded-2xl border border-white/10 bg-white/5 p-8">
                Loading business workspace...
              </div>
            </div>
          }
        >
          {children}
        </Suspense>
      </BusinessRouteShell>
    </AuthProvider>
  );
}
