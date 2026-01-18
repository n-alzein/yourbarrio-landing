"use client";

export default function Error({ error, reset }) {
  return (
    <section className="relative w-full min-h-screen pt-6 md:pt-8 text-white overflow-hidden -mt-8 md:-mt-12 pb-12 md:pb-16">
      <div className="absolute inset-0 -z-10">
        <div className="absolute inset-0 bg-gradient-to-b from-[#0b0720] via-[#0a0816] to-black" />
        <div className="absolute -top-32 -left-20 h-[360px] w-[360px] rounded-full bg-purple-600/20 blur-[120px]" />
        <div className="absolute top-10 right-10 h-[300px] w-[300px] rounded-full bg-pink-500/15 blur-[120px]" />
      </div>

      <div className="w-full px-5 sm:px-6 md:px-8 lg:px-12">
        <div className="max-w-5xl mx-auto space-y-6">
          <div className="rounded-[28px] border border-white/10 bg-white/5 p-6 md:p-8 backdrop-blur">
            <p className="text-[11px] uppercase tracking-[0.32em] text-white/50">
              Inbox
            </p>
            <h1 className="mt-3 text-3xl md:text-4xl font-semibold text-white">
              Messages
            </h1>
            <p className="text-sm text-white/60 mt-2 max-w-2xl">
              We ran into an issue loading your inbox.
            </p>
          </div>

          <div className="rounded-3xl border border-rose-500/30 bg-rose-500/10 px-5 py-4 text-sm text-rose-100 flex flex-wrap items-center justify-between gap-3">
            <span>{error?.message || "Something went wrong."}</span>
            <button
              type="button"
              onClick={reset}
              className="rounded-full border border-rose-200/40 px-3 py-1 text-[11px] uppercase tracking-[0.2em] text-rose-100 hover:text-white"
            >
              Try again
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
