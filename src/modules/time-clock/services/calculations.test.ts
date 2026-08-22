import { describe, expect, it } from "vitest";
import {
  breakDurationMinutes,
  dailyWorkedTotals,
  formatDuration,
  grossDurationMinutes,
  netWorkedMinutes,
  weeklyWorkedMinutes,
} from "@/modules/time-clock/services/calculations";

const entry = {
  id: "10000000-0000-4000-8000-000000000001",
  clock_in_at: "2026-08-17T13:00:00.000Z",
  clock_out_at: "2026-08-17T21:00:00.000Z",
  status: "completed" as const,
};
const breaks = [{
  time_entry_id: entry.id,
  start_at: "2026-08-17T17:00:00.000Z",
  end_at: "2026-08-17T17:30:00.000Z",
}];

describe("Gate 4 worked-time calculations", () => {
  it("calculates gross, break, and net minutes from timestamps", () => {
    expect(grossDurationMinutes(entry)).toBe(480);
    expect(breakDurationMinutes(breaks)).toBe(30);
    expect(netWorkedMinutes(entry, breaks)).toBe(450);
    expect(formatDuration(450)).toBe("7h 30m");
  });

  it("groups entries by the organization's local work date", () => {
    const lateEntry = {
      ...entry,
      id: "10000000-0000-4000-8000-000000000002",
      clock_in_at: "2026-08-18T03:30:00.000Z",
      clock_out_at: "2026-08-18T04:30:00.000Z",
    };
    const totals = dailyWorkedTotals([entry, lateEntry], breaks, "America/New_York");
    expect(totals.get("2026-08-17")).toBe(510);
    expect(weeklyWorkedMinutes([entry, lateEntry], breaks)).toBe(510);
  });

  it("uses elapsed instants across the fall DST transition", () => {
    const fallBackEntry = {
      clock_in_at: "2026-11-01T05:30:00.000Z",
      clock_out_at: "2026-11-01T07:30:00.000Z",
    };
    expect(grossDurationMinutes(fallBackEntry)).toBe(120);
  });

  it("ignores open breaks, open entries, and cancelled entries", () => {
    expect(breakDurationMinutes([{ ...breaks[0], end_at: null }])).toBe(0);
    expect(netWorkedMinutes({ ...entry, clock_out_at: null }, breaks)).toBe(0);
    expect(weeklyWorkedMinutes([{ ...entry, status: "cancelled" }], breaks)).toBe(0);
  });
});
