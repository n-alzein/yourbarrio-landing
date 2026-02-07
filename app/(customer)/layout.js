import { Suspense } from "react";
import { headers, cookies } from "next/headers";
import GlobalHeader from "@/components/nav/GlobalHeader";
import InactivityLogout from "@/components/auth/InactivityLogout";
import AuthSeed from "@/components/auth/AuthSeed";
import AuthRedirectGuard from "@/components/auth/AuthRedirectGuard";
import { requireEffectiveRole } from "@/lib/auth/requireEffectiveRole";
import { PATHS } from "@/lib/auth/paths";
import CustomerRealtimeProvider from "@/app/(customer)/customer/CustomerRealtimeProvider";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const metadata = {
  other: {
    "yb-shell": "customer",
  },
};

function CustomerRouteShell({ children = null, className = "" }) {
  return (
    <div className={`pt-0 md:pt-12 min-h-screen${className ? ` ${className}` : ""}`}>
      {children}
    </div>
  );
}

export default async function CustomerLayout({ children }) {
  const headerList = await headers();
  const userAgent = headerList.get("user-agent") || "";
  const isSafari =
    userAgent.includes("Safari") &&
    !userAgent.includes("Chrome") &&
    !userAgent.includes("Chromium") &&
    !userAgent.includes("Edg") &&
    !userAgent.includes("OPR");
  const perfCookie = (await cookies()).get("yb-perf")?.value === "1";
  const {
    user,
    profile,
    effectiveProfile,
    effectiveRole,
    targetRole,
  } = await requireEffectiveRole("customer");

  return (
    <>
      {isSafari ? (
        <style>{`
          .customer-shell.yb-safari .backdrop-blur-xl,
          .customer-shell.yb-safari .backdrop-blur-lg,
          .customer-shell.yb-safari .backdrop-blur-md,
          .customer-shell.yb-safari .use-backdrop-blur {
            -webkit-backdrop-filter: none !important;
            backdrop-filter: none !important;
            background: var(--color-surface) !important;
          }
          .customer-shell.yb-safari .app-shell-glow,
          .customer-shell.yb-safari .animated-bg {
            display: none !important;
          }
        `}</style>
      ) : null}
      {isSafari && perfCookie ? (
        <script
          dangerouslySetInnerHTML={{
            __html:
              'console.log(\"[nav-guard] applied (customer) – reused business login fix\")',
          }}
        />
      ) : null}
      <AuthSeed
        user={user}
        profile={effectiveProfile || profile}
        role={targetRole || effectiveRole || "customer"}
      />
      <AuthRedirectGuard redirectTo={PATHS.auth.customerLogin}>
        <Suspense fallback={null}>
          <GlobalHeader surface="customer" />
        </Suspense>
        <InactivityLogout />
        <CustomerRouteShell className={`customer-shell${isSafari ? " yb-safari" : ""}`}>
          <Suspense
            fallback={
              <div className="min-h-screen px-6 md:px-10 pt-24 text-white">
                <div className="max-w-5xl mx-auto rounded-2xl border border-white/10 bg-white/5 p-8">
                  Loading your account...
                </div>
              </div>
            }
          >
            <CustomerRealtimeProvider>{children}</CustomerRealtimeProvider>
          </Suspense>
        </CustomerRouteShell>
      </AuthRedirectGuard>
    </>
  );
}
