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
    (element as HTMLButtonElement).form?.requestSubmit(element as HTMLButtonElement);
  });
  await expect(page).toHaveURL(/sign-in/);
}

function nextMonday() {
  const today = new Date();
  const day = today.getUTCDay();
  today.setUTCDate(today.getUTCDate() + (day === 0 ? 1 : 8 - day));
  return today.toISOString().slice(0, 10);
}

test("manager fills an open shift and approves an employee swap", async ({ page }) => {
  test.setTimeout(150_000);
  const unique = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
  const ownerEmail = `owner-${unique}@gate3-test.example`;
  const managerEmail = `manager-${unique}@gate3-test.example`;
  const employeeAEmail = `employee-a-${unique}@gate3-test.example`;
  const employeeBEmail = `employee-b-${unique}@gate3-test.example`;
  const slug = `gate3-${unique}`;
  const shiftNote = `Gate 3 coverage ${unique}`;

  await page.goto("/sign-up");
  await page.getByLabel("First name").fill("Casey");
  await page.getByLabel("Last name").fill("Owner");
  await page.getByLabel("Email").fill(ownerEmail);
  await page.getByLabel("Password").fill(testPassword);
  await page.getByRole("button", { name: "Create account" }).click();
  await page.getByLabel("Organization name").fill(`Gate 3 Test ${unique}`);
  await page.getByLabel("Workspace slug").fill(slug);
  await page.getByRole("button", { name: "Create organization" }).click();
  await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible();

  await page.goto("/locations/new");
  await page.getByLabel("Location name").fill("Coverage Office");
  await page.getByLabel("Street address").fill("300 Coverage Avenue");
  await page.getByLabel("City").fill("Sampleville");
  await page.getByLabel("State / province").fill("NY");
  await page.getByLabel("Postal code").fill("10001");
  await page.getByRole("button", { name: "Add location" }).click();
  await expect(page.getByText("Coverage Office")).toBeVisible();

  await page.goto("/departments/new");
  await page.getByLabel("Department name").fill("Operations");
  await page.getByLabel("Location").selectOption({ label: "Coverage Office" });
  await page.getByRole("button", { name: "Add department" }).click();
  await expect(page.getByText("Operations")).toBeVisible();

  for (const employee of [
    { first: "Avery", last: "Employee", email: employeeAEmail, number: `A-${unique.slice(-5)}` },
    { first: "Blake", last: "Employee", email: employeeBEmail, number: `B-${unique.slice(-5)}` },
  ]) {
    await page.goto("/employees/new");
    await page.getByLabel("First name").fill(employee.first);
    await page.getByLabel("Last name").fill(employee.last);
    await page.getByLabel("Email").fill(employee.email);
    await page.getByLabel("Employee number").fill(employee.number);
    await page.getByRole("button", { name: "Add employee" }).click();
    await expect(page.getByText(`${employee.first} ${employee.last}`)).toBeVisible();
  }

  const employeeAClient = createClient(supabaseUrl, anonKey, { auth: { persistSession: false } });
  const employeeBClient = createClient(supabaseUrl, anonKey, { auth: { persistSession: false } });
  const managerClient = createClient(supabaseUrl, anonKey, { auth: { persistSession: false } });
  for (const account of [
    { client: employeeAClient, email: employeeAEmail, first: "Avery", last: "Employee" },
    { client: employeeBClient, email: employeeBEmail, first: "Blake", last: "Employee" },
    { client: managerClient, email: managerEmail, first: "Morgan", last: "Manager" },
  ]) {
    const { error } = await account.client.auth.signUp({
      email: account.email,
      password: testPassword,
      options: { data: { first_name: account.first, last_name: account.last } },
    });
    expect(error).toBeNull();
  }
  const [{ data: employeeAProfile }, { data: employeeBProfile }, { data: managerProfile }] = await Promise.all([
    employeeAClient.rpc("current_profile_id"),
    employeeBClient.rpc("current_profile_id"),
    managerClient.rpc("current_profile_id"),
  ]);

  const ownerClient = createClient(supabaseUrl, anonKey, { auth: { persistSession: false } });
  const { error: ownerSignInError } = await ownerClient.auth.signInWithPassword({ email: ownerEmail, password: testPassword });
  expect(ownerSignInError).toBeNull();
  const { data: organization } = await ownerClient.from("organizations").select("id").eq("slug", slug).single();
  const { data: roles } = await ownerClient.from("roles").select("id,name").eq("organization_id", organization!.id);
  const { data: employees } = await ownerClient.from("employees").select("id,email").eq("organization_id", organization!.id);
  const employeeRole = roles?.find((role) => role.name === "Employee");
  const managerRole = roles?.find((role) => role.name === "Manager");
  const { error: membershipError } = await ownerClient.from("organization_memberships").insert([
    { organization_id: organization!.id, profile_id: employeeAProfile!, role_id: employeeRole!.id, membership_role: "employee", status: "active" },
    { organization_id: organization!.id, profile_id: employeeBProfile!, role_id: employeeRole!.id, membership_role: "employee", status: "active" },
    { organization_id: organization!.id, profile_id: managerProfile!, role_id: managerRole!.id, membership_role: "manager", status: "active" },
  ]);
  expect(membershipError).toBeNull();
  for (const [email, profileId] of [[employeeAEmail, employeeAProfile], [employeeBEmail, employeeBProfile]] as const) {
    const employee = employees?.find((candidate) => candidate.email === email);
    const { error } = await ownerClient.from("employees").update({ profile_id: profileId }).eq("id", employee!.id);
    expect(error).toBeNull();
  }

  await signOut(page);
  await signIn(page, managerEmail);
  await page.goto("/schedule");
  await page.getByRole("link", { name: "Next week" }).click();
  await expect(page).toHaveURL(/week=/);
  await page.getByRole("button", { name: "Create draft schedule" }).click();
  await page.getByLabel("Department").selectOption({ label: "Operations" });
  await page.getByLabel("Employee").selectOption({ label: "Avery Employee" });
  await page.getByLabel("Notes").fill(shiftNote);
  await page.getByRole("button", { name: "Create shift" }).click();
  await expect(page.getByText("Shift created.")).toBeVisible();
  await page.getByRole("button", { name: "Publish schedule" }).click();
  await expect(page.getByText("Schedule published.")).toBeVisible();
  await page.getByRole("button", { name: "Mark open" }).click();
  await expect(page.getByText("Shift marked open.")).toBeVisible();
  await expect(page.getByLabel("Weekly calendar").getByText("Open shift")).toBeVisible();

  await signOut(page);
  await signIn(page, employeeBEmail);
  await page.goto("/my-availability");
  const monday = page.locator(".availability-card").filter({ has: page.getByRole("heading", { name: "Monday" }) });
  await monday.getByLabel("Available to work").uncheck();
  await monday.getByLabel("Effective from").fill(nextMonday());
  await monday.getByRole("button", { name: "Save Monday" }).click();
  await expect(page.getByText("Availability saved.")).toBeVisible();

  await signOut(page);
  await signIn(page, employeeAEmail);
  await page.goto("/open-shifts");
  const openShift = page.locator(".coverage-card").filter({ hasText: "Coverage Office" });
  await expect(openShift).toContainText("Operations");
  await openShift.getByRole("button", { name: "Request shift" }).click();
  await expect(page.getByText("Open shift requested.")).toBeVisible();
  await expect(openShift.getByText("pending", { exact: true })).toBeVisible();

  await signOut(page);
  await signIn(page, managerEmail);
  await page.goto("/coverage-requests");
  const openRequest = page.locator(".open-request-card").filter({ hasText: "Avery Employee" });
  await expect(openRequest).toContainText("Coverage Office");
  await openRequest.getByRole("button", { name: "Approve open shift" }).click();
  await expect(page.getByText("Open-shift request reviewed.")).toBeVisible();

  await signOut(page);
  await signIn(page, employeeAEmail);
  await page.goto("/my-schedule");
  await expect(page.getByText(shiftNote)).toBeVisible();
  await page.goto("/shift-swaps");
  const swapShift = page.locator(".coverage-card").filter({ hasText: "Coverage Office" });
  await swapShift.getByLabel("Target employee").selectOption({ label: "Blake Employee" });
  await swapShift.getByRole("button", { name: "Request swap" }).click();
  await expect(page.getByText("Shift swap requested.")).toBeVisible();

  await signOut(page);
  await signIn(page, managerEmail);
  await page.goto("/coverage-requests");
  let swapRequest = page.locator(".swap-request-card").filter({ hasText: "Avery Employee → Blake Employee" });
  await swapRequest.getByRole("button", { name: "Approve swap" }).click();
  await expect(page.getByText(/Employee is marked unavailable on Monday/)).toBeVisible();
  swapRequest = page.locator(".swap-request-card").filter({ hasText: "Avery Employee → Blake Employee" });
  await swapRequest.getByLabel("Approve despite availability or approved time-off warnings").check();
  await swapRequest.getByRole("button", { name: "Approve swap" }).click();
  await expect(page.getByText("Shift-swap request reviewed.")).toBeVisible();

  await signOut(page);
  await signIn(page, employeeBEmail);
  await page.goto("/my-schedule");
  await expect(page.getByText(shiftNote)).toBeVisible();
});
