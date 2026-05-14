export const metadata = {
  title: "Terms of Service | YourBarrio",
  description:
    "Terms of Service explaining the rules for using YourBarrio as a customer, visitor, account holder, or business owner.",
};

const summaryCards = [
  {
    title: "Use YourBarrio responsibly",
    body: "Provide accurate information, respect others, and use the marketplace lawfully.",
  },
  {
    title: "Businesses have extra responsibilities",
    body: "Business owners are responsible for their listings, pricing, fulfillment, and customer communication.",
  },
  {
    title: "We protect the marketplace",
    body: "We may moderate content, limit access, or remove activity that violates these terms.",
  },
];

const sections = [
  {
    id: "acceptance",
    title: "Acceptance of these terms",
    body: [
      "By accessing or using YourBarrio, you agree to these Terms of Service. If you do not agree, you should not use the platform.",
      "These Terms apply to customers, visitors, account holders, and business owners who use YourBarrio.",
    ],
  },
  {
    id: "who-may-use-yourbarrio",
    title: "Who may use YourBarrio",
    body: [
      "You must be at least 18 or have legal permission and supervision where applicable. You must also be legally able to enter agreements.",
      "Business owners must have authority to create, manage, and act on behalf of the business they add to YourBarrio.",
    ],
  },
  {
    id: "accounts-and-security",
    title: "Accounts and security",
    body: [
      "You are responsible for keeping your account credentials secure and for activity that occurs through your account.",
      "Account information must be accurate and kept up to date. You should notify YourBarrio if you believe your account was accessed without authorization.",
      "YourBarrio may require verification for certain account, business, ordering, payment, or marketplace features.",
    ],
  },
  {
    id: "marketplace-use",
    title: "Marketplace use",
    body: [
      "YourBarrio helps customers discover local businesses, browse listings, communicate, and place orders where available.",
      "You must use the platform lawfully and respectfully. You may not misuse search, messaging, ordering, reviews, support tools, or any other marketplace feature.",
    ],
  },
  {
    id: "business-owner-responsibilities",
    title: "Business owner responsibilities",
    body: [
      "Business owners are responsible for accurate business profiles, listings, pricing, availability, pickup instructions, policies, and customer communication.",
      "Business owners must comply with applicable laws, taxes, licenses, permits, and marketplace policies.",
      <>
        Business owners are also subject to the{" "}
        <a className="font-semibold text-purple-700 underline underline-offset-4" href="/business-terms">
          Business Terms
        </a>{" "}
        and the{" "}
        <a className="font-semibold text-purple-700 underline underline-offset-4" href="/prohibited-categories">
          Prohibited &amp; Restricted Categories Policy
        </a>
        .
      </>,
    ],
    note:
      "Creating or managing a business on YourBarrio does not guarantee public visibility, approval of every listing, or eligibility for every marketplace feature.",
  },
  {
    id: "listings-content-and-reviews",
    title: "Listings, content, and reviews",
    body: [
      "Users and businesses are responsible for the content they submit, including listings, descriptions, photos, messages, reviews, business details, and support communications.",
      "Content must not be false, misleading, abusive, infringing, unlawful, unsafe, or harmful. Reviews should reflect genuine experiences.",
      "YourBarrio may moderate, hide, remove, or restrict content that violates policies or harms marketplace trust.",
    ],
  },
  {
    id: "orders-pickup-payments-and-fees",
    title: "Orders, pickup, payments, and fees",
    body: [
      "Where ordering is available, customers are responsible for reviewing order details before purchase. Businesses are responsible for fulfilling accepted orders according to the listing, availability, and pickup details shown through YourBarrio.",
      "Prices, taxes, platform fees, and other charges should be shown before checkout where applicable. Payment processing may be handled by third-party providers.",
      "Refunds, cancellations, or order issues may depend on marketplace policies, business policies, payment status, and applicable law.",
    ],
  },
  {
    id: "prohibited-activity",
    title: "Prohibited activity",
    body: [
      <>
        You may not use YourBarrio for fraud, spam, scraping, harassment, abuse, impersonation,
        illegal activity, attempts to bypass platform protections, or posting or selling
        prohibited or restricted items. The{" "}
        <a className="font-semibold text-purple-700 underline underline-offset-4" href="/prohibited-categories">
          Prohibited &amp; Restricted Categories Policy
        </a>{" "}
        provides additional category rules.
      </>,
      "You may not interfere with platform security, availability, integrity, infrastructure, or other users' use of YourBarrio.",
    ],
  },
  {
    id: "privacy",
    title: "Privacy",
    body: [
      <>
        Use of YourBarrio is also governed by our{" "}
        <a className="font-semibold text-purple-700 underline underline-offset-4" href="/privacy">
          Privacy Policy
        </a>
        . The Privacy Policy outlines data collection, use, retention, and controls.
      </>,
    ],
  },
  {
    id: "platform-availability-and-changes",
    title: "Platform availability and changes",
    body: [
      "YourBarrio may change, suspend, limit, or discontinue features. Availability may vary by location, account type, business status, product phase, or operational needs.",
      "Maintenance, outages, third-party service interruptions, or other issues may occur and may affect access to features or marketplace activity.",
    ],
  },
  {
    id: "suspension-and-termination",
    title: "Suspension and termination",
    body: [
      "You may close your account where supported. YourBarrio may suspend, restrict, or terminate access for violations, risk, fraud, abuse, legal reasons, or platform protection.",
      "Some records may be retained as described in the Privacy Policy or as required for legal, security, dispute, transaction, or business purposes.",
    ],
  },
  {
    id: "disclaimers-and-liability",
    title: "Disclaimers and limitation of liability",
    body: [
      'YourBarrio is provided on an "as is" and "as available" basis.',
      "To the fullest extent permitted by law, YourBarrio disclaims warranties and limits liability for indirect, incidental, consequential, special, punitive, or similar damages.",
    ],
  },
  {
    id: "disputes-and-governing-law",
    title: "Disputes and governing law",
    body: [
      "If an issue comes up, please contact support first so it can be reviewed and resolved quickly.",
      "Disputes are governed by applicable law. Nothing in these Terms limits rights you may have under laws that apply to you.",
    ],
  },
  {
    id: "changes-to-these-terms",
    title: "Changes to these terms",
    body: [
      "YourBarrio may update these Terms as the product, marketplace, or legal requirements evolve.",
      "Material changes may be communicated through the site, app, or email where appropriate. The Updated date reflects the latest version.",
    ],
  },
  {
    id: "contact-us",
    title: "Contact us",
  },
];

export default function TermsPage() {
  return (
    <main className="min-h-screen bg-[#f6f5f8] px-4 pb-16 pt-20 text-slate-950 sm:px-6 sm:pt-24">
      <div className="mx-auto max-w-[1060px]">
        <header className="border-b border-slate-200 pb-8 text-center">
          <div className="inline-flex rounded-full border border-purple-200 bg-white px-4 py-2 text-sm font-medium text-purple-700 shadow-sm">
            Terms of Service · Updated May 2026
          </div>
          <h1 className="mt-5 text-4xl font-semibold tracking-tight text-slate-950 md:text-5xl">
            Terms of Service
          </h1>
          <p className="mx-auto mt-4 max-w-3xl text-base leading-7 text-slate-600 md:text-lg">
            These terms explain the rules for using YourBarrio and help keep the
            marketplace fair, safe, and reliable for customers and local businesses.
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
                <a className="hover:text-purple-700" href={`#${section.id}`}>
                  {section.title}
                </a>
              </li>
            ))}
          </ol>
        </section>

        <article className="mt-8 rounded-3xl border border-slate-200 bg-white px-5 py-2 shadow-[0_20px_70px_-58px_rgba(15,23,42,0.55)] sm:px-8">
          {sections.slice(0, 14).map((section, index) => (
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
            15. Contact us
          </h2>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-600 sm:text-[15px]">
            For questions about these Terms, marketplace policies, or account concerns,
            contact us at{" "}
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
      {section.note ? (
        <div className="mt-5 rounded-2xl border border-purple-100 bg-purple-50/70 p-4 text-sm leading-6 text-slate-700">
          {section.note}
        </div>
      ) : null}
    </section>
  );
}
