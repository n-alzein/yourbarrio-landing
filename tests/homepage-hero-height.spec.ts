import { expect, test } from "@playwright/test";

async function readHeroMetrics(page: import("@playwright/test").Page) {
  return page.evaluate(() => {
    const navbarEl = document.querySelector("nav.yb-navbar");
    const heroEl = document.querySelector('[data-testid="home-hero"]');
    const contentEl = heroEl?.querySelector(".mx-auto.flex.w-full.max-w-6xl");
    const ctaEl = Array.from(document.querySelectorAll("a")).find((element) =>
      /explore local businesses/i.test(element.textContent || "")
    );
    const featuredEl = Array.from(document.querySelectorAll("h2, h3")).find((element) =>
      /Featured in Long Beach/.test(element.textContent || "")
    );

    if (!navbarEl || !heroEl || !contentEl || !ctaEl || !featuredEl) {
      return null;
    }

    const navbarBox = navbarEl.getBoundingClientRect();
    const heroBox = heroEl.getBoundingClientRect();
    const contentBox = contentEl.getBoundingClientRect();
    const ctaBox = ctaEl.getBoundingClientRect();
    const featuredBox = featuredEl.getBoundingClientRect();

    return {
      viewportHeight: window.innerHeight,
      navbarHeight: navbarBox.height,
      navbarBottom: navbarBox.bottom,
      heroHeight: heroBox.height,
      heroTop: heroBox.top,
      heroBottom: heroBox.bottom,
      contentTop: contentBox.top,
      contentHeight: contentBox.height,
      ctaTop: ctaBox.top,
      featuredTop: featuredBox.top,
    };
  });
}

test.describe("homepage hero rendered height", () => {
  test("desktop hero stays compact below the navbar", async ({ page }) => {
    await page.goto("/");

    const navbar = page.locator("nav.yb-navbar").first();
    const hero = page.getByTestId("home-hero");
    const cta = page.getByRole("link", { name: /explore local businesses/i }).first();
    const featuredHeading = page.getByText("Featured in Long Beach").first();

    await expect(navbar).toBeVisible();
    await expect(hero).toBeVisible();
    await expect(cta).toBeVisible();
    await expect(featuredHeading).toBeVisible();

    const metrics = await readHeroMetrics(page);

    expect(metrics).toBeTruthy();
    console.log("homepage-hero-metrics", JSON.stringify(metrics));

    expect(Math.abs(metrics?.heroTop ?? 999)).toBeLessThanOrEqual(2);
    expect(metrics?.navbarBottom ?? 999).toBeGreaterThanOrEqual(79);
    expect(metrics?.heroHeight ?? 0).toBeGreaterThanOrEqual(380);
    expect(metrics?.heroHeight ?? 999).toBeLessThanOrEqual(405);
    expect(metrics?.ctaTop ?? -1).toBeGreaterThanOrEqual((metrics?.navbarBottom ?? 0) + 8);
    expect(metrics?.contentHeight ?? 999).toBeLessThanOrEqual(250);
    expect(metrics?.featuredTop ?? 999).toBeLessThanOrEqual(430);
  });

  test("mobile hero stays compact below the navbar", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/");

    const hero = page.getByTestId("home-hero");
    const featuredHeading = page.getByText("Featured in Long Beach").first();

    await expect(hero).toBeVisible();
    await expect(featuredHeading).toBeVisible();

    const metrics = await readHeroMetrics(page);

    expect(metrics).toBeTruthy();
    console.log("homepage-hero-metrics-mobile", JSON.stringify(metrics));

    expect(Math.abs(metrics?.heroTop ?? 999)).toBeLessThanOrEqual(2);
    expect(metrics?.navbarBottom ?? 999).toBeGreaterThanOrEqual(79);
    expect(metrics?.heroHeight ?? 0).toBeGreaterThanOrEqual(360);
    expect(metrics?.heroHeight ?? 999).toBeLessThanOrEqual(430);
    expect(metrics?.ctaTop ?? -1).toBeGreaterThanOrEqual((metrics?.navbarBottom ?? 0) + 8);
    expect(metrics?.featuredTop ?? 999).toBeLessThanOrEqual(450);
  });

  test("mobile hero remains flush after returning from cart", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/");

    await expect(page.getByTestId("home-hero")).toBeVisible();
    await page.locator('a[href="/cart"]').first().click();
    await expect(page).toHaveURL(/\/cart$/);
    await expect(page.locator("nav.yb-navbar").first()).toBeVisible();

    await page.goBack();
    await expect(page).toHaveURL(/\/$/);
    await expect(page.getByTestId("home-hero")).toBeVisible();

    const metrics = await readHeroMetrics(page);
    expect(metrics).toBeTruthy();
    expect(Math.abs(metrics?.heroTop ?? 999)).toBeLessThanOrEqual(2);
    expect(metrics?.ctaTop ?? -1).toBeGreaterThanOrEqual((metrics?.navbarBottom ?? 0) + 8);

    const gapProbe = await page.evaluate(() => {
      const navbarEl = document.querySelector("nav.yb-navbar");
      const heroEl = document.querySelector('[data-testid="home-hero"]');
      const publicShell = document.querySelector('[data-testid="public-shell-content"]');
      if (!navbarEl || !heroEl) return null;
      const navbarBox = navbarEl.getBoundingClientRect();
      const heroBox = heroEl.getBoundingClientRect();
      const midpointX = Math.floor(window.innerWidth / 2);
      const element = document.elementFromPoint(midpointX, Math.floor(navbarBox.bottom + 4));
      return {
        heroTop: heroBox.top,
        navbarBottom: navbarBox.bottom,
        publicShellPaddingTop: publicShell ? window.getComputedStyle(publicShell).paddingTop : null,
        navBottomIsInsideHero: heroBox.top <= navbarBox.bottom && navbarBox.bottom <= heroBox.bottom,
        elementTag: element?.tagName || null,
        elementTestId: element?.getAttribute?.("data-testid") || null,
        elementBackground: element ? window.getComputedStyle(element).backgroundColor : null,
      };
    });

    expect(gapProbe).toBeTruthy();
    expect(Math.abs(gapProbe?.heroTop ?? 999)).toBeLessThanOrEqual(2);
    expect(gapProbe?.navBottomIsInsideHero).toBe(true);
    expect(gapProbe?.publicShellPaddingTop).toBe("0px");
    expect(gapProbe?.elementTestId).not.toBe("public-shell-content");
  });

  test("mobile homepage ignores stale shared nav content offset", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/");
    await expect(page.getByTestId("home-hero")).toBeVisible();

    await page.evaluate(() => {
      document.documentElement.style.setProperty("--yb-nav-content-offset", "140px");
      window.dispatchEvent(new Event("resize"));
    });

    await expect
      .poll(async () => {
        return page.evaluate(() => {
          const navbarEl = document.querySelector("nav.yb-navbar");
          const heroEl = document.querySelector('[data-testid="home-hero"]');
          if (!navbarEl || !heroEl) return 999;
          return Math.abs(heroEl.getBoundingClientRect().top);
        });
      })
      .toBeLessThanOrEqual(2);
  });
});
