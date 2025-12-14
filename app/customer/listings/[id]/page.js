"use client";

import { Suspense } from "react";
import ListingDetails from "@/app/listings/[id]/page";

export default function CustomerListingDetails(props) {
  // Reuse the public listing detail UI under /customer to enforce auth + navbar
  return (
    <Suspense fallback={<div className="pt-24 text-center text-white/80">Loading listing...</div>}>
      <ListingDetails {...props} />
    </Suspense>
  );
}
