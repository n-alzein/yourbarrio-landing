"use client";

import { motion } from "framer-motion";
import {
  ScaleIcon,
  ShieldExclamationIcon,
  CheckBadgeIcon,
  BuildingStorefrontIcon,
  ChatBubbleLeftRightIcon,
  ClockIcon,
  HandThumbUpIcon,
  LifebuoyIcon,
} from "@heroicons/react/24/outline";
import CustomerNavbar from "@/components/navbars/CustomerNavbar";
import BusinessNavbar from "@/components/navbars/BusinessNavbar";
import { useAuth } from "@/components/AuthProvider";

const fade = {
  initial: { opacity: 0, y: 18 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.6 },
};

export default function TermsPage() {
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
      <motion.div {...fade} className="max-w-5xl mx-auto text-center mb-16">
        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-white/10 bg-white/5 text-sm text-white/80">
          <ScaleIcon className="h-4 w-4" />
          Terms of Service
          <span className="text-white/50">• Updated Feb 2025</span>
        </div>
        <h1 className="mt-6 text-4xl md:text-5xl font-bold tracking-tight">
          YourBarrio Terms &amp; Community Standards
        </h1>
        <p className="mt-4 text-lg text-white/80 max-w-3xl mx-auto leading-relaxed">
          These terms keep YourBarrio fair and safe for residents and business partners.
          By using the platform, you agree to the commitments below.
        </p>
      </motion.div>

      {/* SUMMARY */}
      <div className="max-w-6xl mx-auto grid lg:grid-cols-3 gap-6 mb-16">
        {[
          {
            title: "Who we serve",
            desc: "Residents discover local businesses; business owners manage listings, respond to messages, and showcase services.",
            icon: BuildingStorefrontIcon,
          },
          {
            title: "Your obligations",
            desc: "Provide accurate info, respect community guidelines, and use the platform for lawful purposes only.",
            icon: CheckBadgeIcon,
          },
          {
            title: "Our promise",
            desc: "Deliver reliable discovery tools, protect your account, and communicate policy updates transparently.",
            icon: ShieldExclamationIcon,
          },
        ].map(({ title, desc, icon: Icon }) => (
          <motion.div
            key={title}
            whileInView={{ opacity: 1, y: 0 }}
            initial={{ opacity: 0, y: 14 }}
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

      {/* TERMS DETAIL */}
      <div className="max-w-6xl mx-auto grid lg:grid-cols-2 gap-8 mb-16">
        <motion.div
          {...fade}
          transition={{ duration: 0.6, delay: 0.1 }}
          className="rounded-3xl border border-white/15 bg-white/5 p-8 shadow-2xl"
        >
          <h2 className="text-2xl font-bold">Core terms</h2>
          <div className="mt-4 space-y-4 text-white/80">
            <div className="rounded-2xl border border-white/10 p-4">
              <div className="font-semibold text-white">Eligibility</div>
              <p className="text-sm mt-1">
                You must be 18+ and legally able to enter agreements. Business owners
                must have authority to represent their company.
              </p>
            </div>
            <div className="rounded-2xl border border-white/10 p-4">
              <div className="font-semibold text-white">Account security</div>
              <p className="text-sm mt-1">
                Keep credentials confidential. Notify us immediately of unauthorized
                access so we can secure your account.
              </p>
            </div>
            <div className="rounded-2xl border border-white/10 p-4">
              <div className="font-semibold text-white">Acceptable use</div>
              <p className="text-sm mt-1">
                No spam, scraping, harassment, or misrepresentation. Respect local laws,
                IP rights, and community guidelines when posting content.
              </p>
            </div>
            <div className="rounded-2xl border border-white/10 p-4">
              <div className="font-semibold text-white">Listings & content</div>
              <p className="text-sm mt-1">
                Businesses are responsible for accuracy of hours, pricing, and service
                descriptions. We may moderate or remove content that breaks these terms.
              </p>
            </div>
          </div>
        </motion.div>

        <motion.div
          {...fade}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="rounded-3xl border border-white/15 bg-gradient-to-br from-purple-600/25 via-pink-600/20 to-rose-600/20 p-8 shadow-2xl"
        >
          <h2 className="text-2xl font-bold">Platform commitments</h2>
          <div className="mt-4 space-y-4 text-white/80">
            <div className="rounded-2xl bg-white/10 border border-white/10 p-4">
              <div className="font-semibold text-white">Reliability</div>
              <p className="text-sm mt-1">
                We aim for continuous uptime but occasional maintenance or outages may
                occur. Critical updates are communicated promptly.
              </p>
            </div>
            <div className="rounded-2xl bg-white/10 border border-white/10 p-4">
              <div className="font-semibold text-white">Payment & fees</div>
              <p className="text-sm mt-1">
                If paid features are enabled, pricing will be shown before purchase.
                Taxes may apply. All billing is handled securely.
              </p>
            </div>
            <div className="rounded-2xl bg-white/10 border border-white/10 p-4">
              <div className="font-semibold text-white">Privacy alignment</div>
              <p className="text-sm mt-1">
                Our <a className="underline underline-offset-4" href="/privacy">Privacy Policy</a>
                outlines data use, retention, and control. Using YourBarrio implies
                agreement to both policies.
              </p>
            </div>
            <div className="rounded-2xl bg-white/10 border border-white/10 p-4">
              <div className="font-semibold text-white">Termination</div>
              <p className="text-sm mt-1">
                We may suspend or end access for violations. You can close your account
                anytime; certain records may remain where required by law.
              </p>
            </div>
          </div>
        </motion.div>
      </div>

      {/* COMMUNITY & DISPUTES */}
      <div className="max-w-6xl mx-auto grid md:grid-cols-3 gap-6 mb-16">
        {[
          {
            title: "Community conduct",
            desc: "Be respectful in messages and reviews. We remove hateful, fraudulent, or abusive content to protect the neighborhood.",
            icon: ChatBubbleLeftRightIcon,
          },
          {
            title: "Limitation of liability",
            desc: "YourBarrio is provided “as is.” To the fullest extent permitted by law, we disclaim warranties and limit damages.",
            icon: HandThumbUpIcon,
          },
          {
            title: "Dispute resolution",
            desc: "Contact us first — we aim to resolve issues quickly. Where required, disputes will follow applicable local laws.",
            icon: ClockIcon,
          },
        ].map(({ title, desc, icon: Icon }) => (
          <motion.div
            key={title}
            whileInView={{ opacity: 1, y: 0 }}
            initial={{ opacity: 0, y: 12 }}
            transition={{ duration: 0.45 }}
            viewport={{ once: true }}
            className="rounded-2xl border border-white/10 bg-white/5 p-6 backdrop-blur-xl shadow-xl"
          >
            <div className="flex items-center gap-3">
              <div className="h-12 w-12 rounded-xl bg-white/10 border border-white/15 flex items-center justify-center">
                <Icon className="h-6 w-6 text-white" />
              </div>
              <div className="text-lg font-semibold">{title}</div>
            </div>
            <p className="mt-3 text-white/75 text-sm md:text-base leading-relaxed">
              {desc}
            </p>
          </motion.div>
        ))}
      </div>

      {/* SUPPORT */}
      <motion.div
        {...fade}
        transition={{ duration: 0.6, delay: 0.1 }}
        className="max-w-4xl mx-auto text-center rounded-3xl border border-white/12 bg-gradient-to-r from-purple-600/30 via-indigo-600/20 to-rose-600/25 p-10 shadow-2xl"
      >
        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-white/20 bg-white/10 text-sm text-white/80">
          <LifebuoyIcon className="h-4 w-4" />
          We keep you informed
        </div>
        <h3 className="mt-4 text-2xl md:text-3xl font-bold">Need clarity or a custom agreement?</h3>
        <p className="mt-3 text-white/80">
          Email <a className="underline underline-offset-4" href="mailto:legal@yourbarrio.com">legal@yourbarrio.com</a> for
          questions, partnership terms, or notice of potential issues. We respond
          quickly and post updates when these terms change.
        </p>
      </motion.div>
    </div>
    </>
  );
}
