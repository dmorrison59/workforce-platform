import { randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { addDays } from "../src/lib/schedule-presentation";
import { organizationToday } from "../src/lib/time-off-presentation";
import { loadCrewContext } from "../src/services/crew-context";
import { cancelCrewTimeOff, createCrewTimeOff, loadCrewTimeOff } from "../src/services/crew-time-off";
import type { CrewContext } from "../src/types/crew-context";
import type { MobileDatabase } from "../src/types/database";
import type { CrewTimeOffRequest } from "../src/types/time-off";

const url = process.env.CREW_LOCAL_TEST_URL;
const key = process.env.CREW_LOCAL_TEST_ANON_KEY;
const email = process.env.CREW_LOCAL_TEST_EMAIL;
const password = process.env.CREW_LOCAL_TEST_PASSWORD;
const writesEnabled = process.env.CREW_LOCAL_TIME_OFF_WRITES === "1";
const configured = Boolean(url && key && email && password && writesEnabled);

describe.skipIf(!configured)("authenticated local employee time off", () => {
  const client = createClient<MobileDatabase>(url || "http://127.0.0.1:54321", key || "not-configured", {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  let context: CrewContext;
  let created: CrewTimeOffRequest | null = null;

  beforeAll(async () => {
    if (!url || !["127.0.0.1", "localhost"].includes(new URL(url).hostname)) {
      throw new Error("Integration tests refuse non-local Supabase URLs.");
    }
    const auth = await client.auth.signInWithPassword({ email: email!, password: password! });
    expect(auth.error).toBeNull();
    context = await loadCrewContext(client, auth.data.user!);
    expect(context.role.name).toBe("Employee");
    expect(context.permissions["timeoff.view_self"]).toBe(true);
    expect(context.permissions["timeoff.request"]).toBe(true);
  });

  afterAll(async () => {
    if (created?.status === "pending") {
      await cancelCrewTimeOff(client, context, created).catch(() => undefined);
    }
    await client.auth.signOut({ scope: "local" });
  });

  it("loads only the authenticated employee's requests", async () => {
    const requests = await loadCrewTimeOff(client, context);
    expect(requests.every((request) => request.organization_id === context.organization.id
      && request.employee_id === context.employee.id)).toBe(true);
    const others = await client.from("time_off_requests").select("id").neq("employee_id", context.employee.id);
    expect(others.error).toBeNull();
    expect(others.data).toEqual([]);
    const foreign = await client.from("time_off_requests").select("id")
      .eq("organization_id", "20000000-0000-0000-0000-000000000001");
    expect(foreign.error).toBeNull();
    expect(foreign.data).toEqual([]);
  });

  it("creates, reloads, and cancels one disposable pending request", async () => {
    const today = organizationToday(new Date(), context.organization.timezone);
    const startDate = addDays(today, 400);
    const endDate = addDays(startDate, 1);
    const reason = `Mobile Gate 4 local test ${randomUUID()}`;
    const id = await createCrewTimeOff(client, context, { startDate, endDate, reason });
    created = (await loadCrewTimeOff(client, context)).find((request) => request.id === id) ?? null;
    expect(created).toMatchObject({ id, organization_id: context.organization.id,
      employee_id: context.employee.id, start_date: startDate, end_date: endDate, reason, status: "pending" });
    await cancelCrewTimeOff(client, context, created!);
    created = (await loadCrewTimeOff(client, context)).find((request) => request.id === id) ?? null;
    expect(created?.status).toBe("cancelled");
  });

  it("cannot directly submit for another employee or alter manager review data", async () => {
    const date = addDays(organizationToday(new Date(), context.organization.timezone), 500);
    const insert = await client.from("time_off_requests").insert({ organization_id: context.organization.id,
      employee_id: "00000000-0000-0000-0000-000000000001", start_date: date, end_date: date,
      status: "pending", reviewed_by: null, reviewed_at: null, manager_note: "" });
    expect(insert.error).not.toBeNull();
    const update = await client.from("time_off_requests").update({ manager_note: "Compromised" }).eq("id", created!.id);
    expect(update.error).not.toBeNull();
  });

  it("cannot cancel an unknown/other request or approve/deny requests", async () => {
    const cancel = await client.rpc("cancel_my_time_off_request", { target_request_id: randomUUID() });
    expect(cancel.error?.code).toBe("42501");
    for (const decision of ["approved", "denied"] as const) {
      const review = await client.rpc("review_time_off_request", {
        target_request_id: created!.id, review_status: decision, review_note: "Not allowed",
      });
      expect(review.error?.code).toBe("42501");
    }
  });
});
