import { localDateTimeValue } from "@/lib/schedule-presentation";
import type { CrewTimeOffRequest, TimeOffDraft, TimeOffGroups } from "@/types/time-off";

export const timeOffStatus = {
  pending: { label: "Pending", detail: "Waiting for manager review" },
  approved: { label: "Approved", detail: "Approved by your manager" },
  denied: { label: "Denied", detail: "Not approved" },
  cancelled: { label: "Cancelled", detail: "This request was cancelled" },
} as const;

function isCalendarDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

export function organizationToday(now: Date, timeZone: string) {
  return localDateTimeValue(now.toISOString(), timeZone).slice(0, 10);
}

export function validateTimeOffDraft(draft: TimeOffDraft) {
  if (!draft.startDate.trim()) return "Start date is required.";
  if (!isCalendarDate(draft.startDate)) return "Enter the start date as YYYY-MM-DD.";
  if (!draft.endDate.trim()) return "End date is required.";
  if (!isCalendarDate(draft.endDate)) return "Enter the end date as YYYY-MM-DD.";
  if (draft.endDate < draft.startDate) return "End date must be on or after the start date.";
  if (draft.reason.trim().length > 2000) return "Reason must be 2,000 characters or fewer.";
  return null;
}

function formatDate(date: string, options: Intl.DateTimeFormatOptions = {}) {
  return new Intl.DateTimeFormat("en-US", {
    weekday: "long", month: "short", day: "numeric", year: "numeric", timeZone: "UTC", ...options,
  }).format(new Date(`${date}T12:00:00Z`));
}

export function formatTimeOffRange(startDate: string, endDate: string) {
  if (startDate === endDate) return formatDate(startDate);
  return `${formatDate(startDate)} through ${formatDate(endDate)}`;
}

export function formatDecisionDate(value: string | null, timeZone: string) {
  if (!value || !Number.isFinite(Date.parse(value))) return null;
  return new Intl.DateTimeFormat("en-US", {
    month: "short", day: "numeric", year: "numeric", timeZone,
  }).format(new Date(value));
}

export function groupTimeOffRequests(requests: CrewTimeOffRequest[], today: string): TimeOffGroups {
  const upcoming = requests.filter((request) => request.end_date >= today && request.status !== "cancelled")
    .sort((a, b) => a.start_date.localeCompare(b.start_date)
      || b.requested_at.localeCompare(a.requested_at) || a.id.localeCompare(b.id));
  const history = requests.filter((request) => request.end_date < today || request.status === "cancelled")
    .sort((a, b) => b.end_date.localeCompare(a.end_date)
      || b.requested_at.localeCompare(a.requested_at) || a.id.localeCompare(b.id));
  return { upcoming, history };
}

export function canCancelTimeOff(request: CrewTimeOffRequest) {
  return request.status === "pending";
}

export function cancellationPrompt(request: CrewTimeOffRequest) {
  return `Cancel your request for ${formatTimeOffRange(request.start_date, request.end_date)}?`;
}

export function timeOffActionState(submitting: boolean, cancellingId: string | null, requestId?: string) {
  return {
    actionsDisabled: submitting || cancellingId !== null,
    submissionLoading: submitting,
    cancellationLoading: Boolean(requestId && cancellingId === requestId),
  };
}
