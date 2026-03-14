import { describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import {
  getCanonicalRedirectUrlForRequest,
  getSiteUrlFromHeaders,
} from "@/lib/auth/getSiteUrl";

describe("getSiteUrl", () => {
  it("normalizes www.yourbarrio.com to the apex host", () => {
    const siteUrl = getSiteUrlFromHeaders({
      get(name: string) {
        if (name === "x-forwarded-proto") return "https";
        if (name === "x-forwarded-host") return "www.yourbarrio.com";
        return null;
      },
    });

    expect(siteUrl).toBe("https://yourbarrio.com");
  });

  it("builds a canonical redirect when a www request hits prod auth routes", () => {
    const request = new NextRequest(
      "https://www.yourbarrio.com/auth/confirm?next=%2Fonboarding&token_hash=abc&type=email"
    );

    const redirectUrl = getCanonicalRedirectUrlForRequest(request);

    expect(redirectUrl?.toString()).toBe(
      "https://yourbarrio.com/auth/confirm?next=%2Fonboarding&token_hash=abc&type=email"
    );
  });
});
