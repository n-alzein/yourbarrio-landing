import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";

const listingDetailPageSource = readFileSync(
  path.join(process.cwd(), "app/(public)/listings/[id]/page.js"),
  "utf8"
);
const listingDetailsClientSource = readFileSync(
  path.join(process.cwd(), "app/(public)/listings/[id]/ListingDetailsClient.jsx"),
  "utf8"
);
const publicListingDetailsSource = readFileSync(
  path.join(process.cwd(), "lib/listings/publicListingDetails.js"),
  "utf8"
);

describe("ListingDetailsPage server handoff", () => {
  it("passes server listing, business, options, and save state into the client", () => {
    expect(listingDetailPageSource).toContain("getPublicListingDetails(resolvedParams?.id)");
    expect(listingDetailPageSource).toContain("initialListing={initialDetails.listing}");
    expect(listingDetailPageSource).toContain("initialBusiness={initialDetails.business}");
    expect(listingDetailPageSource).toContain("initialListingOptions={initialDetails.listingOptions}");
    expect(listingDetailPageSource).toContain("initialIsSaved={initialDetails.isSaved}");
  });

  it("keeps non-critical listing controls out of the blocking server render path", () => {
    expect(publicListingDetailsSource).toContain("variantsDeferred: true");
    expect(publicListingDetailsSource).toContain("savedStateDeferred: true");
    expect(publicListingDetailsSource).toContain("listingOptions: null");
    expect(publicListingDetailsSource).toContain("isSaved: false");
  });

  it("does not replace server listing content with a client skeleton during hydration", () => {
    expect(listingDetailsClientSource).toContain("const [loading, setLoading] = useState(!initialListing)");
    expect(listingDetailsClientSource).toContain("if (loading && !listing)");
    expect(listingDetailsClientSource).toContain("priority");
  });
});
