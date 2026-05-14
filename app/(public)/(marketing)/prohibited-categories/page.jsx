export const metadata = {
  title: "Prohibited & Restricted Categories | YourBarrio",
  description:
    "Policy explaining which businesses, products, and services are prohibited or require review on YourBarrio.",
};

const policySections = [
  {
    heading: "A. Prohibited",
    intro: "These businesses, products, and services are disallowed from public business profiles and listings.",
    rows: [
      {
        status: "Prohibited",
        category: "Cannabis and drug paraphernalia",
        examples: "Cannabis, marijuana, THC, CBD, drug paraphernalia",
        notes: "Not eligible for public profiles or listings.",
      },
      {
        status: "Prohibited",
        category: "Tobacco and smoking products",
        examples: "Tobacco, nicotine, vapes, smoking products",
        notes: "Includes accessories primarily intended for smoking or vaping.",
      },
      {
        status: "Prohibited",
        category: "Alcohol",
        examples: "Alcohol sales or alcohol-focused listings",
        notes: "Unless separately approved in the future through a compliant program.",
      },
      {
        status: "Prohibited",
        category: "Adult goods and services",
        examples: "Adult/sexual goods, adult entertainment, escort services, explicit services",
        notes: "Not eligible for marketplace visibility.",
      },
      {
        status: "Prohibited",
        category: "Weapons and explosives",
        examples: "Weapons, firearms, ammunition, knives intended as weapons, tactical weapons, explosives",
        notes: "Includes products or services primarily related to weapons use.",
      },
      {
        status: "Prohibited",
        category: "Regulated drugs and health products",
        examples: "Prescription drugs, controlled substances, regulated medical devices, unauthorized health products",
        notes: "Health-related claims may also require review.",
      },
      {
        status: "Prohibited",
        category: "Illegal or unsafe goods",
        examples: "Illegal, stolen, counterfeit, recalled, or unsafe goods",
        notes: "YourBarrio may remove a specific listing even if the business itself is otherwise allowed.",
      },
      {
        status: "Prohibited",
        category: "Gambling and betting",
        examples: "Gambling, lottery, betting, sweepstakes, casino-style products/services",
        notes: "Includes services that facilitate wagering or chance-based prizes.",
      },
      {
        status: "Prohibited",
        category: "Financial products",
        examples: "Financial products, loans, credit repair, crypto/investment services",
        notes: "May conflict with marketplace risk and payment provider requirements.",
      },
      {
        category: "Hazardous materials",
        examples: "Hazardous materials, pesticides, explosives, toxic substances",
        notes: "Not eligible for marketplace visibility.",
      },
      {
        category: "Live animals and pets",
        examples: "Live animals, pets",
        notes: "May only be considered if separately approved in the future.",
      },
      {
        status: "Prohibited",
        category: "Hate, extremist, discriminatory, or violent content",
        examples: "Products, services, or content promoting hate, extremism, discrimination, or violence",
        notes: "Not eligible for YourBarrio distribution.",
      },
      {
        status: "Prohibited",
        category: "Regulated professional advice",
        examples: "Medical, legal, tax, or financial advice",
        notes: "Not allowed unless separately approved for a compliant program.",
      },
    ],
  },
  {
    heading: "B. Restricted / Manual Review",
    intro: "These categories may require admin approval before public visibility.",
    rows: [
      {
        status: "Review",
        category: "Food and beverages",
        examples: "Food, baked goods, cottage food, packaged food, beverages",
        notes: "May involve licensing, safety, labeling, or local compliance.",
      },
      {
        status: "Review",
        category: "Beauty and body services",
        examples: "Beauty, tattoo, piercing, massage, wellness services",
        notes: "May require licensing, hygiene, age, or safety review.",
      },
      {
        status: "Review",
        category: "Supplements and wellness products",
        examples: "Supplements, health/wellness products, fitness claims",
        notes: "Claims, ingredients, and processor rules may affect eligibility.",
      },
      {
        status: "Review",
        category: "Children's products",
        examples: "Children's products, baby products, toys",
        notes: "Safety, recall, and age suitability rules may apply.",
      },
      {
        status: "Review",
        category: "High-value and branded goods",
        examples: "High-value collectibles, designer/branded goods, luxury goods",
        notes: "May require authenticity or fraud-risk review.",
      },
      {
        status: "Review",
        category: "Tickets, reservations, and memberships",
        examples: "Event tickets, reservations, memberships",
        notes: "May require proof of authorization and clear cancellation terms.",
      },
      {
        status: "Review",
        category: "Electronics and repair",
        examples: "Used electronics, repair services",
        notes: "May require condition, warranty, data safety, or fraud review.",
      },
      {
        status: "Review",
        category: "Delivery and courier services",
        examples: "Delivery/courier services",
        notes: "May require safety, licensing, and operational review.",
      },
      {
        status: "Review",
        category: "Other risk-sensitive categories",
        examples: "Any category with licensing, age restriction, safety, or fraud risk",
        notes: "YourBarrio may require manual review before visibility.",
      },
    ],
  },
  {
    heading: "C. Generally Allowed",
    intro:
      "These are lower-risk launch categories when listings remain lawful, accurate, and policy-compliant. Generally allowed categories are still subject to listing accuracy, safety, quality, and policy review.",
    rows: [
      {
        status: "Allowed",
        category: "Clothing and home goods",
        examples: "Clothing and accessories, home goods and decor",
        notes: "Counterfeit, unsafe, or restricted items remain prohibited.",
      },
      {
        status: "Allowed",
        category: "Creative goods",
        examples: "Art, handmade goods, crafts, gifts, stationery, books",
        notes: "Listings must respect intellectual property rights.",
      },
      {
        status: "Allowed",
        category: "Vintage and thrift",
        examples: "Vintage/thrift items",
        notes: "Excludes counterfeit, recalled, unsafe, or otherwise restricted goods.",
      },
      {
        status: "Allowed",
        category: "Local makers and retailers",
        examples: "Local makers and independent retailers",
        notes: "Subject to normal listing accuracy and quality review.",
      },
      {
        status: "Allowed",
        category: "Low-risk local services",
        examples: "Low-risk local services",
        notes: "Regulated advice or licensed services may require review.",
      },
      {
        status: "Allowed",
        category: "Plants and flowers",
        examples: "Plants, flowers, and non-regulated garden items",
        notes: "Excludes regulated, toxic, restricted, or unsafe products.",
      },
    ],
  },
];

function PolicyTable({ rows }) {
  return (
    <>
      <div className="hidden overflow-hidden rounded-2xl border border-slate-200/80 md:block">
        <table className="w-full border-collapse text-left text-sm">
          <thead className="bg-slate-50/80 text-xs uppercase tracking-[0.16em] text-slate-500">
            <tr>
              <th className="w-[210px] px-4 py-2.5 font-semibold">Category</th>
              <th className="px-4 py-2.5 font-semibold">Examples</th>
              <th className="w-[260px] px-4 py-2.5 font-semibold">Notes</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200/80 bg-white">
            {rows.map((row) => (
              <tr key={row.category}>
                <td className="px-4 py-3 align-top font-medium text-slate-900">{row.category}</td>
                <td className="px-4 py-3 align-top leading-6 text-slate-600">{row.examples}</td>
                <td className="px-4 py-3 align-top leading-6 text-slate-600">{row.notes}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="space-y-3 md:hidden">
        {rows.map((row) => (
          <div key={row.category} className="rounded-2xl border border-slate-200/80 bg-white p-4">
            <h3 className="text-sm font-semibold text-slate-950">{row.category}</h3>
            <p className="mt-2 text-sm leading-6 text-slate-600">{row.examples}</p>
            <p className="mt-2 text-xs leading-5 text-slate-500">{row.notes}</p>
          </div>
        ))}
      </div>
    </>
  );
}

export default function ProhibitedCategoriesPage() {
  return (
    <main className="min-h-screen bg-[#f6f5f8] px-4 pb-16 pt-28 text-slate-950 sm:px-6">
      <div className="mx-auto max-w-[1060px]">
        <header className="border-b border-slate-200 pb-10 text-center">
          <div className="inline-flex rounded-full border border-purple-200 bg-white px-4 py-2 text-sm font-medium text-purple-700 shadow-sm">
            Marketplace policy · Updated May 2026
          </div>
          <h1 className="mt-6 text-4xl font-semibold tracking-tight text-slate-950 md:text-5xl">
            Prohibited &amp; Restricted Categories
          </h1>
          <p className="mx-auto mt-4 max-w-3xl text-base leading-7 text-slate-600 md:text-lg">
            This policy defines which businesses, products, and services may not appear
            on YourBarrio or may require review before public visibility.
          </p>
        </header>

        <section className="mt-8 rounded-3xl border border-slate-200 bg-white p-5 shadow-[0_16px_54px_-50px_rgba(15,23,42,0.42)] sm:p-6">
          <h2 className="text-base font-semibold text-slate-950">How this policy applies</h2>
          <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm leading-6 text-slate-600">
            <li>This policy applies to both businesses and individual listings.</li>
            <li>YourBarrio may remove a specific listing even if the business itself is allowed.</li>
            <li>Approval in one category does not guarantee approval of future listings.</li>
            <li>Categories can change over time as the marketplace evolves.</li>
            <li>
              YourBarrio may use this policy together with the{" "}
              <a className="font-semibold text-purple-700 underline underline-offset-4" href="/business-terms">
                Business Terms
              </a>{" "}
              and payment provider requirements.
            </li>
          </ol>
        </section>

        <div className="mt-8 space-y-8">
          {policySections.map((section) => (
            <section key={section.heading} className="rounded-3xl border border-slate-200/90 bg-white p-4 shadow-[0_16px_62px_-56px_rgba(15,23,42,0.46)] sm:p-5">
              <div className="mb-4">
                <h2 className="text-xl font-semibold tracking-tight text-slate-950">{section.heading}</h2>
                <p className="mt-2 text-sm leading-6 text-slate-600">{section.intro}</p>
              </div>
              <PolicyTable rows={section.rows} />
            </section>
          ))}
        </div>

        <section className="mt-10 rounded-3xl border border-purple-100 bg-white p-6 text-center shadow-[0_18px_60px_-54px_rgba(88,28,135,0.45)]">
          <h2 className="text-lg font-semibold text-slate-950">Questions about a category?</h2>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            Email{" "}
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
