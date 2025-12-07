"use client";

import PublicNavbar from "@/components/navbars/PublicNavbar";
import GoogleMapClient from "@/components/GoogleMapClient";

export default function HomePage() {
  return (
    <>
      {/* Public Navbar */}
      <PublicNavbar />

      <main className="relative min-h-screen text-white pt-28">

        {/* HERO */}
        <section className="max-w-7xl mx-auto px-6 pb-16 md:pb-24">
          <div className="grid md:grid-cols-2 gap-10 items-center">
            <div>
              <p className="inline-flex items-center rounded-full border border-white/15 bg-white/5 px-3 py-1 text-xs md:text-sm text-white/80">
                Local discovery, re-imagined ✨
              </p>

              <h1 className="mt-5 text-4xl md:text-6xl font-extrabold tracking-tight">
                Discover your neighborhood with{" "}
                <span className="bg-gradient-to-r from-purple-300 via-pink-300 to-rose-300 bg-clip-text text-transparent">
                  YourBarrio
                </span>
              </h1>

              <p className="mt-4 text-base md:text-lg text-white/80 leading-relaxed">
                Find nearby restaurants, stores, services, and hidden gems.
                Connect with local business owners instantly and explore what’s around you.
              </p>

              <div className="mt-7 flex flex-col sm:flex-row gap-3">
                <a
                  href="/auth/register"
                  className="inline-flex items-center justify-center rounded-xl px-6 py-3 font-semibold bg-gradient-to-r from-purple-600 via-pink-500 to-rose-500 shadow-lg shadow-purple-500/30 hover:brightness-110 active:scale-[0.98] transition"
                >
                  Get Started
                </a>
              </div>

              <div className="mt-6 flex items-center gap-6 text-sm text-white/70">
                <div className="flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-emerald-400" />
                  Live near you
                </div>
                <div className="flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-sky-400" />
                  Fast search
                </div>
                <div className="flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-pink-400" />
                  Curated picks
                </div>
              </div>
            </div>

            {/* Right hero card */}
            <div className="relative">
              <div className="absolute inset-0 rounded-3xl bg-gradient-to-tr from-purple-500/30 via-pink-500/20 to-rose-500/30 blur-2xl" />
              <div className="relative rounded-3xl border border-white/10 bg-white/5 p-6 md:p-8 shadow-2xl">
                <GoogleMapClient
                  radiusKm={25}
                  containerClassName="w-full"
                  cardClassName="p-0 bg-transparent border-0 text-white"
                  mapClassName="h-80 rounded-2xl overflow-hidden border border-white/10"
                  title="Explore nearby businesses"
                />

                <div className="mt-6 rounded-2xl bg-gradient-to-r from-purple-600/30 to-pink-600/30 p-4 border border-white/10">
                  <div className="text-sm font-semibold">Want your business listed?</div>
                  <div className="text-xs text-white/70 mt-1">
                    Join YourBarrio and reach locals instantly.
                  </div>
                  <a
                    className="mt-3 inline-flex text-sm font-semibold underline underline-offset-4 hover:text-white"
                    href="http://localhost:3000/business"
                  >
                    Become a partner →
                  </a>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* HOW IT WORKS */}
        <section className="max-w-7xl mx-auto px-6 py-10 md:py-16">
          <h2 className="text-2xl md:text-3xl font-bold tracking-tight text-center">
            How it works
          </h2>
          <p className="text-center text-white/70 mt-2">
            Three simple steps to explore your city like a local.
          </p>

          <div className="mt-8 grid md:grid-cols-3 gap-5">
            {[
              {
                title: "Discover",
                desc: "Search for restaurants, stores, services, and hidden gems around you.",
              },
              {
                title: "Connect",
                desc: "Contact business owners and get the info you need instantly.",
              },
              {
                title: "Explore",
                desc: "Navigate your neighborhood with curated recommendations.",
              },
            ].map((c) => (
              <div
                key={c.title}
                className="rounded-2xl border border-white/10 bg-white/5 p-6 shadow-lg hover:bg-white/10 transition"
              >
                <div className="text-lg font-semibold">{c.title}</div>
                <p className="mt-2 text-sm md:text-base text-white/75 leading-relaxed">
                  {c.desc}
                </p>
              </div>
            ))}
          </div>
        </section>

        {/* CTA */}
        <section className="max-w-7xl mx-auto px-6 py-14 md:py-20">
          <div className="rounded-3xl border border-white/10 bg-gradient-to-r from-purple-700/30 via-fuchsia-700/20 to-rose-700/30 p-8 md:p-12 text-center shadow-2xl">
            <h3 className="text-2xl md:text-4xl font-extrabold tracking-tight">
              Ready to find what’s nearby?
            </h3>
            <p className="mt-3 text-white/80">
              Create your account and start exploring your neighborhood today.
            </p>
            <div className="mt-6 flex justify-center">
              <a
                href="/register"
                className="inline-flex items-center justify-center rounded-xl px-7 py-3 font-semibold bg-white text-black hover:bg-white/90 transition"
              >
                Sign Up Free
              </a>
            </div>
          </div>
        </section>

      </main>
    </>
  );
}
