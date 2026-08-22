import type { CrewMember, JobAssignment, JobStatus } from "@/types/database";

export const TERMINAL_JOB_STATUSES: JobStatus[] = ["completed", "cancelled"];

export function isMembershipActiveOn(
  membership: Pick<CrewMember, "effective_from" | "effective_until">,
  date: string,
) {
  return membership.effective_from <= date
    && (membership.effective_until === null || membership.effective_until >= date);
}

export function validateCrewAssignment(active: boolean) {
  if (!active) throw new Error("Inactive crews cannot be assigned to jobs.");
}

export function validateJobWindow(start: string, end: string) {
  if (!start || !end || end <= start) throw new Error("Job end must be after start.");
}

export function canTransitionJobStatus(current: JobStatus, next: JobStatus) {
  const transitions: Record<JobStatus, JobStatus[]> = {
    draft: ["scheduled", "cancelled"],
    scheduled: ["in_progress", "completed", "cancelled"],
    in_progress: ["completed", "cancelled"],
    completed: [],
    cancelled: [],
  };
  return transitions[current].includes(next);
}

export function validateAssignmentTarget(crewId: string | null, employeeId: string | null) {
  if (Number(Boolean(crewId)) + Number(Boolean(employeeId)) !== 1) {
    throw new Error("Choose exactly one crew or employee assignment target.");
  }
}

export function isDuplicateAssignment(
  assignments: Pick<JobAssignment, "crew_id" | "employee_id">[],
  crewId: string | null,
  employeeId: string | null,
) {
  return assignments.some((assignment) => (
    (crewId !== null && assignment.crew_id === crewId)
    || (employeeId !== null && assignment.employee_id === employeeId)
  ));
}

export function employeeCanSeeJob(input: {
  employeeId: string;
  jobDate: string;
  assignments: Pick<JobAssignment, "crew_id" | "employee_id">[];
  memberships: Pick<CrewMember, "crew_id" | "employee_id" | "effective_from" | "effective_until">[];
}) {
  return input.assignments.some((assignment) => (
    assignment.employee_id === input.employeeId
    || (assignment.crew_id !== null && input.memberships.some((membership) => (
      membership.employee_id === input.employeeId
      && membership.crew_id === assignment.crew_id
      && isMembershipActiveOn(membership, input.jobDate)
    )))
  ));
}
