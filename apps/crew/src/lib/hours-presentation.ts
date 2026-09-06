import {
  breakDurationMinutes,
  formatDuration,
  grossDurationMinutes,
  netWorkedMinutes,
} from "@yardclock/time-calculations";
import { addDays, formatShiftTime, localDateTimeValue } from "@/lib/schedule-presentation";
import type { CrewHoursBreak, CrewHoursData, CrewHoursEntry } from "@/types/hours";

export { formatDuration };

function validInstant(value: string | null) {
  return value !== null && Number.isFinite(Date.parse(value));
}

export function breaksFor(entry: CrewHoursEntry, breaks: CrewHoursBreak[]) {
  return breaks.filter((item) => item.time_entry_id === entry.id);
}

function calculationInterval(entry: CrewHoursEntry, breaks: CrewHoursBreak[], now: Date) {
  if (!validInstant(entry.clock_in_at)) return null;
  const end = entry.clock_out_at ?? (entry.status === "open" ? now.toISOString() : null);
  if (!validInstant(end) || Date.parse(end!) <= Date.parse(entry.clock_in_at)) return null;
  return {
    entry: { ...entry, clock_out_at: end },
    breaks: breaks.filter((item) => validInstant(item.start_at))
      .map((item) => ({ ...item, end_at: item.end_at ?? (entry.status === "open" ? end : null) }))
      .filter((item) => validInstant(item.end_at)),
  };
}

export function entryWorkedMinutes(entry: CrewHoursEntry, breaks: CrewHoursBreak[], now: Date) {
  if (entry.status === "cancelled") return 0;
  const interval = calculationInterval(entry, breaks, now);
  return interval ? netWorkedMinutes(interval.entry, interval.breaks) : 0;
}

export function entryGrossMinutes(entry: CrewHoursEntry, now: Date) {
  const interval = calculationInterval(entry, [], now);
  return interval ? grossDurationMinutes(interval.entry) : 0;
}

export function entryBreakMinutes(entry: CrewHoursEntry, breaks: CrewHoursBreak[], now: Date) {
  const interval = calculationInterval(entry, breaks, now);
  return interval ? breakDurationMinutes(interval.breaks) : 0;
}

export function entryHasOpenBreak(entry: CrewHoursEntry, breaks: CrewHoursBreak[]) {
  return entry.status === "open" && breaks.some((item) => item.time_entry_id === entry.id && item.end_at === null);
}

export function entryDay(entry: CrewHoursEntry, timeZone: string) {
  if (!validInstant(entry.clock_in_at)) return null;
  const day = localDateTimeValue(entry.clock_in_at, timeZone).slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(day) ? day : null;
}

export function hoursSummary(data: CrewHoursData, timeZone: string, now: Date) {
  const today = localDateTimeValue(now.toISOString(), timeZone).slice(0, 10);
  const visible = data.entries.filter((entry) => entry.status !== "cancelled");
  const total = visible.reduce((sum, entry) => sum + entryWorkedMinutes(entry, breaksFor(entry, data.breaks), now), 0);
  const todayTotal = visible.filter((entry) => entryDay(entry, timeZone) === today)
    .reduce((sum, entry) => sum + entryWorkedMinutes(entry, breaksFor(entry, data.breaks), now), 0);
  const openEntry = visible.find((entry) => entry.status === "open") ?? null;
  return { totalMinutes: total, todayMinutes: todayTotal, openEntry };
}

export function hoursDayGroups(data: CrewHoursData, timeZone: string, now: Date) {
  return Array.from({ length: 7 }, (_, index) => {
    const day = addDays(data.weekStart, index);
    const entries = data.entries.filter((entry) => entryDay(entry, timeZone) === day)
      .sort((a, b) => Date.parse(a.clock_in_at) - Date.parse(b.clock_in_at) || a.id.localeCompare(b.id));
    return {
      day,
      entries,
      totalMinutes: entries.filter((entry) => entry.status !== "cancelled")
        .reduce((sum, entry) => sum + entryWorkedMinutes(entry, breaksFor(entry, data.breaks), now), 0),
    };
  }).filter((group) => group.entries.length > 0);
}

export function dayHeading(day: string) {
  return new Intl.DateTimeFormat("en-US", {
    weekday: "long", month: "short", day: "numeric", timeZone: "UTC",
  }).format(new Date(`${day}T12:00:00Z`));
}

export function entryTimeLabel(entry: CrewHoursEntry, timeZone: string) {
  if (!validInstant(entry.clock_in_at)) return "Time unavailable";
  const start = formatShiftTime(entry.clock_in_at, timeZone);
  if (entry.status === "open" && !entry.clock_out_at) return `${start} – Clocked In`;
  if (!validInstant(entry.clock_out_at)) return `${start} – Time unavailable`;
  return `${start} – ${formatShiftTime(entry.clock_out_at!, timeZone)}`;
}

export function entryStatusLabels(entry: CrewHoursEntry) {
  if (entry.status === "open") return ["In Progress"];
  if (entry.status === "cancelled") return ["Cancelled"];
  return [entry.review_status === "approved" ? "Approved" : "Pending Review",
    ...(entry.status === "corrected" || entry.corrected_at ? ["Adjusted"] : [])];
}

export function safeOptionalText(value: unknown, fallback: string) {
  return typeof value === "string" && value.trim() && value.length <= 200 ? value.trim() : fallback;
}
