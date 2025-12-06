"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import { useAuth } from "@/components/AuthProvider";

export default function CustomerHomePage() {
    const { user, loadingUser } = useAuth();

    if (loadingUser) {
      return (
        <div className="min-h-screen flex items-center justify-center text-white pt-32">
          Loading...
        </div>
      );
    }
    
    const firstName = user?.full_name
      ? user.full_name.split(" ")[0]
      : "Welcome";
    

  return (
    <div className="min-h-screen text-white relative pt-32 px-6">

      {/* 🔥 Background (same as About / Businesses pages) */}
      <div className="absolute inset-0 -z-10 overflow-hidden">
        <div className="absolute inset-0 bg-[#05010d]" />
        <div className="absolute inset-0 bg-gradient-to-b from-purple-900/40 via-fuchsia-900/30 to-black" />

        {/* Glows */}
        <div className="pointer-events-none absolute -top-32 -left-24 h-[420px] w-[420px] rounded-full bg-purple-600/30 blur-[120px]" />
        <div className="pointer-events-none absolute top-40 -right-24 h-[480px] w-[480px] rounded-full bg-pink-500/30 blur-[120px]" />
      </div>

      {/* ====================================================== */}
      {/* HERO / GREETING */}
      {/* ====================================================== */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="max-w-4xl mx-auto text-center mb-20"
      >
        <h1 className="text-4xl md:text-6xl font-bold tracking-tight">
          {firstName},{" "}
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-pink-400">
            welcome back!
          </span>
        </h1>

        <p className="text-lg md:text-xl text-white/80 max-w-2xl mx-auto mt-4">
          Discover your neighborhood’s best local businesses — curated with a clean, modern experience made just for you.
        </p>
      </motion.div>

      {/* ====================================================== */}
      {/* DASHBOARD CARDS */}
      {/* ====================================================== */}

      <div className="max-w-6xl mx-auto grid md:grid-cols-3 gap-10">

        {/* Explore Businesses */}
        <motion.div
          initial={{ opacity: 0, y: 25 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          viewport={{ once: true }}
        >
          <Link href="/customer/businesses">
            <div className="group cursor-pointer p-8 rounded-2xl backdrop-blur-xl bg-white/10 border border-white/20 shadow-xl hover:bg-white/20 transition">
              <h3 className="text-2xl font-semibold mb-2">Explore Businesses</h3>
              <p className="text-white/70">
                Discover local restaurants, salons, services, and hidden gems near you.
              </p>
              <div className="mt-5 text-purple-300 group-hover:text-purple-200 font-medium">
                Browse now →
              </div>
            </div>
          </Link>
        </motion.div>

        {/* Saved Listings */}
        <motion.div
          initial={{ opacity: 0, y: 25 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
          viewport={{ once: true }}
        >
          <Link href="/customer/saved">
            <div className="group cursor-pointer p-8 rounded-2xl backdrop-blur-xl bg-white/10 border border-white/20 shadow-xl hover:bg-white/20 transition">
              <h3 className="text-2xl font-semibold mb-2">Saved Favorites</h3>
              <p className="text-white/70">
                Quickly access your bookmarked and favorite local spots.
              </p>
              <div className="mt-5 text-purple-300 group-hover:text-purple-200 font-medium">
                View saved →
              </div>
            </div>
          </Link>
        </motion.div>

        {/* Profile */}
        <motion.div
          initial={{ opacity: 0, y: 25 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
          viewport={{ once: true }}
        >
          <Link href="/profile">
            <div className="group cursor-pointer p-8 rounded-2xl backdrop-blur-xl bg-white/10 border border-white/20 shadow-xl hover:bg-white/20 transition">
              <h3 className="text-2xl font-semibold mb-2">Your Profile</h3>
              <p className="text-white/70">
                Update your info, manage your account, and customize preferences.
              </p>
              <div className="mt-5 text-purple-300 group-hover:text-purple-200 font-medium">
                Go to profile →
              </div>
            </div>
          </Link>
        </motion.div>

      </div>

      {/* ====================================================== */}
      {/* CTA */}
      {/* ====================================================== */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        whileInView={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.7 }}
        viewport={{ once: true }}
        className="max-w-3xl mx-auto text-center mt-32 mb-20"
      >
        <h2 className="text-3xl md:text-4xl font-semibold mb-4">
          Support Local. Explore Smart.
        </h2>

        <p className="text-white/80 text-lg mb-8">
          YourBarrio connects you to authentic local businesses — beautifully and effortlessly.
        </p>

        <Link
          href="/customer/businesses"
          className="inline-block px-8 py-3 rounded-xl font-semibold text-white text-lg bg-gradient-to-r from-purple-600 via-pink-500 to-rose-500 shadow-lg hover:scale-105 active:scale-95 transition-all"
        >
          Explore Near You
        </Link>
      </motion.div>

    </div>
  );
}
