import { expect, test } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";

const testPassword = process.env.PLAYWRIGHT_TEST_PASSWORD ?? "";
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
test.skip(!testPassword || !supabaseUrl || !anonKey, "Local Supabase and PLAYWRIGHT_TEST_PASSWORD are required.");

test("manager publishes a shift that the assigned employee can view", async ({ page }) => {
  test.setTimeout(90_000);
  const unique = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
  const ownerEmail = `owner-${unique}@gate1-test.example`;
  const managerEmail = `manager-${unique}@gate1-test.example`;
  const employeeEmail = `employee-${unique}@gate1-test.example`;
  const slug = `gate1-${unique}`;

  await page.goto("/sign-up");
  await page.getByLabel("First name").fill("Casey");
  await page.getByLabel("Last name").fill("Owner");
  await page.getByLabel("Email").fill(ownerEmail);
  await page.getByLabel("Password").fill(testPassword);
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page).toHaveURL(/organization-setup/);

  await page.getByLabel("Organization name").fill(`Gate 1 Test ${unique}`);
  await page.getByLabel("Workspace slug").fill(slug);
  await page.getByRole("button", { name: "Create organization" }).click();
  await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible();

  await page.goto("/locations/new");
  await page.getByLabel("Location name").fill("Scheduling Office");
  await page.getByLabel("Street address").fill("100 Schedule Avenue");
  await page.getByLabel("City").fill("Sampleville");
  await page.getByLabel("State / province").fill("NY");
  await page.getByLabel("Postal code").fill("10001");
  await page.getByRole("button", { name: "Add location" }).click();

  await page.goto("/departments/new");
  await page.getByLabel("Department name").fill("Operations");
  await page.getByLabel("Location").selectOption({ label: "Scheduling Office" });
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
  const { data: employeeProfileId, error: profileError } = await employeeClient.rpc("current_profile_id");
  expect(profileError).toBeNull();
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
  const { data: organization, error: organizationError } = await ownerClient
    .from("organizations").select("id").eq("slug", slug).single();
  expect(organizationError).toBeNull();
  const { data: employeeRole, error: employeeRoleError } = await ownerClient
    .from("roles").select("id").eq("organization_id", organization!.id).eq("name", "Employee").single();
  expect(employeeRoleError).toBeNull();
  const { data: managerRole, error: managerRoleError } = await ownerClient
    .from("roles").select("id").eq("organization_id", organization!.id).eq("name", "Manager").single();
  expect(managerRoleError).toBeNull();
  const { data: employee, error: employeeError } = await ownerClient
    .from("employees").select("id").eq("organization_id", organization!.id).eq("email", employeeEmail).single();
  expect(employeeError).toBeNull();
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
  const { data: managerMembership, error: managerMembershipError } = await managerClient
    .from("organization_memberships")
    .select("membership_role")
    .eq("organization_id", organization!.id)
    .eq("profile_id", managerProfileId!)
    .single();
  expect(managerMembershipError).toBeNull();
  expect(managerMembership?.membership_role).toBe("manager");
  const { error: linkError } = await ownerClient.from("employees").update({ profile_id: employeeProfileId }).eq("id", employee!.id);
  expect(linkError).toBeNull();

  await page.getByRole("button", { name: "Sign out" }).click();
  await page.getByLabel("Email").fill(managerEmail);
  await page.getByLabel("Password").fill(testPassword);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Schedule", exact: true })).toBeVisible();

  await page.goto("/schedule");
  await page.getByRole("link", { name: "Next week" }).click();
  await page.getByRole("button", { name: "Create draft schedule" }).click();
  await expect(page.getByText("Draft schedule created.")).toBeVisible();
  await page.getByLabel("Department").selectOption({ label: "Operations" });
  await page.getByLabel("Employee").selectOption({ label: "Emery Employee" });
  await page.getByLabel("Notes").fill("Customer coverage");
  await page.getByRole("button", { name: "Create shift" }).click();
  await expect(page.getByText("Shift created.")).toBeVisible();
  await expect(page.getByLabel("Weekly calendar").getByText("Emery Employee")).toBeVisible();
  await page.getByRole("button", { name: "Publish schedule" }).click();
  await expect(page.getByText("Schedule published.")).toBeVisible();
  await expect(page.getByText("published", { exact: true })).toBeVisible();

  await page.getByRole("button", { name: "Sign out" }).click();
  await expect(page).toHaveURL(/sign-in/);
  await page.getByLabel("Email").fill(employeeEmail);
  await page.getByLabel("Password").fill(testPassword);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible();
  await page.goto("/my-schedule");
  await expect(page.getByRole("heading", { name: "My Schedule" })).toBeVisible();
  await expect(page.getByText("Customer coverage")).toBeVisible();
  await expect(page.getByText("Scheduling Office")).toBeVisible();
  await expect(page.getByText("Operations")).toBeVisible();
  await expect(page.getByRole("link", { name: "Schedule", exact: true })).toHaveCount(0);
});
