import { describe, expect, it } from "vitest";
import {
  getApprovedTimeOffConflicts,
  getAvailabilityConflicts,
  getShiftAssignmentWarnings,
} from "@/modules/scheduling/services/conflicts";

const input = {
  startLocal: "2026-08-24T09:00",
  endLocal: "2026-08-24T17:00",
  availability: [{
    day_of_week: 1,
    available: true,
    start_time: "10:00:00",
    end_time: "16:00:00",
    effective_from: "2026-08-01",
    effective_until: null,
  }],
  timeOffRequests: [{
    start_date: "2026-08-24",
    end_date: "2026-08-24",
    status: "approved" as const,
  }],
};

describe("scheduling assignment warnings", () => {
  it("detects shifts outside stated availability", () => {
    expect(getAvailabilityConflicts(input)).toEqual([
      "Shift falls outside the employee's Monday availability (10:00–16:00).",
    ]);
  });

  it("detects approved time off but ignores non-approved requests", () => {
    expect(getApprovedTimeOffConflicts(input)).toHaveLength(1);
    expect(getApprovedTimeOffConflicts({
      ...input,
      timeOffRequests: [{ ...input.timeOffRequests[0], status: "pending" }],
    })).toEqual([]);
  });

  it("combines availability and approved time-off warnings without blocking", () => {
    const warnings = getShiftAssignmentWarnings(input);
    expect(warnings).toHaveLength(2);
    expect(warnings.join(" ")).toContain("Approved time off overlaps");
  });
});
