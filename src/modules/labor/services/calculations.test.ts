import { describe, expect, it } from "vitest";
import {
  calculateActualMinutes,
  calculateLaborCostCents,
  calculateLaborVariance,
  calculateScheduledMinutes,
  calculateWeeklyOvertimeStatus,
  isInstantInLocalWeek,
  percentageVariance,
} from "@/modules/labor/services/calculations";

describe("Gate 5 labor calculations", () => {
  it("deducts scheduled breaks and excludes non-published labor states", () => {
    const base = { start_at: "2026-08-17T13:00:00Z", end_at: "2026-08-17T21:00:00Z", break_minutes: 30 };
    expect(calculateScheduledMinutes([
      { ...base, status: "published" },
      { ...base, status: "open" },
      { ...base, status: "draft" },
      { ...base, status: "cancelled" },
    ])).toBe(900);
  });

  it("uses completed and corrected actual entries with actual break deduction", () => {
    const entries = [
      { id: "a", clock_in_at: "2026-08-17T13:00:00Z", clock_out_at: "2026-08-17T21:00:00Z", status: "completed" as const },
      { id: "b", clock_in_at: "2026-08-18T13:00:00Z", clock_out_at: "2026-08-18T21:00:00Z", status: "corrected" as const },
      { id: "c", clock_in_at: "2026-08-19T13:00:00Z", clock_out_at: null, status: "open" as const },
    ];
    const breaks = [{ time_entry_id: "a", start_at: "2026-08-17T17:00:00Z", end_at: "2026-08-17T17:30:00Z" }];
    expect(calculateActualMinutes(entries, breaks)).toBe(930);
  });

  it("calculates hourly cost in integer cents", () => {
    expect(calculateLaborCostCents(450, 25)).toBe(18_750);
    expect(calculateLaborCostCents(480, 25)).toBe(20_000);
  });

  it("distinguishes missing compensation from a true zero-dollar rate", () => {
    expect(calculateLaborCostCents(480, null)).toBeNull();
    expect(calculateLaborCostCents(480, 0)).toBe(0);
  });

  it("uses actual minus scheduled for positive and negative variance", () => {
    expect(calculateLaborVariance({ scheduledMinutes: 450, actualMinutes: 480, scheduledCostCents: 18_750, actualCostCents: 20_000 }))
      .toMatchObject({ hourVarianceMinutes: 30, costVarianceCents: 1_250 });
    expect(calculateLaborVariance({ scheduledMinutes: 480, actualMinutes: 450, scheduledCostCents: 20_000, actualCostCents: 18_750 }))
      .toMatchObject({ hourVarianceMinutes: -30, costVarianceCents: -1_250 });
  });

  it("returns percentage variance only with a valid scheduled denominator", () => {
    expect(percentageVariance(90, 60)).toBe(50);
    expect(percentageVariance(60, 0)).toBeNull();
  });

  it("classifies normal, near, threshold, and over-40-hour states", () => {
    expect(calculateWeeklyOvertimeStatus(34 * 60).status).toBe("normal");
    expect(calculateWeeklyOvertimeStatus(35 * 60).status).toBe("near");
    expect(calculateWeeklyOvertimeStatus(40 * 60).status).toBe("near");
    expect(calculateWeeklyOvertimeStatus(42 * 60)).toMatchObject({ status: "over", overMinutes: 120 });
  });

  it("uses organization-local dates across the fall DST week boundary", () => {
    const week = "2026-10-26";
    expect(isInstantInLocalWeek("2026-11-02T04:30:00Z", week, "America/New_York")).toBe(true);
    expect(isInstantInLocalWeek("2026-11-02T05:30:00Z", week, "America/New_York")).toBe(false);
  });
});
