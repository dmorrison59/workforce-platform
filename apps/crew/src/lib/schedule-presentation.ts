// Pure existing YardClock utilities, with no Next.js/server imports.
import { orgDayWindow, zonedMidnight } from "../../../../src/core/shared/day-window";
import { addDays, formatShiftTime, formatWeekDay, localDateTimeValue, weekStartFor } from "../../../../src/modules/scheduling/lib/dates";
import type { CrewShift } from "../services/crew-schedule";

export { addDays, formatShiftTime, formatWeekDay, localDateTimeValue, orgDayWindow, weekStartFor };

export function weekHeading(weekStart: string) {
  const format = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });
  return `${format.format(new Date(weekStart + "T12:00:00Z"))} – ${format.format(new Date(addDays(weekStart, 6) + "T12:00:00Z"))}`;
}

export function weekWindow(weekStart: string, timeZone: string) {
  return {
    start: zonedMidnight(timeZone, weekStart).toISOString(),
    end: zonedMidnight(timeZone, addDays(weekStart, 7)).toISOString(),
  };
}

export function shiftsInWindow(shifts: CrewShift[], window: { start: string; end: string }) {
  return shifts.filter((shift) => Date.parse(shift.start_at) < Date.parse(window.end)
    && Date.parse(shift.end_at) > Date.parse(window.start))
    .sort((a, b) => Date.parse(a.start_at) - Date.parse(b.start_at) || a.id.localeCompare(b.id));
}

export function todayWork(shifts: CrewShift[], timeZone: string, now: Date) {
  const window = orgDayWindow(timeZone, now);
  const today = shiftsInWindow(shifts, window);
  const immediate = today.find((shift) => Date.parse(shift.end_at) > now.getTime());
  return { shifts: today, immediateId: immediate?.id ?? null, day: window.day };
}

export function weekGroups(shifts: CrewShift[], weekStart: string, timeZone: string) {
  // Overnight shifts appear on every day they overlap, with actual date labels.
  return Array.from({ length: 7 }, (_, index) => {
    const day = addDays(weekStart, index);
    return {
      day,
      shifts: shiftsInWindow(shifts, {
        start: zonedMidnight(timeZone, day).toISOString(),
        end: zonedMidnight(timeZone, addDays(day, 1)).toISOString(),
      }),
    };
  });
}

export function greeting(timeZone: string, now: Date) {
  const hour = Number(new Intl.DateTimeFormat("en-US", { timeZone, hour: "numeric", hourCycle: "h23" }).format(now));
  return hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
}

export function shiftTimeLabel(instant: string, referenceDay: string, timeZone: string) {
  const day = orgDayWindow(timeZone, new Date(instant)).day;
  const time = formatShiftTime(instant, timeZone);
  return day === referenceDay ? time : `${formatWeekDay(day)} · ${time}`;
}

export function optionalText(value: unknown, maxLength = 500): string | null {
  if (typeof value !== "string") return null;
  const text = value.trim().replace(/\s+/g, " ");
  return text && text.length <= maxLength ? text : null;
}

export function locationAddress(location: CrewShift["location"] | null | undefined): string | null {
  if (!location) return null;
  const street = optionalText(location.address);
  const city = optionalText(location.city, 120);
  const state = optionalText(location.state, 120);
  const postal = optionalText(location.postal_code, 30);
  // Syntactic usability only, not geocoding. Never open a stored arbitrary URL.
  const placeholders = /^(?:n\/?a|none|unknown|tbd|not available|not set|-+)$/i;
  if (!street || street.length < 5 || placeholders.test(street)
    || /(?:[a-z]+:|www\.|[<>])/i.test(street) || !/\p{L}/u.test(street)
    || (!/\d/.test(street) && !(city && state))) return null;
  const locality = [city, state, postal].filter((part) => part && !placeholders.test(part));
  return [street, ...locality].join(", ");
}

export function directionsUrls(address: string, platform: string) {
  const destination = encodeURIComponent(address);
  const fallback = `https://www.google.com/maps/dir/?api=1&destination=${destination}`;
  return {
    native: platform === "ios" ? `https://maps.apple.com/?daddr=${destination}`
      : platform === "android" ? `geo:0,0?q=${destination}` : fallback,
    fallback,
  };
}
