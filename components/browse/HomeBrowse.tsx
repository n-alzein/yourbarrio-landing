import StrapiBannersServer from "@/components/banners/StrapiBannersServer";
import CustomerHomeClient from "@/app/(customer)/customer/home/CustomerHomeClient";
import type { BrowseMode, HomeBrowseData } from "@/lib/browse/getHomeBrowseData";

type HomeBrowseProps = {
  mode: BrowseMode;
  initialData: HomeBrowseData;
};

export default async function HomeBrowse({ mode, initialData }: HomeBrowseProps) {
  return (
    <>
      <div className="mt-0 md:-mt-12 mb-6 md:mb-8 relative z-10">
        <StrapiBannersServer banners={initialData.banners} />
      </div>

      <CustomerHomeClient
        mode={mode}
        featuredCategories={initialData.featuredCategories}
        featuredCategoriesError={initialData.featuredCategoriesError}
        initialListings={initialData.listings}
      />
    </>
  );
}
