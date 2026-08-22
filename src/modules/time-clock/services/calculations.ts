import { localDateTimeValue } from "@/modules/scheduling/lib/dates";
import type { TimeBreak, TimeEntry } from "@/types/database";

type EntryInterval = Pick<TimeEntry, "id" | "clock_in_at" | "clock_out_at" | "status">;
type BreakInterval = Pick<TimeBreak, "time_entry_id" | "start_at" | "end_at">;

function elapsedMilliseconds(start: string, end: string) {
  return Math.max(0, Date.parse(end) - Date.parse(start));
}

function roundedMinutes(milliseconds: number) {
  return Math.round(milliseconds / 60_000);
}

export function grossDurationMinutes(entry: Pick<EntryInterval, "clock_in_at" | "clock_out_at">) {
  return entry.clock_out_at ? roundedMinutes(elapsedMilliseconds(entry.clock_in_at, entry.clock_out_at)) : 0;
}

export function breakDurationMinutes(breaks: Pick<BreakInterval, "start_at" | "end_at">[]) {
  return roundedMinutes(breaks.reduce((total, item) => (
    total + (item.end_at ? elapsedMilliseconds(item.start_at, item.end_at) : 0)
  ), 0));
}

export function netWorkedMinutes(
  entry: Pick<EntryInterval, "clock_in_at" | "clock_out_at">,
  breaks: Pick<BreakInterval, "start_at" | "end_at">[],
) {
  if (!entry.clock_out_at) return 0;
  const gross = elapsedMilliseconds(entry.clock_in_at, entry.clock_out_at);
  const breakTime = breaks.reduce((total, item) => (
    total + (item.end_at ? elapsedMilliseconds(item.start_at, item.end_at) : 0)
  ), 0);
  return roundedMinutes(Math.max(0, gross - breakTime));
}

export function dailyWorkedTotals(entries: EntryInterval[], breaks: BreakInterval[], timeZone: string) {
  const totals = new Map<string, number>();
  for (const entry of entries.filter((item) => item.status !== "cancelled")) {
    const date = localDateTimeValue(entry.clock_in_at, timeZone).slice(0, 10);
    const entryBreaks = breaks.filter((item) => item.time_entry_id === entry.id);
    totals.set(date, (totals.get(date) ?? 0) + netWorkedMinutes(entry, entryBreaks));
  }
  return totals;
}

export function weeklyWorkedMinutes(entries: EntryInterval[], breaks: BreakInterval[]) {
  return entries.filter((item) => item.status !== "cancelled")
    .reduce((total, entry) => total + netWorkedMinutes(
      entry,
      breaks.filter((item) => item.time_entry_id === entry.id),
    ), 0);
}

export function formatDuration(minutes: number) {
  const safeMinutes = Math.max(0, Math.round(minutes));
  return `${Math.floor(safeMinutes / 60)}h ${safeMinutes % 60}m`;
}
