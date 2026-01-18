"use client";

export default function CustomerHomeLoading() {
  return (
    <div className="min-h-screen text-white relative px-6 pt-10">
      <div className="absolute inset-0 -z-10 overflow-hidden">
        <div className="absolute inset-0 bg-[#05010d]" />
        <div className="absolute inset-0 bg-gradient-to-b from-purple-900/40 via-fuchsia-900/30 to-black" />
        <div className="pointer-events-none absolute -top-32 -left-24 h-[420px] w-[420px] rounded-full bg-purple-600/30 blur-[120px]" />
        <div className="pointer-events-none absolute top-40 -right-24 h-[480px] w-[480px] rounded-full bg-pink-500/30 blur-[120px]" />
      </div>
      <div className="w-full max-w-5xl mx-auto space-y-4">
        <div className="h-10 w-64 rounded-full bg-white/10 border border-white/10" />
        <div className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-xl shadow-xl p-4 space-y-3">
          <div className="h-4 w-48 rounded bg-white/10" />
          <div className="h-4 w-64 rounded bg-white/10" />
          <div className="h-4 w-40 rounded bg-white/10" />
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
          <div className="lg:col-span-3 rounded-2xl border border-white/10 bg-white/5 backdrop-blur-xl shadow-xl h-[240px]" />
          <div className="lg:col-span-2 rounded-2xl border border-white/10 bg-white/5 backdrop-blur-xl shadow-xl h-[240px]" />
        </div>
      </div>
    </div>
  );
}
