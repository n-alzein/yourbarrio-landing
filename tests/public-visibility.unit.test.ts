import { describe, expect, it } from "vitest";
import { canViewerAccessPublicTarget } from "@/lib/publicVisibility";

describe("public visibility semantics", () => {
  it("hides internal business content from normal viewers", () => {
    expect(
      canViewerAccessPublicTarget(
        { businessIsInternal: true, listingIsInternal: false },
        { viewerCanSeeInternalContent: false }
      )
    ).toBe(false);
  });

  it("hides internal listings from normal viewers even when the business is public", () => {
    expect(
      canViewerAccessPublicTarget(
        { businessIsInternal: false, listingIsInternal: true },
        { viewerCanSeeInternalContent: false }
      )
    ).toBe(false);
  });

  it("allows internal viewers to see internal businesses and listings", () => {
    expect(
      canViewerAccessPublicTarget(
        { businessIsInternal: true, listingIsInternal: true },
        { viewerCanSeeInternalContent: true }
      )
    ).toBe(true);
  });
});
