import { describe, expect, it } from "vitest";
import { capabilities } from "@/core/permissions/capabilities";
import { timeOffRequestSchema, timeOffReviewSchema } from "@/modules/time-off/validation/schemas";

describe("time-off validation", () => {
  it("accepts a valid date range and optional reason", () => {
    expect(timeOffRequestSchema.safeParse({
      organizationId: "10000000-0000-4000-8000-000000000000",
      startDate: "2026-08-24",
      endDate: "2026-08-26",
      reason: "Family event",
    }).success).toBe(true);
  });

  it("rejects an end date before the start date", () => {
    expect(timeOffRequestSchema.safeParse({
      organizationId: "10000000-0000-4000-8000-000000000000",
      startDate: "2026-08-26",
      endDate: "2026-08-24",
      reason: "",
    }).success).toBe(false);
  });

  it("allows only approve or deny review decisions", () => {
    expect(timeOffReviewSchema.safeParse({
      requestId: "10000000-0000-4000-8000-000000000001",
      decision: "approved",
      managerNote: "Approved",
    }).success).toBe(true);
    expect(timeOffReviewSchema.safeParse({
      requestId: "10000000-0000-4000-8000-000000000001",
      decision: "cancelled",
      managerNote: "",
    }).success).toBe(false);
  });

  it("registers every Gate 2 capability", () => {
    expect(capabilities).toEqual(expect.arrayContaining([
      "availability.view", "availability.manage_self", "timeoff.request",
      "timeoff.view_self", "timeoff.approve",
    ]));
  });
});
