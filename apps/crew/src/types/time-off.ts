import type { MobileDatabase } from "./database";

type Row = MobileDatabase["public"]["Tables"]["time_off_requests"]["Row"];

export type CrewTimeOffRequest = Pick<Row,
  "id" | "organization_id" | "employee_id" | "start_date" | "end_date"
  | "reason" | "status" | "requested_at" | "reviewed_at" | "manager_note"
>;

export interface TimeOffDraft {
  startDate: string;
  endDate: string;
  reason: string;
}

export interface TimeOffGroups {
  upcoming: CrewTimeOffRequest[];
  history: CrewTimeOffRequest[];
}
