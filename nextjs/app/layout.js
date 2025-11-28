import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

import { AuthProvider } from "@/components/AuthProvider";
import Footer from "@/components/Footer";
import Navbar from "@/components/Navbar";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata = {
  title: "YourBarrio – Find What You Need Nearby",
  description: "YourBarrio neighborhood discovery landing page",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body
        className={`relative min-h-screen pt-20 ${geistSans.variable} ${geistMono.variable} antialiased text-white`}
      >

        {/* 🌌 GLOBAL YOURBARRIO BACKGROUND */}
        <div className="absolute inset-0 -z-10 bg-[#05010d]" />
        <div className="absolute inset-0 -z-10 bg-gradient-to-b from-purple-900/40 via-fuchsia-900/30 to-black" />

        {/* Soft glowing blobs (same as landing page) */}
        <div className="pointer-events-none absolute -top-32 -left-24 h-[420px] w-[420px] rounded-full bg-purple-600/30 blur-[120px]" />
        <div className="pointer-events-none absolute top-40 -right-24 h-[480px] w-[480px] rounded-full bg-pink-500/30 blur-[120px]" />

        {/* Pre-existing animated background (if still needed) */}
        <div className="animated-bg" />

        {/* 🔥 AuthProvider wraps Navbar + children */}
        <AuthProvider>
          <Navbar />
          {children}
          <Footer />
        </AuthProvider>
      </body>
    </html>
  );
}
