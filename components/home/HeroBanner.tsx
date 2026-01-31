import Image from "next/image";

type HeroBannerProps = {
  banner: any;
  imageUrl?: string | null;
  priority?: boolean;
};

export default function HeroBanner({ banner, imageUrl, priority = false }: HeroBannerProps) {
  const title = banner?.title || "Featured";
  const subtitle = banner?.subtitle;
  const ctaHref = banner?.ctaURL || "/";
  const ctaText = banner?.ctaText || "Learn more";
  const secondaryHref = banner?.ctaSecondaryURL || banner?.secondaryCtaURL;
  const secondaryText = banner?.ctaSecondaryText || banner?.secondaryCtaText;

  return (
    <article className="relative overflow-hidden border border-white/10 bg-slate-950/80 shadow-2xl shadow-slate-900/30">
      <div className="relative min-h-[200px] sm:min-h-[260px] lg:min-h-[300px]">
        {imageUrl ? (
          <Image
            src={imageUrl}
            alt={title}
            fill
            className="object-cover"
            sizes="(min-width: 1280px) 1120px, (min-width: 1024px) 920px, 100vw"
            priority={priority}
            quality={82}
          />
        ) : (
          <div className="absolute inset-0 bg-gradient-to-br from-slate-950 via-slate-900 to-slate-800" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/35 to-transparent md:bg-gradient-to-r" />
        <div className="relative z-10 flex h-full items-end md:items-center">
          <div className="w-full px-6 py-8 sm:px-8 md:px-10 lg:px-12">
            <div className="mx-auto flex max-w-xl flex-col items-center text-center md:items-start md:text-left">
              <span className="text-xs uppercase tracking-[0.35em] text-white/70">
                Featured
              </span>
              <h2 className="mt-3 text-2xl sm:text-3xl lg:text-4xl font-semibold !text-white">
                {title}
              </h2>
              {subtitle ? (
                <p className="mt-3 text-sm sm:text-base !text-white/85">
                  {subtitle}
                </p>
              ) : null}
              <div className="mt-6 flex flex-col sm:flex-row items-center gap-3 sm:gap-4">
                <a
                  href={ctaHref}
                  className="inline-flex items-center justify-center rounded-xl bg-white px-6 py-3 text-sm sm:text-base font-semibold text-slate-950 shadow-sm transition hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/80 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950"
                >
                  {ctaText}
                </a>
                {secondaryHref && secondaryText ? (
                  <a
                    href={secondaryHref}
                    className="text-sm sm:text-base font-semibold text-white/80 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/80 rounded-lg px-2 py-1"
                  >
                    {secondaryText}
                  </a>
                ) : null}
              </div>
            </div>
          </div>
        </div>
      </div>
    </article>
  );
}
