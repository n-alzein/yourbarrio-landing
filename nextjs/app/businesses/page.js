"use client";

import { motion } from "framer-motion";
import {
  BuildingStorefrontIcon,
  MagnifyingGlassIcon,
  StarIcon,
} from "@heroicons/react/24/outline";

const businesses = [
  {
    name: "Cafe Aroma",
    category: "Coffee Shop",
    rating: 4.8,
    description: "Locally roasted coffee, artisan pastries, and a cozy atmosphere.",
  },
  {
    name: "FreshMart Grocery",
    category: "Supermarket",
    rating: 4.6,
    description: "Everyday essentials, organic produce, and local goods.",
  },
  {
    name: "FixIt Electronics",
    category: "Repair Shop",
    rating: 4.9,
    description: "Fast and reliable phone & laptop repair services.",
  },
];

export default function BusinessesPage() {
  return (
    <div className="min-h-screen text-white relative pt-32 px-6 max-w-7xl mx-auto">

      {/* Title */}
      <motion.h1
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="text-4xl md:text-5xl font-bold mb-10 text-center"
      >
        Explore Local Businesses
      </motion.h1>

      {/* Search Bar */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.15 }}
        className="flex items-center justify-center mb-12"
      >
        <div className="w-full max-w-xl relative">
          <input
            type="text"
            placeholder="Search nearby businesses..."
            className="w-full px-5 py-3 pl-12 rounded-xl bg-white/10 border border-white/20 text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-pink-400"
          />
          <MagnifyingGlassIcon className="h-5 w-5 absolute left-4 top-3.5 text-white/60" />
        </div>
      </motion.div>

      {/* Business Grid */}
      <div className="grid gap-8 md:grid-cols-3">

        {businesses.map((biz, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.4, delay: i * 0.15 }}
            className="p-6 rounded-2xl bg-white/10 backdrop-blur-xl border border-white/20 shadow-xl hover:scale-[1.03] transition cursor-pointer"
          >
            <div className="flex items-center gap-3 mb-3">
              <BuildingStorefrontIcon className="h-8 w-8 text-pink-300" />
              <h2 className="text-xl font-semibold">{biz.name}</h2>
            </div>

            <p className="text-white/70 text-sm mb-3">{biz.category}</p>

            <p className="text-white/80 text-sm mb-4">{biz.description}</p>

            {/* Rating */}
            <div className="flex items-center gap-1">
              <StarIcon className="h-5 w-5 text-yellow-400" />
              <span className="text-white/90 font-medium">{biz.rating}</span>
            </div>
          </motion.div>
        ))}

      </div>

      {/* Footer message */}
      <motion.p
        initial={{ opacity: 0 }}
        whileInView={{ opacity: 1 }}
        transition={{ duration: 0.6, delay: 0.4 }}
        className="text-center text-white/60 mt-16"
      >
        More businesses coming soon…
      </motion.p>
    </div>
  );
}
