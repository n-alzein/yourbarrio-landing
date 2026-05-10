import Link from "next/link";
import AdminInfoTooltip from "@/app/admin/_components/AdminInfoTooltip";

type AdminMetricTone = "neutral" | "attention";

type AdminMetricCardProps = {
  label: string;
  value: number;
  helper?: string;
  definition?: string;
  href?: string;
  tone?: AdminMetricTone;
};

export default function AdminMetricCard({
  label,
  value,
  helper,
  definition,
  href,
  tone = "neutral",
}: AdminMetricCardProps) {
  const content = (
    <>
      <div className="flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-1">
          <p className="truncate text-[10px] font-medium text-neutral-500 sm:text-xs">{label}</p>
          {definition ? <AdminInfoTooltip label={`${label} definition`}>{definition}</AdminInfoTooltip> : null}
        </div>
        {tone === "attention" && value > 0 ? (
          <span className="h-1.5 w-1.5 rounded-full bg-[#8b5cf6]" aria-hidden="true" />
        ) : null}
      </div>
      <p className="mt-1 text-lg font-semibold tracking-normal text-neutral-50 sm:mt-2 sm:text-2xl">
        {value.toLocaleString()}
      </p>
      {helper ? <p className="mt-1 hidden truncate text-xs text-neutral-500 sm:block">{helper}</p> : null}
    </>
  );
  const className =
    "block min-h-[60px] min-w-[128px] rounded-lg border border-neutral-800/80 bg-neutral-900/45 p-2 transition-colors hover:border-neutral-700/80 hover:bg-neutral-900/60 sm:min-h-[104px] sm:min-w-0 sm:p-4";

  if (href) {
    return (
      <Link href={href} className={className}>
        {content}
      </Link>
    );
  }

  return <div className={className}>{content}</div>;
}
