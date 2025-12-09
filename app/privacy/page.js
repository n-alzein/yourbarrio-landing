"use client";

import { motion } from "framer-motion";
import {
  ShieldCheckIcon,
  LockClosedIcon,
  SparklesIcon,
  GlobeAltIcon,
  UserCircleIcon,
  BellAlertIcon,
  DevicePhoneMobileIcon,
  EnvelopeIcon,
} from "@heroicons/react/24/outline";
import CustomerNavbar from "@/components/navbars/CustomerNavbar";
import BusinessNavbar from "@/components/navbars/BusinessNavbar";
import { useAuth } from "@/components/AuthProvider";

const fadeIn = {
  initial: { opacity: 0, y: 16 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.6 },
};

export default function PrivacyPage() {
  const { user, role, loadingUser } = useAuth();

  const navbarShell = (
    <div className="fixed top-0 inset-x-0 z-50 h-20 bg-gradient-to-r from-purple-950/80 via-purple-900/60 to-fuchsia-900/70 backdrop-blur-xl border-b border-white/10 theme-lock" />
  );

  const renderNavbar = () => {
    if (loadingUser) return navbarShell;
    if (role === "business") return <BusinessNavbar />;
    if (user) return <CustomerNavbar />;
    return null;
  };

  return (
    <>
      {renderNavbar()}
      <div className="min-h-screen text-white relative pt-28 pb-16 px-6">
      {/* HERO */}
      <motion.div
        {...fadeIn}
        className="max-w-5xl mx-auto text-center mb-16"
      >
        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-white/10 bg-white/5 text-sm text-white/80">
          <ShieldCheckIcon className="h-4 w-4" />
          Privacy first, always
          <span className="text-white/50">• Updated Feb 2025</span>
        </div>
        <h1 className="mt-6 text-4xl md:text-5xl font-bold tracking-tight">
          YourBarrio Privacy &amp; Data Stewardship
        </h1>
        <p className="mt-4 text-lg text-white/80 max-w-3xl mx-auto leading-relaxed">
          Your trust powers the neighborhood. We design every feature with data
          respect, transparency, and control so you can discover local businesses
          with confidence.
        </p>
        <div className="mt-8 grid sm:grid-cols-3 gap-4 max-w-3xl mx-auto">
          {[
            { label: "No resale", desc: "We never sell personal data." },
            { label: "Clear consent", desc: "Location is opt-in and revocable." },
            { label: "Secure by design", desc: "Encryption in transit & at rest." },
          ].map((item) => (
            <div
              key={item.label}
              className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white/70"
            >
              <div className="font-semibold text-white">{item.label}</div>
              <div className="mt-1">{item.desc}</div>
            </div>
          ))}
        </div>
      </motion.div>

      {/* PRINCIPLES */}
      <div className="max-w-6xl mx-auto grid md:grid-cols-3 gap-6 mb-16">
        {[
          {
            title: "Data minimization",
            desc: "We collect only what’s needed to show nearby recommendations, streamline support, and improve product reliability.",
            icon: GlobeAltIcon,
          },
          {
            title: "Control & clarity",
            desc: "Privacy controls live in your account settings. Export or delete your data anytime — requests are honored quickly.",
            icon: UserCircleIcon,
          },
          {
            title: "Protection",
            desc: "Encryption protects personal info in transit and at rest. Access is role-based, logged, and reviewed regularly.",
            icon: LockClosedIcon,
          },
        ].map(({ title, desc, icon: Icon }) => (
          <motion.div
            key={title}
            whileInView={{ opacity: 1, y: 0 }}
            initial={{ opacity: 0, y: 16 }}
            transition={{ duration: 0.5 }}
            viewport={{ once: true }}
            className="backdrop-blur-xl bg-white/10 border border-white/15 p-6 rounded-2xl shadow-xl"
          >
            <div className="flex items-center gap-3">
              <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-purple-500/30 to-pink-500/30 flex items-center justify-center border border-white/15">
                <Icon className="h-6 w-6 text-white" />
              </div>
              <div className="text-lg font-semibold">{title}</div>
            </div>
            <p className="mt-3 text-white/75 leading-relaxed text-sm md:text-base">
              {desc}
            </p>
          </motion.div>
        ))}
      </div>

      {/* DATA USE */}
      <div className="max-w-6xl mx-auto grid lg:grid-cols-2 gap-8 mb-16">
        <motion.div
          {...fadeIn}
          transition={{ duration: 0.6, delay: 0.1 }}
          className="rounded-3xl border border-white/15 bg-gradient-to-br from-purple-600/25 via-pink-600/20 to-rose-600/20 p-8 shadow-2xl"
        >
          <div className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-white/80">
            <SparklesIcon className="h-5 w-5" />
            What we collect
          </div>
          <div className="mt-4 space-y-4 text-white/80">
            <div className="rounded-2xl bg-white/10 border border-white/10 p-4">
              <div className="font-semibold text-white">Account basics</div>
              <p className="text-sm mt-1">
                Name, email, password hashes, and preferences you choose to share.
              </p>
            </div>
            <div className="rounded-2xl bg-white/10 border border-white/10 p-4">
              <div className="font-semibold text-white">Location (optional)</div>
              <p className="text-sm mt-1">
                Only when you grant permission to improve nearby results. You can
                disable this anytime in your device settings.
              </p>
            </div>
            <div className="rounded-2xl bg-white/10 border border-white/10 p-4">
              <div className="font-semibold text-white">Product interactions</div>
              <p className="text-sm mt-1">
                Searches, saves, and messages to support better recommendations and
                resolve support requests quickly.
              </p>
            </div>
          </div>
        </motion.div>

        <motion.div
          {...fadeIn}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="rounded-3xl border border-white/15 bg-white/5 p-8 shadow-2xl"
        >
          <div className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-white/80">
            <BellAlertIcon className="h-5 w-5" />
            How we use it
          </div>
          <div className="mt-4 space-y-4 text-white/80">
            <div className="rounded-2xl border border-white/10 p-4">
              <div className="font-semibold text-white">Personalize discovery</div>
              <p className="text-sm mt-1">
                Show relevant nearby businesses, trending picks, and saved places
                across devices.
              </p>
            </div>
            <div className="rounded-2xl border border-white/10 p-4">
              <div className="font-semibold text-white">Protect the community</div>
              <p className="text-sm mt-1">
                Prevent fraud, secure accounts, and enforce community guidelines for
                residents and business owners.
              </p>
            </div>
            <div className="rounded-2xl border border-white/10 p-4">
              <div className="font-semibold text-white">Support & operations</div>
              <p className="text-sm mt-1">
                Troubleshoot issues, improve performance, and comply with legal
                obligations where required.
              </p>
            </div>
          </div>
        </motion.div>
      </div>

      {/* CONTROL SECTION */}
      <div className="max-w-6xl mx-auto mb-16">
        <motion.div {...fadeIn} className="rounded-3xl border border-white/10 bg-white/5 p-8 shadow-2xl">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <div className="text-sm font-semibold uppercase tracking-wide text-white/70">
                Your controls
              </div>
              <h2 className="text-2xl md:text-3xl font-bold mt-1">
                You decide what stays, moves, or goes
              </h2>
              <p className="text-white/75 mt-2 max-w-2xl">
                Manage privacy directly in YourBarrio. Adjust permissions, export
                your data, or ask us to delete your account — we act fast and confirm
                when it’s done.
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              {[
                "Download your data",
                "Delete account",
                "Opt out of marketing",
                "Revoke location access",
              ].map((item) => (
                <span
                  key={item}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-white/15 bg-white/5 text-sm"
                >
                  <DevicePhoneMobileIcon className="h-4 w-4" />
                  {item}
                </span>
              ))}
            </div>
          </div>

          <div className="mt-6 grid md:grid-cols-3 gap-4">
            {[
              "We keep request receipts and send confirmations.",
              "We retain minimal logs for security and compliance.",
              "You can contact privacy@yourbarrio.com for custom requests.",
            ].map((note) => (
              <div
                key={note}
                className="rounded-2xl border border-white/10 bg-white/5 p-4 text-white/75 text-sm"
              >
                {note}
              </div>
            ))}
          </div>
        </motion.div>
      </div>

      {/* QUESTIONS */}
      <motion.div
        {...fadeIn}
        transition={{ duration: 0.6, delay: 0.1 }}
        className="max-w-4xl mx-auto text-center rounded-3xl border border-white/10 bg-gradient-to-r from-purple-600/30 via-sky-600/20 to-rose-600/25 p-10 shadow-2xl"
      >
        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-white/20 bg-white/10 text-sm text-white/80">
          <EnvelopeIcon className="h-4 w-4" />
          We respond quickly
        </div>
        <h3 className="mt-4 text-2xl md:text-3xl font-bold">Questions or requests?</h3>
        <p className="mt-3 text-white/80">
          Email <a className="underline underline-offset-4" href="mailto:privacy@yourbarrio.com">privacy@yourbarrio.com</a>.
          We clarify any clause, fulfill data requests, and share updates as our
          product evolves.
        </p>
      </motion.div>
    </div>
    </>
  );
}
