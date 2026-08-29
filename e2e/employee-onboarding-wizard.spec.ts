import { expect, test, type Page } from "@playwright/test";

const testPassword = process.env.PLAYWRIGHT_TEST_PASSWORD ?? "";
test.skip(!testPassword, "PLAYWRIGHT_TEST_PASSWORD is required for the live onboarding workflow.");

function nextMonday() {
  const date = new Date();
  date.setUTCHours(12, 0, 0, 0);
  const day = date.getUTCDay();
  date.setUTCDate(date.getUTCDate() + (day === 0 ? 1 : 8 - day));
  return date.toISOString().slice(0, 10);
}

async function createOwnerWorkspace(page: Page, unique: string) {
  await page.goto("/sign-up");
  await page.getByLabel("First name").fill("Casey");
  await page.getByLabel("Last name").fill("Owner");
  await page.getByLabel("Email").fill(`onboarding-owner-${unique}@example.test`);
  await page.getByLabel("Password").fill(testPassword);
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page).toHaveURL(/organization-setup/);
  await page.getByLabel("Organization name").fill(`Onboarding Test ${unique}`);
  await page.getByLabel("Workspace slug").fill(`onboarding-test-${unique}`);
  await page.getByRole("button", { name: "Create organization" }).click();
  await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible();
}

async function completeEmployeeDetails(page: Page, unique: string, firstName: string) {
  await page.getByLabel("First name").fill(firstName);
  await page.getByLabel("Last name").fill("Newhire");
  await page.getByRole("textbox", { name: "Email" }).fill(`${firstName.toLowerCase()}-${unique}@example.test`);
  await page.getByLabel("Phone").fill("555-0100");
  await page.getByLabel("Employee number").fill(`W-${unique.slice(-5)}`);
  await page.getByLabel("Hire date", { exact: true }).fill(nextMonday());
  await page.getByLabel("Hourly rate").fill("27.50");
  await page.getByRole("button", { name: "Continue" }).click();
}

test("owner completes guided onboarding with crew and first draft shift", async ({ page }) => {
  test.setTimeout(120_000);
  const unique = Date.now().toString(36);
  const shiftDate = nextMonday();
  await createOwnerWorkspace(page, unique);

  await page.goto("/locations/new");
  await page.getByLabel("Location name").fill("North Office");
  await page.getByLabel("Street address").fill("100 Test Avenue");
  await page.getByLabel("City").fill("Sampleville");
  await page.getByLabel("State / province").fill("NY");
  await page.getByLabel("Postal code").fill("10001");
  await page.getByRole("button", { name: "Add location" }).click();
  await expect(page.getByText("North Office")).toBeVisible();

  await page.goto("/departments/new");
  await page.getByLabel("Department name").fill("Operations");
  await page.getByLabel("Location").selectOption({ label: "North Office" });
  await page.getByRole("button", { name: "Add department" }).click();
  await expect(page.getByText("Operations")).toBeVisible();

  await page.goto("/crews");
  await page.getByLabel("Crew name").fill("North Crew");
  await page.getByRole("button", { name: "Create crew" }).click();
  await expect(page.getByRole("heading", { name: "North Crew" })).toBeVisible();

  await page.goto("/dashboard");
  await page.getByRole("link", { name: "Onboard employee" }).click();
  await expect(page).toHaveURL(/\/employees\/onboard$/);
  await completeEmployeeDetails(page, unique, "Morgan");

  await page.getByLabel("Street address").fill("500 Onboarding Lane");
  await page.getByLabel("City").fill("Sampleville");
  await page.getByLabel("State / province").fill("NY");
  await page.getByLabel("Postal code").fill("10002");
  await page.getByRole("button", { name: "Continue" }).click();

  await page.getByLabel("Starting location").selectOption({ label: "North Office" });
  await page.getByLabel("Starting department").selectOption({ label: "Operations" });
  await page.getByRole("button", { name: "Continue" }).click();

  await page.getByRole("radio", { name: /Set up app access later/ }).check();
  await page.getByRole("button", { name: "Continue" }).click();

  await page.getByLabel("Crew").selectOption({ label: "North Crew" });
  await page.getByLabel("Effective from", { exact: true }).fill(shiftDate);
  await page.getByRole("button", { name: "Continue" }).click();

  await page.getByLabel("Add the employee’s first shift to a draft schedule").check();
  await page.getByLabel("Shift location").selectOption({ label: "North Office" });
  await page.getByLabel("Shift department").selectOption({ label: "Operations" });
  await page.getByLabel("Shift date", { exact: true }).fill(shiftDate);
  await page.getByLabel("Start time").fill("09:00");
  await page.getByLabel("End time").fill("17:00");
  await page.getByLabel("Break minutes").fill("30");
  await page.getByRole("button", { name: "Continue" }).click();

  await expect(page.getByText("Morgan Newhire")).toBeVisible();
  await expect(page.getByText(/^North Crew from /)).toBeVisible();
  await page.getByRole("button", { name: "Finish onboarding" }).click();
  await expect(page.getByRole("heading", { name: "Morgan Newhire was created" })).toBeVisible();
  await expect(page.getByText("First shift was added to the draft schedule.", { exact: false })).toBeVisible();
  const schedulePath = await page.getByRole("link", { name: "View Schedule" }).getAttribute("href");
  expect(schedulePath).toBeTruthy();

  await page.getByRole("link", { name: "View Employees" }).click();
  await expect(page.getByText("Morgan Newhire")).toBeVisible();
  await page.goto("/crews");
  await page.getByText("Membership history").click();
  await expect(page.getByText(/^Morgan Newhire · /)).toBeVisible();
  await page.goto(schedulePath!);
  await expect(page.getByRole("region", { name: "Weekly calendar" }).getByText("Morgan Newhire")).toBeVisible();
  await expect(page.getByText("draft", { exact: true })).toBeVisible();
});

test("owner completes minimal onboarding with optional steps skipped", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const unique = `${Date.now().toString(36)}-minimal`;
  await createOwnerWorkspace(page, unique);
  await page.goto("/employees/onboard");
  await completeEmployeeDetails(page, unique, "Riley");

  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page.getByText("No active locations exist.", { exact: false })).toBeVisible();
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByRole("radio", { name: /Employee does not need app access/ }).check();
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByRole("button", { name: "Skip this step" }).click();
  await page.getByRole("button", { name: "Skip this step" }).click();

  await expect(page.getByText("Crew assignment").last()).toBeVisible();
  await expect(page.getByText("Skipped", { exact: true })).toHaveCount(2);
  await page.getByRole("button", { name: "Finish onboarding" }).click();
  await expect(page.getByRole("heading", { name: "Riley Newhire was created" })).toBeVisible();
  await page.getByRole("link", { name: "View Employees" }).click();
  await expect(page.getByText("Riley Newhire")).toBeVisible();
});
