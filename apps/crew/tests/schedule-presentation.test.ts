import { describe, expect, it } from "vitest";
import {
  addDays, directionsUrls, greeting, locationAddress, orgDayWindow,
  shiftTimeLabel, todayWork, weekGroups, weekHeading, weekStartFor, weekWindow,
} from "../src/lib/schedule-presentation";
import type { CrewShift } from "../src/services/crew-schedule";

function shift(id: string, start: string, end: string): CrewShift {
  return { id, location_id: "location", start_at: start, end_at: end, notes: "", break_minutes: 0,
    schedule: { id: "schedule" }, location: null, department: null, role: null };
}
const zone = "America/New_York";
const now = new Date("2026-09-03T13:00:00Z");
const early = shift("early", "2026-09-03T10:00:00Z", "2026-09-03T12:00:00Z");
const current = shift("current", "2026-09-03T13:00:00Z", "2026-09-03T16:00:00Z");
const later = shift("later", "2026-09-03T18:00:00Z", "2026-09-03T22:00:00Z");

describe("Today", () => {
  it("handles no work", () => {
    expect(todayWork([], zone, now)).toMatchObject({ shifts: [], immediateId: null });
  });
  it("shows a single current shift", () => {
    expect(todayWork([current], zone, now).immediateId).toBe("current");
  });
  it("sorts multiple shifts and highlights current work, not an ended shift", () => {
    const work = todayWork([later, current, early], zone, now);
    expect(work.shifts.map((item) => item.id)).toEqual(["early", "current", "later"]);
    expect(work.immediateId).toBe("current");
  });
  it("highlights next work between shifts and nothing after all shifts end", () => {
    expect(todayWork([early, later], zone, now).immediateId).toBe("later");
    expect(todayWork([early], zone, now).immediateId).toBeNull();
  });
  it("includes overnight carry-in and excludes an end exactly at midnight", () => {
    const overnight = shift("overnight", "2026-09-03T02:00:00Z", "2026-09-03T06:00:00Z");
    const ended = shift("ended", "2026-09-03T01:00:00Z", "2026-09-03T04:00:00Z");
    expect(todayWork([ended, overnight], zone, now).shifts.map((item) => item.id)).toEqual(["overnight"]);
  });
  it("uses the organization date, not the device/UTC date", () => {
    expect(todayWork([current], zone, new Date("2026-09-04T01:00:00Z")).shifts).toHaveLength(1);
  });
  it("shows the actual date for overnight start/end labels", () => {
    expect(shiftTimeLabel("2026-09-04T05:00:00Z", "2026-09-03", zone)).toContain("Sep 4");
    expect(shiftTimeLabel(current.start_at, "2026-09-03", zone)).toBe("9:00 AM");
  });
  it("uses the local hour in the greeting", () => {
    expect(greeting(zone, now)).toBe("Good morning");
    expect(greeting(zone, new Date("2026-09-03T20:00:00Z"))).toBe("Good afternoon");
    expect(greeting(zone, new Date("2026-09-04T01:00:00Z"))).toBe("Good evening");
  });
});

describe("weeks and DST", () => {
  it("starts on Monday, including when now is Sunday", () => {
    expect(weekStartFor(now, zone)).toBe("2026-08-31");
    expect(weekStartFor(new Date("2026-09-07T01:00:00Z"), zone)).toBe("2026-08-31");
  });
  it("navigates weeks across month/year boundaries reversibly", () => {
    expect(addDays("2026-12-28", 7)).toBe("2027-01-04");
    expect(addDays(addDays("2026-12-28", 7), -7)).toBe("2026-12-28");
    expect(weekHeading("2026-12-28")).toBe("Dec 28, 2026 – Jan 3, 2027");
  });
  it("groups all seven dates and keeps shifts chronological", () => {
    const groups = weekGroups([later, early, current], "2026-08-31", zone);
    expect(groups).toHaveLength(7);
    expect(groups[3].shifts.map((item) => item.id)).toEqual(["early", "current", "later"]);
    expect(groups[0].shifts).toEqual([]);
  });
  it("keeps Sunday-to-Monday overnight work visible in both weeks", () => {
    const overnight = shift("night", "2026-09-07T02:00:00Z", "2026-09-07T06:00:00Z");
    expect(weekGroups([overnight], "2026-08-31", zone)[6].shifts).toHaveLength(1);
    expect(weekGroups([overnight], "2026-09-07", zone)[0].shifts).toHaveLength(1);
  });
  it.each([
    ["2026-03-08T12:00:00Z", 23], ["2026-11-01T12:00:00Z", 25],
  ])("handles DST day %s", (instant, hours) => {
    const range = orgDayWindow(zone, new Date(instant));
    expect((Date.parse(range.end) - Date.parse(range.start)) / 3_600_000).toBe(hours);
  });
  it("uses zoned midnights for a DST week, not fixed 24-hour increments", () => {
    const range = weekWindow("2026-03-02", zone);
    expect((Date.parse(range.end) - Date.parse(range.start)) / 3_600_000).toBe(167);
  });
});

describe("location details and Directions", () => {
  const location = { name: "Main site", address: " 123 Main St ", city: "Boston", state: "MA", postal_code: "02108" };
  it("builds the existing location address", () => {
    expect(locationAddress(location)).toBe("123 Main St, Boston, MA, 02108");
  });
  it.each(["", "N/A", "TBD", "unknown", "https://evil.example", "javascript:alert(1)", "123", "???", "<site>"])("rejects unusable street %s", (address) => {
    expect(locationAddress({ ...location, address })).toBeNull();
  });
  it("handles missing and malformed optional location fields", () => {
    expect(locationAddress(null)).toBeNull();
    expect(locationAddress({ ...location, address: 42 } as unknown as CrewShift["location"])).toBeNull();
    expect(locationAddress({ ...location, city: "", state: "", postal_code: "" })).toBe("123 Main St");
  });
  it("encodes the address into fixed native map URLs, not arbitrary stored URLs", () => {
    const address = "123 A & B St, Boston";
    expect(directionsUrls(address, "ios").native).toBe("https://maps.apple.com/?daddr=123%20A%20%26%20B%20St%2C%20Boston");
    expect(directionsUrls(address, "android").native).toBe("geo:0,0?q=123%20A%20%26%20B%20St%2C%20Boston");
    expect(directionsUrls(address, "android").fallback).toContain("https://www.google.com/maps/dir/?api=1&destination=");
  });
});
