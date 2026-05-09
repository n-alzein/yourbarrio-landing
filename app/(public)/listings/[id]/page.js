import ListingDetailsClient from "./ListingDetailsClient";
import { getPublicListingDetails } from "@/lib/listings/publicListingDetails";

const EMPTY_INITIAL_LISTING_DETAILS = {
  listing: null,
  business: null,
  listingOptions: null,
  isSaved: false,
};

export default async function ListingDetailsPage({ params }) {
  const resolvedParams = await params;
  let initialDetails = EMPTY_INITIAL_LISTING_DETAILS;

  try {
    initialDetails = await getPublicListingDetails(resolvedParams?.id);
  } catch (error) {
    console.error("[listing details initial data error]", error);
  }

  return (
    <ListingDetailsClient
      params={resolvedParams}
      renderedAt={new Date().toISOString()}
      initialListing={initialDetails.listing}
      initialBusiness={initialDetails.business}
      initialListingOptions={initialDetails.listingOptions}
      initialIsSaved={initialDetails.isSaved}
    />
  );
}
