import { expect, test, type Page } from "@playwright/test";

const adminSuperEmail = process.env.E2E_ADMIN_SUPER_EMAIL;
const adminSuperPassword = process.env.E2E_ADMIN_SUPER_PASSWORD;
const adminOpsEmail = process.env.E2E_ADMIN_OPS_EMAIL;
const adminOpsPassword = process.env.E2E_ADMIN_OPS_PASSWORD;
const adminSupportEmail = process.env.E2E_ADMIN_SUPPORT_EMAIL;
const adminSupportPassword = process.env.E2E_ADMIN_SUPPORT_PASSWORD;
const adminReadonlyEmail = process.env.E2E_ADMIN_READONLY_EMAIL;
const adminReadonlyPassword = process.env.E2E_ADMIN_READONLY_PASSWORD;

const targetUserId =
  process.env.E2E_USER_DETAIL_TARGET_ID ||
  process.env.E2E_CUSTOMER_USER_ID ||
  process.env.E2E_BUSINESS_USER_ID ||
  process.env.E2E_ADMIN_USER_ID;

async function signIn(page: Page, email: string, password: string) {
  await page.goto("/signin?modal=signin&next=/admin");
  await page.getByLabel(/email/i).first().fill(email);
  await page.getByLabel(/password/i).first().fill(password);
  await page.locator("form").getByRole("button", { name: /log in/i }).click();
  await expect(page).toHaveURL(/\/admin/);
}

async function openUserDetail(page: Page) {
  await page.goto(`/admin/users/${encodeURIComponent(String(targetUserId))}`);
  await expect(page).toHaveURL(/\/admin\/users\//);
}

test.describe("Admin user detail security tab access", () => {
  test("admin_super can see Security and Permissions tabs", async ({ page }) => {
    test.skip(
      !adminSuperEmail || !adminSuperPassword || !targetUserId,
      "Set E2E_ADMIN_SUPER_* and target user id env vars"
    );

    await signIn(page, adminSuperEmail as string, adminSuperPassword as string);
    await openUserDetail(page);
    await expect(page.getByRole("button", { name: "Security" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Permissions" })).toBeVisible();
  });

  test("admin_ops sees Permissions tab but not Security tab", async ({ page }) => {
    test.skip(!adminOpsEmail || !adminOpsPassword || !targetUserId, "Set E2E_ADMIN_OPS_* and target user id env vars");

    await signIn(page, adminOpsEmail as string, adminOpsPassword as string);
    await openUserDetail(page);
    await expect(page.getByRole("button", { name: "Security" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Permissions" })).toBeVisible();
  });

  test("admin_support cannot see Security or Permissions tabs", async ({ page }) => {
    test.skip(
      !adminSupportEmail || !adminSupportPassword || !targetUserId,
      "Set E2E_ADMIN_SUPPORT_* and target user id env vars"
    );

    await signIn(page, adminSupportEmail as string, adminSupportPassword as string);
    await openUserDetail(page);
    await expect(page.getByRole("button", { name: "Security" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Permissions" })).toHaveCount(0);

    const response = await page.goto(`/admin/users/${encodeURIComponent(String(targetUserId))}/permissions`);
    expect(response?.status()).toBe(404);
  });

  test("admin_readonly cannot see Security or Permissions tabs", async ({ page }) => {
    test.skip(
      !adminReadonlyEmail || !adminReadonlyPassword || !targetUserId,
      "Set E2E_ADMIN_READONLY_* and target user id env vars"
    );

    await signIn(page, adminReadonlyEmail as string, adminReadonlyPassword as string);
    await openUserDetail(page);
    await expect(page.getByRole("button", { name: "Security" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Permissions" })).toHaveCount(0);

    const response = await page.goto(`/admin/users/${encodeURIComponent(String(targetUserId))}/permissions`);
    expect(response?.status()).toBe(404);
  });
});
