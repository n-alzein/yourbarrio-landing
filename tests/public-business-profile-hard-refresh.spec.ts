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

    await page.goto(profilePath, { waitUntil: "domcontentloaded" });
    await expect(page.getByTestId("public-business-profile-content")).toBeVisible();
    await expect(page.getByRole("heading", { name: "Shoreline Beauty" })).toBeVisible();
    await expect(page.getByText("We need one more refresh")).toHaveCount(0);
    await expect(page.getByText("Something went wrong")).toHaveCount(0);

    await page.reload({ waitUntil: "domcontentloaded" });
    await expect(page.getByTestId("public-business-profile-content")).toBeVisible();
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
});
