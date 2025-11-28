"use client";

import { motion } from "framer-motion";
import { LightBulbIcon, MapIcon, ChatBubbleBottomCenterIcon } from "@heroicons/react/24/outline";

export default function AboutPage() {
  return (
    <div className="min-h-screen text-white bg-gradient-to-b from-purple-600/20 via-pink-500/10 to-rose-500/20 pt-32 px-6">

      {/* Header Section */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="max-w-4xl mx-auto text-center mb-20"
      >
        <h1 className="text-4xl md:text-6xl font-bold tracking-tight mb-4">
          About <span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-500 to-rose-500">YourBarrio</span>
        </h1>

        <p className="text-lg md:text-xl text-white/80 max-w-2xl mx-auto">
          YourBarrio helps you discover the best local businesses, services, and hidden gems in your neighborhood —
          all in one place, beautifully organized and curated for convenience.
        </p>
      </motion.div>

      {/* Feature Grid */}
      <div className="max-w-6xl mx-auto grid md:grid-cols-3 gap-10">

        {/* Card 1 */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          viewport={{ once: true }}
          className="backdrop-blur-xl bg-white/10 border border-white/20 p-8 rounded-2xl shadow-lg"
        >
          <LightBulbIcon className="h-12 w-12 text-purple-300 mb-4" />
          <h3 className="text-xl font-semibold mb-2">Our Mission</h3>
          <p className="text-white/80 leading-relaxed">
            We believe neighborhoods thrive when people connect. Our mission is to make it incredibly easy for you
            to find trustworthy businesses and build community relationships.
          </p>
        </motion.div>

        {/* Card 2 */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.1 }}
          viewport={{ once: true }}
          className="backdrop-blur-xl bg-white/10 border border-white/20 p-8 rounded-2xl shadow-lg"
        >
          <MapIcon className="h-12 w-12 text-pink-300 mb-4" />
          <h3 className="text-xl font-semibold mb-2">What We Offer</h3>
          <p className="text-white/80 leading-relaxed">
            From restaurants and salons to home services and boutique stores — YourBarrio maps out what's around you
            and highlights the best recommendations.
          </p>
        </motion.div>

        {/* Card 3 */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2 }}
          viewport={{ once: true }}
          className="backdrop-blur-xl bg-white/10 border border-white/20 p-8 rounded-2xl shadow-lg"
        >
          <ChatBubbleBottomCenterIcon className="h-12 w-12 text-rose-300 mb-4" />
          <h3 className="text-xl font-semibold mb-2">Why It Matters</h3>
          <p className="text-white/80 leading-relaxed">
            People discover new places from people they trust — friends, neighbors, and locals.
            YourBarrio brings that trust online with a clean, modern experience.
          </p>
        </motion.div>

      </div>

      {/* Bottom Call to Action */}
      <motion.div
        initial={{ opacity: 0 }}
        whileInView={{ opacity: 1 }}
        transition={{ duration: 0.8, delay: 0.3 }}
        viewport={{ once: true }}
        className="max-w-3xl mx-auto text-center mt-24 mb-20"
      >
        <h2 className="text-3xl md:text-4xl font-semibold mb-4">
          Join Your Local Community
        </h2>
        <p className="text-white/80 text-lg mb-8">
          Whether you're a resident or a business owner, YourBarrio creates meaningful local connections.
        </p>

        <a
          href="/register"
          className="inline-block px-8 py-3 rounded-xl font-semibold text-white text-lg
                     bg-gradient-to-r from-purple-600 via-pink-500 to-rose-500
                     shadow-lg hover:scale-105 active:scale-95 transition-all"
        >
          Get Started
        </a>
      </motion.div>
    </div>
  );
}
