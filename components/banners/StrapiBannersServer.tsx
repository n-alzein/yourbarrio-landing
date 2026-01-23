import Image from "next/image";
import { fetchStrapiBanners, strapiAbsoluteUrl } from "@/lib/strapi";

function isBannerLive(banner: any, now: Date) {
  if (banner?.startAt) {
    const startAt = new Date(banner.startAt);
    if (!Number.isNaN(startAt.getTime()) && now < startAt) return false;
  }

  if (banner?.endAt) {
    const endAt = new Date(banner.endAt);
    if (!Number.isNaN(endAt.getTime()) && now > endAt) return false;
  }

  return true;
}

export default async function StrapiBannersServer() {
  let banners: any[] = [];
  try {
    banners = await fetchStrapiBanners();
  } catch (error) {
    console.error("Failed to load Strapi banners:", error);
  }

  const now = new Date();
  const liveBanners = banners
    .map((banner) => banner?.attributes ?? banner)
    .filter(
      (banner) =>
        banner?.placement === "HOME_TOP" &&
        banner?.isActive === true &&
        isBannerLive(banner, now),
    )
    .sort((a, b) => Number(b?.priority ?? 0) - Number(a?.priority ?? 0));

  if (liveBanners.length === 0) return null;

  return (
    <section className="w-full">
      <div className="w-full space-y-4">
        {liveBanners.map((banner, index) => {
          const imageCandidate =
            banner?.image?.formats?.small?.url ||
            banner?.image?.url ||
            banner?.image?.formats?.thumbnail?.url ||
            null;
          const imageUrl = strapiAbsoluteUrl(imageCandidate);
          const ctaHref = banner?.ctaURL || "/";
          if (index === 0 && imageUrl) {
            console.log("[StrapiBanner] imageUrl:", imageUrl);
          }
          return (
            <div
              key={banner?.id ?? banner?.title ?? banner?.ctaURL ?? `banner-${index}`}
              className="overflow-hidden rounded-2xl border border-white/10 bg-white/5 shadow-xl shadow-slate-900/30"
            >
              <div className="grid gap-6 md:grid-cols-[1.2fr_1fr]">
                <div className="p-6 md:p-8">
                  <div className="text-xs uppercase tracking-[0.3em] text-white/60">
                    Featured
                  </div>
                  <h2 className="mt-3 text-2xl md:text-3xl font-bold text-white">
                    {banner?.title}
                  </h2>
                  {banner?.subtitle ? (
                    <p className="mt-3 text-sm md:text-base text-white/75">
                      {banner.subtitle}
                    </p>
                  ) : null}
                  <a
                    className="mt-5 inline-flex items-center justify-center rounded-xl bg-white text-slate-950 px-5 py-2.5 text-sm font-semibold shadow-sm hover:bg-slate-100"
                    href={ctaHref}
                  >
                    {banner?.ctaText || "Learn more"}
                  </a>
                </div>
                {imageUrl ? (
                  <div className="relative min-h-[220px] md:min-h-full">
                    <Image
                      src={imageUrl}
                      alt={banner?.title || "Banner image"}
                      fill
                      className="object-cover"
                      sizes="(min-width: 768px) 40vw, 100vw"
                      priority={index === 0}
                      unoptimized
                    />
                  </div>
                ) : null}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
