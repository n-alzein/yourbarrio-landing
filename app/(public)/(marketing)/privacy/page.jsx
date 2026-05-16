import SmoothHashLink from "@/components/marketing/SmoothHashLink";

export const metadata = {
  title: "Privacy Policy | YourBarrio",
  description:
    "Privacy policy explaining how YourBarrio collects, uses, shares, and protects marketplace information.",
};

const summaryCards = [
  {
    title: "We do not sell personal data",
    body: "Your personal information is not sold to third parties.",
  },
  {
    title: "Location is optional",
    body: "Location access helps improve nearby results, but you can revoke it anytime.",
  },
  {
    title: "You control your data",
    body: "You can request access, deletion, or updates to your information.",
  },
];

const sections = [
  {
    id: "information-we-collect",
    title: "Information we collect",
    body: [
      "We collect information needed to operate YourBarrio, support customers and local businesses, and keep the marketplace reliable and safe.",
    ],
    bullets: [
      "Account basics, such as name, email, password hashes, account preferences, and settings.",
      "Business profile information, such as business name, contact details, location or service area, verification details, listings, photos, and product information.",
      "Marketplace activity, such as searches, saves, cart activity, orders, messages, reviews, support requests, and related interactions.",
      "Device and usage information, such as browser, device type, pages visited, performance logs, and security events.",
    ],
  },
  {
    id: "how-we-use-information",
    title: "How we use information",
    body: [
      "We use information to provide the marketplace experience, make local discovery useful, and protect customers, businesses, and the platform.",
    ],
    bullets: [
      "Operate the marketplace and maintain account, business, listing, cart, order, messaging, and support features.",
      "Show relevant nearby businesses, listings, and marketplace results.",
      "Process orders and support pickup, customer service, and business operations.",
      "Prevent fraud, abuse, spam, unsafe marketplace activity, and policy violations.",
      "Improve reliability, performance, product features, search quality, and customer support.",
      "Communicate account, order, policy, product, and support updates.",
      "Comply with legal obligations and enforce our terms and marketplace policies.",
    ],
  },
  {
    id: "location-information",
    title: "Location information",
    body: [
      "Location access is optional unless a specific marketplace feature needs it to work. You may manually select a city or location instead of granting device location access.",
      "When you give permission, device location may help show nearby listings and businesses. You can revoke location permission at any time in your device or browser settings.",
    ],
  },
  {
    id: "sharing-and-disclosure",
    title: "Sharing and disclosure",
    body: [
      "We do not sell personal data. We share information only where needed to operate YourBarrio, fulfill marketplace activity, comply with law, or protect the platform and community.",
    ],
    bullets: [
      "We may share limited information with businesses when needed to fulfill orders, pickup, customer service, or marketplace communication.",
      "Service providers may process information for hosting, payments, messaging, analytics, fraud prevention, security, and support.",
      "We may disclose information when required by law or when necessary to protect YourBarrio, users, businesses, or the public.",
    ],
  },
  {
    id: "cookies-analytics-product-insights",
    title: "Cookies, analytics, and product insights",
    body: [
      "Cookies, session storage, and similar technologies may help keep you signed in, remember preferences, protect accounts, measure product reliability, and understand how the platform is working.",
      "We use analytics and product insights to improve YourBarrio, including performance, search quality, customer flows, business tools, and support experiences.",
    ],
  },
  {
    id: "data-retention",
    title: "Data retention",
    body: [
      "We keep information only as long as needed for marketplace operation, legal compliance, security, dispute resolution, and business records.",
      "Some records, such as order history, support logs, fraud prevention logs, and transaction records, may be retained longer where required or appropriate.",
    ],
  },
  {
    id: "your-choices-and-controls",
    title: "Your choices and controls",
    body: [
      "You have choices about how your information is used and maintained. Some controls are available directly in YourBarrio, and support can help with custom privacy requests.",
    ],
    bullets: [
      "Update account information and preferences.",
      "Revoke location access in your device or browser settings.",
      "Opt out of marketing communications where available.",
      "Request access, export, updates, or deletion of your information.",
      "Delete your account where supported.",
      "Contact support for privacy requests that are not available in product settings.",
    ],
  },
  {
    id: "security",
    title: "Security",
    body: [
      "YourBarrio uses safeguards designed to protect information, including encryption in transit and at rest where appropriate, role-based access controls, and logging or review of sensitive access.",
      "No system can be guaranteed 100% secure, but we work to protect information and respond responsibly to security concerns.",
    ],
  },
  {
    id: "childrens-privacy",
    title: "Children's privacy",
    body: [
      "YourBarrio is not intended for children under 13, and we do not knowingly collect personal data from children under 13.",
      "If you believe a child under 13 may have provided personal information to YourBarrio, contact us so we can review and respond.",
    ],
  },
  {
    id: "changes-to-this-policy",
    title: "Changes to this policy",
    body: [
      "We may update this Privacy Policy as YourBarrio evolves, including to reflect new features, supported locations, security practices, legal requirements, or marketplace operations.",
      "Material changes may be communicated through the site, app, or email where appropriate. The Updated date reflects the latest version of this policy.",
    ],
  },
  {
    id: "contact-us",
    title: "Contact us",
  },
];

export default function PrivacyPage() {
  return (
    <main className="min-h-screen bg-[#f6f5f8] px-4 pb-16 pt-20 text-slate-950 sm:px-6 sm:pt-24">
      <div className="mx-auto max-w-[1060px]">
        <header className="border-b border-slate-200 pb-8 text-center">
          <div className="inline-flex rounded-full border border-purple-200 bg-white px-4 py-2 text-sm font-medium text-purple-700 shadow-sm">
            Privacy first · Updated May 2026
          </div>
          <h1 className="mt-5 text-4xl font-semibold tracking-tight text-slate-950 md:text-5xl">
            Privacy Policy
          </h1>
          <p className="mx-auto mt-4 max-w-3xl text-base leading-7 text-slate-600 md:text-lg">
            We design YourBarrio with data respect, transparency, and control so
            customers and local businesses can use the marketplace with confidence.
          </p>
        </header>

        <section className="mt-6 grid gap-4 md:grid-cols-3">
          {summaryCards.map((card) => (
            <div
              key={card.title}
              className="rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_14px_46px_-42px_rgba(15,23,42,0.4)]"
            >
              <div className="h-1 w-10 rounded-full bg-purple-200" />
              <h2 className="mt-4 text-base font-semibold text-slate-950">{card.title}</h2>
              <p className="mt-2 text-sm leading-6 text-slate-600">{card.body}</p>
            </div>
          ))}
        </section>

        <section className="mx-auto mt-6 max-w-3xl rounded-2xl border border-slate-200 bg-white p-4 shadow-[0_14px_46px_-42px_rgba(15,23,42,0.4)] sm:p-5">
          <h2 className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
            Contents
          </h2>
          <ol className="mt-3 list-decimal space-y-1.5 pl-5 text-[13px] leading-5 text-slate-700">
            {sections.map((section) => (
              <li key={section.id} className="pl-1">
                <SmoothHashLink className="hover:text-purple-700" href={`#${section.id}`}>
                  {section.title}
                </SmoothHashLink>
              </li>
            ))}
          </ol>
        </section>

        <article className="mt-8 rounded-3xl border border-slate-200 bg-white px-5 py-2 shadow-[0_20px_70px_-58px_rgba(15,23,42,0.55)] sm:px-8">
          {sections.slice(0, 10).map((section, index) => (
            <PolicySection key={section.id} section={section} number={index + 1} />
          ))}
        </article>

        <section
          id="contact-us"
          className="mt-8 scroll-mt-28 rounded-3xl border border-slate-200 bg-white p-6 shadow-[0_20px_70px_-58px_rgba(15,23,42,0.55)] sm:p-8"
        >
          <div className="inline-flex rounded-full border border-purple-200 bg-purple-50 px-3 py-1 text-xs font-semibold text-purple-700">
            We respond as quickly as possible.
          </div>
          <h2 className="mt-4 text-xl font-semibold tracking-tight text-slate-950">
            11. Contact us
          </h2>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-600 sm:text-[15px]">
            For privacy questions, data requests, or concerns about this policy, contact us at{" "}
            <a className="font-semibold text-purple-700 underline underline-offset-4" href="mailto:support@yourbarrio.com">
              support@yourbarrio.com
            </a>
            .
          </p>
        </section>
      </div>
    </main>
  );
}

function PolicySection({ section, number }) {
  return (
    <section
      id={section.id}
      className="scroll-mt-28 border-b border-slate-200 py-7 last:border-b-0"
    >
      <h2 className="text-xl font-semibold tracking-tight text-slate-950">
        {number}. {section.title}
      </h2>
      <div className="mt-3 space-y-3 text-sm leading-6 text-slate-600 sm:text-[15px]">
        {section.body.map((paragraph, index) => (
          <p key={index}>{paragraph}</p>
        ))}
      </div>
      {section.bullets ? (
        <ul className="mt-4 list-disc space-y-2 pl-5 text-sm leading-6 text-slate-600 sm:text-[15px]">
          {section.bullets.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}
