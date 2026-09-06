import { createClient } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";
import { crewScheduleQuery, loadCrewSchedule, ScheduleReadError } from "../src/services/crew-schedule";
import type { CrewContext } from "../src/types/crew-context";
import type { MobileDatabase } from "../src/types/database";

const context = { user: { id: "user" }, organization: { id: "org" }, employee: { id: "employee" } } as CrewContext;
const window = { start: "2026-09-03T04:00:00Z", end: "2026-09-04T04:00:00Z" };

function fixture(options: {
  user?: string; employee?: string | null; permission?: boolean; failure?: string; status?: number;
  authFailure?: { name: string; status: number }; rowCount?: number;
} = {}) {
  const requests: URL[] = [];
  const client = createClient<MobileDatabase>("https://example.supabase.co", "public-test-key", {
    auth: { persistSession: false, autoRefreshToken: false },
    accessToken: async () => "test-access-token",
    global: { fetch: async (input) => {
      const url = new URL(String(input));
      requests.push(url);
      const offset = Number(url.searchParams.get("offset") ?? 0);
      const limit = Number(url.searchParams.get("limit") ?? 200);
      const rows = Array.from({ length: options.rowCount ?? 0 }, (_, index) => ({ id: String(index) })).slice(offset, offset + limit);
      const data = url.pathname.endsWith("current_employee_id") ? (options.employee === undefined ? "employee" : options.employee)
        : url.pathname.endsWith("has_permission") ? (options.permission ?? true) : rows;
      return new Response(JSON.stringify(options.failure ? { code: options.failure, message: "sensitive database details" } : data),
        { status: options.status ?? (options.failure ? 400 : 200), headers: { "Content-Type": "application/json" } });
    } },
  });
  // Use a client without accessToken for auth; only getUser is substituted here.
  Object.defineProperty(client, "auth", { value: { getUser: async () => ({
    data: { user: { id: options.user ?? "user" } }, error: options.authFailure ?? null,
  }) } });
  return { client, requests };
}

describe("secure scheduling query contract", () => {
  it("applies own employee, tenant, both publication filters and overlap on the server", async () => {
    const { client, requests } = fixture();
    await crewScheduleQuery(client, "org", "employee", window);
    const params = requests[0].searchParams;
    expect(params.get("organization_id")).toBe("eq.org");
    expect(params.get("employee_id")).toBe("eq.employee");
    expect(params.get("status")).toBe("eq.published");
    expect(params.get("schedule.organization_id")).toBe("eq.org");
    expect(params.get("schedule.status")).toBe("eq.published");
    expect(params.get("select")).toContain("schedule:schedules!inner(id)");
    expect(params.get("select")).not.toContain("*");
    expect(params.get("start_at")).toBe(`lt.${window.end}`);
    expect(params.get("end_at")).toBe(`gt.${window.start}`);
    expect(params.get("order")).toBe("start_at.asc,id.asc");
  });
  it("revalidates the current employee and capability before reading shifts", async () => {
    const { client, requests } = fixture();
    expect(await loadCrewSchedule(client, context, window)).toEqual([]);
    expect(requests.map((url) => url.pathname)).toEqual([
      "/rest/v1/rpc/current_employee_id", "/rest/v1/rpc/has_permission", "/rest/v1/shifts",
    ]);
  });
  it.each([{ employee: null }, { employee: "other" }, { permission: false }])("rejects changed access %j without any shift read", async (options) => {
    const { client, requests } = fixture(options);
    await expect(loadCrewSchedule(client, context, window)).rejects.toMatchObject({ kind: "access" });
    expect(requests.some((url) => url.pathname.endsWith("/shifts"))).toBe(false);
  });
  it("rejects a session for another account", async () => {
    const { client, requests } = fixture({ user: "other" });
    await expect(loadCrewSchedule(client, context, window)).rejects.toMatchObject({ kind: "session" });
    expect(requests).toHaveLength(0);
  });
  it.each([["PGRST301", "session"], ["42501", "access"], ["XX000", "read"]])("sanitizes %s errors", async (failure, kind) => {
    const { client } = fixture({ failure });
    await expect(loadCrewSchedule(client, context, window)).rejects.toMatchObject({ kind });
    await expect(loadCrewSchedule(client, context, window)).rejects.not.toThrow("sensitive database details");
  });
  it("has employee-safe messages for failed reads and expired sessions", () => {
    expect(new ScheduleReadError("read").message).toContain("connection");
    expect(new ScheduleReadError("session").message).toContain("sign in again");
  });
  it.each([
    [{ name: "AuthApiError", status: 401 }, "session"],
    [{ name: "AuthRetryableFetchError", status: 0 }, "read"],
    [{ name: "AuthApiError", status: 503 }, "read"],
  ] as const)("distinguishes auth failure %j from connectivity problems", async (authFailure, kind) => {
    const { client, requests } = fixture({ authFailure });
    await expect(loadCrewSchedule(client, context, window)).rejects.toMatchObject({ kind });
    expect(requests).toHaveLength(0);
  });
  it("paginates instead of silently truncating a large week", async () => {
    const { client, requests } = fixture({ rowCount: 201 });
    expect(await loadCrewSchedule(client, context, window)).toHaveLength(201);
    const pages = requests.filter((url) => url.pathname.endsWith("/shifts"));
    expect(pages.map((url) => url.searchParams.get("offset"))).toEqual(["0", "200"]);
    expect(pages.every((url) => url.searchParams.get("employee_id") === "eq.employee")).toBe(true);
  });
});
