import type { DayWindow } from "@/core/shared/day-window";

export interface TodayShiftRow {
  id: string;
  start_at: string;
  end_at: string;
  break_minutes: number;
  employee_id: string | null;
  status: string;
}

export interface TodayTimeEntryRow {
  id: string;
  clock_in_at: string;
  clock_out_at: string | null;
  status: string;
  employee_id: string;
}

export interface TodayCoverageRow {
  id: string;
  status: string;
}

export interface TodaySummary {
  scheduledCount: number;
  unfilledCount: number;
  clockedInCount: number;
  scheduledHours: number;
  scheduledCost: number;
  actualHours: number;
  actualCost: number;
  pendingCoverageCount: number;
}

const HOURS = 3600000;

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

function overlapHours(startIso: string, endIso: string | null, window: DayWindow, now: Date): number {
  const start = Math.max(new Date(startIso).getTime(), new Date(window.start).getTime());
  const end = Math.min(endIso ? new Date(endIso).getTime() : now.getTime(), new Date(window.end).getTime());
  return Math.max(0, (end - start) / HOURS);
}

export function summarizeToday(input: {
  shifts: TodayShiftRow[];
  timeEntries: TodayTimeEntryRow[];
  coverage: TodayCoverageRow[];
  rates: Map<string, number>;
  window: DayWindow;
  now: Date;
}): TodaySummary {
  const { shifts, timeEntries, coverage, rates, window, now } = input;

  const liveShifts = shifts.filter(
    (s) =>
      s.status !== "draft" &&
      s.status !== "cancelled" &&
      new Date(s.start_at).getTime() < new Date(window.end).getTime() &&
      new Date(s.end_at).getTime() > new Date(window.start).getTime(),
  );
  const assigned = liveShifts.filter((s) => s.employee_id !== null);
  const unfilled = liveShifts.filter(
    (s) => s.employee_id === null && (s.status === "published" || s.status === "open"),
  );

  let scheduledHours = 0;
  let scheduledCost = 0;
  for (const shift of assigned) {
        const hours = Math.max(0, overlapHours(shift.start_at, shift.end_at, window, now) - shift.break_minutes / 60);
    scheduledHours += hours;
    scheduledCost += hours * (rates.get(shift.employee_id as string) ?? 0);
  }

  const liveEntries = timeEntries.filter(
    (t) =>
      t.status !== "cancelled" &&
      new Date(t.clock_in_at).getTime() < new Date(window.end).getTime() &&
      new Date(t.clock_out_at ?? now.toISOString()).getTime() > new Date(window.start).getTime(),
  );
  const clockedIn = timeEntries.filter((t) => t.status === "open");

  let actualHours = 0;
  let actualCost = 0;
  for (const entry of liveEntries) {
    const hours = overlapHours(entry.clock_in_at, entry.clock_out_at, window, now);
    actualHours += hours;
    actualCost += hours * (rates.get(entry.employee_id) ?? 0);
  }

  return {
    scheduledCount: assigned.length,
    unfilledCount: unfilled.length,
    clockedInCount: clockedIn.length,
    scheduledHours: round2(scheduledHours),
    scheduledCost: round2(scheduledCost),
    actualHours: round2(actualHours),
    actualCost: round2(actualCost),
    pendingCoverageCount: coverage.filter((c) => c.status === "pending").length,
  };
}