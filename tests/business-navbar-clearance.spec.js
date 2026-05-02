import { expect, test } from "@playwright/test";

const businessEmail = process.env.E2E_BUSINESS_EMAIL;
const businessPassword = process.env.E2E_BUSINESS_PASSWORD;
const BUSINESS_SHELL_GAP_PX = 16;

const ROUTES = [
  { path: "/business/dashboard", heading: /Payouts|Checking payout setup/i },
  {
    path: "/business/profile",
    heading: /.+/i,
    expectedSurfaceGap: 0,
    targetSelector: '[data-testid="profile-hero-cover"]',
  },
  { path: "/business/orders", heading: /Manage orders/i },
  { path: "/business/listings", heading: /Catalog|No listings yet/i },
  { path: "/business/listings/new", heading: /Create a new listing/i },
  { path: "/business/messages", heading: /Messages/i },
  { path: "/business/settings", heading: /Settings/i },
];

const VIEWPORTS = [
  { name: "desktop", width: 1366, height: 900 },
  { name: "mobile", width: 390, height: 844 },
];

async function loginBusiness(page) {
  await page.goto("/business-auth/login");
  await page.locator("#business-login-email").fill(businessEmail);
  await page.locator("#business-login-password").fill(businessPassword);
  await page.getByRole("button", { name: /log in/i }).click();
  await expect(page).toHaveURL(/\/business\/dashboard/);
}

test.describe("business navbar clearance", () => {
  test.skip(
    !businessEmail || !businessPassword,
    "Set E2E_BUSINESS_* env vars for business navbar clearance coverage"
  );

  for (const viewport of VIEWPORTS) {
    test.describe(viewport.name, () => {
      test.use({ viewport: { width: viewport.width, height: viewport.height } });

      for (const route of ROUTES) {
        test(`${route.path} content starts below the fixed navbar without a duplicate gap`, async ({ page }) => {
          await loginBusiness(page);
          await page.goto(route.path);

          const navbar = page.locator('nav[data-business-navbar="1"]').first();
          await expect(navbar).toBeVisible();

          const heading = page.getByRole("heading", { name: route.heading }).first();
          await expect(heading).toBeVisible();

          const geometry = await page.evaluate((targetSelector) => {
            const nav = document.querySelector('nav[data-business-navbar="1"]');
            const shell = document.querySelector('[data-testid="business-route-shell"]');
            const pageSurface = shell?.firstElementChild;
            const target =
              targetSelector
                ? document.querySelector(targetSelector)
                : document.querySelector("h1, h2");
            if (!nav || !shell || !pageSurface || !target) return null;
            const navRect = nav.getBoundingClientRect();
            const shellRect = shell.getBoundingClientRect();
            const targetRect = target.getBoundingClientRect();
            const shellPaddingTop = window.getComputedStyle(shell).paddingTop;
            const pageSurfacePaddingTop = window.getComputedStyle(pageSurface).paddingTop;
            const navOffset = window.getComputedStyle(document.documentElement).getPropertyValue(
              "--yb-nav-content-offset"
            );
            const shellPaddingTopPx = Number.parseFloat(shellPaddingTop);
            const pageSurfacePaddingTopPx = Number.parseFloat(pageSurfacePaddingTop);
            const navOffsetPx = Number.parseFloat(navOffset);
            return {
              navBottom: navRect.bottom,
              shellTop: shellRect.top,
              shellPaddingTop,
              pageSurfacePaddingTop,
              navOffset,
              shellPaddingTopPx,
              pageSurfacePaddingTopPx,
              navOffsetPx,
              targetTop: targetRect.top,
              targetGap: targetRect.top - navRect.bottom,
            };
          }, route.targetSelector || null);

          expect(geometry).toBeTruthy();
          const expectedSurfaceGap = route.expectedSurfaceGap ?? BUSINESS_SHELL_GAP_PX;
          expect(geometry.targetTop).toBeGreaterThanOrEqual(geometry.navBottom - 2);
          expect(geometry.targetGap).toBeGreaterThanOrEqual(expectedSurfaceGap - 2);
          expect(geometry.targetGap).toBeLessThanOrEqual(88);
          expect(geometry.shellPaddingTopPx).toBeCloseTo(geometry.navOffsetPx, 0);
          expect(geometry.pageSurfacePaddingTopPx).toBeCloseTo(expectedSurfaceGap, 0);
        });
      }
    });
  }
});
