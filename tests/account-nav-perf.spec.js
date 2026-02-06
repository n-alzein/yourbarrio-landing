import { test, expect } from "@playwright/test";

const customerEmail = process.env.E2E_CUSTOMER_EMAIL;
const customerPassword = process.env.E2E_CUSTOMER_PASSWORD;

const loginCustomer = async (page) => {
  await page.goto("/?returnUrl=/account/orders");
  await page.getByRole("button", { name: /log in/i }).click();
  await page.locator("#customer-login-email").fill(customerEmail);
  await page.locator("#customer-login-password").fill(customerPassword);
  await page.locator("form").getByRole("button", { name: /log in/i }).click();
  await expect(page).toHaveURL(/\/account\/orders/);
};

test.describe("Account nav input latency", () => {
  test("click to handler-start stays under threshold", async ({ page, browserName }) => {
    test.skip(!customerEmail || !customerPassword, "Set E2E_CUSTOMER_* env vars");

    await page.addInitScript(() => {
      window.localStorage.setItem("PERF_DEBUG", "1");
    });

    await loginCustomer(page);

    const historyTab = page.locator(
      '[data-perf="account-nav"][data-perf-id="history"]'
    );
    await expect(historyTab).toBeVisible();

    await historyTab.click();
    await expect(page).toHaveURL(/\/account\/purchase-history/);

    const entry = await page.evaluate(() => {
      const logs = window.__PERF_NAV_LOGS__ || [];
      return logs.filter((log) => log.id === "history").slice(-1)[0] || null;
    });

    expect(entry).toBeTruthy();
    expect(entry.deltas).toBeTruthy();

    const thresholdMs = browserName === "webkit" ? 300 : 200;
    const inputToHandler = entry.deltas.inputToHandler;

    expect(typeof inputToHandler).toBe("number");
    expect(inputToHandler).toBeLessThan(thresholdMs);
  });
});
