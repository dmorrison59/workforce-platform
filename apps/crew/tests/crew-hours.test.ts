import { createClient } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";

import { crewHoursEntriesQuery, HoursReadError, loadCrewHours } from "../src/services/crew-hours";
import type { CrewContext } from "../src/types/crew-context";
import type { MobileDatabase } from "../src/types/database";

const context = {
  user: { id: "user" }, organization: { id: "org", timezone: "America/New_York" },
  employee: { id: "employee" }, permissions: { "schedule.view": true },
} as CrewContext;
const window = { start: "2026-08-31T04:00:00Z", end: "2026-09-07T04:00:00Z" };

function fixture(options: {
  user?: string; employee?: string | null; permission?: boolean; failurePath?: string; failure?: string;
  authFailure?: { name: string; status: number }; entries?: unknown[]; breaks?: unknown[];
} = {}) {
  const requests: URL[] = [];
  const client = createClient<MobileDatabase>("https://example.supabase.co", "public-test-key", {
    auth: { persistSession: false, autoRefreshToken: false },
    accessToken: async () => "test-access-token",
    global: { fetch: async (input) => {
      const url = new URL(String(input));
      requests.push(url);
      const path = url.pathname.split("/").pop()!;
      const failure = path === options.failurePath ? options.failure : null;
      const data = path === "current_employee_id" ? (options.employee === undefined ? "employee" : options.employee)
        : path === "has_permission" ? (options.permission ?? true)
          : path === "time_entries" ? (options.entries ?? [])
            : path === "time_breaks" ? (options.breaks ?? [])
              : path === "locations" ? [{ id: "location", name: "Main Yard" }]
                : path === "shifts" ? [{ id: "shift", start_at: "2026-09-03T13:00:00Z", end_at: "2026-09-03T21:00:00Z" }]
                  : [];
      return new Response(JSON.stringify(failure ? { code: failure, message: "sensitive database details" } : data), {
        status: failure ? 400 : 200, headers: { "Content-Type": "application/json" },
      });
    } },
  });
  Object.defineProperty(client, "auth", { value: { getUser: async () => ({
    data: { user: { id: options.user ?? "user" } }, error: options.authFailure ?? null,
  }) } });
  return { client, requests };
}

describe("secure hours query contract", () => {
  it("applies tenant, employee, organization-local week, explicit columns, and ordering on the server", async () => {
    const { client, requests } = fixture();
    await crewHoursEntriesQuery(client, "org", "employee", window);
    const params = requests[0].searchParams;
    expect(params.get("organization_id")).toBe("eq.org");
    expect(params.get("employee_id")).toBe("eq.employee");
    expect(params.getAll("clock_in_at")).toEqual([`gte.${window.start}`, `lt.${window.end}`]);
    expect(params.get("select")).not.toContain("*");
    expect(params.get("select")).not.toContain("latitude");
    expect(params.get("order")).toBe("clock_in_at.asc,id.asc");
  });

  it("revalidates identity/capability and loads own entries, breaks, and safe optional details", async () => {
    const row = { id: "entry", organization_id: "org", employee_id: "employee", shift_id: "shift", location_id: "location",
      clock_in_at: "2026-09-03T13:00:00Z", clock_out_at: "2026-09-03T21:00:00Z", status: "completed",
      review_status: "approved", corrected_at: null, clock_in_captured_at: "2026-09-03T13:00:00Z", clock_out_captured_at: null };
    const itemBreak = { id: "break", organization_id: "org", time_entry_id: "entry", start_at: "2026-09-03T17:00:00Z", end_at: "2026-09-03T17:30:00Z" };
    const { client, requests } = fixture({ entries: [row], breaks: [itemBreak] });
    const result = await loadCrewHours(client, context, "2026-08-31");
    expect(result.entries).toEqual([row]);
    expect(result.breaks).toEqual([itemBreak]);
    expect(result.locationNames).toEqual({ location: "Main Yard" });
    expect(result.shifts.shift).toMatchObject({ start_at: row.clock_in_at });
    expect(requests.map((url) => url.pathname.split("/").pop())).toEqual([
      "current_employee_id", "has_permission", "time_entries", "time_breaks", "locations", "shifts",
    ]);
  });

  it.each([{ employee: null }, { employee: "other" }, { permission: false }])("blocks changed employee access %j before reading records", async (options) => {
    const { client, requests } = fixture(options);
    await expect(loadCrewHours(client, context, "2026-08-31")).rejects.toMatchObject({ kind: "access" });
    expect(requests.some((url) => url.pathname.endsWith("/time_entries"))).toBe(false);
  });

  it("rejects a session for another account before reading records", async () => {
    const { client, requests } = fixture({ user: "other" });
    await expect(loadCrewHours(client, context, "2026-08-31")).rejects.toMatchObject({ kind: "session" });
    expect(requests).toHaveLength(0);
  });

  it.each([["PGRST301", "session"], ["42501", "access"], ["XX000", "read"]])("sanitizes %s errors", async (failure, kind) => {
    const { client } = fixture({ entries: [{}], failurePath: "time_breaks", failure });
    await expect(loadCrewHours(client, context, "2026-08-31")).rejects.toMatchObject({ kind });
    await expect(loadCrewHours(client, context, "2026-08-31")).rejects.not.toThrow("sensitive database details");
  });

  it("has employee-safe read, access, and session messages", () => {
    expect(new HoursReadError("read").message).toContain("connection");
    expect(new HoursReadError("access").message).toContain("manager");
    expect(new HoursReadError("session").message).toContain("sign in again");
  });
});
