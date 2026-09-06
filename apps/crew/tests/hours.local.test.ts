import { createClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { entryWorkedMinutes } from "../src/lib/hours-presentation";
import { weekStartFor } from "../src/lib/schedule-presentation";
import { loadCrewContext } from "../src/services/crew-context";
import { loadCrewHours } from "../src/services/crew-hours";
import type { CrewContext } from "../src/types/crew-context";
import type { MobileDatabase } from "../src/types/database";
import type { CrewHoursData } from "../src/types/hours";

// Opt-in and read-only. It uses only an authenticated local employee session;
// no service key, fixture creation, or time-entry mutation is permitted here.
const url = process.env.CREW_LOCAL_TEST_URL;
const key = process.env.CREW_LOCAL_TEST_ANON_KEY;
const email = process.env.CREW_LOCAL_TEST_EMAIL;
const password = process.env.CREW_LOCAL_TEST_PASSWORD;
const configured = Boolean(url && key && email && password);

describe.skipIf(!configured)("authenticated local employee hours", () => {
  const client = createClient<MobileDatabase>(url || "http://127.0.0.1:54321", key || "not-configured", {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  let context: CrewContext;
  let hours: CrewHoursData;

  beforeAll(async () => {
    if (!url || !["127.0.0.1", "localhost"].includes(new URL(url).hostname)) {
      throw new Error("Integration tests refuse non-local Supabase URLs.");
    }
    const auth = await client.auth.signInWithPassword({ email: email!, password: password! });
    expect(auth.error).toBeNull();
    context = await loadCrewContext(client, auth.data.user!);
    expect(context.role.name).toBe("Employee");
    hours = await loadCrewHours(client, context, weekStartFor(new Date(), context.organization.timezone));
  });

  afterAll(async () => { await client.auth.signOut({ scope: "local" }); });

  it("loads only the current employee's current-week entries and relevant breaks", () => {
    expect(hours.entries.every((entry) => entry.organization_id === context.organization.id
      && entry.employee_id === context.employee.id)).toBe(true);
    const visibleEntryIds = new Set(hours.entries.map((entry) => entry.id));
    expect(hours.breaks.every((item) => item.organization_id === context.organization.id
      && visibleEntryIds.has(item.time_entry_id))).toBe(true);
  });

  it("represents open entries provisionally and closed entries with the shared web calculation", () => {
    const now = new Date();
    for (const entry of hours.entries) {
      const breaks = hours.breaks.filter((item) => item.time_entry_id === entry.id);
      const minutes = entryWorkedMinutes(entry, breaks, now);
      expect(minutes).toBeGreaterThanOrEqual(0);
      if (entry.status === "open") expect(entry.clock_out_at).toBeNull();
      if (["completed", "corrected"].includes(entry.status)) expect(entry.clock_out_at).not.toBeNull();
    }
  });

  it("RLS blocks other employees and the known seeded foreign organization", async () => {
    const foreignOrganization = "20000000-0000-0000-0000-000000000001";
    expect(context.organization.id).not.toBe(foreignOrganization);
    const otherEntries = await client.from("time_entries").select("id").neq("employee_id", context.employee.id);
    expect(otherEntries.error).toBeNull();
    expect(otherEntries.data).toEqual([]);
    const foreignEntries = await client.from("time_entries").select("id").eq("organization_id", foreignOrganization);
    expect(foreignEntries.error).toBeNull();
    expect(foreignEntries.data).toEqual([]);
    const otherBreaks = await client.from("time_breaks").select("id").neq("organization_id", context.organization.id);
    expect(otherBreaks.error).toBeNull();
    expect(otherBreaks.data).toEqual([]);
  });
});
