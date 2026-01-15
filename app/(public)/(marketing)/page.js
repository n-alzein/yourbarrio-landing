"use client";

import { useEffect } from "react";
import { useModal } from "@/components/modals/ModalProvider";
import { useTheme } from "@/components/ThemeProvider";
import { useAuth } from "@/components/AuthProvider";
import { useRouter } from "next/navigation";

export default function HomePage() {
  const { openModal } = useModal();
  const { theme, hydrated } = useTheme();
  const { user, authUser, loadingUser } = useAuth();
  const router = useRouter();
  const isLight = hydrated ? theme === "light" : true;

  // Client-side guard: if already signed in, push to customer home to avoid public navbar
  useEffect(() => {
    if (loadingUser) return;
    if (user || authUser) {
      router.replace("/customer/home");
    }
  }, [authUser, loadingUser, router, user]);

  return (
    <>
      {/* Private beta banner */}
      <div className="fixed top-20 inset-x-0 z-40">
        <div className="bg-gradient-to-r from-amber-500 via-amber-500 to-amber-400 text-slate-950 border-b border-amber-300 shadow-lg shadow-amber-900/25">
          <div className="w-full px-5 sm:px-6 md:px-8 lg:px-12 xl:px-14">
            <div className="max-w-7xl mx-auto py-3 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
              <div className="flex items-center gap-3 text-sm md:text-base font-semibold">
                <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-white/70 text-lg">
                  🚧
                </span>
                <span>YourBarrio is currently in private beta</span>
                <span className="px-2.5 py-1 text-xs font-bold uppercase tracking-wide rounded-full bg-slate-900/80 text-amber-100 border border-slate-900/60">
                  Limited access
                </span>
              </div>

              <div className="text-xs md:text-sm text-slate-900/80">
                Some experiences and listings are still rolling out while we onboard early neighbors.
              </div>
            </div>
          </div>
        </div>
      </div>

      <main className="relative min-h-screen text-white pt-24">

        {/* HERO */}
        <section className="w-full px-5 sm:px-6 md:px-8 lg:px-12 xl:px-14 pb-16 md:pb-24">
          <div className="max-w-7xl mx-auto">
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
                  Shop and order from neighborhood favorites with delivery or pickup.
                  Support local businesses without losing the convenience you expect.
                </p>

                <div className="mt-7 flex flex-col sm:flex-row gap-3">
                  <button
                    type="button"
                    onClick={() => openModal("customer-signup")}
                    className="inline-flex items-center justify-center rounded-xl px-6 py-3 font-semibold bg-gradient-to-r from-purple-600 via-pink-500 to-rose-500 shadow-lg shadow-purple-500/30 hover:brightness-110 active:scale-[0.98] transition"
                  >
                    Start Shopping Local
                  </button>
                </div>

                <div className="mt-6 flex flex-wrap items-center gap-3 md:gap-6 text-sm text-white/70">
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
                <div
                  className={`absolute inset-0 rounded-3xl bg-gradient-to-tr blur-2xl ${
                    isLight
                      ? "from-indigo-500/20 via-sky-500/15 to-slate-800/20"
                      : "from-purple-500/30 via-pink-500/20 to-rose-500/30"
                  }`}
                />
                <div className="relative rounded-3xl border border-white/10 bg-white/5 p-6 md:p-8 shadow-2xl">
                  <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
                    <div className="text-xs uppercase tracking-[0.22em] text-white/60">
                      Buy local, anytime
                    </div>
                    <div className="mt-3 text-2xl md:text-3xl font-bold">
                      Delivery or pickup from the spots you love.
                    </div>
                    <p className="mt-3 text-sm md:text-base text-white/75 leading-relaxed">
                      From coffee runs to home services, YourBarrio keeps your
                      dollars in the neighborhood while saving you time.
                    </p>

                    <div className="mt-5 grid grid-cols-2 gap-3 text-sm">
                      <div className="rounded-xl border border-white/10 bg-white/5 px-3 py-3">
                        <div className="font-semibold">Fast delivery</div>
                        <div className="text-xs text-white/65 mt-1">
                          Order from nearby favorites.
                        </div>
                      </div>
                      <div className="rounded-xl border border-white/10 bg-white/5 px-3 py-3">
                        <div className="font-semibold">Easy pickup</div>
                        <div className="text-xs text-white/65 mt-1">
                          Skip the wait, grab and go.
                        </div>
                      </div>
                    </div>
                  </div>

                  <div
                    className={`mt-6 rounded-2xl bg-gradient-to-r p-4 border border-white/10 ${
                      isLight
                        ? "from-indigo-600/25 to-sky-600/25"
                        : "from-purple-600/30 to-pink-600/30"
                    }`}
                  >
                    <div className="text-sm font-semibold">Want your business listed?</div>
                    <div className="text-xs text-white/70 mt-1">
                      Join YourBarrio and reach locals instantly.
                    </div>
                    <a
                      className="mt-3 inline-flex text-sm font-semibold underline underline-offset-4 hover:text-white"
                      href="/business"
                    >
                      Become a partner →
                    </a>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* HOW IT WORKS */}
        <section className="w-full px-5 sm:px-6 md:px-8 lg:px-12 xl:px-14 py-10 md:py-16">
          <div className="max-w-7xl mx-auto">
            <h2 className="text-2xl md:text-3xl font-bold tracking-tight text-center">
              How it works
            </h2>
            <p className="text-center text-white/70 mt-2">
              Three simple steps to shop local on your schedule.
            </p>

            <div className="mt-8 grid md:grid-cols-3 gap-5">
              {[
                {
                  title: "Browse",
                  desc: "Shop neighborhood restaurants, stores, and services in one place.",
                },
                {
                  title: "Order",
                  desc: "Choose delivery or pickup with transparent timing.",
                },
                {
                  title: "Support",
                  desc: "Keep your spend in the community and build local relationships.",
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
          </div>
        </section>

        {/* CTA */}
        <section className="w-full px-5 sm:px-6 md:px-8 lg:px-12 xl:px-14 py-14 md:py-20">
          <div className="max-w-7xl mx-auto">
            <div
              className={`rounded-3xl border border-white/10 bg-gradient-to-r p-8 md:p-12 text-center shadow-2xl ${
                isLight
                  ? "from-indigo-600/20 via-sky-600/15 to-slate-700/20"
                  : "from-purple-700/30 via-fuchsia-700/20 to-rose-700/30"
              }`}
            >
              <h3 className="text-2xl md:text-4xl font-extrabold tracking-tight">
                Ready to buy local tonight?
              </h3>
              <p className="mt-3 text-white/80">
                Create your account and order from nearby businesses with delivery or pickup.
              </p>
              <div className="mt-6 flex justify-center">
                <button
                  type="button"
                  onClick={() => openModal("customer-signup")}
                  className="inline-flex items-center justify-center rounded-xl px-7 py-3 font-semibold bg-white text-black hover:bg-white/90 transition"
                >
                  Start Ordering
                </button>
              </div>
            </div>
          </div>
        </section>

      </main>
    </>
  );
}
