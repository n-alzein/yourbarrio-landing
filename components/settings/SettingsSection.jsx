export const inputClassName =
  "h-11 w-full rounded-xl border border-white/15 bg-black/20 px-3 text-base md:text-sm text-white placeholder:text-white/40 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pink-400/60 focus-visible:border-pink-400/60";

export function SettingsSection({
  title,
  description,
  action,
  children,
  footer,
  className = "",
  headerClassName = "",
  bodyClassName = "",
  footerClassName = "",
  titleClassName = "",
  descriptionClassName = "",
}) {
  return (
    <section
      className={`rounded-2xl border border-white/10 bg-white/5 p-5 shadow-sm sm:p-6 ${className}`}
    >
      <div
        className={`mb-4 flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between ${headerClassName}`}
      >
        <div>
          <h2 className={`text-lg font-semibold text-white ${titleClassName}`}>
            {title}
          </h2>
          {description ? (
            <p className={`text-sm text-white/60 ${descriptionClassName}`}>
              {description}
            </p>
          ) : null}
        </div>
        {action ? <div className="shrink-0">{action}</div> : null}
      </div>

      <div className={`space-y-5 ${bodyClassName}`}>{children}</div>

      {footer ? (
        <div className={`mt-6 flex flex-wrap items-center gap-3 ${footerClassName}`}>
          {footer}
        </div>
      ) : null}
    </section>
  );
}

export function Field({
  label,
  id,
  helper,
  error,
  children,
  className = "",
  labelClassName = "",
  helperClassName = "",
  errorClassName = "",
  hideEmptyHelper = false,
}) {
  const shouldShowHelper = Boolean(error || helper || !hideEmptyHelper);

  return (
    <div className={className}>
      <label
        htmlFor={id}
        className={`mb-1.5 block text-sm text-white/70 ${labelClassName}`}
      >
        {label}
      </label>
      {children}
      {shouldShowHelper ? (
        <p
          className={`mt-1.5 min-h-[1.25rem] text-xs ${
            error
              ? `text-rose-300 ${errorClassName}`
              : `text-white/45 ${helperClassName}`
          }`}
        >
          {error || helper || ""}
        </p>
      ) : null}
    </div>
  );
}

export function FieldGrid({ className = "", children }) {
  return <div className={`grid grid-cols-1 gap-4 ${className}`}>{children}</div>;
}
