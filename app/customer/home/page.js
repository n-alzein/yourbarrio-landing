"use client";

import { motion } from "framer-motion";
import { useAuth } from "@/components/AuthProvider";
import GoogleMapClient from "@/components/GoogleMapClient";

export default function CustomerHomePage() {
  const { user, loadingUser } = useAuth();

  if (loadingUser) {
    return (
      <div className="min-h-screen text-white relative pt-8 px-6">
        <div className="absolute inset-0 -z-10 overflow-hidden">
          <div className="absolute inset-0 bg-[#05010d]" />
          <div className="absolute inset-0 bg-gradient-to-b from-purple-900/40 via-fuchsia-900/30 to-black" />
          <div className="pointer-events-none absolute -top-32 -left-24 h-[420px] w-[420px] rounded-full bg-purple-600/30 blur-[120px]" />
          <div className="pointer-events-none absolute top-40 -right-24 h-[480px] w-[480px] rounded-full bg-pink-500/30 blur-[120px]" />
        </div>
        <div className="min-h-screen flex items-center justify-center">
          <div className="text-center space-y-3">
            <div className="h-12 w-12 rounded-full border-4 border-white/10 border-t-white/70 animate-spin mx-auto" />
            <p className="text-lg text-white/80">Loading your account...</p>
          </div>
        </div>
      </div>
    );
  }

  const firstName = user?.full_name
    ? user.full_name.split(" ")[0]
    : "Welcome";

  return (
    <div className="min-h-screen text-white relative pt-0 px-6">

      {/* Background */}
      <div className="absolute inset-0 -z-10 overflow-hidden">
        <div className="absolute inset-0 bg-[#05010d]" />
        <div className="absolute inset-0 bg-gradient-to-b from-purple-900/40 via-fuchsia-900/30 to-black" />
        <div className="pointer-events-none absolute -top-32 -left-24 h-[420px] w-[420px] rounded-full bg-purple-600/30 blur-[120px]" />
        <div className="pointer-events-none absolute top-40 -right-24 h-[480px] w-[480px] rounded-full bg-pink-500/30 blur-[120px]" />
      </div>

      <div className="max-w-6xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="flex flex-col gap-4 mb-10"
        >
          <div className="text-sm uppercase tracking-[0.22em] text-white/60">
            Quick start
          </div>
          <div className="flex flex-wrap items-baseline gap-3">
            <h1 className="text-3xl md:text-4xl font-bold tracking-tight">
              {firstName}, explore your barrio
            </h1>
            <span className="text-sm px-3 py-1 rounded-full border border-white/15 bg-white/5 text-white/80">
              Live view, curated picks, instant access
            </span>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.65, delay: 0.1 }}
          className="rounded-3xl border border-white/12 bg-white/5 backdrop-blur-2xl shadow-2xl overflow-hidden"
        >
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 px-6 pt-6">
            <div>
              <div className="text-xs uppercase tracking-[0.25em] text-white/60">Map</div>
              <div className="text-2xl font-semibold">See what’s open near you</div>
              <p className="text-sm text-white/70 mt-1">Live discovery within 25km — drag, zoom, and tap to connect.</p>
            </div>
          </div>
          <div className="p-4">
            <GoogleMapClient
              radiusKm={25}
              showBusinessErrors={false}
              containerClassName="w-full"
              cardClassName="bg-transparent border-0 text-white"
              mapClassName="h-[520px] rounded-2xl overflow-hidden border border-white/10"
              title=""
              enableCategoryFilter
              enableSearch
            />
          </div>
        </motion.div>
      </div>
    </div>
  );
}
