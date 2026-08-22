import { expect, test } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";

const testPassword = process.env.PLAYWRIGHT_TEST_PASSWORD ?? "";
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
test.skip(!testPassword || !supabaseUrl || !anonKey, "Local Supabase and PLAYWRIGHT_TEST_PASSWORD are required.");

async function signIn(page: import("@playwright/test").Page, email: string) {
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(testPassword);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible();
}

async function signOut(page: import("@playwright/test").Page) {
  await page.getByRole("button", { name: "Sign out" }).evaluate((element) => {
    const button = element as HTMLButtonElement;
    button.form?.requestSubmit(button);
  });
  await expect(page).toHaveURL(/sign-in/);
}

function newYorkDate() {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const value = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${value.year}-${value.month}-${value.day}`;
}

function adjustLocalMinutes(value: string, minutes: number) {
  const [date, time] = value.split("T");
  const [year, month, day] = date.split("-").map(Number);
  const [hour, minute] = time.split(":").map(Number);
  return new Date(Date.UTC(year, month - 1, day, hour, minute + minutes)).toISOString().slice(0, 16);
}

test("employee records actual time and a manager corrects and approves it", async ({ page }) => {
  test.setTimeout(180_000);
  const unique = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
  const ownerEmail = `owner-${unique}@gate4-test.example`;
  const managerEmail = `manager-${unique}@gate4-test.example`;
  const employeeEmail = `employee-${unique}@gate4-test.example`;
  const slug = `gate4-${unique}`;
  const today = newYorkDate();

  await page.goto("/sign-up");
  await page.getByLabel("First name").fill("Casey");
  await page.getByLabel("Last name").fill("Owner");
  await page.getByLabel("Email").fill(ownerEmail);
  await page.getByLabel("Password").fill(testPassword);
  await page.getByRole("button", { name: "Create account" }).click();
  await page.getByLabel("Organization name").fill(`Gate 4 Test ${unique}`);
  await page.getByLabel("Workspace slug").fill(slug);
  await page.getByRole("button", { name: "Create organization" }).click();
  await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible();

  await page.goto("/locations/new");
  await page.getByLabel("Location name").fill("Time Office");
  await page.getByLabel("Street address").fill("400 Time Avenue");
  await page.getByLabel("City").fill("Sampleville");
  await page.getByLabel("State / province").fill("NY");
  await page.getByLabel("Postal code").fill("10001");
  await page.getByRole("button", { name: "Add location" }).click();

  await page.goto("/departments/new");
  await page.getByLabel("Department name").fill("Operations");
  await page.getByLabel("Location").selectOption({ label: "Time Office" });
  await page.getByRole("button", { name: "Add department" }).click();

  await page.goto("/employees/new");
  await page.getByLabel("First name").fill("Emery");
  await page.getByLabel("Last name").fill("Employee");
  await page.getByLabel("Email").fill(employeeEmail);
  await page.getByLabel("Employee number").fill(`T-${unique.slice(-5)}`);
  await page.getByRole("button", { name: "Add employee" }).click();
  await expect(page.getByText("Emery Employee")).toBeVisible();

  const employeeClient = createClient(supabaseUrl, anonKey, { auth: { persistSession: false } });
  const managerClient = createClient(supabaseUrl, anonKey, { auth: { persistSession: false } });
  for (const account of [
    { client: employeeClient, email: employeeEmail, first: "Emery", last: "Employee" },
    { client: managerClient, email: managerEmail, first: "Morgan", last: "Manager" },
  ]) {
    const { error } = await account.client.auth.signUp({
      email: account.email,
      password: testPassword,
      options: { data: { first_name: account.first, last_name: account.last } },
    });
    expect(error).toBeNull();
  }
  const [{ data: employeeProfile }, { data: managerProfile }] = await Promise.all([
    employeeClient.rpc("current_profile_id"),
    managerClient.rpc("current_profile_id"),
  ]);

  const ownerClient = createClient(supabaseUrl, anonKey, { auth: { persistSession: false } });
  const { error: ownerSignInError } = await ownerClient.auth.signInWithPassword({ email: ownerEmail, password: testPassword });
  expect(ownerSignInError).toBeNull();
  const { data: organization } = await ownerClient.from("organizations").select("id").eq("slug", slug).single();
  const { data: roles } = await ownerClient.from("roles").select("id,name").eq("organization_id", organization!.id);
  const { data: employee } = await ownerClient.from("employees").select("id").eq("organization_id", organization!.id).eq("email", employeeEmail).single();
  const employeeRole = roles?.find((role) => role.name === "Employee");
  const managerRole = roles?.find((role) => role.name === "Manager");
  const { error: membershipError } = await ownerClient.from("organization_memberships").insert([
    { organization_id: organization!.id, profile_id: employeeProfile!, role_id: employeeRole!.id, membership_role: "employee", status: "active" },
    { organization_id: organization!.id, profile_id: managerProfile!, role_id: managerRole!.id, membership_role: "manager", status: "active" },
  ]);
  expect(membershipError).toBeNull();
  const { error: linkError } = await ownerClient.from("employees").update({ profile_id: employeeProfile }).eq("id", employee!.id);
  expect(linkError).toBeNull();

  await signOut(page);
  await signIn(page, managerEmail);
  await page.goto("/schedule");
  await page.getByRole("button", { name: "Create draft schedule" }).click();
  await page.getByLabel("Department").selectOption({ label: "Operations" });
  await page.getByLabel("Employee").selectOption({ label: "Emery Employee" });
  await page.getByLabel("Start time").fill(`${today}T00:01`);
  await page.getByLabel("End time").fill(`${today}T23:58`);
  await page.getByLabel("Notes").fill(`Gate 4 actual versus scheduled ${unique}`);
  await page.getByRole("button", { name: "Create shift" }).click();
  await expect(page.getByText("Shift created.")).toBeVisible();
  await page.getByRole("button", { name: "Publish schedule" }).click();
  await expect(page.getByText("Schedule published.")).toBeVisible();

  await signOut(page);
  await signIn(page, employeeEmail);
  await page.goto("/time-clock");
  await expect(page.getByRole("heading", { name: "Time Clock" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Clocked out" })).toBeVisible();
  await page.getByLabel("Location").selectOption({ label: "Time Office" });
  await page.getByLabel("Assigned shift (optional)").selectOption({ index: 1 });
  await page.getByRole("button", { name: "Clock in" }).click();
  await expect(page.getByText("Clocked in successfully.")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Clocked in" })).toBeVisible();
  await page.getByRole("button", { name: "Start break" }).click();
  await expect(page.getByText("Break started.")).toBeVisible();
  await expect(page.getByRole("heading", { name: "On break" })).toBeVisible();
  await page.getByRole("button", { name: "End break" }).click();
  await expect(page.getByText("Break ended.")).toBeVisible();
  await page.getByRole("button", { name: "Clock out" }).click();
  await expect(page.getByText("Clocked out successfully.")).toBeVisible();
  await page.goto("/my-timesheet");
  await expect(page.getByRole("heading", { name: "My Timesheet" })).toBeVisible();
  await expect(page.getByText("completed", { exact: true })).toBeVisible();
  await expect(page.getByText(/Scheduled/)).toBeVisible();

  await signOut(page);
  await signIn(page, managerEmail);
  await page.goto("/timesheets");
  await expect(page.getByRole("heading", { name: "Weekly Timesheets" })).toBeVisible();
  const entry = page.locator(".time-entry-card").filter({ hasText: "Emery Employee" });
  await expect(entry).toContainText("Scheduled");
  const clockIn = entry.getByLabel("Corrected clock-in");
  const clockOut = entry.getByLabel("Corrected clock-out");
  await clockIn.fill(adjustLocalMinutes(await clockIn.inputValue(), -5));
  await clockOut.fill(adjustLocalMinutes(await clockOut.inputValue(), 5));
  await entry.getByLabel("Correction reason").fill("Manager verified the signed paper log");
  await entry.getByRole("button", { name: "Save correction" }).click();
  await expect(page.getByText("Time entry corrected.")).toBeVisible();
  const correctedEntry = page.locator(".time-entry-card").filter({ hasText: "Emery Employee" });
  await expect(correctedEntry).toContainText("corrected");
  await expect(correctedEntry).toContainText("Manager verified the signed paper log");
  await correctedEntry.getByRole("button", { name: "Approve time entry" }).click();
  await expect(page.getByText("Time entry approved.")).toBeVisible();
  await expect(page.locator(".time-entry-card").filter({ hasText: "Emery Employee" })).toContainText("approved");

  await signOut(page);
  await signIn(page, employeeEmail);
  await page.goto("/my-timesheet");
  const employeeEntry = page.locator(".time-entry-card").filter({ hasText: "Time Office" });
  await expect(employeeEntry).toContainText("corrected");
  await expect(employeeEntry).toContainText("approved");
});
