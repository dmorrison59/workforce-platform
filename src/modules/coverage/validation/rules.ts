import type { CoverageRequestStatus, ScheduleStatus, ShiftStatus } from "@/types/database";

export function canTransitionCoverageRequest(
  current: CoverageRequestStatus,
  next: CoverageRequestStatus,
  actor: "employee" | "manager",
) {
  if (current !== "pending") return false;
  return actor === "employee" ? next === "cancelled" : next === "approved" || next === "denied";
}

export function openShiftRequestError(input: {
  shiftStatus: ShiftStatus;
  scheduleStatus: ScheduleStatus;
  assignedEmployeeId: string | null;
  duplicatePending: boolean;
}) {
  if (input.duplicatePending) return "A pending request already exists for this shift.";
  if (input.shiftStatus !== "open" || input.scheduleStatus !== "published" || input.assignedEmployeeId) {
    return "Open shift is not available to request.";
  }
  return null;
}

export function openShiftApprovalError(input: {
  requestStatus: CoverageRequestStatus;
  shiftStatus: ShiftStatus;
  scheduleStatus: ScheduleStatus;
  assignedEmployeeId: string | null;
  shiftChanged: boolean;
}) {
  if (input.requestStatus !== "pending") return "Only pending open-shift requests can be approved.";
  if (input.shiftChanged || input.shiftStatus !== "open" || input.scheduleStatus !== "published" || input.assignedEmployeeId) {
    return "Open shift changed after the request was submitted.";
  }
  return null;
}

export function shiftSwapRequestError(input: {
  shiftStatus: ShiftStatus;
  scheduleStatus: ScheduleStatus;
  assignedEmployeeId: string | null;
  requestingEmployeeId: string;
  targetEmployeeId: string | null;
  duplicatePending: boolean;
}) {
  if (input.duplicatePending) return "A pending swap request already exists for this shift.";
  if (input.shiftStatus !== "published" || input.scheduleStatus !== "published"
      || input.assignedEmployeeId !== input.requestingEmployeeId) {
    return "Only your own upcoming published shift can be swapped.";
  }
  if (input.targetEmployeeId === input.requestingEmployeeId) {
    return "Swap target must be another active employee in the organization.";
  }
  return null;
}

export function shiftSwapApprovalError(input: {
  requestStatus: CoverageRequestStatus;
  shiftStatus: ShiftStatus;
  scheduleStatus: ScheduleStatus;
  assignedEmployeeId: string | null;
  requestingEmployeeId: string;
  targetEmployeeId: string | null;
  shiftChanged: boolean;
  hasSchedulingConflicts: boolean;
}) {
  if (input.requestStatus !== "pending") return "Only pending swap requests can be approved.";
  if (!input.targetEmployeeId) return "A target employee is required before a swap can be approved.";
  if (input.shiftChanged || input.shiftStatus !== "published" || input.scheduleStatus !== "published"
      || input.assignedEmployeeId !== input.requestingEmployeeId) {
    return "Assigned shift changed after the swap was requested.";
  }
  if (input.hasSchedulingConflicts) return "Scheduling conflicts must be resolved or explicitly overridden.";
  return null;
}
