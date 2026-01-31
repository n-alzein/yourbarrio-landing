import { ArrowRight } from "lucide-react";
import BusinessAuthPopupLink from "@/components/business/BusinessAuthPopupLink";

export default function BusinessHome() {
  return (
    <div className="min-h-screen text-white relative pt-8 px-6 pb-24">

      {/* ------------------------------------------------------------ */}
      {/* 🔥 SAME BACKGROUND AS ABOUT PAGE */}
      {/* ------------------------------------------------------------ */}
      <div className="absolute inset-0 -z-10 overflow-hidden">
        <div className="absolute inset-0 bg-[#05010d]" />
        <div className="absolute inset-0 bg-gradient-to-b from-purple-900/40 via-fuchsia-900/30 to-black" />
        <div className="yb-business-glow pointer-events-none absolute -top-32 -left-24 h-[420px] w-[420px] rounded-full bg-purple-600/30 blur-[120px]" />
        <div className="yb-business-glow pointer-events-none absolute top-40 -right-24 h-[480px] w-[480px] rounded-full bg-pink-500/30 blur-[120px]" />
      </div>

      {/* ------------------------------------------------------------ */}
      {/* HERO SECTION */}
      {/* ------------------------------------------------------------ */}
      <section className="max-w-6xl mx-auto text-center">
        <h1 className="text-4xl md:text-6xl font-extrabold tracking-tight">
          YourBarrio <span className="text-pink-400">for Business</span>
        </h1>

        <p className="text-lg md:text-2xl text-white/80 max-w-3xl mx-auto mt-6 leading-relaxed">
          Reach more local customers, grow your visibility, and thrive in your neighborhood.
          YourBarrio helps small businesses stand out in a world dominated by large corporations.
        </p>

        <div className="mt-10 flex flex-col md:flex-row gap-6 justify-center">
          <BusinessAuthPopupLink
            href="/business-auth/register"
            className="px-8 py-4 bg-white text-black font-bold rounded-xl text-lg hover:bg-gray-200 active:scale-95 transition shadow-lg"
          >
            Create a Business Account
          </BusinessAuthPopupLink>

          <BusinessAuthPopupLink
            href="/business-auth/login"
            className="px-8 py-4 bg-gradient-to-r from-purple-600 via-pink-500 to-rose-500 rounded-xl text-lg font-bold shadow-lg hover:brightness-110 active:scale-95 transition"
          >
            Business Login
          </BusinessAuthPopupLink>
        </div>
      </section>

      {/* ------------------------------------------------------------ */}
      {/* VISION SECTION */}
      {/* ------------------------------------------------------------ */}
      <section
        className="max-w-5xl mx-auto px-6 mt-28 yb-fade-in"
        style={{ contentVisibility: "auto", containIntrinsicSize: "520px" }}
      >
        <h2 className="text-3xl md:text-4xl font-bold text-center mb-8">
          Our Vision
        </h2>

        <p className="text-white/80 text-lg leading-relaxed text-center max-w-3xl mx-auto">
          YourBarrio exists to strengthen local communities by helping small businesses
          compete with big-box retailers like Walmart, Target, and Amazon.
          Local businesses bring character, culture, and connection — and they deserve
          modern tools to thrive in the digital age.
        </p>

        <p className="text-white/80 text-lg leading-relaxed text-center max-w-3xl mx-auto mt-6">
          Whether you&apos;re a restaurant, barber shop, boutique, contractor, or service provider,
          YourBarrio increases your local exposure and connects you directly with nearby customers.
        </p>
      </section>

      {/* ------------------------------------------------------------ */}
      {/* VALUE PROPOSITIONS */}
      {/* ------------------------------------------------------------ */}
      <div
        className="max-w-6xl mx-auto px-6 mt-32 grid grid-cols-1 md:grid-cols-3 gap-16 overflow-visible"
        style={{ contentVisibility: "auto", containIntrinsicSize: "720px" }}
      >
        <div className="yb-business-card backdrop-blur-xl bg-white/10 border border-white/20 p-8 rounded-2xl shadow-xl yb-fade-up overflow-visible">
          <h3 className="text-2xl font-bold mb-4">Increase Local Visibility</h3>
          <p className="text-white/80">
            Your business appears where it matters most — directly in front of people searching
            for what you offer, right in your area.
          </p>
        </div>

        <div
          className="yb-business-card backdrop-blur-xl bg-white/10 border border-white/20 p-8 rounded-2xl shadow-xl yb-fade-up overflow-visible"
          style={{ animationDelay: "120ms" }}
        >
          <h3 className="text-2xl font-bold mb-4">Compete With Big Retailers</h3>
          <p className="text-white/80">
            Level the playing field. YourBarrio highlights local businesses,
            helping you attract customers who want to support their community.
          </p>
        </div>

        <div
          className="yb-business-card backdrop-blur-xl bg-white/10 border border-white/20 p-8 rounded-2xl shadow-xl yb-fade-up overflow-visible"
          style={{ animationDelay: "220ms" }}
        >
          <h3 className="text-2xl font-bold mb-4">Simple, Modern Tools</h3>
          <p className="text-white/80">
            Manage your business listings, photos, and customer interactions —
            all from one clean, easy-to-use dashboard.
          </p>
        </div>

      </div>

      {/* ------------------------------------------------------------ */}
      {/* CALL TO ACTION */}
      {/* ------------------------------------------------------------ */}
      <section
        className="max-w-3xl mx-auto text-center mt-32 yb-fade-in"
        style={{ animationDelay: "160ms", contentVisibility: "auto", containIntrinsicSize: "360px" }}
      >
        <h2 className="text-3xl md:text-4xl font-semibold mb-4">
          Start Growing Your Local Reach
        </h2>

        <p className="text-white/80 text-lg mb-10">
          Create a business account and join the platform designed to help
          your neighborhood discover you.
        </p>

        <BusinessAuthPopupLink
          href="/business-auth/register"
          className="inline-flex items-center gap-2 px-8 py-4 rounded-xl font-bold text-lg text-white bg-gradient-to-r from-purple-600 via-pink-500 to-rose-500 shadow-lg hover:scale-105 active:scale-95 transition-all"
        >
          Get Started <ArrowRight className="h-5 w-5" />
        </BusinessAuthPopupLink>
      </section>

    </div>
  );
}
