import { expect, test, type Page } from "@playwright/test";

const adminSuperEmail = process.env.E2E_ADMIN_SUPER_EMAIL;
const adminSuperPassword = process.env.E2E_ADMIN_SUPER_PASSWORD;
const businessUserId = process.env.E2E_BUSINESS_USER_ID;
const customerUserId = process.env.E2E_CUSTOMER_USER_ID;
const adminUserId = process.env.E2E_ADMIN_USER_ID;

async function signIn(page: Page, email: string, password: string) {
  await page.goto("/signin?modal=signin&next=/admin");
  await page.getByLabel(/email/i).first().fill(email);
  await page.getByLabel(/password/i).first().fill(password);
  await page.locator("form").getByRole("button", { name: /log in/i }).click();
  await expect(page).toHaveURL(/\/admin/);
}

test.describe("Admin user detail business verification gating", () => {
  test("shows section only for business accounts", async ({ page }) => {
    test.skip(
      !adminSuperEmail ||
        !adminSuperPassword ||
        !businessUserId ||
        !customerUserId ||
        !adminUserId,
      "Set E2E_ADMIN_SUPER_* and E2E_*_USER_ID env vars"
    );

    await signIn(page, adminSuperEmail as string, adminSuperPassword as string);

    await page.goto(`/admin/users/${encodeURIComponent(businessUserId as string)}`);
    await expect(page.getByTestId("business-verification-section")).toBeVisible();
    await expect(page.getByRole("heading", { name: "Business Verification" })).toBeVisible();

    await page.goto(`/admin/users/${encodeURIComponent(customerUserId as string)}`);
    await expect(page.getByTestId("business-verification-section")).toHaveCount(0);

    await page.goto(`/admin/users/${encodeURIComponent(adminUserId as string)}`);
    await expect(page.getByTestId("business-verification-section")).toHaveCount(0);
  });
});
