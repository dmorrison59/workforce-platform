import { addDays, localDateTimeValue } from "@/modules/scheduling/lib/dates";
import { netWorkedMinutes } from "@/modules/time-clock/services/calculations";
import type { Shift, TimeBreak, TimeEntry } from "@/types/database";

export const WEEKLY_OVERTIME_THRESHOLD_MINUTES = 40 * 60;
export const NEAR_OVERTIME_WINDOW_MINUTES = 5 * 60;

export type OvertimeStatus = "normal" | "near" | "over";
type ScheduledShift = Pick<Shift, "start_at" | "end_at" | "break_minutes" | "status">;
type ActualEntry = Pick<TimeEntry, "id" | "clock_in_at" | "clock_out_at" | "status">;
type ActualBreak = Pick<TimeBreak, "time_entry_id" | "start_at" | "end_at">;

function elapsedMinutes(start: string, end: string) {
  return Math.max(0, Math.round((Date.parse(end) - Date.parse(start)) / 60_000));
}

function isPublishedLaborShift(shift: ScheduledShift) {
  return shift.status === "published" || shift.status === "open" || shift.status === "completed";
}

export function calculateScheduledMinutes(shifts: ScheduledShift[]) {
  return shifts.filter(isPublishedLaborShift).reduce((total, shift) => (
    total + Math.max(0, elapsedMinutes(shift.start_at, shift.end_at) - shift.break_minutes)
  ), 0);
}

export function calculateActualMinutes(entries: ActualEntry[], breaks: ActualBreak[]) {
  return entries.filter((entry) => entry.status === "completed" || entry.status === "corrected")
    .reduce((total, entry) => total + netWorkedMinutes(
      entry,
      breaks.filter((item) => item.time_entry_id === entry.id),
    ), 0);
}

export function calculateLaborCostCents(minutes: number, hourlyRate: number | null) {
  if (hourlyRate === null || !Number.isFinite(hourlyRate)) return null;
  return Math.round((Math.max(0, minutes) / 60) * hourlyRate * 100);
}

export function calculateLaborVariance(input: {
  scheduledMinutes: number;
  actualMinutes: number;
  scheduledCostCents: number | null;
  actualCostCents: number | null;
}) {
  return {
    hourVarianceMinutes: input.actualMinutes - input.scheduledMinutes,
    costVarianceCents: input.scheduledCostCents === null || input.actualCostCents === null
      ? null
      : input.actualCostCents - input.scheduledCostCents,
    hourVariancePercent: percentageVariance(input.actualMinutes, input.scheduledMinutes),
    costVariancePercent: input.scheduledCostCents === null || input.actualCostCents === null
      ? null
      : percentageVariance(input.actualCostCents, input.scheduledCostCents),
  };
}

export function percentageVariance(actual: number, scheduled: number) {
  return scheduled > 0 ? ((actual - scheduled) / scheduled) * 100 : null;
}

export function calculateWeeklyOvertimeStatus(
  minutes: number,
  thresholdMinutes = WEEKLY_OVERTIME_THRESHOLD_MINUTES,
  nearWindowMinutes = NEAR_OVERTIME_WINDOW_MINUTES,
) {
  const safeMinutes = Math.max(0, minutes);
  const status: OvertimeStatus = safeMinutes > thresholdMinutes
    ? "over"
    : safeMinutes >= thresholdMinutes - nearWindowMinutes ? "near" : "normal";
  return {
    status,
    thresholdMinutes,
    remainingMinutes: Math.max(0, thresholdMinutes - safeMinutes),
    overMinutes: Math.max(0, safeMinutes - thresholdMinutes),
  };
}

export function isInstantInLocalWeek(instant: string, weekStart: string, timeZone: string) {
  const localDate = localDateTimeValue(instant, timeZone).slice(0, 10);
  return localDate >= weekStart && localDate < addDays(weekStart, 7);
}
