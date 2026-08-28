import { describe, expect, it } from "vitest";
import { summarizeToday } from "./today-summary";

const window = { start: "2026-08-26T04:00:00.000Z", end: "2026-08-27T04:00:00.000Z", day: "2026-08-26" };
const now = new Date("2026-08-26T18:00:00.000Z");
const rates = new Map<string, number>([["e1", 20], ["e2", 30]]);

describe("summarizeToday", () => {
  it("counts assigned, unfilled, clocked-in, and pending coverage", () => {
    const summary = summarizeToday({
      shifts: [
        { id: "s1", start_at: "2026-08-26T14:00:00Z", end_at: "2026-08-26T22:00:00Z", break_minutes: 0, employee_id: "e1", status: "published" },
        { id: "s2", start_at: "2026-08-26T14:00:00Z", end_at: "2026-08-26T18:00:00Z", break_minutes: 0, employee_id: null, status: "open" },
        { id: "s3", start_at: "2026-08-26T14:00:00Z", end_at: "2026-08-26T18:00:00Z", break_minutes: 0, employee_id: "e2", status: "cancelled" },
        { id: "s4", start_at: "2026-08-24T14:00:00Z", end_at: "2026-08-24T18:00:00Z", break_minutes: 0, employee_id: "e1", status: "published" },
      ],
      timeEntries: [
        { id: "t1", clock_in_at: "2026-08-26T14:00:00Z", clock_out_at: null, status: "open", employee_id: "e1" },
      ],
      coverage: [
        { id: "c1", status: "pending" },
        { id: "c2", status: "approved" },
      ],
      rates,
      window,
      now,
    });
    expect(summary.scheduledCount).toBe(1);
    expect(summary.unfilledCount).toBe(1);
    expect(summary.clockedInCount).toBe(1);
    expect(summary.pendingCoverageCount).toBe(1);
  });

  it("subtracts breaks and applies rates", () => {
    const summary = summarizeToday({
      shifts: [
        { id: "s1", start_at: "2026-08-26T14:00:00Z", end_at: "2026-08-26T22:00:00Z", break_minutes: 30, employee_id: "e1", status: "published" },
      ],
      timeEntries: [],
      coverage: [],
      rates,
      window,
      now,
    });
    expect(summary.scheduledHours).toBe(7.5);
    expect(summary.scheduledCost).toBe(150);
  });

  it("clips overnight shifts to the org day window", () => {
    const summary = summarizeToday({
      shifts: [
        { id: "s1", start_at: "2026-08-26T20:00:00Z", end_at: "2026-08-27T08:00:00Z", break_minutes: 0, employee_id: "e2", status: "published" },
      ],
      timeEntries: [],
      coverage: [],
      rates,
      window,
      now,
    });
    expect(summary.scheduledHours).toBe(8);
    expect(summary.scheduledCost).toBe(240);
  });

  it("computes actual hours from open and completed entries", () => {
    const summary = summarizeToday({
      shifts: [],
      timeEntries: [
        { id: "t1", clock_in_at: "2026-08-26T14:00:00Z", clock_out_at: null, status: "open", employee_id: "e1" },
        { id: "t2", clock_in_at: "2026-08-26T06:00:00Z", clock_out_at: "2026-08-26T08:00:00Z", status: "completed", employee_id: "e2" },
      ],
      coverage: [],
      rates,
      window,
      now,
    });
    expect(summary.actualHours).toBe(6);
    expect(summary.actualCost).toBe(140);
  });
});