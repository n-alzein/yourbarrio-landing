import { expect, test } from "@playwright/test";

test("public business profile stays visible for guests when auth and business media fail", async ({
  page,
  request,
}) => {
  await page.route("**/api/me", async (route) => {
    await route.fulfill({
      status: 401,
      contentType: "application/json",
      body: JSON.stringify({
        user: null,
        profile: null,
        accountContext: { role: "guest", isAuthenticated: false },
      }),
    });
  });

  await page.route("**/storage/v1/object/public/business-photos/**", async (route) => {
    await route.fulfill({ status: 404, body: "missing test media" });
  });
  await page.route("**/business-photos/**", async (route) => {
    await route.fulfill({ status: 404, body: "missing test media" });
  });

  await page.goto("/b/seed-shoreline-beauty", { waitUntil: "domcontentloaded" });

  await expect(page.getByTestId("public-business-profile-content")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Shoreline Beauty" })).toBeVisible();
  await expect(page.getByText("We need one more refresh")).toHaveCount(0);
  await expect(page.locator("[data-business-avatar-placeholder]:visible").first()).toBeVisible();

  const missingLegacyPhoto = await request.get("/business-photos/does-not-exist.jpg", {
    maxRedirects: 0,
  });
  expect(missingLegacyPhoto.status()).toBe(307);
  expect(missingLegacyPhoto.headers().location).toContain("/business-placeholder.png");
});
