import { test, expect } from "@playwright/test";

const customerEmail = process.env.E2E_CUSTOMER_EMAIL;
const customerPassword = process.env.E2E_CUSTOMER_PASSWORD;

const touchScroll = async (page, start, end, steps = 6) => {
  const client = await page.context().newCDPSession(page);
  await client.send("Input.dispatchTouchEvent", {
    type: "touchStart",
    touchPoints: [start],
  });

  for (let i = 1; i <= steps; i += 1) {
    const x = start.x + (end.x - start.x) * (i / steps);
    const y = start.y + (end.y - start.y) * (i / steps);
    await client.send("Input.dispatchTouchEvent", {
      type: "touchMove",
      touchPoints: [{ x, y }],
    });
  }

  await client.send("Input.dispatchTouchEvent", {
    type: "touchEnd",
    touchPoints: [],
  });
};

test.describe("Customer home tile scroll", () => {
  test.use({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
    deviceScaleFactor: 3,
  });

  test("scrolling over tiles does not trigger navigation, tap does", async ({ page }) => {
    test.skip(!customerEmail || !customerPassword, "Set E2E_CUSTOMER_* env vars");

    await page.goto("/?returnUrl=/customer/home");
    await page.getByRole("button", { name: /log in/i }).click();
    await page.locator("#customer-login-email").fill(customerEmail);
    await page.locator("#customer-login-password").fill(customerPassword);
    await page.locator("form").getByRole("button", { name: /log in/i }).click();

    await expect(page).toHaveURL(/\/customer\/home/);
    const tile = page.locator('[data-listing-tile="1"]').first();
    await expect(tile).toBeVisible();

    await page.evaluate(() => {
      window.__tileClicks = 0;
      document.addEventListener(
        "click",
        (event) => {
          const tileEl = event.target?.closest?.('[data-listing-tile="1"]');
          if (tileEl) window.__tileClicks += 1;
        },
        true
      );
    });

    const startUrl = page.url();
    const box = await tile.boundingBox();
    expect(box).toBeTruthy();

    const startPoint = {
      x: box.x + box.width / 2,
      y: box.y + box.height / 2,
    };
    const endPoint = {
      x: startPoint.x,
      y: startPoint.y - 160,
    };

    await touchScroll(page, startPoint, endPoint);
    await page.waitForTimeout(300);

    await expect(page).toHaveURL(startUrl);
    await expect(page.evaluate(() => window.__tileClicks)).resolves.toBe(0);

    await tile.tap();
    await expect(page).toHaveURL(/\/customer\/listings\//);
  });
});
