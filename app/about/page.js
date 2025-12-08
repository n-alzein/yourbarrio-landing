"use client";

import PublicNavbar from "@/components/navbars/PublicNavbar";
import { motion } from "framer-motion";
import { useModal } from "@/components/modals/ModalProvider";

import {
  LightBulbIcon,
  MapIcon,
  ChatBubbleBottomCenterIcon,
} from "@heroicons/react/24/outline";

export default function AboutPage() {
  const { openModal } = useModal();

  return (
    <>
      {/* Public Navbar */}
      <PublicNavbar />

      <div className="min-h-screen text-white relative pt-28 px-6">

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
              YourBarrio
            </span>
          </h1>

          <p className="text-lg md:text-xl text-white/80 max-w-2xl mx-auto">
            YourBarrio helps you discover the best local businesses, services,
            and hidden gems in your neighborhood — all in one place.
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
            className="backdrop-blur-xl bg-white/10 border border-white/20 p-8 rounded-2xl shadow-xl"
          >
            <LightBulbIcon className="h-12 w-12 text-purple-300 mb-4" />
            <h3 className="text-xl font-semibold mb-2">Our Mission</h3>
            <p className="text-white/80 leading-relaxed">
              We believe neighborhoods thrive when people connect. Our mission is
              to make it incredibly easy for you to find trustworthy businesses
              and build meaningful relationships.
            </p>
          </motion.div>

          {/* Card 2 */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.1 }}
            viewport={{ once: true }}
            className="backdrop-blur-xl bg-white/10 border border-white/20 p-8 rounded-2xl shadow-xl"
          >
            <MapIcon className="h-12 w-12 text-pink-300 mb-4" />
            <h3 className="text-xl font-semibold mb-2">What We Offer</h3>
            <p className="text-white/80 leading-relaxed">
              From restaurants and salons to home services — YourBarrio maps
              what's around you and highlights the best local gems.
            </p>
          </motion.div>

          {/* Card 3 */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            viewport={{ once: true }}
            className="backdrop-blur-xl bg-white/10 border border-white/20 p-8 rounded-2xl shadow-xl"
          >
            <ChatBubbleBottomCenterIcon className="h-12 w-12 text-rose-300 mb-4" />
            <h3 className="text-xl font-semibold mb-2">Why It Matters</h3>
            <p className="text-white/80 leading-relaxed">
              People discover places from people they trust. YourBarrio brings
              that trust online with a beautifully curated experience.
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
            Join Your Local Community
          </h2>
          <p className="text-white/80 text-lg mb-8">
            Whether you're a resident or a business owner, YourBarrio helps
            strengthen local connections.
          </p>

          <button
            type="button"
            onClick={() => openModal("customer-signup")}
            className="inline-block px-8 py-3 rounded-xl font-semibold text-white text-lg bg-gradient-to-r from-purple-600 via-pink-500 to-rose-500 shadow-lg hover:scale-105 active:scale-95 transition-all"
          >
            Get Started
          </button>
        </motion.div>
      </div>
    </>
  );
}
