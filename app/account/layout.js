import { Suspense } from "react";
import { headers, cookies } from "next/headers";
import GlobalHeader from "@/components/nav/GlobalHeader";
import InactivityLogout from "@/components/auth/InactivityLogout";
import AuthSeed from "@/components/auth/AuthSeed";
import AccountNavPerf from "@/components/debug/AccountNavPerf";
import ProtectedRouteLoginPrompt from "@/components/auth/ProtectedRouteLoginPrompt";
import CustomerRealtimeProvider from "@/app/(customer)/customer/CustomerRealtimeProvider";
import { getServerAuth, requireRole } from "@/lib/auth/server";
import { getRequestPath } from "@/lib/url/getRequestPath";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function AccountShell({ children = null, className = "", compact = false }) {
  const lightThemeVars = {
    "--bg-solid": "#ffffff",
    "--bg-gradient-start": "#f7f7f8",
    "--bg-gradient-end": "#eef2ff",
    "--glow-1": "rgba(79, 70, 229, 0.1)",
    "--glow-2": "rgba(14, 165, 233, 0.08)",
  };

  return (
    <div
      className={`${
        compact
          ? "pt-[calc(var(--yb-nav-content-offset,80px)+0.75rem)] md:pt-[calc(var(--yb-nav-content-offset,80px)+1rem)]"
          : "pt-[calc(var(--yb-nav-content-offset,80px)+1rem)] md:pt-[calc(var(--yb-nav-content-offset,80px)+1.5rem)]"
      } min-h-screen bg-[var(--yb-bg)] text-[var(--yb-text)]${className ? ` ${className}` : ""}`}
      data-theme="light"
      data-route-theme="light"
      style={lightThemeVars}
    >
      {children}
    </div>
  );
}

export default async function AccountLayout({ children }) {
  const requestPath = await getRequestPath("/account/orders");
  const compactOrderSpacing =
    requestPath === "/account/orders" || requestPath === "/account/purchase-history";
  const headerList = await headers();
  const userAgent = headerList.get("user-agent") || "";
  const isSafari =
    userAgent.includes("Safari") &&
    !userAgent.includes("Chrome") &&
    !userAgent.includes("Chromium") &&
    !userAgent.includes("Edg") &&
    !userAgent.includes("OPR");
  const perfCookie = (await cookies()).get("yb-perf")?.value === "1";
  const serverAuth = await getServerAuth();
  if (!serverAuth?.user) {
    return (
      <>
        <AuthSeed user={null} profile={null} role={null} />
        <Suspense fallback={null}>
          <GlobalHeader surface="customer" />
        </Suspense>
        <AccountShell
          compact={compactOrderSpacing}
          className={`account-shell${isSafari ? " yb-safari" : ""}`}
        >
          <div className="mx-auto max-w-5xl rounded-2xl border border-[var(--yb-border)] bg-white p-8">
            Loading your account...
          </div>
          <ProtectedRouteLoginPrompt role="customer" />
        </AccountShell>
      </>
    );
  }
  const { user, profile } = await requireRole("customer");

  return (
    <>
      {isSafari ? (
        <style>{`
          .account-shell.yb-safari .backdrop-blur-xl,
          .account-shell.yb-safari .backdrop-blur-lg,
          .account-shell.yb-safari .backdrop-blur-md,
          .account-shell.yb-safari .use-backdrop-blur {
            -webkit-backdrop-filter: none !important;
            backdrop-filter: none !important;
            background: var(--color-surface) !important;
          }
          .account-shell.yb-safari .app-shell-glow,
          .account-shell.yb-safari .animated-bg {
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
      <AuthSeed user={user} profile={profile} role="customer" />
      <Suspense fallback={null}>
        <GlobalHeader surface="customer" />
      </Suspense>
      <InactivityLogout />
      <AccountNavPerf />
      <AccountShell
        compact={compactOrderSpacing}
        className={`account-shell${isSafari ? " yb-safari" : ""}`}
      >
        <Suspense fallback={null}>
          <CustomerRealtimeProvider>{children}</CustomerRealtimeProvider>
        </Suspense>
      </AccountShell>
    </>
  );
}
