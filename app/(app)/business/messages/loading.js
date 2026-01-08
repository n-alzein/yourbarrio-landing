export default function Loading() {
  return (
    <section className="relative w-full min-h-screen pt-6 md:pt-8 text-white overflow-hidden -mt-8 md:-mt-12 pb-12 md:pb-16">
      <div className="absolute inset-0 -z-10">
        <div className="absolute inset-0 bg-gradient-to-b from-[#0b0720] via-[#0a0816] to-black" />
        <div className="absolute -top-32 -left-20 h-[360px] w-[360px] rounded-full bg-purple-600/20 blur-[120px]" />
        <div className="absolute top-10 right-10 h-[300px] w-[300px] rounded-full bg-pink-500/15 blur-[120px]" />
      </div>

      <div className="w-full px-5 sm:px-6 md:px-8 lg:px-12">
        <div className="max-w-5xl mx-auto space-y-8">
          <div className="rounded-[28px] border border-white/10 bg-white/5 p-6 md:p-8 backdrop-blur">
            <div className="h-3 w-20 rounded-full bg-white/10" />
            <div className="mt-4 h-8 w-48 rounded-full bg-white/10" />
            <div className="mt-3 h-4 w-80 rounded-full bg-white/10" />
          </div>

          <div className="rounded-[28px] border border-white/10 bg-white/5 p-6 space-y-4">
            <div className="h-16 rounded-2xl bg-white/10" />
            <div className="h-16 rounded-2xl bg-white/10" />
            <div className="h-16 rounded-2xl bg-white/10" />
          </div>
        </div>
      </div>
    </section>
  );
}
