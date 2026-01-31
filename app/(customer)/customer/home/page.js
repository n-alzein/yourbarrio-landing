import StrapiBannersServer from "@/components/banners/StrapiBannersServer";
import { fetchFeaturedCategories } from "@/lib/strapi";
import CustomerHomeClient from "./CustomerHomeClient";

export const revalidate = 300;

export default async function CustomerHomePage() {
  let featuredCategories = [];
  let featuredCategoriesError = null;
  try {
    featuredCategories = await fetchFeaturedCategories();
  } catch (error) {
    console.error("Failed to load featured categories:", error);
    featuredCategoriesError = "We couldn't load categories right now.";
  }

  return (
    <>
      <div className="mt-0 -mt-14 md:-mt-12 mb-6 md:mb-8 relative z-10">
        <StrapiBannersServer />
      </div>
      <CustomerHomeClient
        featuredCategories={featuredCategories}
        featuredCategoriesError={featuredCategoriesError}
      />
    </>
  );
}
