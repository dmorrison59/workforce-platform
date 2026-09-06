export interface PunchLocation {
  latitude: number; longitude: number; accuracyM: number; capturedAt: string;
}
export interface ActiveEntry {
  id: string; clock_in_at: string; location_id: string; shift_id: string | null; location_name: string | null;
}
export interface ClockContext {
  employeeId: string; activeEntry: ActiveEntry | null; latestEntryId: string | null;
  hasOpenBreak: boolean; canUse: boolean; canUseField: boolean; fieldRequired: boolean;
  jobs: { id: string; name: string; location_id: string | null; scheduled_start: string; scheduled_end: string }[];
  locations: { id: string; name: string }[];
}
export interface ClockResult { timeEntryId: string | null; status: string; verificationId?: string }
export interface PendingPunch {
  requestId: string; kind: "in" | "out"; expectedEntryId: string | null;
  locationId: string | null; shiftId: string | null; jobId: string | null;
}
export type PunchArgs = {
  expected_employee_id: string;
  target_organization_id: string; request_id: string;
  submitted_latitude: number | null; submitted_longitude: number | null;
  submitted_accuracy_m: number | null; captured_at: string | null;
};
