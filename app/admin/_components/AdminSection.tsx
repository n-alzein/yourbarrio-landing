import type { ReactNode } from "react";

type AdminSectionProps = {
  title: string;
  description?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
};

export default function AdminSection({
  title,
  description,
  action,
  children,
  className = "",
}: AdminSectionProps) {
  const classes = [
    "rounded-lg border border-neutral-800/80 bg-neutral-900/40 p-3 shadow-[0_16px_40px_-36px_rgba(0,0,0,0.9)] sm:p-4",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <section className={classes}>
      <div className="mb-3 flex flex-col gap-3 sm:mb-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h3 className="text-sm font-semibold text-neutral-100">{title}</h3>
          {description ? <p className="mt-1 hidden text-xs text-neutral-500 sm:block">{description}</p> : null}
        </div>
        {action ? <div className="shrink-0">{action}</div> : null}
      </div>
      {children}
    </section>
  );
}
