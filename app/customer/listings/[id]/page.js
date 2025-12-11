"use client";

import ListingDetails from "@/app/listings/[id]/page";

export default function CustomerListingDetails(props) {
  // Reuse the public listing detail UI under /customer to enforce auth + navbar
  return <ListingDetails {...props} />;
}

