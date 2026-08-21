import { expect, test } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";

const testPassword = process.env.PLAYWRIGHT_TEST_PASSWORD ?? "";
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
test.skip(!testPassword || !supabaseUrl || !anonKey, "Local Supabase and PLAYWRIGHT_TEST_PASSWORD are required.");

function addDays(date: string, days: number) {
  const value = new Date(`${date}T12:00:00Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}

function nextMonday() {
  const today = new Date();
  const date = today.toISOString().slice(0, 10);
  const day = new Date(`${date}T12:00:00Z`).getUTCDay();
  return addDays(date, day === 0 ? 1 : 8 - day);
}

test("employee self-service feeds manager scheduling warnings", async ({ page }) => {
  test.setTimeout(120_000);
  const unique = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
  const ownerEmail = `owner-${unique}@gate2-test.example`;
  const managerEmail = `manager-${unique}@gate2-test.example`;
  const employeeEmail = `employee-${unique}@gate2-test.example`;
  const slug = `gate2-${unique}`;
  const requestedDate = nextMonday();

  await page.goto("/sign-up");
  await page.getByLabel("First name").fill("Casey");
  await page.getByLabel("Last name").fill("Owner");
  await page.getByLabel("Email").fill(ownerEmail);
  await page.getByLabel("Password").fill(testPassword);
  await page.getByRole("button", { name: "Create account" }).click();
  await page.getByLabel("Organization name").fill(`Gate 2 Test ${unique}`);
  await page.getByLabel("Workspace slug").fill(slug);
  await page.getByRole("button", { name: "Create organization" }).click();
  await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible();

  await page.goto("/locations/new");
  await page.getByLabel("Location name").fill("Self Service Office");
  await page.getByLabel("Street address").fill("200 Self Service Avenue");
  await page.getByLabel("City").fill("Sampleville");
  await page.getByLabel("State / province").fill("NY");
  await page.getByLabel("Postal code").fill("10001");
  await page.getByRole("button", { name: "Add location" }).click();

  await page.goto("/departments/new");
  await page.getByLabel("Department name").fill("Operations");
  await page.getByLabel("Location").selectOption({ label: "Self Service Office" });
  await page.getByRole("button", { name: "Add department" }).click();

  await page.goto("/employees/new");
  await page.getByLabel("First name").fill("Emery");
  await page.getByLabel("Last name").fill("Employee");
  await page.getByLabel("Email").fill(employeeEmail);
  await page.getByLabel("Employee number").fill(`E-${unique.slice(-5)}`);
  await page.getByRole("button", { name: "Add employee" }).click();
  await expect(page.getByText("Emery Employee")).toBeVisible();

  const employeeClient = createClient(supabaseUrl, anonKey, { auth: { persistSession: false } });
  const { error: employeeSignUpError } = await employeeClient.auth.signUp({
    email: employeeEmail,
    password: testPassword,
    options: { data: { first_name: "Emery", last_name: "Employee" } },
  });
  expect(employeeSignUpError).toBeNull();
  const { data: employeeProfileId, error: employeeProfileError } = await employeeClient.rpc("current_profile_id");
  expect(employeeProfileError).toBeNull();
  expect(employeeProfileId).toBeTruthy();

  const managerClient = createClient(supabaseUrl, anonKey, { auth: { persistSession: false } });
  const { error: managerSignUpError } = await managerClient.auth.signUp({
    email: managerEmail,
    password: testPassword,
    options: { data: { first_name: "Morgan", last_name: "Manager" } },
  });
  expect(managerSignUpError).toBeNull();
  const { data: managerProfileId, error: managerProfileError } = await managerClient.rpc("current_profile_id");
  expect(managerProfileError).toBeNull();
  expect(managerProfileId).toBeTruthy();

  const ownerClient = createClient(supabaseUrl, anonKey, { auth: { persistSession: false } });
  const { error: ownerSignInError } = await ownerClient.auth.signInWithPassword({ email: ownerEmail, password: testPassword });
  expect(ownerSignInError).toBeNull();
  const { data: organization } = await ownerClient.from("organizations").select("id").eq("slug", slug).single();
  const { data: roles } = await ownerClient.from("roles").select("id,name").eq("organization_id", organization!.id);
  const { data: employee } = await ownerClient.from("employees").select("id")
    .eq("organization_id", organization!.id).eq("email", employeeEmail).single();
  const employeeRole = roles?.find((role) => role.name === "Employee");
  const managerRole = roles?.find((role) => role.name === "Manager");
  expect(employeeRole).toBeTruthy();
  expect(managerRole).toBeTruthy();
  const { error: membershipError } = await ownerClient.from("organization_memberships").insert([
    {
      organization_id: organization!.id,
      profile_id: employeeProfileId!,
      role_id: employeeRole!.id,
      membership_role: "employee",
      status: "active",
    },
    {
      organization_id: organization!.id,
      profile_id: managerProfileId!,
      role_id: managerRole!.id,
      membership_role: "manager",
      status: "active",
    },
  ]);
  expect(membershipError).toBeNull();
  const { error: linkError } = await ownerClient.from("employees").update({ profile_id: employeeProfileId }).eq("id", employee!.id);
  expect(linkError).toBeNull();

  await page.getByRole("button", { name: "Sign out" }).click();
  await page.getByLabel("Email").fill(employeeEmail);
  await page.getByLabel("Password").fill(testPassword);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible();

  await page.goto("/my-availability");
  const monday = page.locator(".availability-card").filter({ has: page.getByRole("heading", { name: "Monday" }) });
  await monday.getByLabel("Available to work").uncheck();
  await monday.getByLabel("Effective from").fill(requestedDate);
  await monday.getByRole("button", { name: "Save Monday" }).click();
  await expect(page.getByText("Availability saved.")).toBeVisible();

  await page.goto("/time-off");
  await page.getByLabel("Start date").fill(requestedDate);
  await page.getByLabel("End date").fill(requestedDate);
  await page.getByLabel("Reason (optional)").fill("Family appointment");
  await page.getByRole("button", { name: "Submit request" }).click();
  await expect(page.getByText("Time-off request submitted.")).toBeVisible();
  await expect(page.getByText("pending", { exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: "Time Off Requests" })).toHaveCount(0);

  await page.getByRole("button", { name: "Sign out" }).click();
  await page.getByLabel("Email").fill(managerEmail);
  await page.getByLabel("Password").fill(testPassword);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible();
  await page.goto("/time-off-requests");
  const requestCard = page.locator(".review-card").filter({ hasText: "Emery Employee" });
  await expect(requestCard.getByText("Family appointment")).toBeVisible();
  await requestCard.getByLabel("Manager note (optional)").fill("Approved for appointment");
  await requestCard.getByRole("button", { name: "Approve" }).click();
  await expect(page.getByText("Time-off request reviewed.")).toBeVisible();

  await page.goto("/schedule");
  await page.getByRole("link", { name: "Next week" }).click();
  await page.getByRole("button", { name: "Create draft schedule" }).click();
  await page.getByLabel("Department").selectOption({ label: "Operations" });
  await page.getByLabel("Employee").selectOption({ label: "Emery Employee" });
  await page.getByLabel("Notes").fill("Manager override coverage");
  await page.getByRole("button", { name: "Create shift" }).click();
  await expect(page.getByText(/Employee is marked unavailable on Monday/)).toBeVisible();
  await expect(page.getByText(/Approved time off overlaps this shift/)).toBeVisible();

  await page.getByLabel("Department").selectOption({ label: "Operations" });
  await page.getByLabel("Employee").selectOption({ label: "Emery Employee" });
  await page.getByLabel("Notes").fill("Manager override coverage");
  await page.getByLabel("Save despite availability or approved time-off warnings").check();
  await page.getByRole("button", { name: "Create shift" }).click();
  await expect(page.getByText("Shift created.")).toBeVisible();
  await expect(page.getByLabel("Weekly calendar").getByText("Emery Employee")).toBeVisible();

  await page.getByRole("button", { name: "Sign out" }).click();
  await page.getByLabel("Email").fill(employeeEmail);
  await page.getByLabel("Password").fill(testPassword);
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.goto("/time-off");
  await expect(page.getByText("approved", { exact: true })).toBeVisible();
  await expect(page.getByText("Manager note: Approved for appointment")).toBeVisible();
  await expect(page.getByRole("link", { name: "Time Off Requests" })).toHaveCount(0);
});
