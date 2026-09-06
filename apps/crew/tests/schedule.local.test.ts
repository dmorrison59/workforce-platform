import { createClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { weekStartFor, weekWindow } from "../src/lib/schedule-presentation";
import { loadCrewContext } from "../src/services/crew-context";
import { crewScheduleQuery, loadCrewSchedule } from "../src/services/crew-schedule";
import type { CrewContext } from "../src/types/crew-context";
import type { MobileDatabase } from "../src/types/database";

// Opt-in, read-only integration against an existing local Employee fixture with
// at least one published shift. No privileged key or fixture mutation is used.
const url = process.env.CREW_LOCAL_TEST_URL;
const key = process.env.CREW_LOCAL_TEST_ANON_KEY;
const email = process.env.CREW_LOCAL_TEST_EMAIL;
const password = process.env.CREW_LOCAL_TEST_PASSWORD;
const configured = Boolean(url && key && email && password);

describe.skipIf(!configured)("authenticated local employee scheduling", () => {
  const client = createClient<MobileDatabase>(url || "http://127.0.0.1:54321", key || "not-configured", {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  let context: CrewContext;
  let sampleStart: string;
  let sampleId: string;

  beforeAll(async () => {
    if (!url || !["127.0.0.1", "localhost"].includes(new URL(url).hostname)) {
      throw new Error("Integration tests refuse non-local Supabase URLs.");
    }
    const auth = await client.auth.signInWithPassword({ email: email!, password: password! });
    expect(auth.error).toBeNull();
    context = await loadCrewContext(client, auth.data.user!);
    expect(context.role.name).toBe("Employee");
    const sample = await client.from("shifts").select("id, start_at")
      .eq("organization_id", context.organization.id).eq("employee_id", context.employee.id)
      .eq("status", "published").order("start_at").limit(1).single();
    expect(sample.error, "The local employee fixture needs a published shift").toBeNull();
    sampleStart = sample.data!.start_at;
    sampleId = sample.data!.id;
  });
  afterAll(async () => { await client.auth.signOut({ scope: "local" }); });

  it("executes the real mobile joined query and resolves the assigned location", async () => {
    const window = weekWindow(weekStartFor(new Date(sampleStart), context.organization.timezone), context.organization.timezone);
    const shifts = await loadCrewSchedule(client, context, window);
    expect(shifts.some((shift) => shift.id === sampleId)).toBe(true);
    expect(shifts[0].location?.name).toBeTruthy();
    expect(shifts.map((shift) => shift.start_at)).toEqual(shifts.map((shift) => shift.start_at).sort());
  });
  it("RLS alone restricts assigned shifts to this employee and published parents", async () => {
    const result = await client.from("shifts").select("employee_id, status, schedule_id, organization_id")
      .not("employee_id", "is", null);
    expect(result.error).toBeNull();
    expect(result.data!.length).toBeGreaterThan(0);
    for (const shift of result.data!) {
      expect(shift.employee_id).toBe(context.employee.id);
      expect(shift.organization_id).toBe(context.organization.id);
      expect(shift.status).toBe("published");
      const publication = await client.from("schedules").select("status")
        .eq("id", shift.schedule_id).eq("organization_id", shift.organization_id).single();
      expect(publication.error).toBeNull();
      expect(publication.data?.status).toBe("published");
    }
  });
  it("cannot read another employee or the known seeded foreign organization", async () => {
    const foreignOrganization = "20000000-0000-0000-0000-000000000001"; // supabase/seed.sql
    expect(context.organization.id).not.toBe(foreignOrganization);
    const other = await client.from("shifts").select("id").neq("employee_id", context.employee.id).not("employee_id", "is", null);
    expect(other.error).toBeNull();
    expect(other.data).toEqual([]);
    const foreign = await client.from("shifts").select("id").eq("organization_id", foreignOrganization);
    expect(foreign.error).toBeNull();
    expect(foreign.data).toEqual([]);
    const forged = await crewScheduleQuery(client, foreignOrganization, context.employee.id, {
      start: "2020-01-01T00:00:00Z", end: "2040-01-01T00:00:00Z",
    });
    expect(forged.error).toBeNull();
    expect(forged.data).toEqual([]);
  });
});
