/// <reference types="node" />
import { randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { loadCrewContext } from "../src/services/crew-context";
import { clockApi } from "../src/services/crew-clock";
import { loadCrewHours } from "../src/services/crew-hours";
import { entryWorkedMinutes } from "../src/lib/hours-presentation";
import { weekStartFor } from "../src/lib/schedule-presentation";
import type { CrewContext } from "../src/types/crew-context";
import type { MobileDatabase } from "../src/types/database";
import type { PendingPunch } from "../src/types/clock";

const url = process.env.CREW_LOCAL_TEST_URL;
const key = process.env.CREW_LOCAL_TEST_ANON_KEY;
const email = process.env.CREW_LOCAL_TEST_EMAIL;
const password = process.env.CREW_LOCAL_TEST_PASSWORD;
describe.skipIf(!url || !key || !email || !password || process.env.CREW_LOCAL_CLOCK_WRITES !== "1")("local authenticated mobile punches", () => {
  const client = createClient<MobileDatabase>(url || "http://127.0.0.1:54321", key || "not-configured", { auth: { persistSession: false, autoRefreshToken: false } });
  let context: CrewContext;
  let api: ReturnType<typeof clockApi>;
  let createdEntry: string | null = null;
  beforeAll(async () => {
    if (!url || !["127.0.0.1", "localhost"].includes(new URL(url).hostname) || !email?.endsWith("@gate1-test.example")) throw new Error("Only the existing local disposable scheduling test employee is allowed.");
    const auth = await client.auth.signInWithPassword({ email: email!, password: password! });
    expect(auth.error).toBeNull();
    context = await loadCrewContext(client, auth.data.user!);
    expect(context.role.name).toBe("Employee");
    api = clockApi(client, context);
    const state = await api.load();
    expect(state.activeEntry, "Refuse to alter an existing open entry").toBeNull();
    expect(state.fieldRequired).toBe(false);
  });
  afterAll(async () => {
    // Close only the entry created by this test, even on assertion failure.
    if (createdEntry && api) {
      const state = await api.load();
      if (state.activeEntry?.id === createdEntry) {
        if (state.hasOpenBreak) await client.rpc("end_break", { target_organization_id: context.organization.id });
        await api.submit({ requestId: randomUUID(), kind: "out", expectedEntryId: createdEntry,
          locationId: state.activeEntry.location_id, shiftId: null, jobId: null }, null);
      }
    }
    await client.auth.signOut({ scope: "local" });
  });
  it("clocks in, survives reload, rejects duplicates, and clocks out with both GPS samples", async () => {
    const before = await api.load();
    const pending: PendingPunch = { requestId: randomUUID(), kind: "in", expectedEntryId: before.latestEntryId,
      locationId: before.locations[0].id, shiftId: null, jobId: null };
    const gps = { latitude: 40.7128, longitude: -74.006, accuracyM: 10, capturedAt: new Date().toISOString() };
    const first = await api.submit(pending, gps);
    createdEntry = first.timeEntryId;
    expect(createdEntry).toBeTruthy();
    const replay = await api.submit(pending, gps);
    expect(replay.timeEntryId).toBe(createdEntry);
    const restored = await clockApi(client, context).load();
    expect(restored.activeEntry?.id).toBe(createdEntry);
    const week = weekStartFor(new Date(), context.organization.timezone);
    const openHours = await loadCrewHours(client, context, week);
    const openEntry = openHours.entries.find((entry) => entry.id === createdEntry);
    expect(openEntry).toMatchObject({ status: "open", clock_out_at: null });
    expect(entryWorkedMinutes(openEntry!, openHours.breaks.filter((item) => item.time_entry_id === createdEntry), new Date())).toBeGreaterThanOrEqual(0);
    expect((await client.rpc("start_break", { target_organization_id: context.organization.id })).error).toBeNull();
    const breakHours = await loadCrewHours(client, context, week);
    expect(breakHours.breaks.some((item) => item.time_entry_id === createdEntry && item.end_at === null)).toBe(true);
    expect((await client.rpc("end_break", { target_organization_id: context.organization.id })).error).toBeNull();
    await expect(api.submit({ ...pending, requestId: randomUUID(), expectedEntryId: createdEntry }, gps)).rejects.toMatchObject({ kind: "stale" });
    const other = await client.from("time_entries").select("id").neq("employee_id", context.employee.id);
    expect(other.error).toBeNull();
    expect(other.data).toEqual([]);
    const foreign = await client.rpc("mobile_clock_out", {
      target_organization_id: "20000000-0000-0000-0000-000000000001", request_id: randomUUID(),
      expected_employee_id: context.employee.id, expected_entry_id: createdEntry!,
      submitted_latitude: null, submitted_longitude: null, submitted_accuracy_m: null, captured_at: null,
    });
    expect(foreign.error?.code).toBe("42501");
    const otherEntry = await api.submit({ ...pending, kind: "out", requestId: randomUUID(), expectedEntryId: randomUUID() }, gps).catch((error: unknown) => error);
    expect(otherEntry).toMatchObject({ kind: "access" });
    const out: PendingPunch = { ...pending, kind: "out", requestId: randomUUID(), expectedEntryId: createdEntry };
    expect((await api.submit(out, { ...gps, latitude: 40.713, capturedAt: new Date().toISOString() })).timeEntryId).toBe(createdEntry);
    expect((await api.submit(out, gps)).timeEntryId).toBe(createdEntry);
    expect((await api.load()).activeEntry).toBeNull();
    const closedHours = await loadCrewHours(client, context, week);
    const closedEntry = closedHours.entries.find((item) => item.id === createdEntry);
    expect(closedEntry).toMatchObject({ status: "completed" });
    expect(closedHours.breaks.some((item) => item.time_entry_id === createdEntry && item.end_at !== null)).toBe(true);
    expect(entryWorkedMinutes(closedEntry!, closedHours.breaks.filter((item) => item.time_entry_id === createdEntry), new Date())).toBeGreaterThanOrEqual(0);
    const entry = await client.from("time_entries").select("status, clock_in_at, clock_out_at, clock_in_latitude, clock_out_latitude")
      .eq("organization_id", context.organization.id).eq("employee_id", context.employee.id).eq("id", createdEntry!).single();
    expect(entry.error).toBeNull();
    expect(entry.data).toMatchObject({ status: "completed", clock_in_latitude: 40.7128, clock_out_latitude: 40.713 });
    expect(Date.parse(entry.data!.clock_out_at!)).toBeGreaterThan(Date.parse(entry.data!.clock_in_at));
  });
});
