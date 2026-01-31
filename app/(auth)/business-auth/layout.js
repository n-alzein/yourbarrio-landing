// app/business-auth/layout.js
import { Suspense } from "react";
import { headers } from "next/headers";

export const dynamic = "force-dynamic";

function BusinessAuthFallback() {
  return (
    <div className="w-full flex justify-center px-4 mt-24 grow">
      <div
        className="max-w-md w-full max-h-[420px] p-8 rounded-2xl"
        style={{
          background: "rgba(30, 41, 59, 0.35)",
          border: "1px solid rgba(51, 65, 85, 0.4)",
          boxShadow: "0 0 50px -12px rgba(0, 0, 0, 0.5)",
        }}
      >
        <div className="h-7 w-40 rounded bg-white/10 mb-3" />
        <div className="h-4 w-56 rounded bg-white/10 mb-8" />
        <div className="space-y-4">
          <div className="h-11 rounded bg-white/10" />
          <div className="h-11 rounded bg-white/10" />
          <div className="h-12 rounded bg-white/10" />
        </div>
        <div className="h-11 rounded bg-white/10 mt-5" />
      </div>
    </div>
  );
}

export default async function BusinessAuthLayout({ children }) {
  const headerList = await headers();
  const userAgent = headerList.get("user-agent") || "";
  const isSafari =
    userAgent.includes("Safari") &&
    !userAgent.includes("Chrome") &&
    !userAgent.includes("Chromium") &&
    !userAgent.includes("Edg") &&
    !userAgent.includes("OPR");
  return (
    <>
      {/* Override body background for this page */}
      <style>{`
        body {
          background: #000 !important;
        }
      `}</style>
      {isSafari ? (
        <style>{`
          .business-auth-page.yb-safari .backdrop-blur-xl,
          .business-auth-page.yb-safari .backdrop-blur-lg,
          .business-auth-page.yb-safari .backdrop-blur-md {
            -webkit-backdrop-filter: none !important;
            backdrop-filter: none !important;
            background: rgba(30, 41, 59, 0.85) !important;
          }
          .business-auth-page.yb-safari .yb-auth-glow {
            display: none !important;
          }
        `}</style>
      ) : null}

      <div
        className={`business-auth-page fixed inset-0 flex items-center justify-center overflow-auto${isSafari ? " yb-safari" : ""}`}
        style={{ background: 'linear-gradient(to bottom, #0f172a, #020617, #000)', color: '#fff' }}
      >
        {/* Background glow effects */}
        <div className="absolute inset-0 -z-10 overflow-hidden">
          <div
            className="yb-auth-glow pointer-events-none absolute -top-32 -left-24 h-[420px] w-[420px] rounded-full blur-[120px]"
            style={{ background: 'rgba(30, 58, 138, 0.2)' }}
          />
          <div
            className="yb-auth-glow pointer-events-none absolute top-40 -right-24 h-[480px] w-[480px] rounded-full blur-[120px]"
            style={{ background: 'rgba(49, 46, 129, 0.15)' }}
          />
        </div>

        <Suspense fallback={<BusinessAuthFallback />}>{children}</Suspense>
      </div>
    </>
  );
}
