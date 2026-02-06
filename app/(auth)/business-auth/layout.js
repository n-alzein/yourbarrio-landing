// app/business-auth/layout.js
import { Suspense } from "react";
import { headers } from "next/headers";

export const dynamic = "force-dynamic";

function BusinessAuthFallback() {
  return (
    <div className="w-full flex justify-center px-4 py-10">
      <div
        className="max-w-md w-full max-h-[420px] p-8 rounded-2xl bg-white border border-[var(--yb-border)]"
      >
        <div className="h-7 w-40 rounded bg-slate-200/70 mb-3" />
        <div className="h-4 w-56 rounded bg-slate-200/70 mb-8" />
        <div className="space-y-4">
          <div className="h-11 rounded bg-slate-200/70" />
          <div className="h-11 rounded bg-slate-200/70" />
          <div className="h-12 rounded bg-slate-200/70" />
        </div>
        <div className="h-11 rounded bg-slate-200/70 mt-5" />
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
      <style>{`
        html, body {
          height: 100%;
          background: var(--yb-surface) !important;
          margin: 0;
        }
        body > div {
          background: var(--yb-surface) !important;
          padding-top: 0 !important;
        }
        footer {
          background: var(--yb-surface) !important;
          margin-top: 0 !important;
        }
      `}</style>
      <div
        className={`business-auth-page min-h-screen w-full bg-[var(--yb-surface)] text-[var(--yb-text)]${isSafari ? " yb-safari" : ""}`}
      >
        <main className="min-h-screen w-full flex items-center justify-center px-4 py-10">
          <Suspense fallback={<BusinessAuthFallback />}>{children}</Suspense>
        </main>
      </div>
    </>
  );
}
