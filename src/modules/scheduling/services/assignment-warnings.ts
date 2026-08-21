import { requireCapability } from "@/core/permissions/capabilities";
import { createClient } from "@/lib/supabase/server";
import { getShiftAssignmentWarnings } from "@/modules/scheduling/services/conflicts";

export async function getShiftAssignmentWarningsForEmployee(input: {
  organizationId: string;
  employeeId: string;
  startLocal: string;
  endLocal: string;
}) {
  await requireCapability(input.organizationId, "schedule.manage");
  const supabase = await createClient();
  const shiftDate = input.startLocal.slice(0, 10);
  const shiftEndDate = input.endLocal.slice(0, 10);
  const day = new Date(`${shiftDate}T12:00:00Z`).getUTCDay() || 7;
  const [availabilityResult, timeOffResult] = await Promise.all([
    supabase.from("employee_availability").select("*")
      .eq("organization_id", input.organizationId)
      .eq("employee_id", input.employeeId)
      .eq("day_of_week", day)
      .lte("effective_from", shiftDate)
      .or(`effective_until.is.null,effective_until.gte.${shiftDate}`)
      .order("effective_from", { ascending: false }),
    supabase.from("time_off_requests").select("*")
      .eq("organization_id", input.organizationId)
      .eq("employee_id", input.employeeId)
      .eq("status", "approved")
      .lte("start_date", shiftEndDate)
      .gte("end_date", shiftDate),
  ]);
  if (availabilityResult.error) throw new Error(availabilityResult.error.message);
  if (timeOffResult.error) throw new Error(timeOffResult.error.message);
  return getShiftAssignmentWarnings({
    startLocal: input.startLocal,
    endLocal: input.endLocal,
    availability: availabilityResult.data ?? [],
    timeOffRequests: timeOffResult.data ?? [],
  });
}
