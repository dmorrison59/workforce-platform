import { expect, test } from "@playwright/test";

const testPassword = process.env.PLAYWRIGHT_TEST_PASSWORD ?? "";
test.skip(!testPassword, "PLAYWRIGHT_TEST_PASSWORD is required for the live employee workflow.");

test("owner uses shared address entry for locations and employees", async ({ page }) => {
  const unique = Date.now().toString(36);
  const autocompleteScopes = new Set<string>();

  await page.goto("/sign-up");
  await page.getByLabel("First name").fill("Address");
  await page.getByLabel("Last name").fill("Owner");
  await page.getByLabel("Email").fill(`address-owner-${unique}@employee-form-test.example`);
  await page.getByLabel("Password").fill(testPassword);
  await page.getByRole("button", { name: "Create account" }).click();

  await expect(page).toHaveURL(/organization-setup/);
  await page.getByLabel("Organization name").fill(`Employee Form Test ${unique}`);
  await page.getByLabel("Workspace slug").fill(`employee-form-${unique}`);
  await page.getByRole("button", { name: "Create organization" }).click();
  await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible();

  await page.route("**/api/address-autocomplete?*", async (route) => {
    const scope = new URL(route.request().url()).searchParams.get("scope");
    if (scope) autocompleteScopes.add(scope);
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        enabled: true,
        suggestions: [{
          id: "test-place",
          label: "350 Fifth Avenue, New York, NY 10118, United States",
          streetAddress: "350 Fifth Avenue",
          city: "New York",
          stateProvince: "NY",
          postalCode: "10118",
          country: "United States",
        }],
      }),
    });
  });

  await page.goto("/locations/new");
  await page.getByLabel("Location name").fill("Suggested Office");
  const locationStreetAddress = page.getByLabel("Street address");
  await locationStreetAddress.fill("350 Fifth");
  await page.getByRole("option", { name: /350 Fifth Avenue/ }).click();
  await expect(locationStreetAddress).toHaveValue("350 Fifth Avenue");
  await expect(page.getByLabel("City")).toHaveValue("New York");
  await expect(page.getByLabel("State / province")).toHaveValue("NY");
  await expect(page.getByLabel("Postal code")).toHaveValue("10118");
  expect(autocompleteScopes).toContain("location");
  await page.getByRole("button", { name: "Add location" }).click();
  const locationRow = page.getByRole("row").filter({ hasText: "Suggested Office" });
  await expect(locationRow).toContainText("350 Fifth Avenue");

  await page.goto("/employees/new");
  await expect(page.getByRole("group", { name: "Personal" })).toBeVisible();
  await expect(page.getByRole("group", { name: "Address" })).toBeVisible();
  await expect(page.getByRole("group", { name: "Employment" })).toBeVisible();
  await page.getByLabel("First name").fill("Manual");
  await page.getByLabel("Last name").fill("Entry");
  await page.getByLabel("Email").fill(`manual-${unique}@employee-form-test.example`);
  await page.getByLabel("Street address").fill("145 Manual Lane");
  await page.getByLabel("Address line 2").fill("Suite 200");
  await page.getByLabel("City").fill("Sampleville");
  await page.getByLabel("State / province").fill("NY");
  await page.getByLabel("Postal code").fill("10001");
  await expect(page.getByLabel("Country")).toHaveValue("United States");

  const hireDate = page.locator('input[name="hireDate"]');
  await expect(hireDate).toHaveAttribute("type", "date");
  await hireDate.fill("2026-08-15");
  await expect(hireDate).toHaveValue("2026-08-15");
  await page.getByRole("button", { name: "Open Hire date calendar" }).click();
  await expect(hireDate).toBeFocused();
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "Add employee" }).click();

  await expect(page).toHaveURL(/employees\?message=/);
  await expect(page.getByText("Manual Entry", { exact: true })).toBeVisible();
  await expect(page.getByText("145 Manual Lane", { exact: true })).toBeVisible();
  await expect(page.getByText("Suite 200", { exact: true })).toBeVisible();
  await expect(page.getByText("2026-08-15", { exact: true })).toBeVisible();

  await page.goto("/employees/new");
  await page.getByLabel("First name").fill("Suggested");
  await page.getByLabel("Last name").fill("Address");
  await page.getByLabel("Email").fill(`suggested-${unique}@employee-form-test.example`);
  const streetAddress = page.getByLabel("Street address");
  await streetAddress.fill("350 Fifth");
  await expect(page.getByRole("option", { name: /350 Fifth Avenue/ })).toBeVisible();
  await streetAddress.press("ArrowDown");
  await streetAddress.press("Enter");

  await expect(streetAddress).toHaveValue("350 Fifth Avenue");
  await expect(page.getByLabel("City")).toHaveValue("New York");
  await expect(page.getByLabel("State / province")).toHaveValue("NY");
  await expect(page.getByLabel("Postal code")).toHaveValue("10118");
  await expect(page.getByLabel("Country")).toHaveValue("United States");
  await expect(page.getByText("Address selected. Review the populated fields before saving.")).toBeVisible();
  expect(autocompleteScopes).toContain("employee");
  await page.getByRole("button", { name: "Add employee" }).click();

  await expect(page.getByText("Suggested Address", { exact: true })).toBeVisible();
  await expect(page.getByText("350 Fifth Avenue", { exact: true })).toBeVisible();
});
