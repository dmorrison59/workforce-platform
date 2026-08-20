import { expect, test } from "@playwright/test";

const testPassword = process.env.PLAYWRIGHT_TEST_PASSWORD ?? "";
test.skip(!testPassword, "PLAYWRIGHT_TEST_PASSWORD is required for the live signup workflow.");

test("owner completes signup through employee creation", async ({ page }) => {
  const unique = Date.now().toString(36);
  const email = `owner-${unique}@gate0-test.example`;
  const slug = `gate0-test-${unique}`;

  await page.goto("/sign-up");
  await page.getByLabel("First name").fill("Casey");
  await page.getByLabel("Last name").fill("Owner");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(testPassword);
  await page.getByRole("button", { name: "Create account" }).click();

  await expect(page).toHaveURL(/organization-setup/);
  await page.getByLabel("Organization name").fill(`Gate 0 Test ${unique}`);
  await page.getByLabel("Workspace slug").fill(slug);
  await page.getByRole("button", { name: "Create organization" }).click();
  await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible();
  await expect(page.getByText("Owner", { exact: true }).first()).toBeVisible();

  await page.goto("/locations/new");
  await page.getByLabel("Location name").fill("Main Office");
  await page.getByLabel("Street address").fill("100 Test Avenue");
  await page.getByLabel("City").fill("Sampleville");
  await page.getByLabel("State / province").fill("NY");
  await page.getByLabel("Postal code").fill("10001");
  await page.getByRole("button", { name: "Add location" }).click();
  await expect(page.getByText("Main Office")).toBeVisible();

  await page.goto("/departments/new");
  await page.getByLabel("Department name").fill("Operations");
  await page.getByLabel("Location").selectOption({ label: "Main Office" });
  await page.getByRole("button", { name: "Add department" }).click();
  await expect(page.getByText("Operations")).toBeVisible();

  await page.goto("/employees/new");
  await page.getByLabel("First name").fill("Jordan");
  await page.getByLabel("Last name").fill("Employee");
  await page.getByLabel("Email").fill(`employee-${unique}@gate0-test.example`);
  await page.getByLabel("Employee number").fill("E-001");
  await page.getByRole("button", { name: "Add employee" }).click();
  await expect(page.getByText("Jordan Employee")).toBeVisible();
});
