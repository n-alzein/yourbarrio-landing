import { expect, test, type Page } from "@playwright/test";

const MOBILE_VIEWPORT = { width: 390, height: 844 };

const ROUTES = [
  { path: "/", hasNavbar: true, anchor: '[data-testid="hero-headline-shell"]' },
  { path: "/nearby", hasNavbar: true, anchor: '[data-testid="nearby-search-input"]' },
  { path: "/login", hasNavbar: false, anchor: "h1" },
  { path: "/auth/forgot-password", hasNavbar: false, anchor: "h1" },
  {
    path: "/set-password?token_hash=test&type=recovery",
    hasNavbar: false,
    anchor: "h1",
  },
  { path: "/business/login", hasNavbar: true, anchor: "h1" },
  { path: "/cart", hasNavbar: true, anchor: "h1" },
  { path: "/checkout", hasNavbar: false, anchor: "h1" },
];

async function installScrollProbe(page: Page) {
  await page.addInitScript(() => {
    window.__ybMobileScrollProbe = {
      samples: [],
      layoutShift: 0,
    };

    try {
      if ("PerformanceObserver" in window) {
        const observer = new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) {
            const layoutShiftEntry = entry as PerformanceEntry & {
              value?: number;
              hadRecentInput?: boolean;
            };
            if (!layoutShiftEntry.hadRecentInput) {
              window.__ybMobileScrollProbe.layoutShift +=
                layoutShiftEntry.value || 0;
            }
          }
        });
        observer.observe({ type: "layout-shift", buffered: true });
      }
    } catch {
      // Layout shift entries are best-effort and not available in every engine.
    }

    const startedAt = performance.now();
    const sample = () => {
      window.__ybMobileScrollProbe.samples.push({
        t: Math.round(performance.now() - startedAt),
        y: Math.round(window.scrollY || document.documentElement.scrollTop || 0),
      });
      if (performance.now() - startedAt < 2200) {
        requestAnimationFrame(sample);
      }
    };
    requestAnimationFrame(sample);
  });
}

async function getProbe(page: Page) {
  return page.evaluate(() => window.__ybMobileScrollProbe);
}

async function resetScrollProbe(page: Page) {
  await page.evaluate(() => {
    window.__ybMobileScrollProbe.samples = [];
    window.__ybMobileScrollProbe.layoutShift = 0;
  });
}

async function expectTopStable(page: Page) {
  const earlyScrollY = await page.evaluate(() =>
    Math.round(window.scrollY || document.documentElement.scrollTop || 0)
  );
  expect(Math.abs(earlyScrollY)).toBeLessThanOrEqual(2);

  await page.waitForTimeout(1400);

  const probe = await getProbe(page);
  const maxScrollY = Math.max(...probe.samples.map((sample) => sample.y));
  const lastScrollY = probe.samples.at(-1)?.y ?? 0;
  expect(maxScrollY).toBeLessThanOrEqual(2);
  expect(Math.abs(lastScrollY)).toBeLessThanOrEqual(2);
  expect(probe.layoutShift).toBeLessThan(0.15);
}

async function expectContentClearsNavbar(page: Page, anchorSelector: string) {
  const navbar = page.locator("nav.yb-navbar").first();
  await expect(navbar).toBeVisible();
  await expect(page.locator(anchorSelector).first()).toBeVisible();

  const clearance = await page.evaluate((selector) => {
    const nav = document.querySelector("nav.yb-navbar");
    const anchor = document.querySelector(selector);
    if (!nav || !anchor) return null;
    const navBox = nav.getBoundingClientRect();
    const anchorBox = anchor.getBoundingClientRect();
    return {
      navBottom: navBox.bottom,
      anchorTop: anchorBox.top,
      shellPaddingTop: window.getComputedStyle(
        document.querySelector('[data-testid="public-shell-content"], [data-testid="customer-shell-content"]') ||
          document.body
      ).paddingTop,
    };
  }, anchorSelector);

  expect(clearance).toBeTruthy();
  const shellPaddingTop = Number.parseFloat(clearance?.shellPaddingTop || "0");
  if (shellPaddingTop > 0) {
    expect(shellPaddingTop).toBeGreaterThanOrEqual(
      Math.floor(clearance?.navBottom || 0) - 1
    );
  }
  expect(clearance?.anchorTop ?? -1).toBeGreaterThanOrEqual(
    (clearance?.navBottom ?? 0) - 1
  );
}

test.describe("mobile initial page scroll", () => {
  test.use({
    viewport: MOBILE_VIEWPORT,
    isMobile: true,
    hasTouch: true,
  });

  for (const route of ROUTES) {
    test(`${route.path} paints at the top and stays there`, async ({ page }) => {
      await installScrollProbe(page);
      await page.goto(route.path, { waitUntil: "domcontentloaded" });
      await expect(page.locator(route.anchor).first()).toBeVisible();

      await expectTopStable(page);

      if (route.hasNavbar) {
        await expectContentClearsNavbar(page, route.anchor);
      }
    });
  }

  test("client navigation to cart does not visibly correct scroll after render", async ({
    page,
  }) => {
    await installScrollProbe(page);
    await page.goto("/", { waitUntil: "domcontentloaded" });
    await expect(page.locator('[data-testid="hero-headline-shell"]').first()).toBeVisible();

    await page.evaluate(() => window.scrollTo(0, 700));
    await page.locator('a[href="/cart"]').first().click();
    await expect(page).toHaveURL(/\/cart/);
    await expect(page.locator("h1").first()).toBeVisible();

    await resetScrollProbe(page);
    await expectTopStable(page);
    await expectContentClearsNavbar(page, "h1");
  });
});

declare global {
  interface Window {
    __ybMobileScrollProbe: {
      samples: Array<{ t: number; y: number }>;
      layoutShift: number;
    };
  }
}
