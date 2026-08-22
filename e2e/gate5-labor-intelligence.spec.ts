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

function addDays(date: string, days: number) {
  const value = new Date(`${date}T00:00:00Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}

function weekStart(date: string) {
  const value = new Date(`${date}T00:00:00Z`);
  const day = value.getUTCDay();
  value.setUTCDate(value.getUTCDate() - (day === 0 ? 6 : day - 1));
  return value.toISOString().slice(0, 10);
}

test("manager reviews weekly labor cost, variance, and overtime intelligence", async ({ page }) => {
  test.setTimeout(180_000);
  const unique = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
  const ownerEmail = `owner-${unique}@gate5-test.example`;
  const employeeEmail = `employee-${unique}@gate5-test.example`;
  const viewerEmail = `viewer-${unique}@gate5-test.example`;
  const slug = `gate5-${unique}`;
  const today = newYorkDate();
  const monday = weekStart(today);
  const primaryNote = `Gate 5 primary ${unique}`;
  const overtimeNote = `Gate 5 overtime ${unique}`;

  await page.goto("/sign-up");
  await page.getByLabel("First name").fill("Casey");
  await page.getByLabel("Last name").fill("Owner");
  await page.getByLabel("Email").fill(ownerEmail);
  await page.getByLabel("Password").fill(testPassword);
  await page.getByRole("button", { name: "Create account" }).click();
  await page.getByLabel("Organization name").fill(`Gate 5 Test ${unique}`);
  await page.getByLabel("Workspace slug").fill(slug);
  await page.getByRole("button", { name: "Create organization" }).click();
  await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible();

  await page.goto("/locations/new");
  await page.getByLabel("Location name").fill("Labor Office");
  await page.getByLabel("Street address").fill("500 Labor Avenue");
  await page.getByLabel("City").fill("Sampleville");
  await page.getByLabel("State / province").fill("NY");
  await page.getByLabel("Postal code").fill("10001");
  await page.getByRole("button", { name: "Add location" }).click();
  await expect(page.getByText("Labor Office")).toBeVisible();

  await page.goto("/departments/new");
  await page.getByLabel("Department name").fill("Operations");
  await page.getByLabel("Location").selectOption({ label: "Labor Office" });
  await page.getByRole("button", { name: "Add department" }).click();
  await expect(page.getByText("Operations")).toBeVisible();

  for (const employee of [
    { first: "Emery", last: "Employee", email: employeeEmail, number: `P-${unique.slice(-5)}`, rate: "25" },
    { first: "Taylor", last: "Overtime", email: `overtime-${unique}@gate5-test.example`, number: `O-${unique.slice(-5)}`, rate: "20" },
  ]) {
    await page.goto("/employees/new");
    await page.getByLabel("First name").fill(employee.first);
    await page.getByLabel("Last name").fill(employee.last);
    await page.getByLabel("Email").fill(employee.email);
    await page.getByLabel("Employee number").fill(employee.number);
    await page.getByLabel("Hourly rate").fill(employee.rate);
    await page.getByRole("button", { name: "Add employee" }).click();
    await expect(page.getByText(`${employee.first} ${employee.last}`)).toBeVisible();
  }

  const employeeClient = createClient(supabaseUrl, anonKey, { auth: { persistSession: false } });
  const viewerClient = createClient(supabaseUrl, anonKey, { auth: { persistSession: false } });
  const { error: employeeSignUpError } = await employeeClient.auth.signUp({
    email: employeeEmail,
    password: testPassword,
    options: { data: { first_name: "Emery", last_name: "Employee" } },
  });
  expect(employeeSignUpError).toBeNull();
  const { error: viewerSignUpError } = await viewerClient.auth.signUp({
    email: viewerEmail,
    password: testPassword,
    options: { data: { first_name: "Robin", last_name: "Viewer" } },
  });
  expect(viewerSignUpError).toBeNull();
  const { data: employeeProfile } = await employeeClient.rpc("current_profile_id");
  const { data: viewerProfile } = await viewerClient.rpc("current_profile_id");
  const ownerClient = createClient(supabaseUrl, anonKey, { auth: { persistSession: false } });
  const { error: ownerSignInError } = await ownerClient.auth.signInWithPassword({ email: ownerEmail, password: testPassword });
  expect(ownerSignInError).toBeNull();
  const { data: organization } = await ownerClient.from("organizations").select("id").eq("slug", slug).single();
  const { data: employeeRole } = await ownerClient.from("roles").select("id").eq("organization_id", organization!.id).eq("name", "Employee").single();
  const { data: employees } = await ownerClient.from("employees").select("id,email").eq("organization_id", organization!.id);
  const primaryEmployee = employees?.find((employee) => employee.email === employeeEmail);
  const { error: membershipError } = await ownerClient.from("organization_memberships").insert({
    organization_id: organization!.id,
    profile_id: employeeProfile!,
    role_id: employeeRole!.id,
    membership_role: "employee",
    status: "active",
  });
  expect(membershipError).toBeNull();
  const { data: laborPermission } = await ownerClient.from("permissions").select("id").eq("capability", "labor.view").single();
  const { data: viewerRole, error: viewerRoleError } = await ownerClient.from("roles").insert({
    organization_id: organization!.id,
    name: "Labor Hours Viewer",
    description: "Hours without wage or cost visibility",
    is_system: false,
  }).select("id").single();
  expect(viewerRoleError).toBeNull();
  const { error: viewerGrantError } = await ownerClient.from("role_permissions").insert({
    organization_id: organization!.id,
    role_id: viewerRole!.id,
    permission_id: laborPermission!.id,
  });
  expect(viewerGrantError).toBeNull();
  const { error: viewerMembershipError } = await ownerClient.from("organization_memberships").insert({
    organization_id: organization!.id,
    profile_id: viewerProfile!,
    role_id: viewerRole!.id,
    membership_role: "manager",
    status: "active",
  });
  expect(viewerMembershipError).toBeNull();
  const { error: linkError } = await ownerClient.from("employees").update({ profile_id: employeeProfile }).eq("id", primaryEmployee!.id);
  expect(linkError).toBeNull();

  await page.goto("/schedule");
  await page.getByRole("button", { name: "Create draft schedule" }).click();
  await expect(page.getByText("Draft schedule created.")).toBeVisible();
  await page.getByLabel("Department").selectOption({ label: "Operations" });
  await page.getByLabel("Employee").selectOption({ label: "Emery Employee" });
  await page.getByLabel("Start time").fill(`${today}T09:00`);
  await page.getByLabel("End time").fill(`${today}T17:00`);
  await page.getByLabel("Break minutes").fill("30");
  await page.getByLabel("Notes").fill(primaryNote);
  await page.getByRole("button", { name: "Create shift" }).click();
  await expect(page.getByText("Shift created.")).toBeVisible();

  await page.getByLabel("Department").selectOption({ label: "Operations" });
  await page.getByLabel("Employee").selectOption({ label: "Taylor Overtime" });
  await page.getByLabel("Start time").fill(`${monday}T08:00`);
  await page.getByLabel("End time").fill(`${monday}T17:00`);
  await page.getByLabel("Break minutes").fill("0");
  await page.getByLabel("Notes").fill(overtimeNote);
  await page.getByRole("button", { name: "Create shift" }).click();
  await expect(page.getByLabel("Weekly calendar").getByText(overtimeNote)).toBeVisible();
  const { data: overtimeShift } = await ownerClient.from("shifts").select("id").eq("organization_id", organization!.id).eq("notes", overtimeNote).single();
  for (let offset = 1; offset <= 4; offset += 1) {
    const { error } = await ownerClient.rpc("copy_schedule_shift", {
      source_shift_id: overtimeShift!.id,
      target_local_date: addDays(monday, offset),
    });
    expect(error).toBeNull();
  }
  await page.reload();
  await page.getByRole("button", { name: "Publish schedule" }).click();
  await expect(page.getByText("Schedule published.")).toBeVisible();

  await signOut(page);
  await signIn(page, employeeEmail);
  await expect(page.getByRole("link", { name: "Labor", exact: true })).toHaveCount(0);
  await page.goto("/labor");
  await expect(page).toHaveURL(/dashboard/);
  await page.goto("/time-clock");
  await page.getByLabel("Location").selectOption({ label: "Labor Office" });
  await page.getByLabel("Assigned shift (optional)").selectOption({ index: 1 });
  await page.getByRole("button", { name: "Clock in" }).click();
  await expect(page.getByText("Clocked in successfully.")).toBeVisible();
  await page.getByRole("button", { name: "Clock out" }).click();
  await expect(page.getByText("Clocked out successfully.")).toBeVisible();

  await signOut(page);
  await signIn(page, ownerEmail);
  await page.goto("/timesheets");
  const timeEntry = page.locator(".time-entry-card").filter({ hasText: "Emery Employee" });
  await timeEntry.getByLabel("Corrected clock-in").fill(`${today}T09:00`);
  await timeEntry.getByLabel("Corrected clock-out").fill(`${today}T17:00`);
  await timeEntry.getByLabel("Correction reason").fill("Controlled Gate 5 labor verification");
  await timeEntry.getByRole("button", { name: "Save correction" }).click();
  await expect(page.getByText("Time entry corrected.")).toBeVisible();
  await page.locator(".time-entry-card").filter({ hasText: "Emery Employee" }).getByRole("button", { name: "Approve time entry" }).click();
  await expect(page.getByText("Time entry approved.")).toBeVisible();

  await page.goto("/labor");
  await expect(page.getByRole("heading", { name: "Labor" })).toBeVisible();
  const totals = page.getByLabel("Labor totals");
  await expect(totals).toContainText("52h 30m");
  await expect(totals).toContainText("8h 0m");
  await expect(totals).toContainText("$1,087.50");
  await expect(totals).toContainText("$200.00");
  await expect(totals).toContainText("$887.50");
  const primaryRow = page.locator(".labor-row").filter({ hasText: "Emery Employee" });
  await expect(primaryRow).toContainText("7h 30m");
  await expect(primaryRow).toContainText("8h 0m");
  await expect(primaryRow).toContainText("$25.00/hr");
  await expect(primaryRow).toContainText("$187.50");
  await expect(primaryRow).toContainText("$200.00");
  const overtimeRow = page.locator(".labor-row").filter({ hasText: "Taylor Overtime" });
  await expect(overtimeRow).toContainText("45h 0m");
  await expect(overtimeRow).toContainText("Scheduled over 40h by 5h 0m");
  await page.getByLabel("Location").selectOption({ label: "Labor Office" });
  await page.getByLabel("Department").selectOption({ label: "Operations" });
  await page.getByRole("button", { name: "Apply filters" }).click();
  await expect(page.locator(".labor-row")).toHaveCount(2);

  await signOut(page);
  await signIn(page, viewerEmail);
  await expect(page.getByRole("link", { name: "Labor", exact: true })).toBeVisible();
  await page.goto("/labor");
  await expect(page.getByLabel("Labor totals")).toContainText("Restricted");
  await expect(page.getByText("$25.00/hr")).toHaveCount(0);
  await expect(page.getByText("$187.50")).toHaveCount(0);
  await expect(page.getByText("Missing wage")).toHaveCount(0);
});
