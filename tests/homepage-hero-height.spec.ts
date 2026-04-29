import { expect, test } from "@playwright/test";

async function readHeroMetrics(page: import("@playwright/test").Page) {
  return page.evaluate(() => {
    const navbarEl = document.querySelector("nav.yb-navbar");
    const heroEl = document.querySelector('[data-testid="home-hero"]');
    const contentEl = heroEl?.querySelector(".mx-auto.flex.w-full.max-w-6xl");
    const ctaEl = Array.from(document.querySelectorAll("a")).find((element) =>
      /explore local businesses/i.test(element.textContent || "")
    );
    const popularEl = Array.from(document.querySelectorAll("h2, h3")).find((element) =>
      /Popular in Long Beach/.test(element.textContent || "")
    );

    if (!navbarEl || !heroEl || !contentEl || !ctaEl || !popularEl) {
      return null;
    }

    const navbarBox = navbarEl.getBoundingClientRect();
    const heroBox = heroEl.getBoundingClientRect();
    const contentBox = contentEl.getBoundingClientRect();
    const ctaBox = ctaEl.getBoundingClientRect();
    const popularBox = popularEl.getBoundingClientRect();

    return {
      viewportHeight: window.innerHeight,
      navbarHeight: navbarBox.height,
      heroHeight: heroBox.height,
      heroTop: heroBox.top,
      heroBottom: heroBox.bottom,
      contentTop: contentBox.top,
      contentHeight: contentBox.height,
      ctaTop: ctaBox.top,
      popularTop: popularBox.top,
    };
  });
}

test.describe("homepage hero rendered height", () => {
  test("desktop hero stays compact below the navbar", async ({ page }) => {
    await page.goto("/");

    const navbar = page.locator("nav.yb-navbar").first();
    const hero = page.getByTestId("home-hero");
    const cta = page.getByRole("link", { name: /explore local businesses/i }).first();
    const popularHeading = page.getByText("Popular in Long Beach").first();

    await expect(navbar).toBeVisible();
    await expect(hero).toBeVisible();
    await expect(cta).toBeVisible();
    await expect(popularHeading).toBeVisible();

    const metrics = await readHeroMetrics(page);

    expect(metrics).toBeTruthy();
    console.log("homepage-hero-metrics", JSON.stringify(metrics));

    expect(Math.abs((metrics?.heroTop ?? 999) - (metrics?.navbarHeight ?? 0))).toBeLessThanOrEqual(2);
    expect(metrics?.heroHeight ?? 0).toBeGreaterThanOrEqual(300);
    expect(metrics?.heroHeight ?? 999).toBeLessThanOrEqual(320);
    expect(metrics?.contentHeight ?? 999).toBeLessThanOrEqual(250);
    expect(metrics?.popularTop ?? 999).toBeLessThanOrEqual(430);
  });

  test("mobile hero stays compact below the navbar", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/");

    const hero = page.getByTestId("home-hero");
    const popularHeading = page.getByText("Popular in Long Beach").first();

    await expect(hero).toBeVisible();
    await expect(popularHeading).toBeVisible();

    const metrics = await readHeroMetrics(page);

    expect(metrics).toBeTruthy();
    console.log("homepage-hero-metrics-mobile", JSON.stringify(metrics));

    expect(Math.abs((metrics?.heroTop ?? 999) - (metrics?.navbarHeight ?? 0))).toBeLessThanOrEqual(2);
    expect(metrics?.heroHeight ?? 0).toBeGreaterThanOrEqual(280);
    expect(metrics?.heroHeight ?? 999).toBeLessThanOrEqual(320);
    expect(metrics?.popularTop ?? 999).toBeLessThanOrEqual(450);
  });
});
