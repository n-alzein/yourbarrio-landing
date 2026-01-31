"use client";

import { motion } from "framer-motion";

import {
  LightBulbIcon,
  MapIcon,
  ChatBubbleBottomCenterIcon,
} from "@heroicons/react/24/outline";
import { openBusinessAuthPopup } from "@/lib/openBusinessAuthPopup";

export default function BusinessAboutPage() {
  const handlePopup = (event) => {
    event.preventDefault();
    openBusinessAuthPopup("/business-auth/register");
  };

  return (
    <div className="min-h-screen text-white relative pt-8 px-6">
      <div className="absolute inset-0 -z-10 overflow-hidden">
        <div className="absolute inset-0 bg-[#05010d]" />
        <div className="absolute inset-0 bg-gradient-to-b from-purple-900/40 via-fuchsia-900/30 to-black" />
        <div className="yb-business-glow pointer-events-none absolute -top-32 -left-24 h-[420px] w-[420px] rounded-full bg-purple-600/30 blur-[120px]" />
        <div className="yb-business-glow pointer-events-none absolute top-40 -right-24 h-[480px] w-[480px] rounded-full bg-pink-500/30 blur-[120px]" />
      </div>
      {/* Header Section */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="max-w-4xl mx-auto text-center mb-20"
      >
        <h1 className="text-4xl md:text-6xl font-bold tracking-tight mb-4">
          About{" "}
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-500 to-rose-500">
            YourBarrio for Business
          </span>
        </h1>

        <p className="text-lg md:text-xl text-white/80 max-w-2xl mx-auto">
          The platform built to help businesses thrive locally.
        </p>
      </motion.div>

      {/* Feature Grid */}
      <div className="max-w-6xl mx-auto grid md:grid-cols-3 gap-10">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          viewport={{ once: true }}
          className="backdrop-blur-xl bg-white/10 border border-white/20 p-8 rounded-2xl shadow-xl"
        >
          <LightBulbIcon className="h-12 w-12 text-purple-300 mb-4" />
          <h3 className="text-xl font-semibold mb-2">Why YourBarrio?</h3>
          <p className="text-white/80 leading-relaxed">
            Reach local customers and grow your business with modern discovery tools.
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.1 }}
          viewport={{ once: true }}
          className="backdrop-blur-xl bg-white/10 border border-white/20 p-8 rounded-2xl shadow-xl"
        >
          <MapIcon className="h-12 w-12 text-pink-300 mb-4" />
          <h3 className="text-xl font-semibold mb-2">Local Presence</h3>
          <p className="text-white/80 leading-relaxed">
            Put your business on the map where customers can find you instantly.
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2 }}
          viewport={{ once: true }}
          className="backdrop-blur-xl bg-white/10 border border-white/20 p-8 rounded-2xl shadow-xl"
        >
          <ChatBubbleBottomCenterIcon className="h-12 w-12 text-rose-300 mb-4" />
          <h3 className="text-xl font-semibold mb-2">Customer Engagement</h3>
          <p className="text-white/80 leading-relaxed">
            Communicate with your community directly and build trust faster.
          </p>
        </motion.div>
      </div>

      {/* CTA */}
      <motion.div
        initial={{ opacity: 0 }}
        whileInView={{ opacity: 1 }}
        transition={{ duration: 0.8, delay: 0.3 }}
        viewport={{ once: true }}
        className="max-w-3xl mx-auto text-center mt-24 mb-20"
      >
        <h2 className="text-3xl md:text-4xl font-semibold mb-4">
          Grow with YourBarrio for Business
        </h2>
        <a
          href="/business-auth/register"
          onClick={handlePopup}
          className="inline-block px-8 py-3 rounded-xl font-semibold text-white text-lg bg-gradient-to-r from-purple-600 via-pink-500 to-rose-500 shadow-lg hover:scale-105 active:scale-95 transition-all"
        >
          Get Started →
        </a>
      </motion.div>
    </div>
  );
}
