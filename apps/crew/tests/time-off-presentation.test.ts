import { describe, expect, it } from "vitest";

import {
  cancellationPrompt, canCancelTimeOff, formatDecisionDate, formatTimeOffRange,
  groupTimeOffRequests, organizationToday, timeOffActionState, timeOffStatus, validateTimeOffDraft,
} from "../src/lib/time-off-presentation";
import type { CrewTimeOffRequest } from "../src/types/time-off";

function request(id: string, start: string, end: string, status: CrewTimeOffRequest["status"], requested = start): CrewTimeOffRequest {
  return {
    id, organization_id: "org", employee_id: "employee", start_date: start, end_date: end,
    reason: "", status, requested_at: `${requested}T12:00:00Z`, reviewed_at: null, manager_note: "",
  };
}

describe("Gate 4 time-off presentation", () => {
  it("uses only the four backend statuses with employee-friendly detail", () => {
    expect(Object.keys(timeOffStatus)).toEqual(["pending", "approved", "denied", "cancelled"]);
    expect(timeOffStatus.pending).toEqual({ label: "Pending", detail: "Waiting for manager review" });
    expect(timeOffStatus.approved.label).toBe("Approved");
    expect(timeOffStatus.denied.label).toBe("Denied");
    expect(timeOffStatus.cancelled.label).toBe("Cancelled");
  });

  it("formats single-day and multi-day full-day requests", () => {
    expect(formatTimeOffRange("2026-09-14", "2026-09-14")).toBe("Monday, Sep 14, 2026");
    expect(formatTimeOffRange("2026-09-14", "2026-09-16"))
      .toBe("Monday, Sep 14, 2026 through Wednesday, Sep 16, 2026");
  });

  it("sorts active upcoming requests forward and recent/cancelled requests backward", () => {
    const result = groupTimeOffRequests([
      request("late", "2026-10-03", "2026-10-04", "approved"),
      request("past", "2026-08-01", "2026-08-02", "denied"),
      request("early", "2026-09-20", "2026-09-20", "pending"),
      request("cancelled", "2026-11-01", "2026-11-01", "cancelled"),
      request("recent", "2026-08-20", "2026-08-22", "approved"),
    ], "2026-09-06");
    expect(result.upcoming.map((item) => item.id)).toEqual(["early", "late"]);
    expect(result.history.map((item) => item.id)).toEqual(["cancelled", "recent", "past"]);
  });

  it("derives today and decision labels in the organization timezone", () => {
    const instant = new Date("2026-09-07T02:30:00Z");
    expect(organizationToday(instant, "America/New_York")).toBe("2026-09-06");
    expect(organizationToday(instant, "Asia/Tokyo")).toBe("2026-09-07");
    expect(formatDecisionDate("2026-09-07T02:30:00Z", "America/New_York")).toBe("Sep 6, 2026");
  });

  it("validates required, real, ordered dates and the backend reason limit", () => {
    expect(validateTimeOffDraft({ startDate: "", endDate: "2026-09-01", reason: "" })).toContain("required");
    expect(validateTimeOffDraft({ startDate: "2026-02-30", endDate: "2026-03-01", reason: "" })).toContain("YYYY-MM-DD");
    expect(validateTimeOffDraft({ startDate: "2026-09-02", endDate: "", reason: "" })).toContain("required");
    expect(validateTimeOffDraft({ startDate: "2026-09-02", endDate: "2026-09-01", reason: "" })).toContain("on or after");
    expect(validateTimeOffDraft({ startDate: "2026-09-01", endDate: "2026-09-01", reason: "x".repeat(2001) })).toContain("2,000");
    expect(validateTimeOffDraft({ startDate: "2026-09-01", endDate: "2026-09-03", reason: " Vacation " })).toBeNull();
  });

  it("limits cancellation UI to pending and provides a confirmation prompt", () => {
    const pending = request("pending", "2026-09-14", "2026-09-16", "pending");
    expect(canCancelTimeOff(pending)).toBe(true);
    expect(cancellationPrompt(pending)).toContain("Monday, Sep 14, 2026 through Wednesday, Sep 16, 2026");
    for (const status of ["approved", "denied", "cancelled"] as const) {
      expect(canCancelTimeOff({ ...pending, status })).toBe(false);
    }
  });

  it("represents submission and per-request cancellation loading without allowing parallel actions", () => {
    expect(timeOffActionState(true, null, "request")).toEqual({
      actionsDisabled: true, submissionLoading: true, cancellationLoading: false,
    });
    expect(timeOffActionState(false, "request", "request")).toEqual({
      actionsDisabled: true, submissionLoading: false, cancellationLoading: true,
    });
    expect(timeOffActionState(false, "request", "other")).toEqual({
      actionsDisabled: true, submissionLoading: false, cancellationLoading: false,
    });
  });

  it("handles an empty request list", () => {
    expect(groupTimeOffRequests([], "2026-09-06")).toEqual({ upcoming: [], history: [] });
  });
});
