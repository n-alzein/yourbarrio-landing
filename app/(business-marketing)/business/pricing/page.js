export default function BusinessPricingPage() {
  return (
    <div className="min-h-screen text-white relative px-6 pb-24 pt-10">
      <div className="absolute inset-0 -z-10 overflow-hidden">
        <div className="absolute inset-0 bg-[#05010d]" />
        <div className="absolute inset-0 bg-gradient-to-b from-purple-900/40 via-fuchsia-900/30 to-black" />
        <div className="pointer-events-none absolute -top-32 -left-24 h-[420px] w-[420px] rounded-full bg-purple-600/30 blur-[120px]" />
        <div className="pointer-events-none absolute top-40 -right-24 h-[480px] w-[480px] rounded-full bg-pink-500/30 blur-[120px]" />
      </div>

      <div className="max-w-4xl mx-auto text-center">
        <h1 className="text-3xl md:text-5xl font-bold tracking-tight">Pricing</h1>
        <p className="mt-6 text-lg text-white/80">
          Transparent, flexible plans built for local businesses. We&apos;ll share full pricing details here soon.
        </p>
      </div>
    </div>
  );
}
