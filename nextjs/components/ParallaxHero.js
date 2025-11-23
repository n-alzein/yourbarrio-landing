"use client";

import { motion, useScroll, useTransform } from "framer-motion";

export default function ParallaxHero({ children }) {
  const { scrollY } = useScroll();

  // Move gradient slightly for a parallax effect
  const y = useTransform(scrollY, [0, 500], [0, 120]);

  return (
    <motion.div style={{ y }} className="absolute inset-0 opacity-90">
      {children}
    </motion.div>
  );
}
