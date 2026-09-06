import type { QueryData, SupabaseClient } from "@supabase/supabase-js";

import type { CrewContext } from "../types/crew-context";
import type { MobileDatabase } from "../types/database";

type Client = SupabaseClient<MobileDatabase>;
export interface ScheduleWindow { start: string; end: string }
export type ScheduleFailureKind = "session" | "access" | "read";

export class ScheduleReadError extends Error {
  constructor(public readonly kind: ScheduleFailureKind) {
    super(kind === "session"
      ? "Your session has expired. Please sign in again."
      : kind === "access"
        ? "Your schedule access has changed. Check your account or ask your manager."
        : "We couldn’t load your schedule. Check your connection and try again.");
  }
}

function checkError(error: { code?: string; status?: number } | null) {
  if (!error) return;
  if (error.status === 401 || ["PGRST301", "PGRST302", "PGRST303"].includes(error.code ?? "")) {
    throw new ScheduleReadError("session");
  }
  throw new ScheduleReadError(error.code === "42501" ? "access" : "read");
}

// All visibility predicates execute in PostgREST/Postgres, in addition to RLS.
// The inner parent join prevents even a privileged crew account from receiving
// a published child under an unpublished schedule. Optional details use left joins.
export function crewScheduleQuery(client: Client, organizationId: string, employeeId: string, window: ScheduleWindow) {
  return client.from("shifts").select(`
    id, location_id, start_at, end_at, notes, break_minutes,
    schedule:schedules!inner(id),
    location:locations(name, address, city, state, postal_code),
    department:departments(name),
    role:roles(name)
  `)
    .eq("organization_id", organizationId)
    .eq("employee_id", employeeId)
    .eq("status", "published")
    .eq("schedule.organization_id", organizationId)
    .eq("schedule.status", "published")
    .lt("start_at", window.end)
    .gt("end_at", window.start)
    .order("start_at")
    .order("id");
}

type ScheduleRow = QueryData<ReturnType<typeof crewScheduleQuery>>[number];
// A foreign-key target may be hidden by its own RLS policy.
export type CrewShift = Omit<ScheduleRow, "location" | "department" | "role"> & {
  location: ScheduleRow["location"] | null;
  department: ScheduleRow["department"] | null;
  role: ScheduleRow["role"] | null;
};

export async function loadCrewSchedule(
  client: Client, context: CrewContext, window: ScheduleWindow, signal?: AbortSignal,
): Promise<CrewShift[]> {
  const { data: auth, error: authError } = await client.auth.getUser();
  if (authError) {
    if (authError.status && authError.status >= 500) throw new ScheduleReadError("read");
    if (authError.name === "AuthRetryableFetchError") throw new ScheduleReadError("read");
    throw new ScheduleReadError("session");
  }
  if (!auth.user || auth.user.id !== context.user.id) throw new ScheduleReadError("session");

  // Re-resolve identity/capability on every read, not only at the initial login.
  const [employee, permission] = await Promise.all([
    client.rpc("current_employee_id", { target_organization_id: context.organization.id }),
    client.rpc("has_permission", { target_organization_id: context.organization.id, requested_capability: "schedule.view" }),
  ]);
  checkError(employee.error);
  checkError(permission.error);
  if (!employee.data || employee.data !== context.employee.id || !permission.data) {
    throw new ScheduleReadError("access");
  }

  const shifts: CrewShift[] = [];
  const pageSize = 200;
  for (let offset = 0; ; offset += pageSize) {
    const query = crewScheduleQuery(client, context.organization.id, employee.data, window)
      .range(offset, offset + pageSize - 1);
    const result = await (signal ? query.abortSignal(signal) : query);
    checkError(result.error);
    if (!result.data) throw new ScheduleReadError("read");
    shifts.push(...result.data);
    if (result.data.length < pageSize) return shifts;
  }
}
