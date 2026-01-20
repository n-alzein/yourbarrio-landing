import { test, expect } from "@playwright/test";

const customerEmail = process.env.E2E_CUSTOMER_EMAIL;
const customerPassword = process.env.E2E_CUSTOMER_PASSWORD;

test.describe("Customer saved listings", () => {
  test("renders saved listings on first visit and refresh", async ({ page }) => {
    test.skip(!customerEmail || !customerPassword, "Set E2E_CUSTOMER_* env vars");

    await page.goto("/");
    await page.getByRole("button", { name: /log in/i }).click();

    await page.locator("#customer-login-email").fill(customerEmail);
    await page.locator("#customer-login-password").fill(customerPassword);
    await page.locator("form").getByRole("button", { name: /log in/i }).click();

    await page.goto("/customer/home");
    const listingLink = page.locator("a[href^='/listings/']").first();
    await listingLink.click();

    const listingTitle = await page
      .getByRole("heading", { level: 1 })
      .first()
      .textContent();
    expect(listingTitle).toBeTruthy();

    const saveButton = page.getByRole("button", {
      name: /save listing|unsave listing/i,
    });
    await expect(saveButton).toBeVisible();
    const label = await saveButton.getAttribute("aria-label");
    if (label && label.toLowerCase().includes("save listing")) {
      await saveButton.click();
      await expect(saveButton).toHaveAttribute("aria-label", /unsave listing/i);
    }

    await page.goto("/customer/saved");
    await expect(page.locator("text=Fetching your saved picks")).toHaveCount(0);
    await expect(page.getByRole("heading", { name: listingTitle })).toBeVisible();

    await page.reload();
    await expect(page.getByRole("heading", { name: listingTitle })).toBeVisible();
    await expect(page.locator("text=Nothing saved yet")).toHaveCount(0);
  });
});
