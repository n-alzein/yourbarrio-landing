import { describe, expect, it } from "vitest";
import {
  getBusinessPublicUrl,
  getCustomerBusinessUrl,
} from "@/lib/ids/publicRefs";

describe("public business URLs", () => {
  it("builds canonical public business profile URLs", () => {
    expect(getBusinessPublicUrl({ public_id: "my-shop" })).toBe("/b/my-shop");
    expect(getBusinessPublicUrl({ id: "123" })).toBe("/b/123");
  });

  it("keeps the legacy helper aligned to the canonical public route", () => {
    expect(getCustomerBusinessUrl({ public_id: "my-shop" })).toBe("/b/my-shop");
  });
});
