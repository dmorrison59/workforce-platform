import { createClient } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";

import {
  cancelCrewTimeOff, createCrewTimeOff, loadCrewTimeOff, TimeOffError,
} from "../src/services/crew-time-off";
import type { CrewContext } from "../src/types/crew-context";
import type { MobileDatabase } from "../src/types/database";
import type { CrewTimeOffRequest } from "../src/types/time-off";

const context = {
  user: { id: "user" }, organization: { id: "org", timezone: "America/New_York" },
  employee: { id: "employee" }, permissions: { "timeoff.view_self": true, "timeoff.request": true },
} as CrewContext;

const pending: CrewTimeOffRequest = {
  id: "request", organization_id: "org", employee_id: "employee", start_date: "2026-09-14",
  end_date: "2026-09-16", reason: "Vacation", status: "pending", requested_at: "2026-09-01T12:00:00Z",
  reviewed_at: null, manager_note: "",
};

function fixture(options: {
  user?: string; employee?: string | null; permission?: boolean; failurePath?: string;
  failure?: { code: string; message: string }; requests?: unknown[];
} = {}) {
  const calls: { url: URL; body: Record<string, unknown> | null }[] = [];
  const client = createClient<MobileDatabase>("https://example.supabase.co", "public-test-key", {
    auth: { persistSession: false, autoRefreshToken: false },
    accessToken: async () => "test-access-token",
    global: { fetch: async (input, init) => {
      const url = new URL(String(input));
      const body = init?.body ? JSON.parse(String(init.body)) : null;
      calls.push({ url, body });
      const path = url.pathname.split("/").pop()!;
      const failure = path === options.failurePath ? options.failure : null;
      const data = path === "current_employee_id" ? (options.employee === undefined ? "employee" : options.employee)
        : path === "has_permission" ? (options.permission ?? true)
          : path === "time_off_requests" ? (options.requests ?? [])
            : path === "create_my_time_off_request" ? "new-request"
              : null;
      return new Response(JSON.stringify(failure ?? data), {
        status: failure ? 400 : 200, headers: { "Content-Type": "application/json" },
      });
    } },
  });
  Object.defineProperty(client, "auth", { value: { getUser: async () => ({
    data: { user: { id: options.user ?? "user" } }, error: null,
  }) } });
  return { client, calls };
}

describe("secure Gate 4 time-off service", () => {
  it("revalidates identity and view capability before an employee-scoped explicit-column read", async () => {
    const { client, calls } = fixture({ requests: [pending] });
    expect(await loadCrewTimeOff(client, context)).toEqual([pending]);
    expect(calls.map((call) => call.url.pathname.split("/").pop())).toEqual([
      "current_employee_id", "has_permission", "time_off_requests",
    ]);
    const query = calls[2].url.searchParams;
    expect(query.get("organization_id")).toBe("eq.org");
    expect(query.get("employee_id")).toBe("eq.employee");
    expect(query.get("select")).not.toContain("*");
    expect(query.get("select")).not.toContain("reviewed_by");
  });

  it.each([{ user: "other" }, { employee: null }, { employee: "other" }, { permission: false }])
  ("blocks changed self-service context before reading requests %j", async (options) => {
    const { client, calls } = fixture(options);
    await expect(loadCrewTimeOff(client, context)).rejects.toBeInstanceOf(TimeOffError);
    expect(calls.some((call) => call.url.pathname.endsWith("/time_off_requests"))).toBe(false);
  });

  it("creates through the existing self-service RPC without accepting an employee id or status", async () => {
    const { client, calls } = fixture();
    const id = await createCrewTimeOff(client, context, {
      startDate: "2026-09-14", endDate: "2026-09-16", reason: " Vacation ",
    });
    expect(id).toBe("new-request");
    expect(calls.at(-1)?.url.pathname.endsWith("/rpc/create_my_time_off_request")).toBe(true);
    expect(calls.at(-1)?.body).toEqual({
      target_organization_id: "org", request_start_date: "2026-09-14",
      request_end_date: "2026-09-16", request_reason: "Vacation",
    });
  });

  it("cancels only an owned pending request through the existing cancellation RPC", async () => {
    const { client, calls } = fixture();
    await cancelCrewTimeOff(client, context, pending);
    expect(calls.at(-1)?.url.pathname.endsWith("/rpc/cancel_my_time_off_request")).toBe(true);
    expect(calls.at(-1)?.body).toEqual({ target_request_id: "request" });
    await expect(cancelCrewTimeOff(client, context, { ...pending, status: "approved" }))
      .rejects.toMatchObject({ kind: "validation" });
    await expect(cancelCrewTimeOff(client, context, { ...pending, employee_id: "other" }))
      .rejects.toMatchObject({ kind: "access" });
  });

  it.each([
    [{ code: "42501", message: "private policy detail" }, "access"],
    [{ code: "23514", message: "private constraint detail" }, "validation"],
    [{ code: "XX000", message: "private database detail" }, "mutation"],
  ] as const)("sanitizes backend mutation failures %#", async (failure, kind) => {
    const { client } = fixture({ failurePath: "create_my_time_off_request", failure });
    const operation = createCrewTimeOff(client, context, { startDate: "2026-09-14", endDate: "2026-09-16", reason: "" });
    await expect(operation).rejects.toMatchObject({ kind });
    await expect(operation).rejects.not.toThrow("private");
  });

  it("does not expose an approval or denial mutation path", () => {
    expect(Object.keys({ loadCrewTimeOff, createCrewTimeOff, cancelCrewTimeOff })).not.toContain("reviewTimeOffRequest");
  });

  it("provides stable employee-safe loading, action, access, and session messages", () => {
    expect(new TimeOffError("read").message).toContain("connection");
    expect(new TimeOffError("mutation").message).toContain("save");
    expect(new TimeOffError("access").message).toContain("manager");
    expect(new TimeOffError("session").message).toContain("sign in again");
  });
});
