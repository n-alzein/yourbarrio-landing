export default function LoadingConversation() {
  return (
    <section className="relative w-full min-h-screen pt-6 md:pt-8 text-white overflow-hidden -mt-8 md:-mt-12 pb-20 md:pb-24">
      <div className="absolute inset-0 -z-10">
        <div className="absolute inset-0 bg-gradient-to-b from-[#0b0720] via-[#0a0816] to-black" />
        <div className="absolute -top-32 -left-20 h-[360px] w-[360px] rounded-full bg-purple-600/20 blur-[120px]" />
        <div className="absolute top-10 right-10 h-[300px] w-[300px] rounded-full bg-pink-500/15 blur-[120px]" />
      </div>

      <div className="w-full px-5 sm:px-6 md:px-8 lg:px-12">
        <div className="max-w-5xl mx-auto space-y-4">
          <div className="rounded-[28px] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.08),rgba(255,255,255,0.04))] p-5 md:p-6 backdrop-blur">
            <div className="mb-3 h-3 w-24 rounded-full bg-white/10" />
            <div className="flex items-center gap-4">
              <div className="h-12 w-12 rounded-2xl border border-white/10 bg-[radial-gradient(circle_at_top,_rgba(255,255,255,0.18),_rgba(255,255,255,0.08)_55%,_rgba(15,23,42,0.6)_100%)] animate-pulse" />
              <div>
                <div className="h-3 w-24 rounded-full bg-white/10 animate-pulse" />
                <div className="mt-3 h-7 w-44 rounded-full bg-white/10 animate-pulse" />
              </div>
            </div>
          </div>

          <div className="rounded-[28px] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.08),rgba(255,255,255,0.04))] p-5 md:p-6 space-y-5 backdrop-blur">
            <div className="h-9 w-40 rounded-full border border-white/10 bg-white/5 animate-pulse" />
            <div className="space-y-5">
              <div className="ml-auto max-w-[72%]">
                <div className="rounded-[24px] border border-[#dccbff]/30 bg-[linear-gradient(135deg,rgba(220,203,255,0.26),rgba(220,203,255,0.12))] px-4 py-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]">
                  <div className="h-4 w-40 rounded-full bg-white/15 animate-pulse" />
                  <div className="mt-2 h-4 w-32 rounded-full bg-white/10 animate-pulse" />
                </div>
                <div className="mt-2 ml-auto h-3 w-14 rounded-full bg-white/10 animate-pulse" />
              </div>
              <div className="max-w-[60%]">
                <div className="rounded-[24px] border border-white/10 bg-[linear-gradient(135deg,rgba(255,255,255,0.14),rgba(255,255,255,0.06))] px-4 py-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]">
                  <div className="h-4 w-36 rounded-full bg-white/15 animate-pulse" />
                  <div className="mt-2 h-4 w-28 rounded-full bg-white/10 animate-pulse" />
                  <div className="mt-2 h-4 w-40 rounded-full bg-white/10 animate-pulse" />
                </div>
                <div className="mt-2 h-3 w-16 rounded-full bg-white/10 animate-pulse" />
              </div>
              <div className="ml-auto max-w-[76%]">
                <div className="rounded-[24px] border border-[#dccbff]/30 bg-[linear-gradient(135deg,rgba(220,203,255,0.26),rgba(220,203,255,0.12))] px-4 py-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]">
                  <div className="h-4 w-44 rounded-full bg-white/15 animate-pulse" />
                  <div className="mt-2 h-4 w-24 rounded-full bg-white/10 animate-pulse" />
                </div>
                <div className="mt-2 ml-auto h-3 w-12 rounded-full bg-white/10 animate-pulse" />
              </div>
            </div>
          </div>

          <div className="rounded-3xl border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.08),rgba(255,255,255,0.04))] p-4 backdrop-blur">
            <div className="flex items-end gap-3">
              <div className="flex-1 rounded-[24px] border border-white/10 bg-white/5 px-4 py-4">
                <div className="h-4 w-40 rounded-full bg-white/10 animate-pulse" />
                <div className="mt-3 h-4 w-28 rounded-full bg-white/10 animate-pulse" />
              </div>
              <div className="h-14 w-24 rounded-[20px] border border-white/10 bg-white/10 animate-pulse" />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
