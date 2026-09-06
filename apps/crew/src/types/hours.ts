import type { MobileDatabase } from "./database";

type Tables = MobileDatabase["public"]["Tables"];
type EntryRow = Tables["time_entries"]["Row"];
type BreakRow = Tables["time_breaks"]["Row"];

export type CrewHoursEntry = Pick<EntryRow,
  "id" | "organization_id" | "employee_id" | "shift_id" | "location_id"
  | "clock_in_at" | "clock_out_at" | "status" | "review_status" | "corrected_at"
  | "clock_in_captured_at" | "clock_out_captured_at"
>;

export type CrewHoursBreak = Pick<BreakRow,
  "id" | "organization_id" | "time_entry_id" | "start_at" | "end_at"
>;

export interface CrewHoursData {
  weekStart: string;
  entries: CrewHoursEntry[];
  breaks: CrewHoursBreak[];
  locationNames: Record<string, string>;
  shifts: Record<string, { start_at: string; end_at: string }>;
}
