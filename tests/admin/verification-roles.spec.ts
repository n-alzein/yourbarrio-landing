import { expect, test, type Page } from "@playwright/test";

const adminOpsEmail = process.env.E2E_ADMIN_OPS_EMAIL;
const adminOpsPassword = process.env.E2E_ADMIN_OPS_PASSWORD;
const adminSupportEmail = process.env.E2E_ADMIN_SUPPORT_EMAIL;
const adminSupportPassword = process.env.E2E_ADMIN_SUPPORT_PASSWORD;

async function signInAndOpenVerification(page: Page, email: string, password: string) {
  await page.goto("/signin?modal=signin&next=/admin/verification");
  await page.getByLabel(/email/i).first().fill(email);
  await page.getByLabel(/password/i).first().fill(password);
  await page.locator("form").getByRole("button", { name: /log in/i }).click();
  await expect(page).toHaveURL(/\/admin\/verification/);
}

test.describe("Verification role access", () => {
  test("admin_ops can access verification actions surface", async ({ page }) => {
    test.skip(!adminOpsEmail || !adminOpsPassword, "Set E2E_ADMIN_OPS_EMAIL and E2E_ADMIN_OPS_PASSWORD");

    await signInAndOpenVerification(page, adminOpsEmail as string, adminOpsPassword as string);

    await expect(
      page.getByText(/read-only mode\.\s*`admin_super`\s*or\s*`admin_ops`\s*required for actions\./i)
    ).toHaveCount(0);
  });

  test("admin_support remains read-only for verification actions", async ({ page }) => {
    test.skip(
      !adminSupportEmail || !adminSupportPassword,
      "Set E2E_ADMIN_SUPPORT_EMAIL and E2E_ADMIN_SUPPORT_PASSWORD"
    );

    await signInAndOpenVerification(page, adminSupportEmail as string, adminSupportPassword as string);

    await expect(
      page.getByText(/read-only mode\.\s*`admin_super`\s*or\s*`admin_ops`\s*required for actions\./i)
    ).toBeVisible();
  });
});
