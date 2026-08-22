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

function localDate() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/New_York", year: "numeric", month: "2-digit", day: "2-digit",
  }).format(new Date());
}

test("assigned employee verifies inside radius, is blocked outside, and uses a manager override", async ({ page, context }) => {
  test.setTimeout(180_000);
  const unique = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
  const ownerEmail = `owner-${unique}@gate7-test.example`;
  const employeeEmail = `employee-${unique}@gate7-test.example`;
  const slug = `gate7-${unique}`;
  const today = localDate();
  const jobName = `Verified Field Job ${unique}`;

  await context.grantPermissions(["geolocation"], { origin: "http://127.0.0.1:3000" });
  await page.goto("/sign-up");
  await page.getByLabel("First name").fill("Jordan");
  await page.getByLabel("Last name").fill("Owner");
  await page.getByLabel("Email").fill(ownerEmail);
  await page.getByLabel("Password").fill(testPassword);
  await page.getByRole("button", { name: "Create account" }).click();
  await page.getByLabel("Organization name").fill(`Gate 7 Test ${unique}`);
  await page.getByLabel("Workspace slug").fill(slug);
  await page.getByRole("button", { name: "Create organization" }).click();
  await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible();

  await page.goto("/locations/new");
  await page.getByLabel("Location name").fill("Field Operations Office");
  await page.getByLabel("Street address").fill("10 Field Way");
  await page.getByLabel("City").fill("New York");
  await page.getByLabel("State / province").fill("NY");
  await page.getByLabel("Postal code").fill("10001");
  await page.getByRole("button", { name: "Add location" }).click();
  await expect(page.getByText("Field Operations Office")).toBeVisible();

  await page.goto("/employees/new");
  await page.getByLabel("First name").fill("Avery");
  await page.getByLabel("Last name").fill("Field");
  await page.getByLabel("Email").fill(employeeEmail);
  await page.getByLabel("Employee number").fill(`GPS-${unique.slice(-5)}`);
  await page.getByRole("button", { name: "Add employee" }).click();
  await expect(page.getByText("Avery Field")).toBeVisible();

  const employeeClient = createClient(supabaseUrl, anonKey, { auth: { persistSession: false } });
  const ownerClient = createClient(supabaseUrl, anonKey, { auth: { persistSession: false } });
  const { error: signUpError } = await employeeClient.auth.signUp({
    email: employeeEmail, password: testPassword,
    options: { data: { first_name: "Avery", last_name: "Field" } },
  });
  expect(signUpError).toBeNull();
  const { data: employeeProfile } = await employeeClient.rpc("current_profile_id");
  const { error: ownerSignInError } = await ownerClient.auth.signInWithPassword({ email: ownerEmail, password: testPassword });
  expect(ownerSignInError).toBeNull();
  const { data: organization } = await ownerClient.from("organizations").select("id").eq("slug", slug).single();
  const { data: employeeRole } = await ownerClient.from("roles").select("id").eq("organization_id", organization!.id).eq("name", "Employee").single();
  const { data: employee } = await ownerClient.from("employees").select("id").eq("organization_id", organization!.id).eq("email", employeeEmail).single();
  const { error: membershipError } = await ownerClient.from("organization_memberships").insert({
    organization_id: organization!.id, profile_id: employeeProfile!, role_id: employeeRole!.id,
    membership_role: "employee", status: "active",
  });
  expect(membershipError).toBeNull();
  const { error: linkError } = await ownerClient.from("employees").update({ profile_id: employeeProfile }).eq("id", employee!.id);
  expect(linkError).toBeNull();

  await page.goto("/jobs");
  await page.getByLabel("Customer name", { exact: true }).first().fill("Acme Field Customer");
  await page.getByLabel("Job name", { exact: true }).first().fill(jobName);
  await page.getByLabel("Job address", { exact: true }).fill("10 Field Way, New York, NY");
  await page.getByLabel("Existing location (optional)").selectOption({ label: "Field Operations Office" });
  await page.getByLabel("Scheduled start", { exact: true }).first().fill(`${today}T00:01`);
  await page.getByLabel("Scheduled end", { exact: true }).first().fill(`${today}T23:58`);
  await page.getByRole("button", { name: "Create job" }).click();
  await expect(page.getByText("Job created.")).toBeVisible();
  let jobCard = page.locator(".field-card").filter({ hasText: jobName });
  await jobCard.getByLabel("Verification latitude").fill("40.7128");
  await jobCard.getByLabel("Verification longitude").fill("-74.0060");
  await jobCard.getByRole("button", { name: "Save verification coordinates" }).click();
  await expect(page.getByText("Job verification coordinates updated.")).toBeVisible();
  jobCard = page.locator(".field-card").filter({ hasText: jobName });
  await jobCard.getByLabel("Assign employee").selectOption({ label: "Avery Field" });
  await jobCard.getByRole("button", { name: "Assign employee" }).click();
  await expect(page.getByText("Job assignment added.")).toBeVisible();

  await page.goto("/field-clock");
  await page.getByLabel("Require job-site verification for field clock-in").check();
  await page.getByLabel("Allowed radius (meters)").fill("150");
  await page.getByLabel("Maximum device uncertainty (meters)").fill("100");
  await page.getByRole("button", { name: "Save field clock settings" }).click();
  await expect(page.getByText("Field clock settings updated.")).toBeVisible();

  await signOut(page);
  await signIn(page, employeeEmail);
  await context.setGeolocation({ latitude: 40.71281, longitude: -74.00601, accuracy: 10 });
  await page.goto("/time-clock");
  await page.getByLabel("Assigned field job").selectOption({ label: `${jobName} · 10 Field Way, New York, NY` });
  await page.getByRole("button", { name: "Verify location and clock in" }).click();
  await expect(page.getByText("Location verified and clock-in recorded.")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Clocked in" })).toBeVisible();
  await page.getByRole("button", { name: "Clock out" }).click();
  await expect(page.getByText("Clocked out successfully.")).toBeVisible();

  await context.setGeolocation({ latitude: 40.7228, longitude: -74.006, accuracy: 10 });
  await page.getByLabel("Assigned field job").selectOption({ label: `${jobName} · 10 Field Way, New York, NY` });
  await page.getByRole("button", { name: "Verify location and clock in" }).click();
  await expect(page.getByText(/outside the allowed radius/)).toBeVisible();
  await expect(page.getByRole("heading", { name: "Clocked out" })).toBeVisible();
  await expect(page.getByText("outside radius", { exact: true })).toBeVisible();

  await signOut(page);
  await signIn(page, ownerEmail);
  await page.goto("/field-clock");
  const failedAttempt = page.locator(".review-card").filter({ hasText: "Outside radius" }).first();
  await failedAttempt.getByLabel("Override reason").fill("Supervisor confirmed the employee used the alternate job entrance");
  await failedAttempt.getByRole("button", { name: "Approve override" }).click();
  await expect(page.getByText("Verification override approved and audited.")).toBeVisible();
  await expect(page.locator(".review-card").filter({ hasText: "Overridden" }).first()).toContainText("alternate job entrance");

  await signOut(page);
  await signIn(page, employeeEmail);
  await page.goto("/time-clock");
  await expect(page.getByText(/approved your failed verification/)).toBeVisible();
  await page.getByRole("button", { name: "Clock in with approved override" }).click();
  await expect(page.getByText("Clock-in recorded with the approved manager override.")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Clocked in" })).toBeVisible();
});
