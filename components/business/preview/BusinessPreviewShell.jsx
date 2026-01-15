"use client";

import { useCallback, useState } from "react";
import PublicBusinessPreviewClient from "@/components/publicBusinessProfile/PublicBusinessPreviewClient";

function BusinessPreviewFallback() {
  return (
    <div className="min-h-screen text-white -mt-20">
      <div className="h-[170px] sm:h-[200px] md:h-[230px] bg-gradient-to-br from-slate-900 via-purple-900/70 to-black" />
      <div className="mx-auto max-w-6xl px-6 md:px-10 pb-16 space-y-8 mt-6">
        <div className="rounded-3xl border border-white/10 bg-white/5 p-6 md:p-8">
          <div className="h-5 w-32 rounded bg-white/10" />
          <div className="mt-4 space-y-2">
            <div className="h-4 w-full rounded bg-white/10" />
            <div className="h-4 w-5/6 rounded bg-white/10" />
            <div className="h-4 w-4/6 rounded bg-white/10" />
          </div>
        </div>

        <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,360px)]">
          <div className="rounded-3xl border border-white/10 bg-white/5 p-6 md:p-8 space-y-4">
            <div className="h-5 w-40 rounded bg-white/10" />
            <div className="h-20 w-full rounded bg-white/10" />
          </div>
          <div className="rounded-3xl border border-white/10 bg-white/5 p-6 md:p-8">
            <div className="h-5 w-32 rounded bg-white/10" />
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <div className="h-28 rounded bg-white/10" />
              <div className="h-28 rounded bg-white/10" />
              <div className="h-28 rounded bg-white/10" />
              <div className="h-28 rounded bg-white/10" />
            </div>
          </div>
        </div>

        <div className="rounded-3xl border border-white/10 bg-white/5 p-6 md:p-8">
          <div className="h-5 w-32 rounded bg-white/10" />
          <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <div className="h-40 rounded bg-white/10" />
            <div className="h-40 rounded bg-white/10" />
            <div className="h-40 rounded bg-white/10" />
          </div>
        </div>
      </div>
    </div>
  );
}

export default function BusinessPreviewShell({ businessId }) {
  const [ready, setReady] = useState(false);

  const handleReady = useCallback(() => {
    setReady(true);
  }, []);

  return (
    <>
      {!ready ? <BusinessPreviewFallback /> : null}
      <div style={ready ? undefined : { display: "none" }}>
        <PublicBusinessPreviewClient
          businessId={businessId}
          onReady={handleReady}
        />
      </div>
    </>
  );
}
