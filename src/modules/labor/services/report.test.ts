import { describe, expect, it } from "vitest";
import { buildWeeklyLaborReport } from "@/modules/labor/services/report";

const employee = { id: "employee-a", first_name: "Avery", last_name: "Employee" };
const shift = {
  id: "shift-a",
  employee_id: employee.id,
  start_at: "2026-08-17T13:00:00Z",
  end_at: "2026-08-17T21:00:00Z",
  break_minutes: 30,
  status: "published" as const,
};
const entry = {
  id: "entry-a",
  employee_id: employee.id,
  shift_id: shift.id,
  clock_in_at: "2026-08-17T13:00:00Z",
  clock_out_at: "2026-08-17T21:00:00Z",
  status: "completed" as const,
  review_status: "unreviewed" as const,
};

describe("Gate 5 weekly labor report", () => {
  it("aggregates hours, costs, variance, and provisional status", () => {
    const report = buildWeeklyLaborReport({
      employees: [employee],
      shifts: [shift],
      entries: [entry],
      breaks: [],
      compensation: [{ employee_id: employee.id, hourly_rate: 25 }],
      canViewCosts: true,
    });
    expect(report).toMatchObject({
      scheduledMinutes: 450,
      actualMinutes: 480,
      hourVarianceMinutes: 30,
      scheduledCostCents: 18_750,
      actualCostCents: 20_000,
      costVarianceCents: 1_250,
      provisionalEntryCount: 1,
      costDataComplete: true,
    });
    expect(report.rows[0]).toMatchObject({ scheduledWithoutActualCount: 0, missingCompensation: false });
  });

  it("marks cost incomplete instead of treating a missing wage as zero", () => {
    const report = buildWeeklyLaborReport({
      employees: [employee], shifts: [shift], entries: [entry], breaks: [], compensation: [], canViewCosts: true,
    });
    expect(report.rows[0]).toMatchObject({
      hourlyRate: null,
      scheduledCostCents: null,
      actualCostCents: null,
      missingCompensation: true,
    });
    expect(report).toMatchObject({ costDataComplete: false, missingCompensationCount: 1, costVarianceCents: null });
  });

  it("does not expose rates, costs, or missing-wage state without cost authorization", () => {
    const report = buildWeeklyLaborReport({
      employees: [employee],
      shifts: [shift],
      entries: [entry],
      breaks: [],
      compensation: [{ employee_id: employee.id, hourly_rate: 25 }],
      canViewCosts: false,
    });
    expect(report.rows[0]).toMatchObject({
      hourlyRate: null,
      scheduledCostCents: null,
      actualCostCents: null,
      missingCompensation: false,
    });
    expect(report).toMatchObject({ scheduledCostCents: null, actualCostCents: null, missingCompensationCount: 0 });
  });

  it("surfaces open and unlinked actual time separately", () => {
    const report = buildWeeklyLaborReport({
      employees: [employee],
      shifts: [shift],
      entries: [
        { ...entry, shift_id: null, review_status: "approved" },
        { ...entry, id: "entry-open", shift_id: null, clock_out_at: null, status: "open", review_status: "unreviewed" },
      ],
      breaks: [],
      compensation: [{ employee_id: employee.id, hourly_rate: 25 }],
      canViewCosts: true,
    });
    expect(report).toMatchObject({ openEntryCount: 1, unlinkedActualCount: 1, scheduledWithoutActualCount: 1 });
  });

  it("includes unassigned published hours while marking their cost incomplete", () => {
    const report = buildWeeklyLaborReport({
      employees: [],
      shifts: [{ ...shift, employee_id: null }],
      entries: [],
      breaks: [],
      compensation: [],
      canViewCosts: true,
    });
    expect(report).toMatchObject({ scheduledMinutes: 450, unassignedShiftCount: 1, costDataComplete: false });
    expect(report.rows).toHaveLength(0);
  });
});
