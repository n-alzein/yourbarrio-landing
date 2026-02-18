import { expect, test, type Page } from "@playwright/test";

const adminSuperEmail = process.env.E2E_ADMIN_SUPER_EMAIL;
const adminSuperPassword = process.env.E2E_ADMIN_SUPER_PASSWORD;
const adminSupportEmail = process.env.E2E_ADMIN_SUPPORT_EMAIL;
const adminSupportPassword = process.env.E2E_ADMIN_SUPPORT_PASSWORD;

async function signInAndOpenAdminsPage(page: Page, email: string, password: string) {
  await page.goto("/signin?modal=signin&next=/admin/admins");
  await page.getByLabel(/email/i).first().fill(email);
  await page.getByLabel(/password/i).first().fill(password);
  await page.locator("form").getByRole("button", { name: /log in/i }).click();
  await expect(page).toHaveURL(/\/admin\/admins/);
}

test.describe("Admin management visibility", () => {
  test("admin_super sees admin management section on /admin/admins", async ({ page }) => {
    test.skip(
      !adminSuperEmail || !adminSuperPassword,
      "Set E2E_ADMIN_SUPER_EMAIL and E2E_ADMIN_SUPER_PASSWORD"
    );

    await signInAndOpenAdminsPage(page, adminSuperEmail as string, adminSuperPassword as string);

    const section = page.getByTestId("admin-management-section");
    await expect(section).toBeVisible();
    await expect(page.getByTestId("admin-management-header")).toHaveText(/admin management/i);

    const actorUserId = await section.getAttribute("data-actor-user-id");
    expect(actorUserId).toBeTruthy();
    await expect(page.locator(`[data-testid="admin-row"][data-user-id="${actorUserId}"]`)).toHaveCount(0);
  });

  test("non-super admin does not see admin management section", async ({ page }) => {
    test.skip(
      !adminSupportEmail || !adminSupportPassword,
      "Set E2E_ADMIN_SUPPORT_EMAIL and E2E_ADMIN_SUPPORT_PASSWORD"
    );

    await signInAndOpenAdminsPage(page, adminSupportEmail as string, adminSupportPassword as string);

    await expect(page.getByTestId("admin-management-section")).toHaveCount(0);
  });
});
