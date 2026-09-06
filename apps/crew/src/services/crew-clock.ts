import type { SupabaseClient } from "@supabase/supabase-js";
import type { MobileDatabase } from "../types/database";
import type { ClockContext, ClockResult, PendingPunch, PunchLocation } from "../types/clock";
import type { CrewContext } from "../types/crew-context";

export class ClockError extends Error {
  constructor(public readonly kind: "read" | "session" | "setup" | "access" | "stale" | "break" | "field" | "invalid" | "uncertain") {
    super({
      read: "We couldn’t check your clock. Check your connection and refresh.",
      session: "Your session could not be verified. Please sign in again.",
      setup: "Your organization’s mobile clock is not ready yet. Ask your manager for help.",
      access: "Your clock access is unavailable. Ask your manager for help.",
      stale: "Your clock status changed. Refresh before trying again.",
      break: "An active break must be ended in YardClock on the web before you can clock out.",
      field: "Your workplace requires an assigned job and a successful location check. Refresh and try again, or contact your manager.",
      invalid: "The clock details could not be accepted. Refresh and try again.",
      uncertain: "We couldn’t confirm that punch. Refresh to check its result, or retry the same punch. Do not start another one.",
    }[kind]);
  }
}
export function clockFailure(error: { code?: string; message?: string }, mutation = false) {
  if (error.code === "PGRST202") return new ClockError("setup");
  if (["PGRST301", "PGRST302", "PGRST303"].includes(error.code ?? "")) return new ClockError("session");
  if (error.code === "42501") return new ClockError("access");
  if (error.code === "40001" || error.message?.includes("already has an open") || error.message?.includes("overlapping time entry")) return new ClockError("stale");
  if (error.message?.includes("active break")) return new ClockError("break");
  if (error.message?.includes("Field location verification") || error.message?.includes("verification coordinates")) return new ClockError("field");
  if (["22023", "23514", "23503", "P0001"].includes(error.code ?? "")) return new ClockError("invalid");
  return new ClockError(mutation ? "uncertain" : "read");
}

export function clockApi(client: SupabaseClient<MobileDatabase>, context: CrewContext) {
  async function verifyUser() {
    const result = await client.auth.getUser();
    if (result.error?.name === "AuthRetryableFetchError" || (result.error?.status && result.error.status >= 500)) throw new ClockError("read");
    if (result.error || result.data.user?.id !== context.user.id) throw new ClockError("session");
  }
  return {
    async load(): Promise<ClockContext> {
      await verifyUser();
      const result = await client.rpc("mobile_clock_context", { target_organization_id: context.organization.id });
      if (result.error) throw clockFailure(result.error);
      const value = result.data as unknown as ClockContext;
      if (!value || value.employeeId !== context.employee.id || !Array.isArray(value.locations) || !Array.isArray(value.jobs)) throw new ClockError("access");
      return value;
    },
    async submit(pending: PendingPunch, gps: PunchLocation | null): Promise<ClockResult> {
      await verifyUser();
      const args = {
        expected_employee_id: context.employee.id,
        target_organization_id: context.organization.id,
        request_id: pending.requestId,
        submitted_latitude: gps?.latitude ?? null, submitted_longitude: gps?.longitude ?? null,
        submitted_accuracy_m: gps?.accuracyM ?? null, captured_at: gps?.capturedAt ?? null,
      };
      if (pending.kind === "in") {
        const result = await client.rpc("mobile_clock_in", {
          ...args, expected_latest_entry_id: pending.expectedEntryId,
          target_location_id: pending.locationId!, target_shift_id: pending.shiftId, target_job_id: pending.jobId,
        });
        if (result.error) throw clockFailure(result.error, true);
        return result.data as unknown as ClockResult;
      }
      const result = await client.rpc("mobile_clock_out", { ...args, expected_entry_id: pending.expectedEntryId! });
      if (result.error) throw clockFailure(result.error, true);
      return { timeEntryId: result.data, status: "clocked_out" };
    },
    async resolve(pending: PendingPunch): Promise<ClockResult | null> {
      await verifyUser();
      const result = await client.from("time_entries").select("id")
        .eq("organization_id", context.organization.id).eq("employee_id", context.employee.id)
        .eq(pending.kind === "in" ? "mobile_clock_in_request_id" : "mobile_clock_out_request_id", pending.requestId).maybeSingle();
      if (result.error) throw clockFailure(result.error);
      if (result.data) return { timeEntryId: result.data.id, status: "replayed" };
      if (pending.kind === "in" && pending.jobId) {
        const verification = await client.from("field_clock_verifications").select("id, time_entry_id, status")
          .eq("organization_id", context.organization.id).eq("employee_id", context.employee.id)
          .eq("mobile_request_id", pending.requestId).maybeSingle();
        if (verification.error) throw clockFailure(verification.error);
        if (verification.data) return { timeEntryId: verification.data.time_entry_id, status: verification.data.status, verificationId: verification.data.id };
      }
      return null;
    },
  };
}
