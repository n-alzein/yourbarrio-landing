import { expect, test } from "@playwright/test";

const profilePath = "/b/seed-shoreline-beauty";

test.describe("public business profile hard refresh", () => {
  test.beforeEach(async ({ page }) => {
    await page.route("**/api/me", async (route) => {
      await route.fulfill({
        status: 401,
        contentType: "application/json",
        body: JSON.stringify({
          user: null,
          profile: null,
          accountContext: { role: "guest", isAuthenticated: false },
        }),
      });
    });
  });

  test("direct entry and browser reload keep the public profile visible", async ({
    page,
  }, testInfo) => {
    const consoleErrors: string[] = [];
    const failedRequests: string[] = [];

    page.on("console", (message) => {
      if (message.type() === "error") {
        consoleErrors.push(message.text());
      }
    });

    page.on("requestfailed", (request) => {
      const failure = request.failure()?.errorText || "unknown";
      failedRequests.push(`${request.method()} ${request.url()} ${failure}`);
    });

    const profileContent = page.getByTestId("public-business-profile-content").first();

    await page.goto(profilePath, { waitUntil: "domcontentloaded" });
    await expect(profileContent).toBeAttached();
    await expect(page.getByRole("heading", { name: "Shoreline Beauty" })).toBeVisible();
    await expect(page.getByText("We need one more refresh")).toHaveCount(0);
    await expect(page.getByText("Something went wrong")).toHaveCount(0);

    await page.reload({ waitUntil: "domcontentloaded" });
    await expect(profileContent).toBeAttached();
    await expect(page.getByRole("heading", { name: "Shoreline Beauty" })).toBeVisible();
    await expect(page.getByText("We need one more refresh")).toHaveCount(0);
    await expect(page.getByText("Something went wrong")).toHaveCount(0);

    const criticalFailures = failedRequests.filter((entry) => {
      if (/\/_next\/static\/|\/_next\/data\//.test(entry)) return true;
      if (!/_rsc=|__flight__/.test(entry)) return false;
      return entry.includes(profilePath);
    });
    await testInfo.attach("business-profile-hard-refresh-diagnostics", {
      body: JSON.stringify({ consoleErrors, failedRequests }, null, 2),
      contentType: "application/json",
    });
    expect(criticalFailures).toEqual([]);
  });

  test("uses deterministic cover height before and after reload", async ({ page }) => {
    const consoleMessages: string[] = [];
    page.on("console", (message) => {
      consoleMessages.push(message.text());
    });

    await page.goto(profilePath, { waitUntil: "domcontentloaded" });
    await expect(page.getByTestId("public-business-profile-content")).toBeVisible();

    const desktopCover = page.getByTestId("profile-hero-cover");
    const desktopMedia = page.getByTestId("profile-hero-cover-media");
    const desktopHeroName = desktopCover.getByRole("heading", { name: "Shoreline Beauty" });
    const desktopNav = page.locator(".sticky").filter({ hasText: "About" }).first();
    await expect(desktopCover).toBeVisible();
    await expect(desktopMedia).toBeVisible();
    await expect(desktopHeroName).toBeVisible();
    await expect(desktopNav).toBeVisible();

    const desktopBox = await desktopCover.boundingBox();
    const desktopMediaBox = await desktopMedia.boundingBox();
    const desktopHeroNameBox = await desktopHeroName.boundingBox();
    const desktopNavBox = await desktopNav.boundingBox();
    expect(desktopBox?.height).toBeGreaterThan(0);
    expect(desktopBox?.height).toBeGreaterThanOrEqual(279);
    expect(desktopBox?.height).toBeLessThanOrEqual(281);
    expect(desktopMediaBox?.height).toBeGreaterThan(0);
    expect(desktopMediaBox?.height).toBeGreaterThanOrEqual(279);
    expect(desktopMediaBox?.height).toBeLessThanOrEqual(281);
    expect(desktopHeroNameBox?.y || 0).toBeGreaterThanOrEqual(desktopBox?.y || 0);
    expect((desktopHeroNameBox?.y || 0) + (desktopHeroNameBox?.height || 0)).toBeLessThanOrEqual(
      (desktopBox?.y || 0) + (desktopBox?.height || 0)
    );
    expect((desktopNavBox?.y || 0) - ((desktopBox?.y || 0) + (desktopBox?.height || 0))).toBeLessThanOrEqual(1);

    await page.reload({ waitUntil: "domcontentloaded" });
    await expect(page.getByTestId("public-business-profile-content")).toBeVisible();
    const reloadedDesktopBox = await desktopCover.boundingBox();
    const reloadedDesktopMediaBox = await desktopMedia.boundingBox();
    expect(reloadedDesktopBox?.height).toBeGreaterThanOrEqual(279);
    expect(reloadedDesktopBox?.height).toBeLessThanOrEqual(281);
    expect(reloadedDesktopMediaBox?.height).toBeGreaterThanOrEqual(279);
    expect(reloadedDesktopMediaBox?.height).toBeLessThanOrEqual(281);

    await page.setViewportSize({ width: 390, height: 844 });
    await page.reload({ waitUntil: "domcontentloaded" });
    await expect(page.getByTestId("public-business-profile-content")).toBeVisible();
    const mobileCoverBox = await desktopCover.boundingBox();
    const mobileMediaBox = await desktopMedia.boundingBox();
    expect(mobileCoverBox?.height).toBeGreaterThanOrEqual(359);
    expect(mobileCoverBox?.height).toBeLessThanOrEqual(361);
    expect(mobileMediaBox?.height).toBeGreaterThanOrEqual(359);
    expect(mobileMediaBox?.height).toBeLessThanOrEqual(361);
    expect(
      consoleMessages.filter((message) =>
        /fill.+height value of 0|height value of 0.+fill/i.test(message)
      )
    ).toEqual([]);
  });
});
