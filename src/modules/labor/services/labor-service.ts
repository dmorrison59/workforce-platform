import { hasCapability, requireCapability } from "@/core/permissions/capabilities";
import { isInstantInLocalWeek } from "@/modules/labor/services/calculations";
import { buildWeeklyLaborReport } from "@/modules/labor/services/report";
import { createClient } from "@/lib/supabase/server";

function assertDatabaseResult(error: { message: string } | null) {
  if (error) throw new Error(error.message);
}

export async function getWeeklyLaborReport(input: {
  organizationId: string;
  timeZone: string;
  weekStart: string;
  locationId?: string;
  departmentId?: string;
}) {
  await requireCapability(input.organizationId, "labor.view");
  const supabase = await createClient();
  const [canViewCostCapability, canViewWages, locationResult, departmentResult, employeeResult] = await Promise.all([
    hasCapability(input.organizationId, "labor.view_cost"),
    hasCapability(input.organizationId, "employee_wage.view"),
    supabase.from("locations").select("*").eq("organization_id", input.organizationId).eq("active", true).order("name"),
    supabase.from("departments").select("*").eq("organization_id", input.organizationId).eq("active", true).order("name"),
    supabase.from("employees").select("*").eq("organization_id", input.organizationId).order("last_name"),
  ]);
  assertDatabaseResult(locationResult.error);
  assertDatabaseResult(departmentResult.error);
  assertDatabaseResult(employeeResult.error);
  const locations = locationResult.data ?? [];
  const allDepartments = departmentResult.data ?? [];
  const selectedLocationId = locations.some((location) => location.id === input.locationId)
    ? input.locationId : undefined;
  const departments = selectedLocationId
    ? allDepartments.filter((department) => department.location_id === selectedLocationId || department.location_id === null)
    : allDepartments;
  const selectedDepartmentId = departments.some((department) => department.id === input.departmentId)
    ? input.departmentId : undefined;

  let scheduleQuery = supabase.from("schedules").select("*")
    .eq("organization_id", input.organizationId)
    .eq("week_start", input.weekStart)
    .eq("status", "published");
  if (selectedLocationId) scheduleQuery = scheduleQuery.eq("location_id", selectedLocationId);
  const scheduleResult = await scheduleQuery;
  assertDatabaseResult(scheduleResult.error);
  const scheduleIds = scheduleResult.data?.map((schedule) => schedule.id) ?? [];
  const shiftResult = scheduleIds.length
    ? await supabase.from("shifts").select("*").in("schedule_id", scheduleIds).order("start_at")
    : { data: [], error: null };
  assertDatabaseResult(shiftResult.error);
  const allShifts = shiftResult.data ?? [];
  const shifts = selectedDepartmentId
    ? allShifts.filter((shift) => shift.department_id === selectedDepartmentId)
    : allShifts;
  const selectedShiftIds = new Set(shifts.map((shift) => shift.id));

  const entryResult = await supabase.from("time_entries").select("*")
    .eq("organization_id", input.organizationId).order("clock_in_at");
  assertDatabaseResult(entryResult.error);
  const entries = (entryResult.data ?? []).filter((entry) => (
    isInstantInLocalWeek(entry.clock_in_at, input.weekStart, input.timeZone)
    && (!selectedLocationId || entry.location_id === selectedLocationId)
    && (!selectedDepartmentId || (entry.shift_id !== null && selectedShiftIds.has(entry.shift_id)))
  ));
  const breakResult = entries.length
    ? await supabase.from("time_breaks").select("*").in("time_entry_id", entries.map((entry) => entry.id))
    : { data: [], error: null };
  assertDatabaseResult(breakResult.error);

  const canViewCosts = canViewCostCapability && canViewWages;
  const compensationResult = canViewCosts
    ? await supabase.from("employee_compensation").select("*").eq("organization_id", input.organizationId)
    : { data: [], error: null };
  assertDatabaseResult(compensationResult.error);

  return {
    report: buildWeeklyLaborReport({
      employees: employeeResult.data ?? [],
      shifts,
      entries,
      breaks: breakResult.data ?? [],
      compensation: compensationResult.data ?? [],
      canViewCosts,
    }),
    canViewCosts,
    locations,
    departments,
    selectedLocationId,
    selectedDepartmentId,
  };
}
