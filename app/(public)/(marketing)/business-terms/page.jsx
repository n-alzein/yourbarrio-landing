import Link from "next/link";
import SmoothHashLink from "@/components/marketing/SmoothHashLink";

export const metadata = {
  title: "Business Terms | YourBarrio",
  description:
    "Business terms for shops, sellers, and service providers using YourBarrio.",
};

const sections = [
  {
    id: "eligibility",
    title: "Business eligibility and authority",
    body: [
      "You must have authority to create, manage, and act on behalf of the business you add to YourBarrio. This includes authority over the business profile, listings, photos, pricing, pickup or delivery details, orders, and customer communications.",
      "You are responsible for making sure the business and its listings comply with applicable laws, licensing requirements, marketplace policies, and any commitments made to customers.",
    ],
  },
  {
    id: "verification",
    title: "Verification and approval",
    body: [
      "YourBarrio may request additional information, review a business before public launch, or require manual approval for certain categories. Verification may include review of business details, category fit, location, photos, listings, or payment provider eligibility.",
      "Approval of a business profile does not guarantee approval of every listing, future listing, service, product, or category expansion.",
    ],
  },
  {
    id: "visibility",
    title: "Public visibility is not guaranteed",
    body: [
      "Creating a business account does not guarantee public placement or visibility on YourBarrio. A business, profile, listing, or piece of content may be pending review, limited, hidden, or withheld from public surfaces.",
      "Public visibility may depend on marketplace quality, safety, compliance, category fit, location support, completeness, customer experience, or other operational factors.",
    ],
  },
  {
    id: "accuracy",
    title: "Business information and listing accuracy",
    body: [
      "Business owners are responsible for keeping business names, addresses, hours, contact details, descriptions, photos, prices, taxes, fees, availability, inventory, pickup details, and fulfillment promises accurate and current.",
      "Listings must not be misleading, deceptive, infringing, unsafe, or inconsistent with the actual products or services offered.",
    ],
  },
  {
    id: "categories",
    title: "Prohibited and restricted categories",
    body: [
      <>
        The{" "}
        <Link className="font-semibold text-purple-700 underline underline-offset-4" href="/prohibited-categories">
          Prohibited &amp; Restricted Categories Policy
        </Link>{" "}
        is incorporated into these Business Terms by reference. Businesses and individual listings must comply with that policy.
      </>,
      "Restricted categories may require manual review before public visibility. YourBarrio may approve, reject, limit, hide, or remove a business or listing based on category risk, licensing, safety, fraud, payment processing, brand fit, or legal requirements.",
    ],
  },
  {
    id: "orders",
    title: "Orders, pickup, fulfillment, and cancellations",
    body: [
      "Businesses must make reasonable efforts to honor accepted orders, pickup windows, availability, customer instructions, and cancellation commitments shown in the product experience.",
      "If an order or request cannot be fulfilled, businesses should communicate promptly and handle cancellations, substitutions, or customer support issues professionally.",
    ],
  },
  {
    id: "pricing",
    title: "Pricing, taxes, fees, and payouts",
    body: [
      "Businesses are responsible for their listed prices, discounts, taxes, fees, and payout information. Any platform fees, payment fees, or payout timing will be shown through YourBarrio or the applicable payment provider where relevant.",
      "Businesses are responsible for understanding and satisfying their own tax, licensing, reporting, and accounting obligations.",
    ],
  },
  {
    id: "communication",
    title: "Customer communication and conduct",
    body: [
      "Customer communication should be accurate, respectful, and related to legitimate business activity. Harassment, discrimination, threats, spam, deceptive claims, or attempts to move unsafe or prohibited activity off-platform are not allowed.",
      "YourBarrio may review communications where necessary for support, safety, fraud prevention, policy enforcement, or legal compliance.",
    ],
  },
  {
    id: "content",
    title: "Content and photo rights",
    body: [
      "By uploading or submitting business content, you confirm that you have the rights needed to use it and grant YourBarrio permission to host, store, resize, crop, display, distribute, promote, and otherwise use that content to operate, market, and improve the marketplace.",
      "This includes business names, logos, photos, product images, listing descriptions, profile content, and other materials submitted through YourBarrio.",
    ],
  },
  {
    id: "moderation",
    title: "Moderation, delisting, suspension, and removal",
    body: [
      "YourBarrio may reject, hide, restrict, suspend, or remove businesses, profiles, listings, or content at its discretion for safety, compliance, brand fit, policy, marketplace-quality, or legal reasons.",
      "YourBarrio may also take action where a business creates risk for customers, payment providers, the platform, or the broader marketplace.",
    ],
  },
  {
    id: "payments",
    title: "Payment provider requirements",
    body: [
      "Payment processing may be subject to third-party provider rules, including Stripe or another provider. Provider requirements may restrict certain businesses, products, services, categories, transaction types, or payout eligibility.",
      "Payment provider approval is separate from YourBarrio business visibility, and YourBarrio may use provider requirements together with these Business Terms and marketplace policies.",
    ],
  },
  {
    id: "changes",
    title: "Changes to business terms",
    body: [
      "YourBarrio may update these Business Terms as the marketplace evolves, including to reflect new features, supported locations, category rules, payment requirements, safety practices, or legal obligations.",
      "Continued use of business features after changes are posted means you accept the updated Business Terms.",
    ],
  },
  {
    id: "contact",
    title: "Contact",
    body: [
      <>
        For questions about business eligibility, category review, listings, or these Business Terms, email{" "}
        <a className="font-semibold text-purple-700 underline underline-offset-4" href="mailto:support@yourbarrio.com">
          support@yourbarrio.com
        </a>
        .
      </>,
    ],
  },
];

const categorySummary = [
  {
    label: "Prohibited",
    summary:
      "Cannabis/THC/CBD; tobacco/vapes; alcohol unless separately approved; adult goods/services; weapons/firearms/ammunition; prescription drugs/controlled substances; illegal, stolen, counterfeit, or recalled goods; gambling/betting; financial products/crypto/loans; hazardous materials; live animals; hate, extremist, or discriminatory content.",
  },
  {
    label: "Restricted / manual review",
    summary:
      "Food and beverages; beauty/tattoo/piercing/massage/wellness; supplements/health claims; children's products; high-value collectibles/designer goods; event tickets/memberships; used electronics/repair; courier/delivery services; licensed, age-restricted, safety, or fraud-risk categories.",
  },
  {
    label: "Generally allowed",
    summary:
      "Clothing/accessories; home goods/decor; art/handmade/crafts; gifts/stationery/books; vintage/thrift excluding counterfeit or restricted goods; local makers and independent retailers; low-risk local services; flowers/plants/non-regulated garden items.",
  },
];

export default function BusinessTermsPage() {
  return (
    <main className="min-h-screen bg-[#f6f5f8] px-4 pb-16 pt-20 text-slate-950 sm:px-6 sm:pt-24">
      <div className="mx-auto max-w-[1060px]">
        <header className="border-b border-slate-200 pb-8 text-center">
          <div className="inline-flex rounded-full border border-purple-200 bg-white px-4 py-2 text-sm font-medium text-purple-700 shadow-sm">
            Business policy · Updated May 2026
          </div>
          <h1 className="mt-5 text-4xl font-semibold tracking-tight text-slate-950 md:text-5xl">
            YourBarrio Business Terms
          </h1>
          <p className="mx-auto mt-4 max-w-3xl text-base leading-7 text-slate-600 md:text-lg">
            These terms apply to businesses, sellers, shops, service providers, and anyone
            creating business profiles or listings on YourBarrio.
          </p>
        </header>

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

        <section className="mt-6 rounded-3xl border border-purple-100 bg-purple-50/70 p-5 sm:p-6">
          <h2 className="text-base font-semibold text-slate-950">Key business visibility terms</h2>
          <p className="mt-2 text-sm leading-6 text-slate-700">
            Creating a business account does not guarantee public placement or visibility.
            YourBarrio may reject, hide, restrict, suspend, or remove businesses, profiles,
            listings, or content at its discretion for safety, compliance, brand fit, policy,
            marketplace-quality, or legal reasons.
          </p>
        </section>

        <article className="mt-8 rounded-3xl border border-slate-200 bg-white px-5 py-2 shadow-[0_20px_70px_-58px_rgba(15,23,42,0.55)] sm:px-8">
          {sections.map((section, index) => (
            <section
              key={section.id}
              id={section.id}
              className="scroll-mt-28 border-b border-slate-200 py-7 last:border-b-0"
            >
              <h2 className="text-xl font-semibold tracking-tight text-slate-950">
                {index + 1}. {section.title}
              </h2>
              <div className="mt-3 space-y-3 text-sm leading-6 text-slate-600 sm:text-[15px]">
                {section.body.map((paragraph, paragraphIndex) => (
                  <p key={paragraphIndex}>{paragraph}</p>
                ))}
              </div>

              {section.id === "categories" ? (
                <div className="mt-5 overflow-hidden rounded-2xl border border-slate-200/80">
                  <div className="grid bg-slate-50 text-sm font-semibold text-slate-900 md:grid-cols-[0.34fr_1fr]">
                    <div className="border-b border-slate-200/80 px-4 py-3 md:border-b-0 md:border-r md:border-slate-200/80">
                      Status
                    </div>
                    <div className="px-4 py-3">Summary</div>
                  </div>
                  {categorySummary.map((row) => (
                    <div key={row.label} className="grid border-t border-slate-200/80 text-sm leading-6 md:grid-cols-[0.34fr_1fr]">
                      <div className="bg-slate-50 px-4 py-3 font-semibold text-slate-900 md:border-r md:border-slate-200/80 md:bg-white">
                        {row.label}
                      </div>
                      <div className="px-4 py-3 text-slate-600">{row.summary}</div>
                    </div>
                  ))}
                  <p className="border-t border-slate-200/80 bg-slate-50 px-4 py-3 text-xs leading-5 text-slate-600">
                    This summary is not exhaustive. YourBarrio may restrict other businesses,
                    products, services, categories, or listings that create legal, safety,
                    payment, fraud, brand, or marketplace-quality risk. The detailed{" "}
                    <Link className="font-semibold text-purple-700 underline underline-offset-4" href="/prohibited-categories">
                      Prohibited &amp; Restricted Categories Policy
                    </Link>{" "}
                    controls and may be updated as the marketplace evolves.
                  </p>
                </div>
              ) : null}
            </section>
          ))}
        </article>
      </div>
    </main>
  );
}
