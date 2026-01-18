// app/business-auth/layout.js
import { Suspense } from "react";

function BusinessAuthFallback() {
  return <div className="w-full max-w-2xl min-h-[420px]" />;
}

export default function BusinessAuthLayout({ children }) {
  return (
    <>
      {/* Override body background for this page */}
      <style>{`
        body {
          background: #000 !important;
        }
      `}</style>

      <div
        className="business-auth-page fixed inset-0 flex items-center justify-center overflow-auto"
        style={{ background: 'linear-gradient(to bottom, #0f172a, #020617, #000)', color: '#fff' }}
      >
        {/* Background glow effects */}
        <div className="absolute inset-0 -z-10 overflow-hidden">
          <div
            className="pointer-events-none absolute -top-32 -left-24 h-[420px] w-[420px] rounded-full blur-[120px]"
            style={{ background: 'rgba(30, 58, 138, 0.2)' }}
          />
          <div
            className="pointer-events-none absolute top-40 -right-24 h-[480px] w-[480px] rounded-full blur-[120px]"
            style={{ background: 'rgba(49, 46, 129, 0.15)' }}
          />
        </div>

        <Suspense fallback={<BusinessAuthFallback />}>{children}</Suspense>
      </div>
    </>
  );
}
