// app/layout.js
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

import Footer from "@/components/Footer";
import ModalMount from "@/components/modals/ModalMount";
import { ThemeProvider } from "@/components/ThemeProvider";
import OverlayGuard from "@/components/OverlayGuard";
import DevOnlyNavRecorderLoader from "@/components/DevOnlyNavRecorderLoader";
import DebugToolsClient from "@/components/debug/DebugToolsClient";
import CrashLoggerClient from "@/components/CrashLoggerClient";
import { AuthProvider } from "@/components/AuthProvider";
import ScrollToTop from "@/components/ScrollToTop";
import { CartProvider } from "@/components/cart/CartProvider";

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
  other: {
    "yb-shell-root": "root",
  },
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" className="theme-light" data-scroll-behavior="smooth">
      <body
        className={[
          "relative min-h-screen overflow-x-hidden w-full antialiased text-white flex flex-col pt-20",
          geistSans.variable,
          geistMono.variable
        ].join(" ")}
      >
        <CrashLoggerClient />
        <ScrollToTop />
        <DevOnlyNavRecorderLoader />
        <ThemeProvider>
          <OverlayGuard />
          {/* GLOBAL BACKGROUND */}
          <div className="absolute inset-0 -z-10 overflow-hidden h-full">
            <div className="absolute inset-0" style={{ background: "var(--bg-solid)" }} />
            <div
              className="absolute inset-0"
              style={{
                background: "linear-gradient(to bottom, var(--bg-gradient-start), var(--bg-gradient-end))",
              }}
            />
            <div className="pointer-events-none absolute -top-32 -left-24 h-[420px] w-[420px] rounded-full blur-[120px] bg-[var(--glow-1)]" />
            <div className="pointer-events-none absolute top-40 -right-24 h-[480px] w-[480px] rounded-full blur-[120px] bg-[var(--glow-2)]" />
            <div className="animated-bg" />
          </div>

          <AuthProvider>
            <CartProvider>
              <ModalMount>
                {/* CONTENT */}
                <main className="flex-1 w-full min-h-screen">{children}</main>
                <Footer />
              </ModalMount>
            </CartProvider>
          </AuthProvider>
        </ThemeProvider>
        {/* DEBUG_CLICK_DIAG / NAV_TRACE */}
        <DebugToolsClient />
      </body>
    </html>
  );
}
