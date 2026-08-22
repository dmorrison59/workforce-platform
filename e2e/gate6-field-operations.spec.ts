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

test("manager assigns crew and direct employee jobs with effective-date visibility", async ({ page }) => {
  test.setTimeout(180_000);
  const unique = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
  const ownerEmail = `owner-${unique}@gate6-test.example`;
  const employeeAEmail = `crew-${unique}@gate6-test.example`;
  const employeeBEmail = `direct-${unique}@gate6-test.example`;
  const slug = `gate6-${unique}`;
  const today = localDate();
  const crewName = `North Crew ${unique}`;
  const jobName = `Garden Install ${unique}`;

  await page.goto("/sign-up");
  await page.getByLabel("First name").fill("Finley");
  await page.getByLabel("Last name").fill("Owner");
  await page.getByLabel("Email").fill(ownerEmail);
  await page.getByLabel("Password").fill(testPassword);
  await page.getByRole("button", { name: "Create account" }).click();
  await page.getByLabel("Organization name").fill(`Gate 6 Test ${unique}`);
  await page.getByLabel("Workspace slug").fill(slug);
  await page.getByRole("button", { name: "Create organization" }).click();
  await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible();

  for (const employee of [
    { first: "Avery", last: "Crew", email: employeeAEmail, number: `A-${unique.slice(-5)}` },
    { first: "Blake", last: "Direct", email: employeeBEmail, number: `B-${unique.slice(-5)}` },
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
  const ownerClient = createClient(supabaseUrl, anonKey, { auth: { persistSession: false } });
  for (const [client, email, first, last] of [
    [employeeAClient, employeeAEmail, "Avery", "Crew"],
    [employeeBClient, employeeBEmail, "Blake", "Direct"],
  ] as const) {
    const { error } = await client.auth.signUp({ email, password: testPassword, options: { data: { first_name: first, last_name: last } } });
    expect(error).toBeNull();
  }
  const [{ data: profileA }, { data: profileB }] = await Promise.all([
    employeeAClient.rpc("current_profile_id"), employeeBClient.rpc("current_profile_id"),
  ]);
  const { error: ownerSignInError } = await ownerClient.auth.signInWithPassword({ email: ownerEmail, password: testPassword });
  expect(ownerSignInError).toBeNull();
  const { data: organization } = await ownerClient.from("organizations").select("id").eq("slug", slug).single();
  const { data: employeeRole } = await ownerClient.from("roles").select("id").eq("organization_id", organization!.id).eq("name", "Employee").single();
  const { data: employeeRows } = await ownerClient.from("employees").select("id,email").eq("organization_id", organization!.id);
  for (const [profileId, email] of [[profileA, employeeAEmail], [profileB, employeeBEmail]] as const) {
    const { error: membershipError } = await ownerClient.from("organization_memberships").insert({
      organization_id: organization!.id, profile_id: profileId!, role_id: employeeRole!.id,
      membership_role: "employee", status: "active",
    });
    expect(membershipError).toBeNull();
    const employee = employeeRows?.find((row) => row.email === email);
    const { error: linkError } = await ownerClient.from("employees").update({ profile_id: profileId }).eq("id", employee!.id);
    expect(linkError).toBeNull();
  }

  await page.goto("/crews");
  await page.getByLabel("Crew name").fill(crewName);
  await page.getByLabel("Crew leader (optional)").selectOption({ label: "Avery Crew" });
  await page.getByRole("button", { name: "Create crew" }).click();
  await expect(page.getByText("Crew created.")).toBeVisible();
  const crewCard = page.locator(".field-card").filter({ hasText: crewName });
  await crewCard.getByLabel("Add employee").selectOption({ label: "Avery Crew" });
  await crewCard.getByLabel("Effective from").fill(today);
  await crewCard.getByRole("button", { name: "Add member" }).click();
  await expect(page.getByText("Crew member added.")).toBeVisible();

  await page.goto("/jobs");
  await page.getByLabel("Customer name", { exact: true }).first().fill("Greenview Customer");
  await page.getByLabel("Job name", { exact: true }).first().fill(jobName);
  await page.getByLabel("Job address", { exact: true }).fill("700 Fieldstone Road");
  await page.getByLabel("Scheduled start", { exact: true }).first().fill(`${today}T09:00`);
  await page.getByLabel("Scheduled end", { exact: true }).first().fill(`${today}T17:00`);
  await page.getByLabel("Notes", { exact: true }).first().fill("Bring standard installation equipment.");
  await page.getByRole("button", { name: "Create job" }).click();
  await expect(page.getByText("Job created.")).toBeVisible();
  const jobCard = page.locator(".field-card").filter({ hasText: jobName });
  await jobCard.getByLabel("Assign active crew").selectOption({ label: crewName });
  await jobCard.getByRole("button", { name: "Assign crew" }).click();
  await expect(page.getByText("Job assignment added.")).toBeVisible();

  await signOut(page);
  await signIn(page, employeeAEmail);
  await expect(page.getByRole("link", { name: "My Jobs" })).toBeVisible();
  await page.goto("/my-jobs");
  await expect(page.getByRole("heading", { name: jobName })).toBeVisible();
  await expect(page.getByText(`Crew: ${crewName}`)).toBeVisible();

  await signOut(page);
  await signIn(page, employeeBEmail);
  await page.goto("/my-jobs");
  await expect(page.getByText("No jobs are assigned to you or your active crew.")).toBeVisible();

  await signOut(page);
  await signIn(page, ownerEmail);
  await page.goto("/jobs");
  const managerJobCard = page.locator(".field-card").filter({ hasText: jobName });
  await managerJobCard.getByLabel("Assign employee").selectOption({ label: "Blake Direct" });
  await managerJobCard.getByRole("button", { name: "Assign employee" }).click();
  await expect(page.getByText("Job assignment added.")).toBeVisible();

  await signOut(page);
  await signIn(page, employeeBEmail);
  await page.goto("/my-jobs");
  await expect(page.getByRole("heading", { name: jobName })).toBeVisible();

  await signOut(page);
  await signIn(page, ownerEmail);
  await page.goto("/jobs");
  await page.locator(".field-card").filter({ hasText: jobName }).getByRole("button", { name: "Mark completed" }).click();
  await expect(page.getByText("Job status updated.")).toBeVisible();

  for (const email of [employeeAEmail, employeeBEmail]) {
    await signOut(page);
    await signIn(page, email);
    await page.goto("/my-jobs");
    await expect(page.locator(".my-job-card").filter({ hasText: jobName })).toContainText("completed");
  }
});
