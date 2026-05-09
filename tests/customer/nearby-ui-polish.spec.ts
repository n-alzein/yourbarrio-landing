import { expect, test } from "@playwright/test";

const customerEmail = process.env.E2E_CUSTOMER_EMAIL;
const customerPassword = process.env.E2E_CUSTOMER_PASSWORD;

const installStableLocation = async (page: import("@playwright/test").Page) => {
  await page.addInitScript(() => {
    const value = JSON.stringify({
      source: "manual",
      city: "Long Beach",
      region: "CA",
      country: "US",
      lat: 33.7701,
      lng: -118.1937,
      label: "Long Beach, CA",
      updatedAt: Date.now(),
    });
    localStorage.setItem("yb-location", value);
    localStorage.setItem("yb-city", "Long Beach");
  });
};

const loginCustomer = async (page: import("@playwright/test").Page) => {
  await page.goto("/?returnUrl=/customer/home");
  await page.getByRole("button", { name: /log in/i }).click();
  await page.locator("#customer-login-email").fill(customerEmail || "");
  await page.locator("#customer-login-password").fill(customerPassword || "");
  await page.locator("form").getByRole("button", { name: /log in/i }).click();
  await expect(page).toHaveURL(/\/customer\/home/);
};

test.describe("Nearby UI polish", () => {
  test("loads first-row business identity images immediately without using covers as avatars", async ({ page }) => {
    const imageWarnings: string[] = [];
    page.on("console", (message) => {
      const text = message.text();
      if (/image.*fill.*parent|parent.*height.*0/i.test(text)) {
        imageWarnings.push(text);
      }
    });

    await installStableLocation(page);
    await page.setViewportSize({ width: 1366, height: 900 });
    await page.route("**/api/public-businesses**", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          businessTypes: [{ id: "boutique", name: "Boutique", slug: "boutique" }],
          businesses: [
            {
              id: "nearby-cover-1",
              public_id: "nearby-cover-1",
              business_name: "First Row Cover",
              category: "Boutique",
              business_type_slug: "boutique",
              city: "Long Beach",
              state: "CA",
              profile_photo_url: "/images/fallback/categories/fashion.png",
              cover_photo_url: "/images/fallback/business-profile-cover-neighborhood.png",
              latitude: 33.7701,
              longitude: -118.1937,
            },
            {
              id: "nearby-cover-2",
              public_id: "nearby-cover-2",
              business_name: "First Row Fallback",
              category: "Boutique",
              business_type_slug: "boutique",
              city: "Long Beach",
              state: "CA",
              profile_photo_url: "/images/fallback/categories/fashion.png",
              latitude: 33.7702,
              longitude: -118.1938,
            },
            {
              id: "nearby-cover-3",
              public_id: "nearby-cover-3",
              business_name: "First Row Third",
              category: "Boutique",
              business_type_slug: "boutique",
              city: "Long Beach",
              state: "CA",
              profile_photo_url: "/images/fallback/categories/fashion.png",
              cover_photo_url: "/images/fallback/business-profile-cover-neighborhood.png",
              latitude: 33.7703,
              longitude: -118.1939,
            },
            {
              id: "nearby-cover-4",
              public_id: "nearby-cover-4",
              business_name: "Lazy Row Cover",
              category: "Boutique",
              business_type_slug: "boutique",
              city: "Long Beach",
              state: "CA",
              cover_photo_url: "/images/fallback/business-profile-cover-neighborhood.png",
              latitude: 33.7704,
              longitude: -118.194,
            },
          ],
        }),
      });
    });

    await page.goto("/nearby", { waitUntil: "domcontentloaded" });

    const cards = page.locator('[data-testid="nearby-results-list"] article');
    await expect(cards.first()).toBeVisible();

    const firstMedia = cards.first().getByTestId("nearby-business-card-media");
    const firstBox = await firstMedia.boundingBox();
    expect(firstBox?.height || 0).toBeGreaterThan(80);
    expect(firstBox?.width || 0).toBeGreaterThan(200);

    const firstImage = firstMedia.locator("img").first();
    await expect(firstImage).toHaveAttribute("loading", "eager");
    await expect(firstImage).toHaveAttribute("fetchpriority", "high");
    await expect(firstImage).toHaveAttribute("src", /categories\/fashion/);
    await expect(firstImage).not.toHaveAttribute("src", /business-profile-cover-neighborhood/);

    await expect(cards.nth(1).getByTestId("nearby-business-card-media").locator("img").first()).toHaveAttribute(
      "loading",
      "eager"
    );
    await expect(cards.nth(2).getByTestId("nearby-business-card-media").locator("img").first()).toHaveAttribute(
      "loading",
      "eager"
    );
    await expect(cards.nth(3).getByTestId("nearby-business-card-media").locator("img").first()).toHaveCount(0);
    await expect(
      cards.nth(3).getByTestId("nearby-business-card-media").locator("[data-business-avatar-placeholder='true']")
    ).toBeVisible();
    expect(imageWarnings).toEqual([]);
  });

  test("header spacing is tight and split view occupies viewport", async ({ page }) => {
    test.skip(!customerEmail || !customerPassword, "Set E2E_CUSTOMER_* env vars");

    await installStableLocation(page);
    await loginCustomer(page);
    await page.setViewportSize({ width: 1366, height: 900 });
    await page.goto("/customer/nearby");

    const header = page.getByTestId("nearby-header");
    await expect(header).toBeVisible();

    const sectionClasses = (await page.getByTestId("nearby-page-root").getAttribute("class")) || "";
    expect(sectionClasses).not.toContain("pt-10");
    expect(sectionClasses).not.toContain("pt-8");

    const splitView = page.getByTestId("nearby-splitview");
    const splitBox = await splitView.boundingBox();
    expect(splitBox).toBeTruthy();
    expect((splitBox?.height || 0) / 900).toBeGreaterThan(0.6);
  });

  test("recenter button exists and popup description is clamped", async ({ page }) => {
    test.skip(!customerEmail || !customerPassword, "Set E2E_CUSTOMER_* env vars");

    await installStableLocation(page);
    await loginCustomer(page);
    await page.goto("/customer/nearby");

    await expect(page.getByTestId("recenter-map")).toBeVisible();

    const firstCard = page.locator('[data-testid="nearby-results-list"] article button').first();
    await expect(firstCard).toBeVisible();
    await firstCard.click();

    const popupDescription = page.getByTestId("map-popup-description").first();
    const hasPopupDescription = (await popupDescription.count()) > 0;
    test.skip(!hasPopupDescription, "No popup description available in current fixture data");

    const webkitClamp = await popupDescription.evaluate((el) =>
      getComputedStyle(el).getPropertyValue("-webkit-line-clamp")
    );
    expect(webkitClamp.trim()).toBe("3");
  });

  test("mobile map view shows recenter button", async ({ page }) => {
    test.skip(!customerEmail || !customerPassword, "Set E2E_CUSTOMER_* env vars");

    await installStableLocation(page);
    await loginCustomer(page);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/customer/nearby");

    await page.getByTestId("nearby-toggle-map").tap();
    await expect(page.getByTestId("recenter-map")).toBeVisible();
  });
});
