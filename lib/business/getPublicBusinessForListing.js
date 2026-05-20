import { getPublicBusinessById } from "@/lib/business/getPublicBusinessById";
import { getPublicBusinessByOwnerId } from "@/lib/business/getPublicBusinessByOwnerId";
import { getListingBusinessIdentity } from "@/lib/listings/businessIdentity";

export async function getPublicBusinessForListing(listing, options = {}) {
  const { businessEntityId, ownerUserId } = getListingBusinessIdentity(listing);

  if (businessEntityId) {
    const business = await getPublicBusinessById(businessEntityId, options);
    if (business) return business;
  }

  if (!ownerUserId) return null;
  return getPublicBusinessByOwnerId(ownerUserId, options);
}
