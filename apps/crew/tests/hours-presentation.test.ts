import { describe, expect, it } from "vitest";

import {
  breaksFor, dayHeading, entryBreakMinutes, entryStatusLabels, entryTimeLabel,
  entryWorkedMinutes, formatDuration, hoursDayGroups, hoursSummary,
} from "../src/lib/hours-presentation";
import { addDays, weekHeading, weekStartFor, weekWindow } from "../src/lib/schedule-presentation";
import type { CrewHoursBreak, CrewHoursData, CrewHoursEntry } from "../src/types/hours";

const zone = "America/New_York";
const now = new Date("2026-09-03T17:00:00Z");

function entry(id: string, clockIn: string, clockOut: string | null, status: CrewHoursEntry["status"] = clockOut ? "completed" : "open"): CrewHoursEntry {
  return {
    id, organization_id: "org", employee_id: "employee", shift_id: null, location_id: "location",
    clock_in_at: clockIn, clock_out_at: clockOut, status, review_status: "unreviewed",
    corrected_at: null, clock_in_captured_at: null, clock_out_captured_at: null,
  };
}

function timeBreak(id: string, entryId: string, start: string, end: string | null): CrewHoursBreak {
  return { id, organization_id: "org", time_entry_id: entryId, start_at: start, end_at: end };
}

function data(entries: CrewHoursEntry[], breaks: CrewHoursBreak[] = []): CrewHoursData {
  return { weekStart: "2026-08-31", entries, breaks, locationNames: {}, shifts: {} };
}

describe("Gate 3 hours totals", () => {
  const mondayOne = entry("m1", "2026-08-31T13:00:00Z", "2026-08-31T21:00:00Z");
  const mondayTwo = entry("m2", "2026-08-31T22:00:00Z", "2026-08-31T23:00:00Z");
  const tuesday = entry("t1", "2026-09-01T13:00:00Z", "2026-09-01T21:00:00Z");
  const open = entry("open", "2026-09-03T13:00:00Z", null);
  const breaks = [
    timeBreak("b1", "m1", "2026-08-31T17:00:00Z", "2026-08-31T17:30:00Z"),
    timeBreak("b2", "open", "2026-09-03T16:00:00Z", null),
  ];

  it("calculates current-week and today totals with multiple entries and days", () => {
    const summary = hoursSummary(data([mondayOne, mondayTwo, tuesday, open], breaks), zone, now);
    expect(summary.totalMinutes).toBe(1170);
    expect(summary.todayMinutes).toBe(180);
    expect(summary.openEntry?.id).toBe("open");
    const groups = hoursDayGroups(data([tuesday, mondayTwo, open, mondayOne], breaks), zone, now);
    expect(groups.map((group) => group.entries.map((item) => item.id))).toEqual([["m1", "m2"], ["t1"], ["open"]]);
    expect(groups[0].totalMinutes).toBe(510);
  });

  it("updates an open entry locally and deducts an active break", () => {
    expect(entryWorkedMinutes(open, breaksFor(open, breaks), now)).toBe(180);
    expect(entryWorkedMinutes(open, breaksFor(open, breaks), new Date(now.getTime() + 60_000))).toBe(180);
    expect(entryBreakMinutes(open, breaksFor(open, breaks), now)).toBe(60);
    expect(entryBreakMinutes(open, breaksFor(open, breaks), new Date(now.getTime() + 60_000))).toBe(61);
  });

  it("deducts completed breaks with the same web calculation", () => {
    expect(entryWorkedMinutes(mondayOne, breaksFor(mondayOne, breaks), now)).toBe(450);
    expect(formatDuration(450)).toBe("7h 30m");
  });

  it("groups a cross-midnight entry by its organization-local clock-in date", () => {
    const overnight = entry("night", "2026-09-04T03:00:00Z", "2026-09-04T11:00:00Z");
    const groups = hoursDayGroups(data([overnight]), zone, now);
    expect(groups[0].day).toBe("2026-09-03");
    expect(groups[0].totalMinutes).toBe(480);
  });

  it("uses the organization timezone rather than the device or UTC date", () => {
    const nearMidnight = entry("edge", "2026-09-01T04:30:00Z", "2026-09-01T05:30:00Z");
    expect(hoursDayGroups(data([nearMidnight]), "America/Los_Angeles", now)[0].day).toBe("2026-08-31");
    expect(hoursDayGroups(data([nearMidnight]), zone, now)[0].day).toBe("2026-09-01");
  });

  it("handles empty weeks, cancelled entries, and malformed optional timestamps", () => {
    expect(hoursSummary(data([]), zone, now)).toMatchObject({ totalMinutes: 0, todayMinutes: 0, openEntry: null });
    const cancelled = entry("cancelled", "2026-09-03T13:00:00Z", "2026-09-03T14:00:00Z", "cancelled");
    const malformed = entry("bad", "not-a-time", null);
    expect(hoursSummary(data([cancelled, malformed]), zone, now).totalMinutes).toBe(0);
    expect(entryTimeLabel(malformed, zone)).toBe("Time unavailable");
  });
});

describe("Gate 3 week and presentation semantics", () => {
  it("navigates previous, current, and next Monday-based weeks across DST", () => {
    const current = weekStartFor(new Date("2026-03-08T12:00:00Z"), zone);
    expect(current).toBe("2026-03-02");
    expect(addDays(current, -7)).toBe("2026-02-23");
    expect(addDays(current, 7)).toBe("2026-03-09");
    expect((Date.parse(weekWindow(current, zone).end) - Date.parse(weekWindow(current, zone).start)) / 3_600_000).toBe(167);
  });

  it("formats time periods, durations, entry labels, and employee-safe statuses", () => {
    const closed = entry("closed", "2026-09-03T13:02:00Z", "2026-09-03T21:31:00Z");
    expect(weekHeading("2026-08-31")).toBe("Aug 31, 2026 – Sep 6, 2026");
    expect(dayHeading("2026-09-03")).toBe("Thursday, Sep 3");
    expect(entryTimeLabel(closed, zone)).toBe("9:02 AM – 5:31 PM");
    expect(entryStatusLabels(closed)).toEqual(["Pending Review"]);
    expect(entryStatusLabels({ ...closed, status: "corrected", review_status: "approved", corrected_at: now.toISOString() })).toEqual(["Approved", "Adjusted"]);
    expect(formatDuration(125)).toBe("2h 5m");
  });
});
