import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

function read(relativePath: string) {
  return fs.readFileSync(path.join(process.cwd(), relativePath), "utf8");
}

describe("settings phone separation", () => {
  it("business settings separates public business phone from private account phone", () => {
    const source = read("app/(business)/business/settings/page.js");

    expect(source).toContain('title="Business profile"');
    expect(source).toContain("Manage the business details customers see on YourBarrio.");
    expect(source).toContain('label="Public phone number"');
    expect(source).toContain("Shown on your business profile so customers can contact your shop.");
    expect(source).toContain('title="Account contact"');
    expect(source).toContain("Manage private contact details used for account access and business notifications.");
    expect(source).toContain('label="Private account phone"');
    expect(source).toContain("Not shown publicly. Used for account updates and business notifications.");
    expect(source).not.toContain('label="Your phone number"');
    expect(source).toContain('fetch("/api/account/profile"');
    expect(source).toContain('fetch("/api/business/profile"');
    expect(source).toContain("phone: normalizeUSPhoneForStorage(form.public_phone)");
    expect(source).toContain("phone: normalizeUSPhoneForStorage(form.private_phone)");
    expect(source).not.toContain("business_name: form.full_name,\n      phone: form.phone");
    expect(source).not.toContain("Complete your profile");
    expect(source).not.toContain("getCustomerProfileCompletion");
  });

  it("business settings only sends the active phone section to the matching API", () => {
    const source = read("app/(business)/business/settings/page.js");

    expect(source).toContain('activeSection === "accountContact"');
    expect(source).toContain('activeSection === "profile"');
    expect(source).toContain('body: JSON.stringify(updates)');
    expect(source).toContain('body: JSON.stringify({\n            phone: normalizeUSPhoneForStorage(form.private_phone),\n          })');
    expect(source).not.toContain('phone: normalizeUSPhoneForStorage(form.private_phone),\n          profile_photo_url');
    expect(source).not.toContain('phone: normalizeUSPhoneForStorage(form.public_phone),\n          role');
    expect(source).not.toContain('is_internal');
  });

  it("business avatar upload pushes the saved avatar into auth profile context before refresh", () => {
    const source = read("app/(business)/business/settings/page.js");
    const updateIndex = source.indexOf("updateProfile?.({");
    const refreshIndex = source.indexOf("refreshProfile?.();", updateIndex);

    expect(source).toContain("business_avatar_media_asset: mediaAsset");
    expect(source).toContain("discardTemporaryImages({ assetIds: [tempAssetId] })");
    expect(updateIndex).toBeGreaterThan(-1);
    expect(refreshIndex).toBeGreaterThan(updateIndex);
  });

  it("auth profile updates also patch the cached business object for navbar consumers", () => {
    const source = read("components/AuthProvider.jsx");

    expect(source).toContain("const mergedBusiness =");
    expect(source).toContain("currentState.business?.owner_user_id === currentState.user?.id");
    expect(source).toContain("...currentState.business");
    expect(source).toContain("...nextProfile");
    expect(source).toContain("business: mergedBusiness");
  });

  it("customer settings saves the private phone through the account profile API", () => {
    const source = read("app/(customer)/customer/settings/page.js");

    expect(source).toContain('label="Your phone number"');
    expect(source).not.toContain(
      "Private account contact number. This is not shown on your business profile."
    );
    expect(source).not.toContain("auth provider");
    expect(source).toContain('fetch("/api/account/profile"');
    expect(source).not.toContain('.from("users")\n      .update');
  });
});
