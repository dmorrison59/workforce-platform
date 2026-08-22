import { describe, expect, it } from "vitest";
import {
  canTransitionJobStatus,
  employeeCanSeeJob,
  isDuplicateAssignment,
  isMembershipActiveOn,
  validateAssignmentTarget,
  validateCrewAssignment,
  validateJobWindow,
} from "@/modules/field-operations/validation/rules";
import { jobAssignmentSchema } from "@/modules/field-operations/validation/schemas";

describe("field operations rules", () => {
  it("treats membership effective dates as inclusive", () => {
    const membership = { effective_from: "2026-08-10", effective_until: "2026-08-17" };
    expect(isMembershipActiveOn(membership, "2026-08-10")).toBe(true);
    expect(isMembershipActiveOn(membership, "2026-08-17")).toBe(true);
    expect(isMembershipActiveOn(membership, "2026-08-18")).toBe(false);
  });

  it("supports open-ended membership", () => {
    expect(isMembershipActiveOn({ effective_from: "2026-08-10", effective_until: null }, "2030-01-01")).toBe(true);
  });

  it("rejects inactive crew assignment", () => {
    expect(() => validateCrewAssignment(false)).toThrow("Inactive crews");
    expect(() => validateCrewAssignment(true)).not.toThrow();
  });

  it("requires job end after start", () => {
    expect(() => validateJobWindow("2026-08-22T09:00", "2026-08-22T17:00")).not.toThrow();
    expect(() => validateJobWindow("2026-08-22T17:00", "2026-08-22T09:00")).toThrow("after start");
  });

  it("requires exactly one assignment target", () => {
    expect(() => validateAssignmentTarget("crew", null)).not.toThrow();
    expect(() => validateAssignmentTarget(null, "employee")).not.toThrow();
    expect(() => validateAssignmentTarget(null, null)).toThrow("exactly one");
    expect(() => validateAssignmentTarget("crew", "employee")).toThrow("exactly one");
  });

  it("normalizes an omitted alternate assignment target", () => {
    expect(jobAssignmentSchema.parse({
      jobId: "00000000-0000-4000-8000-000000000001",
      crewId: "00000000-0000-4000-8000-000000000002",
    })).toEqual({
      jobId: "00000000-0000-4000-8000-000000000001",
      crewId: "00000000-0000-4000-8000-000000000002",
      employeeId: null,
    });
  });

  it("detects duplicate crew and employee assignments", () => {
    const assignments = [{ crew_id: "crew-a", employee_id: null }, { crew_id: null, employee_id: "employee-a" }];
    expect(isDuplicateAssignment(assignments, "crew-a", null)).toBe(true);
    expect(isDuplicateAssignment(assignments, null, "employee-a")).toBe(true);
    expect(isDuplicateAssignment(assignments, "crew-b", null)).toBe(false);
  });

  it("allows an employee to see a direct assignment", () => {
    expect(employeeCanSeeJob({
      employeeId: "employee-a", jobDate: "2026-08-22",
      assignments: [{ crew_id: null, employee_id: "employee-a" }], memberships: [],
    })).toBe(true);
  });

  it("allows active crew membership to expose a job", () => {
    expect(employeeCanSeeJob({
      employeeId: "employee-a", jobDate: "2026-08-22",
      assignments: [{ crew_id: "crew-a", employee_id: null }],
      memberships: [{ crew_id: "crew-a", employee_id: "employee-a", effective_from: "2026-08-01", effective_until: null }],
    })).toBe(true);
  });

  it("does not expose crew jobs outside the membership period", () => {
    expect(employeeCanSeeJob({
      employeeId: "employee-a", jobDate: "2026-08-22",
      assignments: [{ crew_id: "crew-a", employee_id: null }],
      memberships: [{ crew_id: "crew-a", employee_id: "employee-a", effective_from: "2026-07-01", effective_until: "2026-07-31" }],
    })).toBe(false);
  });

  it("does not expose unrelated jobs", () => {
    expect(employeeCanSeeJob({
      employeeId: "employee-b", jobDate: "2026-08-22",
      assignments: [{ crew_id: null, employee_id: "employee-a" }], memberships: [],
    })).toBe(false);
  });

  it("allows only operational forward status transitions", () => {
    expect(canTransitionJobStatus("draft", "scheduled")).toBe(true);
    expect(canTransitionJobStatus("scheduled", "in_progress")).toBe(true);
    expect(canTransitionJobStatus("in_progress", "completed")).toBe(true);
    expect(canTransitionJobStatus("scheduled", "draft")).toBe(false);
  });

  it("keeps completed and cancelled jobs terminal", () => {
    expect(canTransitionJobStatus("completed", "scheduled")).toBe(false);
    expect(canTransitionJobStatus("cancelled", "scheduled")).toBe(false);
  });
});
