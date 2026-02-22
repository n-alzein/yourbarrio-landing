import { expect, test, type Page } from "@playwright/test";

const adminSuperEmail = process.env.E2E_ADMIN_SUPER_EMAIL;
const adminSuperPassword = process.env.E2E_ADMIN_SUPER_PASSWORD;

async function signInAndOpenFeatureFlags(page: Page) {
  await page.goto("/signin?modal=signin&next=/admin/settings/features");
  await page.getByLabel(/email/i).first().fill(adminSuperEmail as string);
  await page.getByLabel(/password/i).first().fill(adminSuperPassword as string);
  await page.locator("form").getByRole("button", { name: /log in/i }).click();
  await expect(page).toHaveURL(/\/admin\/settings\/features/);
  await expect(page.getByTestId("feature-flag-card")).toBeVisible();
}

async function isNearbyPublicEnabled(page: Page) {
  const stateText = (await page.getByTestId("nearby-public-state").textContent()) || "";
  return stateText.toLowerCase().includes("enabled");
}

async function ensureNearbyPublicState(page: Page, enabled: boolean) {
  await page.goto("/admin/settings/features");
  await expect(page).toHaveURL(/\/admin\/settings\/features/);

  const currentEnabled = await isNearbyPublicEnabled(page);
  if (currentEnabled !== enabled) {
    await page.getByTestId("nearby-public-toggle").click();
    await expect
      .poll(async () => isNearbyPublicEnabled(page), {
        timeout: 10000,
      })
      .toBe(enabled);
  }

  await page.reload();
  await expect
    .poll(async () => isNearbyPublicEnabled(page), {
      timeout: 10000,
    })
    .toBe(enabled);
}

test.describe.configure({ mode: "serial" });

test.describe("Customer nearby public feature flag", () => {
  test.beforeEach(async ({ page }) => {
    test.skip(
      !adminSuperEmail || !adminSuperPassword,
      "Set E2E_ADMIN_SUPER_EMAIL and E2E_ADMIN_SUPER_PASSWORD"
    );

    await signInAndOpenFeatureFlags(page);
  });

  test("super admin toggle persists across reload", async ({ page }) => {
    await ensureNearbyPublicState(page, false);
    await ensureNearbyPublicState(page, true);
    await ensureNearbyPublicState(page, false);
  });

  test("middleware enforces OFF and allows ON for guest /customer/nearby", async ({ page, browser }) => {
    await ensureNearbyPublicState(page, false);

    const guestOffContext = await browser.newContext();
    const guestOffPage = await guestOffContext.newPage();
    await guestOffPage.goto("/customer/nearby");
    await expect(guestOffPage).toHaveURL(/\/signin\?/);
    await guestOffContext.close();

    await ensureNearbyPublicState(page, true);

    const guestOnContext = await browser.newContext();
    const guestOnPage = await guestOnContext.newPage();
    await guestOnPage.goto("/customer/nearby");
    await expect(guestOnPage).toHaveURL(/\/customer\/nearby/);
    await expect(guestOnPage.getByTestId("nearby-page-root")).toBeVisible();
    await expect(guestOnPage.getByTestId("nearby-public-guest-banner")).toContainText(
      /sign in for personalized results and saved places/i
    );
    await guestOnContext.close();

    await ensureNearbyPublicState(page, false);
  });
});
