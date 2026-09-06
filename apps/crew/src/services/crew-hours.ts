import type { SupabaseClient } from "@supabase/supabase-js";

import { weekWindow } from "@/lib/schedule-presentation";
import type { CrewContext } from "@/types/crew-context";
import type { MobileDatabase } from "@/types/database";
import type { CrewHoursBreak, CrewHoursData, CrewHoursEntry } from "@/types/hours";

type Client = SupabaseClient<MobileDatabase>;
export type HoursFailureKind = "session" | "access" | "read";

export class HoursReadError extends Error {
  constructor(public readonly kind: HoursFailureKind) {
    super(kind === "session"
      ? "Your session has expired. Please sign in again."
      : kind === "access"
        ? "Your hours access has changed. Check your account or ask your manager."
        : "We couldn’t load your hours. Check your connection and try again.");
  }
}

function checkError(error: { code?: string; status?: number } | null) {
  if (!error) return;
  if (error.status === 401 || ["PGRST301", "PGRST302", "PGRST303"].includes(error.code ?? "")) {
    throw new HoursReadError("session");
  }
  throw new HoursReadError(error.code === "42501" ? "access" : "read");
}

export function crewHoursEntriesQuery(
  client: Client, organizationId: string, employeeId: string, window: { start: string; end: string },
) {
  return client.from("time_entries").select(`
    id, organization_id, employee_id, shift_id, location_id,
    clock_in_at, clock_out_at, status, review_status, corrected_at,
    clock_in_captured_at, clock_out_captured_at
  `)
    .eq("organization_id", organizationId)
    .eq("employee_id", employeeId)
    .gte("clock_in_at", window.start)
    .lt("clock_in_at", window.end)
    .order("clock_in_at")
    .order("id");
}

async function verifyAccess(client: Client, context: CrewContext) {
  const auth = await client.auth.getUser();
  if (auth.error) {
    if (auth.error.name === "AuthRetryableFetchError" || (auth.error.status && auth.error.status >= 500)) {
      throw new HoursReadError("read");
    }
    throw new HoursReadError("session");
  }
  if (!auth.data.user || auth.data.user.id !== context.user.id) throw new HoursReadError("session");

  const [employee, permission] = await Promise.all([
    client.rpc("current_employee_id", { target_organization_id: context.organization.id }),
    client.rpc("has_permission", {
      target_organization_id: context.organization.id,
      requested_capability: "timeclock.view_self",
    }),
  ]);
  checkError(employee.error);
  checkError(permission.error);
  if (!employee.data || employee.data !== context.employee.id || !permission.data) {
    throw new HoursReadError("access");
  }
  return employee.data;
}

async function loadEntries(
  client: Client, context: CrewContext, employeeId: string, weekStart: string, signal?: AbortSignal,
) {
  const entries: CrewHoursEntry[] = [];
  const window = weekWindow(weekStart, context.organization.timezone);
  const pageSize = 200;
  for (let offset = 0; ; offset += pageSize) {
    const query = crewHoursEntriesQuery(client, context.organization.id, employeeId, window)
      .range(offset, offset + pageSize - 1);
    const result = await (signal ? query.abortSignal(signal) : query);
    checkError(result.error);
    if (!result.data) throw new HoursReadError("read");
    entries.push(...result.data);
    if (result.data.length < pageSize) return entries;
  }
}

async function loadBreaks(client: Client, context: CrewContext, entryIds: string[], signal?: AbortSignal) {
  const breaks: CrewHoursBreak[] = [];
  for (let offset = 0; offset < entryIds.length; offset += 100) {
    let query = client.from("time_breaks")
      .select("id, organization_id, time_entry_id, start_at, end_at")
      .eq("organization_id", context.organization.id)
      .in("time_entry_id", entryIds.slice(offset, offset + 100))
      .order("start_at")
      .order("id");
    if (signal) query = query.abortSignal(signal);
    const result = await query;
    checkError(result.error);
    if (!result.data) throw new HoursReadError("read");
    breaks.push(...result.data);
  }
  return breaks;
}

async function loadOptionalDetails(
  client: Client, context: CrewContext, entries: CrewHoursEntry[], signal?: AbortSignal,
) {
  const locationIds = [...new Set(entries.map((entry) => entry.location_id))];
  const shiftIds = [...new Set(entries.flatMap((entry) => entry.shift_id ? [entry.shift_id] : []))];
  let locationsQuery = client.from("locations").select("id, name")
    .eq("organization_id", context.organization.id).in("id", locationIds);
  if (signal) locationsQuery = locationsQuery.abortSignal(signal);
  const locations = locationIds.length ? await locationsQuery : { data: [], error: null };
  checkError(locations.error);

  let shiftsQuery = client.from("shifts").select("id, start_at, end_at")
    .eq("organization_id", context.organization.id)
    .eq("employee_id", context.employee.id)
    .in("id", shiftIds);
  if (signal) shiftsQuery = shiftsQuery.abortSignal(signal);
  const shifts = shiftIds.length && context.permissions["schedule.view"]
    ? await shiftsQuery : { data: [], error: null };
  checkError(shifts.error);

  return {
    locationNames: Object.fromEntries((locations.data ?? []).map((row) => [row.id, row.name])),
    shifts: Object.fromEntries((shifts.data ?? []).map((row) => [row.id, { start_at: row.start_at, end_at: row.end_at }])),
  };
}

export async function loadCrewHours(
  client: Client, context: CrewContext, weekStart: string, signal?: AbortSignal,
): Promise<CrewHoursData> {
  const employeeId = await verifyAccess(client, context);
  const entries = await loadEntries(client, context, employeeId, weekStart, signal);
  const breaks = entries.length ? await loadBreaks(client, context, entries.map((entry) => entry.id), signal) : [];
  const details = entries.length ? await loadOptionalDetails(client, context, entries, signal)
    : { locationNames: {}, shifts: {} };
  return { weekStart, entries, breaks, ...details };
}
