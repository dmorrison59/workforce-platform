import {
  calculateActualMinutes,
  calculateLaborCostCents,
  calculateLaborVariance,
  calculateScheduledMinutes,
  calculateWeeklyOvertimeStatus,
} from "@/modules/labor/services/calculations";
import type { Employee, EmployeeCompensation, Shift, TimeBreak, TimeEntry } from "@/types/database";

type LaborShift = Pick<Shift, "id" | "employee_id" | "start_at" | "end_at" | "break_minutes" | "status">;
type LaborEntry = Pick<TimeEntry, "id" | "employee_id" | "shift_id" | "clock_in_at" | "clock_out_at" | "status" | "review_status">;
type LaborBreak = Pick<TimeBreak, "time_entry_id" | "start_at" | "end_at">;
type LaborEmployee = Pick<Employee, "id" | "first_name" | "last_name">;
type LaborCompensation = Pick<EmployeeCompensation, "employee_id" | "hourly_rate">;

export type EmployeeLaborRow = {
  employeeId: string;
  employeeName: string;
  scheduledMinutes: number;
  actualMinutes: number;
  hourVarianceMinutes: number;
  hourVariancePercent: number | null;
  hourlyRate: number | null;
  scheduledCostCents: number | null;
  actualCostCents: number | null;
  costVarianceCents: number | null;
  costVariancePercent: number | null;
  scheduledOvertime: ReturnType<typeof calculateWeeklyOvertimeStatus>;
  actualOvertime: ReturnType<typeof calculateWeeklyOvertimeStatus>;
  missingCompensation: boolean;
  openEntryCount: number;
  provisionalEntryCount: number;
  scheduledWithoutActualCount: number;
  unlinkedActualCount: number;
};

export type WeeklyLaborReport = {
  rows: EmployeeLaborRow[];
  scheduledMinutes: number;
  actualMinutes: number;
  hourVarianceMinutes: number;
  hourVariancePercent: number | null;
  scheduledCostCents: number | null;
  actualCostCents: number | null;
  costVarianceCents: number | null;
  costVariancePercent: number | null;
  costDataComplete: boolean;
  missingCompensationCount: number;
  unassignedShiftCount: number;
  openEntryCount: number;
  provisionalEntryCount: number;
  scheduledWithoutActualCount: number;
  unlinkedActualCount: number;
};

export function buildWeeklyLaborReport(input: {
  employees: LaborEmployee[];
  shifts: LaborShift[];
  entries: LaborEntry[];
  breaks: LaborBreak[];
  compensation: LaborCompensation[];
  canViewCosts: boolean;
}): WeeklyLaborReport {
  const completedEntries = input.entries.filter((entry) => (
    entry.status === "completed" || entry.status === "corrected"
  ));
  const activeShifts = input.shifts.filter((shift) => (
    shift.status === "published" || shift.status === "open" || shift.status === "completed"
  ));
  const compensationByEmployee = new Map(input.compensation.map((item) => [
    item.employee_id,
    item.hourly_rate === null ? null : Number(item.hourly_rate),
  ]));
  const employeeById = new Map(input.employees.map((employee) => [employee.id, employee]));
  const activityEmployeeIds = new Set<string>();
  activeShifts.forEach((shift) => { if (shift.employee_id) activityEmployeeIds.add(shift.employee_id); });
  input.entries.forEach((entry) => activityEmployeeIds.add(entry.employee_id));

  const rows = [...activityEmployeeIds].map((employeeId): EmployeeLaborRow | null => {
    const employee = employeeById.get(employeeId);
    if (!employee) return null;
    const shifts = activeShifts.filter((shift) => shift.employee_id === employeeId);
    const entries = input.entries.filter((entry) => entry.employee_id === employeeId);
    const completed = completedEntries.filter((entry) => entry.employee_id === employeeId);
    const scheduledMinutes = calculateScheduledMinutes(shifts);
    const actualMinutes = calculateActualMinutes(completed, input.breaks);
    const hasRate = compensationByEmployee.has(employeeId) && compensationByEmployee.get(employeeId) !== null;
    const hourlyRate = input.canViewCosts && hasRate ? compensationByEmployee.get(employeeId)! : null;
    const scheduledCostCents = input.canViewCosts
      ? calculateLaborCostCents(scheduledMinutes, hourlyRate) : null;
    const actualCostCents = input.canViewCosts
      ? calculateLaborCostCents(actualMinutes, hourlyRate) : null;
    const variance = calculateLaborVariance({
      scheduledMinutes,
      actualMinutes,
      scheduledCostCents,
      actualCostCents,
    });
    const linkedActualShiftIds = new Set(completed.flatMap((entry) => entry.shift_id ? [entry.shift_id] : []));
    return {
      employeeId,
      employeeName: `${employee.first_name} ${employee.last_name}`,
      scheduledMinutes,
      actualMinutes,
      hourVarianceMinutes: variance.hourVarianceMinutes,
      hourVariancePercent: variance.hourVariancePercent,
      hourlyRate,
      scheduledCostCents,
      actualCostCents,
      costVarianceCents: variance.costVarianceCents,
      costVariancePercent: variance.costVariancePercent,
      scheduledOvertime: calculateWeeklyOvertimeStatus(scheduledMinutes),
      actualOvertime: calculateWeeklyOvertimeStatus(actualMinutes),
      missingCompensation: input.canViewCosts && !hasRate && (scheduledMinutes > 0 || actualMinutes > 0),
      openEntryCount: entries.filter((entry) => entry.status === "open").length,
      provisionalEntryCount: completed.filter((entry) => entry.review_status === "unreviewed").length,
      scheduledWithoutActualCount: shifts.filter((shift) => !linkedActualShiftIds.has(shift.id)).length,
      unlinkedActualCount: completed.filter((entry) => entry.shift_id === null).length,
    };
  }).filter((row): row is EmployeeLaborRow => row !== null)
    .sort((left, right) => left.employeeName.localeCompare(right.employeeName));

  const scheduledMinutes = calculateScheduledMinutes(activeShifts);
  const actualMinutes = calculateActualMinutes(completedEntries, input.breaks);
  const unassignedShiftCount = activeShifts.filter((shift) => !shift.employee_id).length;
  const missingScheduledCostInputs = input.canViewCosts ? activeShifts.filter((shift) => (
    !shift.employee_id || !compensationByEmployee.has(shift.employee_id)
      || compensationByEmployee.get(shift.employee_id) === null
  )).length : 0;
  const missingActualCostInputs = input.canViewCosts ? completedEntries.filter((entry) => (
    !compensationByEmployee.has(entry.employee_id) || compensationByEmployee.get(entry.employee_id) === null
  )).length : 0;
  const costDataComplete = input.canViewCosts
    && missingScheduledCostInputs === 0 && missingActualCostInputs === 0;
  const scheduledCostCents = input.canViewCosts
    ? rows.reduce((total, row) => total + (row.scheduledCostCents ?? 0), 0) : null;
  const actualCostCents = input.canViewCosts
    ? rows.reduce((total, row) => total + (row.actualCostCents ?? 0), 0) : null;
  const variance = calculateLaborVariance({
    scheduledMinutes,
    actualMinutes,
    scheduledCostCents: costDataComplete ? scheduledCostCents : null,
    actualCostCents: costDataComplete ? actualCostCents : null,
  });

  return {
    rows,
    scheduledMinutes,
    actualMinutes,
    hourVarianceMinutes: variance.hourVarianceMinutes,
    hourVariancePercent: variance.hourVariancePercent,
    scheduledCostCents,
    actualCostCents,
    costVarianceCents: variance.costVarianceCents,
    costVariancePercent: variance.costVariancePercent,
    costDataComplete,
    missingCompensationCount: rows.filter((row) => row.missingCompensation).length,
    unassignedShiftCount,
    openEntryCount: rows.reduce((total, row) => total + row.openEntryCount, 0),
    provisionalEntryCount: rows.reduce((total, row) => total + row.provisionalEntryCount, 0),
    scheduledWithoutActualCount: rows.reduce((total, row) => total + row.scheduledWithoutActualCount, 0),
    unlinkedActualCount: rows.reduce((total, row) => total + row.unlinkedActualCount, 0),
  };
}
