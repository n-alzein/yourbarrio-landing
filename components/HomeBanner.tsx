import { strapiFetch } from "@/lib/strapi";

type BannerAttributes = {
  title?: string | null;
  subtitle?: string | null;
};

type BannerEntity = BannerAttributes & {
  id?: number | string;
  attributes?: BannerAttributes;
};

export default async function HomeBanner() {
  // Server-side fetch keeps the API token out of the browser bundle.
  const banners = await strapiFetch<BannerEntity[]>(
    "/api/banners?populate=*&sort=createdAt:desc&pagination[pageSize]=1",
  );

  const banner = banners?.[0];
  if (!banner) return null;

  const attributes = banner.attributes ?? banner;
  const title = attributes?.title ?? "";
  const subtitle = attributes?.subtitle ?? "";

  if (!title && !subtitle) return null;

  return (
    <section className="w-full">
      <div className="mx-auto max-w-5xl px-4 py-6">
        {title ? <h1 className="text-2xl font-semibold">{title}</h1> : null}
        {subtitle ? <p className="mt-2 text-base text-gray-700">{subtitle}</p> : null}
      </div>
    </section>
  );
}
