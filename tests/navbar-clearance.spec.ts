import { expect, test } from "@playwright/test";

const customerEmail = process.env.E2E_CUSTOMER_EMAIL;
const customerPassword = process.env.E2E_CUSTOMER_PASSWORD;

const ROUTES = [
  { path: "/", selector: '[data-testid="hero-headline-shell"]', requiresAuth: false },
  { path: "/nearby", selector: '[data-testid="nearby-search-input"]', requiresAuth: false },
  { path: "/customer/home", selector: '[data-home-content="1"]', requiresAuth: true },
  { path: "/customer/messages", selector: "h1", requiresAuth: true },
  { path: "/customer/nearby", selector: '[data-testid="nearby-search-input"]', requiresAuth: true },
  { path: "/cart", selector: "h1", requiresAuth: false },
  { path: "/account/orders", selector: "h1", requiresAuth: true },
  { path: "/account/purchase-history", selector: "h1", requiresAuth: true },
  { path: "/orders/test-order?from=checkout", selector: "h1", requiresAuth: true },
];

const VIEWPORTS = [
  { name: "desktop", width: 1366, height: 900 },
  { name: "mobile", width: 390, height: 844 },
];

async function installStableLocation(page: import("@playwright/test").Page) {
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
}

async function loginCustomer(page: import("@playwright/test").Page) {
  await page.goto("/?returnUrl=/customer/home");
  await page.getByRole("button", { name: /log in/i }).click();
  await page.locator("#customer-login-email").fill(customerEmail || "");
  await page.locator("#customer-login-password").fill(customerPassword || "");
  await page.locator("form").getByRole("button", { name: /log in/i }).click();
  await expect(page).toHaveURL(/\/customer\/home/);
}

test.describe("navbar clearance", () => {
  for (const viewport of VIEWPORTS) {
    test.describe(viewport.name, () => {
      test.use({ viewport: { width: viewport.width, height: viewport.height } });

      for (const route of ROUTES) {
        test(`${route.path} starts below the navbar`, async ({ page }) => {
          test.skip(
            route.requiresAuth && (!customerEmail || !customerPassword),
            "Set E2E_CUSTOMER_* env vars for auth-gated route coverage"
          );

          if (route.requiresAuth) {
            await installStableLocation(page);
            await loginCustomer(page);
          }

          await page.goto(route.path);

          const navbar = page.locator("nav.yb-navbar").first();
          await expect(navbar).toBeVisible();
          const anchor = page.locator(route.selector).first();
          await expect(anchor).toBeVisible();

          const navbarBox = await navbar.boundingBox();
          const anchorBox = await anchor.boundingBox();
          expect(navbarBox).toBeTruthy();
          expect(anchorBox).toBeTruthy();
          expect(anchorBox?.y ?? -1).toBeGreaterThanOrEqual(
            (navbarBox?.y ?? 0) + (navbarBox?.height ?? 0) + 8
          );

          if (route.path === "/") {
            const hero = page.getByTestId("home-hero");
            await expect(hero).toBeVisible();
            const heroBox = await hero.boundingBox();
            expect(heroBox).toBeTruthy();
            expect(heroBox?.y ?? 999).toBeLessThanOrEqual(
              (navbarBox?.y ?? 0) + (navbarBox?.height ?? 0) + 1
            );

            const cta = page.getByRole("link", { name: /explore local businesses/i }).first();
            await expect(cta).toBeVisible();
            const ctaBox = await cta.boundingBox();
            expect(ctaBox).toBeTruthy();
            expect(ctaBox?.y ?? -1).toBeGreaterThanOrEqual(
              (navbarBox?.y ?? 0) + (navbarBox?.height ?? 0) + 8
            );
          }
        });
      }
    });
  }
});
