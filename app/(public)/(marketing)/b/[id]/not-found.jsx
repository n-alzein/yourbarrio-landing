import Link from "next/link";

export default function PublicBusinessNotFound() {
  return (
    <div className="min-h-screen text-white theme-lock">
      <div className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-slate-900 via-purple-900/70 to-black" />
        <div className="absolute inset-0 bg-gradient-to-b from-black/30 via-black/60 to-black/90" />
        <div className="relative mx-auto max-w-4xl px-6 md:px-10 py-24 md:py-32 text-center">
          <h1 className="text-3xl md:text-4xl font-semibold">
            This business profile could not be found.
          </h1>
          <p className="mt-3 text-sm md:text-base text-white/70">
            Double-check the link or browse nearby businesses.
          </p>
          <Link
            href="/customer/home"
            className="mt-8 inline-flex items-center justify-center rounded-full bg-white/90 px-5 py-2 text-sm font-semibold text-slate-900 hover:bg-white transition"
          >
            Back to customer home
          </Link>
        </div>
      </div>
    </div>
  );
}
