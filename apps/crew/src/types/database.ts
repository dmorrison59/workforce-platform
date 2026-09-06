import type { Database as WebDatabase } from "@yardclock/database";
import type { ClockContext, ClockResult, PunchArgs } from "./clock";

type PublicSchema = WebDatabase["public"];
export type TimeEntry = PublicSchema["Tables"]["time_entries"]["Row"];
export type TimeBreak = PublicSchema["Tables"]["time_breaks"]["Row"];

// The checked-in web database type predates the invitation RPC. Extend that shared
// contract locally instead of duplicating the application's table definitions.
export type MobileDatabase = {
  public: Omit<PublicSchema, "Functions" | "Tables"> & {
    Tables: Omit<PublicSchema["Tables"], "shifts" | "time_entries" | "field_clock_verifications"> & {
      time_entries: Omit<PublicSchema["Tables"]["time_entries"], "Row"> & {
        Row: PublicSchema["Tables"]["time_entries"]["Row"] & {
          mobile_clock_in_request_id: string | null; mobile_clock_out_request_id: string | null;
          clock_in_latitude: number | null; clock_in_longitude: number | null; clock_in_accuracy_m: number | null; clock_in_captured_at: string | null;
          clock_out_latitude: number | null; clock_out_longitude: number | null; clock_out_accuracy_m: number | null; clock_out_captured_at: string | null;
        };
      };
      field_clock_verifications: Omit<PublicSchema["Tables"]["field_clock_verifications"], "Row"> & {
        Row: PublicSchema["Tables"]["field_clock_verifications"]["Row"] & { mobile_request_id: string | null };
      };
      shifts: Omit<PublicSchema["Tables"]["shifts"], "Relationships"> & {
        // Composite foreign keys from 202608200002_gate1_scheduling.sql.
        // The shared hand-written contract omits relationship metadata.
        Relationships: [
          { foreignKeyName: "shifts_schedule_id_organization_id_location_id_fkey"; columns: ["schedule_id", "organization_id", "location_id"]; isOneToOne: false; referencedRelation: "schedules"; referencedColumns: ["id", "organization_id", "location_id"] },
          { foreignKeyName: "shifts_location_id_organization_id_fkey"; columns: ["location_id", "organization_id"]; isOneToOne: false; referencedRelation: "locations"; referencedColumns: ["id", "organization_id"] },
          { foreignKeyName: "shifts_department_id_organization_id_fkey"; columns: ["department_id", "organization_id"]; isOneToOne: false; referencedRelation: "departments"; referencedColumns: ["id", "organization_id"] },
          { foreignKeyName: "shifts_role_id_organization_id_fkey"; columns: ["role_id", "organization_id"]; isOneToOne: false; referencedRelation: "roles"; referencedColumns: ["id", "organization_id"] },
        ];
      };
    };
    Functions: PublicSchema["Functions"] & {
      mobile_clock_context: { Args: { target_organization_id: string }; Returns: ClockContext };
      mobile_clock_in: { Args: PunchArgs & { expected_latest_entry_id: string | null; target_location_id: string; target_shift_id: string | null; target_job_id: string | null }; Returns: ClockResult };
      mobile_clock_out: { Args: PunchArgs & { expected_entry_id: string }; Returns: string };
      accept_employee_invitation: {
        Args: Record<PropertyKey, never>;
        Returns: string | null;
      };
    };
  };
};
