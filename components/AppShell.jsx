"use client";

import Footer from "@/components/Footer";
import ModalMount from "@/components/modals/ModalMount";
import { ThemeProvider } from "@/components/ThemeProvider";
import OverlayGuard from "@/components/OverlayGuard";
import DevOnlyNavRecorderLoader from "@/components/DevOnlyNavRecorderLoader";
import DebugToolsClient from "@/components/debug/DebugToolsClient";
import CrashLoggerClient from "@/components/CrashLoggerClient";
import WebVitalsReporter from "@/components/WebVitalsReporter";
import { AuthProvider } from "@/components/AuthProvider";
import ScrollToTop from "@/components/ScrollToTop";
import { CartProvider } from "@/components/cart/CartProvider";

export default function AppShell({ children }) {
  return (
    <div className="relative min-h-screen overflow-x-hidden w-full antialiased text-white flex flex-col pt-20">
      <CrashLoggerClient />
      <WebVitalsReporter />
      <ScrollToTop />
      <DevOnlyNavRecorderLoader />
      <ThemeProvider>
        <OverlayGuard />
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
              <main className="flex-1 w-full min-h-screen">{children}</main>
              <Footer />
            </ModalMount>
          </CartProvider>
        </AuthProvider>
      </ThemeProvider>
      <DebugToolsClient />
    </div>
  );
}
