import { test, expect } from "@playwright/test";

const businessEmail = process.env.E2E_BUSINESS_EMAIL;
const businessPassword = process.env.E2E_BUSINESS_PASSWORD;

test.describe("Business logout", () => {
  test("redirects to login after logout from protected page", async ({ page }) => {
    test.skip(
      !businessEmail || !businessPassword,
      "Set E2E_BUSINESS_* env vars"
    );

    await page.goto("/business-auth/login");
    await page.locator("#business-login-email").fill(businessEmail);
    await page.locator("#business-login-password").fill(businessPassword);
    await page.getByRole("button", { name: /log in/i }).click();

    await page.goto("/business/orders");

    await page
      .locator('nav[data-business-navbar="1"] button:has(img[alt="Avatar"])')
      .click();
    await page.getByRole("button", { name: /logout/i }).click();

    await expect(page).toHaveURL(/\/business-auth\/login/);
    await expect(page.locator("nav[data-business-navbar=\"1\"]")).toHaveCount(0);
  });
});
