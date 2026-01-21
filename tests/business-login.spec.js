import { test, expect } from "@playwright/test";

const businessEmail = process.env.E2E_BUSINESS_EMAIL;
const businessPassword = process.env.E2E_BUSINESS_PASSWORD;

test.describe("Business login", () => {
  test("redirects to business dashboard after successful login", async ({ page }) => {
    test.skip(
      !businessEmail || !businessPassword,
      "Set E2E_BUSINESS_* env vars"
    );

    await page.goto("/business-auth/login");

    await page.locator("#business-login-email").fill(businessEmail);
    await page.locator("#business-login-password").fill(businessPassword);
    await page.getByRole("button", { name: /log in/i }).click();

    await expect(page).toHaveURL(/\/business\/dashboard/);
  });
});
