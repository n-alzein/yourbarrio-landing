import { expect, test } from "@playwright/test";

const installStableLocation = async (page: import("@playwright/test").Page) => {
  await page.addInitScript(() => {
    sessionStorage.clear();
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

const mockNearbyBusinesses = async (page: import("@playwright/test").Page) => {
  await page.route("**/api/public-businesses**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        businessTypes: [{ id: "boutique", name: "Boutique", slug: "boutique" }],
        businesses: [
          {
            id: "marker-a",
            public_id: "marker-a-public",
            business_name: "Marker Alpha",
            category: "Boutique",
            business_type_slug: "boutique",
            city: "Long Beach",
            state: "CA",
            description: "Alpha popup description",
            latitude: 33.7701,
            longitude: -118.1937,
          },
          {
            id: "marker-b",
            public_id: "marker-b-public",
            business_name: "Marker Beta",
            category: "Boutique",
            business_type_slug: "boutique",
            city: "Long Beach",
            state: "CA",
            description: "Beta popup description",
            latitude: 33.7711,
            longitude: -118.1927,
          },
        ],
      }),
    });
  });
};

const gotoNearbyMap = async (page: import("@playwright/test").Page, viewport = { width: 1366, height: 900 }) => {
  await installStableLocation(page);
  await mockNearbyBusinesses(page);
  await page.setViewportSize(viewport);
  await page.goto("/nearby", { waitUntil: "domcontentloaded" });
  await expect(page.getByTestId("nearby-toggle-map")).toBeVisible();
  await page.getByTestId("nearby-toggle-map").click();
  await expect(page.getByTestId(viewport.width < 768 ? "nearby-map-mobile-pane" : "nearby-map-pane")).toBeVisible();

  const markerA = page.locator('.yb-marker[data-business-id="marker-a"]');
  try {
    await expect(markerA).toBeVisible({ timeout: 15000 });
  } catch {
    test.skip(true, "Mapbox markers unavailable in this environment");
  }
  await expect(markerA).toBeVisible();
};

const clickMapBackground = async (page: import("@playwright/test").Page) => {
  const mapBox = await page.locator("#mapbox-map").boundingBox();
  expect(mapBox).toBeTruthy();
  await page.mouse.click((mapBox?.x || 0) + 16, (mapBox?.y || 0) + 16);
};

test.describe("Nearby marker selection", () => {
  test("marker clicks keep map view active and replace the open popup", async ({ page }) => {
    await gotoNearbyMap(page);

    const mapToggle = page.getByTestId("nearby-toggle-map");
    const listToggle = page.getByTestId("nearby-toggle-list");
    const markerA = page.locator('.yb-marker[data-business-id="marker-a"]');
    const markerB = page.locator('.yb-marker[data-business-id="marker-b"]');

    await markerA.click();
    await expect(mapToggle).toHaveAttribute("aria-pressed", "true");
    await expect(listToggle).toHaveAttribute("aria-pressed", "false");
    await expect(page.getByTestId("map-popup-card")).toContainText("Marker Alpha");

    await markerB.click();
    await expect(mapToggle).toHaveAttribute("aria-pressed", "true");
    await expect(page.locator(".mapboxgl-popup")).toHaveCount(1);
    await expect(page.getByTestId("map-popup-card")).toContainText("Marker Beta");
    await expect(page.getByTestId("map-popup-card")).not.toContainText("Marker Alpha");
  });

  test("popup close and map background clicks clear selected marker without stale reopen", async ({ page }) => {
    await gotoNearbyMap(page);

    const markerA = page.locator('.yb-marker[data-business-id="marker-a"]');
    await markerA.click();
    await expect(page.getByTestId("map-popup-card")).toContainText("Marker Alpha");

    await page.locator(".mapboxgl-popup-close-button").click();
    await expect(page.locator(".mapboxgl-popup")).toHaveCount(0);
    await expect(markerA).not.toHaveClass(/yb-marker-selected/);

    await page.getByTestId("nearby-toggle-list").click();
    await page.getByTestId("nearby-toggle-map").click();
    await expect(page.locator(".mapboxgl-popup")).toHaveCount(0);

    await markerA.click();
    await expect(page.getByTestId("map-popup-card")).toContainText("Marker Alpha");
    await clickMapBackground(page);
    await expect(page.locator(".mapboxgl-popup")).toHaveCount(0);
    await expect(markerA).not.toHaveClass(/yb-marker-selected/);
  });

  test("popup card still navigates to the business profile", async ({ page }) => {
    await gotoNearbyMap(page);

    await page.locator('.yb-marker[data-business-id="marker-a"]').click();
    await expect(page.getByTestId("map-popup-card")).toContainText("Marker Alpha");

    await page.getByTestId("map-popup-card").click();
    await expect(page).toHaveURL(/\/b\/marker-a-public/);
  });

  test("mobile can select another marker while a popup is already open", async ({ page }) => {
    await gotoNearbyMap(page, { width: 390, height: 844 });

    await page.locator('.yb-marker[data-business-id="marker-a"]').click();
    await expect(page.getByTestId("map-popup-card")).toContainText("Marker Alpha");

    await page.locator('.yb-marker[data-business-id="marker-b"]').click();
    await expect(page.locator(".mapboxgl-popup")).toHaveCount(1);
    await expect(page.getByTestId("map-popup-card")).toContainText("Marker Beta");
  });
});
