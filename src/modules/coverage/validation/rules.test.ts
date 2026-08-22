import { describe, expect, it } from "vitest";
import { capabilities } from "@/core/permissions/capabilities";
import {
  canTransitionCoverageRequest,
  openShiftApprovalError,
  openShiftRequestError,
  shiftSwapApprovalError,
  shiftSwapRequestError,
} from "@/modules/coverage/validation/rules";
import {
  coverageApprovalSchema,
  shiftSwapRequestSchema,
} from "@/modules/coverage/validation/schemas";

const employeeA = "10000000-0000-4000-8000-000000000001";
const employeeB = "10000000-0000-4000-8000-000000000002";

describe("Gate 3 coverage rules", () => {
  it("allows employees only to cancel pending requests", () => {
    expect(canTransitionCoverageRequest("pending", "cancelled", "employee")).toBe(true);
    expect(canTransitionCoverageRequest("pending", "approved", "employee")).toBe(false);
    expect(canTransitionCoverageRequest("approved", "cancelled", "employee")).toBe(false);
  });

  it("allows managers to approve or deny only pending requests", () => {
    expect(canTransitionCoverageRequest("pending", "approved", "manager")).toBe(true);
    expect(canTransitionCoverageRequest("pending", "denied", "manager")).toBe(true);
    expect(canTransitionCoverageRequest("denied", "approved", "manager")).toBe(false);
  });

  it("validates open-shift state and duplicate pending requests", () => {
    expect(openShiftRequestError({
      shiftStatus: "open", scheduleStatus: "published", assignedEmployeeId: null, duplicatePending: false,
    })).toBeNull();
    expect(openShiftRequestError({
      shiftStatus: "open", scheduleStatus: "published", assignedEmployeeId: null, duplicatePending: true,
    })).toContain("pending request already exists");
    expect(openShiftRequestError({
      shiftStatus: "draft", scheduleStatus: "draft", assignedEmployeeId: null, duplicatePending: false,
    })).toContain("not available");
  });

  it("rejects stale, assigned, and already-reviewed open-shift approvals", () => {
    expect(openShiftApprovalError({
      requestStatus: "pending", shiftStatus: "open", scheduleStatus: "published",
      assignedEmployeeId: null, shiftChanged: false,
    })).toBeNull();
    expect(openShiftApprovalError({
      requestStatus: "pending", shiftStatus: "open", scheduleStatus: "published",
      assignedEmployeeId: null, shiftChanged: true,
    })).toContain("changed");
    expect(openShiftApprovalError({
      requestStatus: "approved", shiftStatus: "published", scheduleStatus: "published",
      assignedEmployeeId: employeeA, shiftChanged: true,
    })).toContain("Only pending");
  });

  it("requires a swap to originate from the assigned employee", () => {
    expect(shiftSwapRequestError({
      shiftStatus: "published", scheduleStatus: "published", assignedEmployeeId: employeeA,
      requestingEmployeeId: employeeA, targetEmployeeId: employeeB, duplicatePending: false,
    })).toBeNull();
    expect(shiftSwapRequestError({
      shiftStatus: "published", scheduleStatus: "published", assignedEmployeeId: employeeB,
      requestingEmployeeId: employeeA, targetEmployeeId: employeeB, duplicatePending: false,
    })).toContain("your own");
  });

  it("rejects swap approvals without a target or with unresolved conflicts", () => {
    const valid = {
      requestStatus: "pending" as const, shiftStatus: "published" as const,
      scheduleStatus: "published" as const, assignedEmployeeId: employeeA,
      requestingEmployeeId: employeeA, targetEmployeeId: employeeB,
      shiftChanged: false, hasSchedulingConflicts: false,
    };
    expect(shiftSwapApprovalError(valid)).toBeNull();
    expect(shiftSwapApprovalError({ ...valid, targetEmployeeId: null })).toContain("target employee");
    expect(shiftSwapApprovalError({ ...valid, hasSchedulingConflicts: true })).toContain("conflicts");
  });

  it("accepts a nullable swap target and parses explicit warning override", () => {
    expect(shiftSwapRequestSchema.safeParse({
      organizationId: employeeA, shiftId: employeeB, targetEmployeeId: null,
    }).success).toBe(true);
    expect(coverageApprovalSchema.parse({
      requestId: employeeA, managerNote: "Reviewed", overrideWarnings: "on",
    }).overrideWarnings).toBe(true);
  });

  it("registers all Gate 3 capabilities", () => {
    expect(capabilities).toEqual(expect.arrayContaining([
      "open_shift.view", "open_shift.request", "open_shift.manage",
      "shift_swap.request", "shift_swap.approve",
    ]));
  });
});
