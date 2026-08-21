import type { EmployeeAvailability, TimeOffRequest } from "@/types/database";

type AvailabilityInput = Pick<EmployeeAvailability,
  "day_of_week" | "available" | "start_time" | "end_time" | "effective_from" | "effective_until">;
type TimeOffInput = Pick<TimeOffRequest, "start_date" | "end_date" | "status">;

export interface AssignmentConflictInput {
  startLocal: string;
  endLocal: string;
  availability: AvailabilityInput[];
  timeOffRequests: TimeOffInput[];
}

function isoDayOfWeek(date: string) {
  const day = new Date(`${date}T12:00:00Z`).getUTCDay();
  return day === 0 ? 7 : day;
}

function dayName(day: number) {
  return ["", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"][day];
}

export function getAvailabilityConflicts(input: AssignmentConflictInput) {
  const shiftDate = input.startLocal.slice(0, 10);
  const shiftEndDate = input.endLocal.slice(0, 10);
  const day = isoDayOfWeek(shiftDate);
  const rule = input.availability
    .filter((item) => item.day_of_week === day
      && item.effective_from <= shiftDate
      && (!item.effective_until || item.effective_until >= shiftDate))
    .sort((a, b) => b.effective_from.localeCompare(a.effective_from))[0];
  if (!rule) return [];
  if (!rule.available) return [`Employee is marked unavailable on ${dayName(day)}.`];
  const startTime = input.startLocal.slice(11, 16);
  const endTime = input.endLocal.slice(11, 16);
  if (shiftEndDate !== shiftDate || !rule.start_time || !rule.end_time
      || startTime < rule.start_time.slice(0, 5) || endTime > rule.end_time.slice(0, 5)) {
    return [`Shift falls outside the employee's ${dayName(day)} availability (${rule.start_time?.slice(0, 5)}–${rule.end_time?.slice(0, 5)}).`];
  }
  return [];
}

export function getApprovedTimeOffConflicts(input: AssignmentConflictInput) {
  const shiftStartDate = input.startLocal.slice(0, 10);
  const shiftEndDate = input.endLocal.slice(0, 10);
  return input.timeOffRequests
    .filter((request) => request.status === "approved"
      && request.start_date <= shiftEndDate
      && request.end_date >= shiftStartDate)
    .map((request) => `Approved time off overlaps this shift (${request.start_date} to ${request.end_date}).`);
}

export function getShiftAssignmentWarnings(input: AssignmentConflictInput) {
  return [...getAvailabilityConflicts(input), ...getApprovedTimeOffConflicts(input)];
}

