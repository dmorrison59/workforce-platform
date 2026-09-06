import type { SupabaseClient } from "@supabase/supabase-js";

import type { CrewContext } from "@/types/crew-context";
import type { MobileDatabase } from "@/types/database";
import type { CrewTimeOffRequest, TimeOffDraft } from "@/types/time-off";

type Client = SupabaseClient<MobileDatabase>;
type Capability = "timeoff.view_self" | "timeoff.request";
export type TimeOffFailureKind = "session" | "access" | "validation" | "read" | "mutation";

const messages: Record<TimeOffFailureKind, string> = {
  session: "Your session has expired. Please sign in again.",
  access: "Your time-off access has changed. Check your account or ask your manager.",
  validation: "That time-off request is no longer valid. Review it and try again.",
  read: "We couldn’t load your time-off requests. Check your connection and try again.",
  mutation: "We couldn’t save that time-off change. Check your connection and try again.",
};

export class TimeOffError extends Error {
  constructor(public readonly kind: TimeOffFailureKind, message = messages[kind]) {
    super(message);
  }
}

function throwForError(error: { code?: string; status?: number; message?: string } | null, operation: "read" | "mutation") {
  if (!error) return;
  if (error.status === 401 || ["PGRST301", "PGRST302", "PGRST303"].includes(error.code ?? "")) {
    throw new TimeOffError("session");
  }
  if (error.code === "42501") throw new TimeOffError("access");
  const backendMessage = error.message?.toLowerCase() ?? "";
  if (backendMessage.includes("only pending time-off requests")) {
    throw new TimeOffError("validation", "Only pending time-off requests can be cancelled.");
  }
  if (backendMessage.includes("end date") || error.code === "22007" || error.code === "23514") {
    throw new TimeOffError("validation", "End date must be on or after the start date.");
  }
  throw new TimeOffError(operation);
}

async function verifyAccess(client: Client, context: CrewContext, capability: Capability) {
  const auth = await client.auth.getUser();
  if (auth.error) {
    if (auth.error.name === "AuthRetryableFetchError" || (auth.error.status && auth.error.status >= 500)) {
      throw new TimeOffError("read");
    }
    throw new TimeOffError("session");
  }
  if (!auth.data.user || auth.data.user.id !== context.user.id) throw new TimeOffError("session");
  const [employee, permission] = await Promise.all([
    client.rpc("current_employee_id", { target_organization_id: context.organization.id }),
    client.rpc("has_permission", {
      target_organization_id: context.organization.id,
      requested_capability: capability,
    }),
  ]);
  throwForError(employee.error, "read");
  throwForError(permission.error, "read");
  if (!employee.data || employee.data !== context.employee.id || !permission.data) {
    throw new TimeOffError("access");
  }
}

export async function loadCrewTimeOff(client: Client, context: CrewContext, signal?: AbortSignal) {
  await verifyAccess(client, context, "timeoff.view_self");
  let query = client.from("time_off_requests").select(`
    id, organization_id, employee_id, start_date, end_date,
    reason, status, requested_at, reviewed_at, manager_note
  `)
    .eq("organization_id", context.organization.id)
    .eq("employee_id", context.employee.id)
    .order("requested_at", { ascending: false })
    .order("id");
  if (signal) query = query.abortSignal(signal);
  const result = await query;
  throwForError(result.error, "read");
  if (!result.data) throw new TimeOffError("read");
  return result.data as CrewTimeOffRequest[];
}

export async function createCrewTimeOff(client: Client, context: CrewContext, draft: TimeOffDraft) {
  await verifyAccess(client, context, "timeoff.request");
  const result = await client.rpc("create_my_time_off_request", {
    target_organization_id: context.organization.id,
    request_start_date: draft.startDate,
    request_end_date: draft.endDate,
    request_reason: draft.reason.trim(),
  });
  throwForError(result.error, "mutation");
  if (!result.data) throw new TimeOffError("mutation");
  return result.data;
}

export async function cancelCrewTimeOff(client: Client, context: CrewContext, request: CrewTimeOffRequest) {
  if (request.organization_id !== context.organization.id || request.employee_id !== context.employee.id) {
    throw new TimeOffError("access");
  }
  if (request.status !== "pending") {
    throw new TimeOffError("validation", "Only pending time-off requests can be cancelled.");
  }
  await verifyAccess(client, context, "timeoff.request");
  const result = await client.rpc("cancel_my_time_off_request", { target_request_id: request.id });
  throwForError(result.error, "mutation");
}
