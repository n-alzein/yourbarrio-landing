import Link from "next/link";
import { History, PackageSearch } from "lucide-react";

const icons = {
  active: PackageSearch,
  history: History,
};

export default function OrderEmptyState({
  icon = "active",
  title,
  description,
  ctaLabel,
  href = "/customer/home",
}) {
  const Icon = icons[icon] || PackageSearch;

  return (
    <div className="rounded-3xl border border-slate-100 bg-white px-6 py-14 text-center shadow-[0_1px_2px_rgba(15,23,42,0.035)]">
      <div className="mx-auto mb-4 inline-flex h-16 w-16 items-center justify-center rounded-full bg-slate-100 text-slate-700">
        <Icon className="h-7 w-7" aria-hidden="true" />
      </div>
      <h2 className="text-2xl font-semibold tracking-[-0.03em] text-slate-950">
        {title}
      </h2>
      <p className="mx-auto mt-2 max-w-xl text-sm text-slate-500">
        {description}
      </p>
      <Link
        href={href}
        className="yb-primary-button mt-5 inline-flex min-h-11 items-center justify-center rounded-xl px-5 text-sm font-medium !text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgba(var(--brand-rgb),0.35)]"
      >
        {ctaLabel}
      </Link>
    </div>
  );
}
