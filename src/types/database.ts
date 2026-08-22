export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

type RowTable<Row, Insert = Partial<Row>, Update = Partial<Insert>> = {
  Row: Row;
  Insert: Insert;
  Update: Update;
  Relationships: [];
};

export type MembershipRole = "owner" | "manager" | "employee";
export type MembershipStatus = "active" | "invited" | "suspended";
export type EmploymentStatus = "active" | "inactive" | "terminated";
export type ScheduleStatus = "draft" | "published";
export type ShiftStatus = "draft" | "published" | "open" | "completed" | "cancelled";
export type TimeOffRequestStatus = "pending" | "approved" | "denied" | "cancelled";
export type CoverageRequestStatus = "pending" | "approved" | "denied" | "cancelled";
export type TimeEntryStatus = "open" | "completed" | "corrected" | "cancelled";
export type TimeEntrySource = "employee" | "manager" | "system";
export type TimesheetReviewStatus = "unreviewed" | "approved";
export type JobStatus = "draft" | "scheduled" | "in_progress" | "completed" | "cancelled";
export type FieldClockVerificationStatus = "verified" | "outside_radius" | "low_accuracy" | "not_required" | "overridden";

export interface Profile extends Record<string, unknown> {
  id: string;
  auth_user_id: string;
  first_name: string;
  last_name: string;
  phone: string | null;
  created_at: string;
  updated_at: string;
}

export interface Organization extends Record<string, unknown> {
  id: string;
  name: string;
  slug: string;
  timezone: string;
  created_at: string;
  updated_at: string;
}

export interface OrganizationMembership extends Record<string, unknown> {
  id: string;
  organization_id: string;
  profile_id: string;
  role_id: string;
  membership_role: MembershipRole;
  status: MembershipStatus;
  created_at: string;
  updated_at: string;
}

export interface Employee extends Record<string, unknown> {
  id: string;
  organization_id: string;
  profile_id: string | null;
  employee_number: string | null;
  first_name: string;
  last_name: string;
  email: string;
  phone: string | null;
  employment_status: EmploymentStatus;
  hire_date: string | null;
  created_at: string;
  updated_at: string;
}

export interface EmployeeCompensation extends Record<string, unknown> {
  id: string;
  organization_id: string;
  employee_id: string;
  hourly_rate: number | null;
  created_at: string;
  updated_at: string;
}

export interface Location extends Record<string, unknown> {
  id: string;
  organization_id: string;
  name: string;
  address: string;
  city: string;
  state: string;
  postal_code: string;
  latitude: number | null;
  longitude: number | null;
  active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Department extends Record<string, unknown> {
  id: string;
  organization_id: string;
  location_id: string | null;
  name: string;
  active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Role extends Record<string, unknown> {
  id: string;
  organization_id: string;
  name: string;
  description: string | null;
  is_system: boolean;
  created_at: string;
  updated_at: string;
}

export interface Permission extends Record<string, unknown> {
  id: string;
  capability: string;
  description: string;
  created_at: string;
}

export interface RolePermission extends Record<string, unknown> {
  id: string;
  organization_id: string;
  role_id: string;
  permission_id: string;
  created_at: string;
}

export interface OrganizationModule extends Record<string, unknown> {
  id: string;
  organization_id: string;
  module_key: string;
  enabled: boolean;
  settings_json: Json;
  created_at: string;
  updated_at: string;
}

export interface Schedule extends Record<string, unknown> {
  id: string;
  organization_id: string;
  location_id: string;
  week_start: string;
  status: ScheduleStatus;
  published_at: string | null;
  published_by: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface Shift extends Record<string, unknown> {
  id: string;
  organization_id: string;
  schedule_id: string;
  location_id: string;
  department_id: string;
  role_id: string | null;
  employee_id: string | null;
  start_at: string;
  end_at: string;
  break_minutes: number;
  status: ShiftStatus;
  notes: string;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface EmployeeAvailability extends Record<string, unknown> {
  id: string;
  organization_id: string;
  employee_id: string;
  day_of_week: number;
  available: boolean;
  start_time: string | null;
  end_time: string | null;
  effective_from: string;
  effective_until: string | null;
  created_at: string;
  updated_at: string;
}

export interface TimeOffRequest extends Record<string, unknown> {
  id: string;
  organization_id: string;
  employee_id: string;
  start_date: string;
  end_date: string;
  reason: string;
  status: TimeOffRequestStatus;
  requested_at: string;
  reviewed_by: string | null;
  reviewed_at: string | null;
  manager_note: string;
  created_at: string;
  updated_at: string;
}

export interface OpenShiftRequest extends Record<string, unknown> {
  id: string;
  organization_id: string;
  shift_id: string;
  employee_id: string;
  status: CoverageRequestStatus;
  shift_updated_at: string;
  requested_at: string;
  reviewed_by: string | null;
  reviewed_at: string | null;
  manager_note: string;
  created_at: string;
  updated_at: string;
}

export interface ShiftSwapRequest extends Record<string, unknown> {
  id: string;
  organization_id: string;
  shift_id: string;
  requesting_employee_id: string;
  target_employee_id: string | null;
  status: CoverageRequestStatus;
  shift_updated_at: string;
  requested_at: string;
  approved_by: string | null;
  approved_at: string | null;
  manager_note: string;
  created_at: string;
  updated_at: string;
}

export interface TimeEntry extends Record<string, unknown> {
  id: string;
  organization_id: string;
  employee_id: string;
  shift_id: string | null;
  location_id: string;
  clock_in_at: string;
  clock_out_at: string | null;
  status: TimeEntryStatus;
  source: TimeEntrySource;
  review_status: TimesheetReviewStatus;
  approved_by: string | null;
  approved_at: string | null;
  corrected_by: string | null;
  corrected_at: string | null;
  correction_note: string;
  original_clock_in_at: string | null;
  original_clock_out_at: string | null;
  original_location_id: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface TimeBreak extends Record<string, unknown> {
  id: string;
  organization_id: string;
  time_entry_id: string;
  start_at: string;
  end_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface Crew extends Record<string, unknown> {
  id: string;
  organization_id: string;
  name: string;
  crew_leader_id: string | null;
  active: boolean;
  created_at: string;
  updated_at: string;
}

export interface CrewMember extends Record<string, unknown> {
  id: string;
  organization_id: string;
  crew_id: string;
  employee_id: string;
  effective_from: string;
  effective_until: string | null;
  created_at: string;
  updated_at: string;
}

export interface Job extends Record<string, unknown> {
  id: string;
  organization_id: string;
  customer_name: string;
  job_name: string;
  location_id: string | null;
  address: string;
  scheduled_start: string;
  scheduled_end: string;
  status: JobStatus;
  notes: string;
  latitude: number | null;
  longitude: number | null;
  created_at: string;
  updated_at: string;
}

export interface FieldClockSettings extends Record<string, unknown> {
  id: string;
  organization_id: string;
  enabled: boolean;
  allowed_radius_m: number;
  max_accuracy_m: number;
  manager_override_enabled: boolean;
  created_at: string;
  updated_at: string;
}

export interface FieldClockVerification extends Record<string, unknown> {
  id: string;
  organization_id: string;
  employee_id: string;
  job_id: string;
  time_entry_id: string | null;
  submitted_latitude: number;
  submitted_longitude: number;
  submitted_accuracy_m: number;
  expected_latitude: number;
  expected_longitude: number;
  allowed_radius_m: number;
  calculated_distance_m: number;
  initial_status: FieldClockVerificationStatus;
  status: FieldClockVerificationStatus;
  attempted_at: string;
  overridden_by: string | null;
  overridden_at: string | null;
  override_reason: string;
  created_at: string;
  updated_at: string;
}

export interface JobAssignment extends Record<string, unknown> {
  id: string;
  organization_id: string;
  job_id: string;
  crew_id: string | null;
  employee_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface Database {
  public: {
    Tables: {
      profiles: RowTable<Profile>;
      organizations: RowTable<Organization>;
      organization_memberships: RowTable<OrganizationMembership>;
      employees: RowTable<Employee, Omit<Employee, "id" | "created_at" | "updated_at" | "profile_id"> & { id?: string; profile_id?: string | null; created_at?: string; updated_at?: string }>;
      employee_compensation: RowTable<EmployeeCompensation>;
      locations: RowTable<Location, Omit<Location, "id" | "created_at" | "updated_at" | "latitude" | "longitude" | "active"> & { id?: string; latitude?: number | null; longitude?: number | null; active?: boolean; created_at?: string; updated_at?: string }>;
      departments: RowTable<Department, Omit<Department, "id" | "created_at" | "updated_at" | "location_id" | "active"> & { id?: string; location_id?: string | null; active?: boolean; created_at?: string; updated_at?: string }>;
      roles: RowTable<Role>;
      permissions: RowTable<Permission>;
      role_permissions: RowTable<RolePermission>;
      organization_modules: RowTable<OrganizationModule>;
      schedules: RowTable<Schedule>;
      shifts: RowTable<Shift>;
      employee_availability: RowTable<EmployeeAvailability>;
      time_off_requests: RowTable<TimeOffRequest>;
      open_shift_requests: RowTable<OpenShiftRequest>;
      shift_swap_requests: RowTable<ShiftSwapRequest>;
      time_entries: RowTable<TimeEntry>;
      time_breaks: RowTable<TimeBreak>;
      crews: RowTable<Crew>;
      crew_members: RowTable<CrewMember>;
      jobs: RowTable<Job>;
      job_assignments: RowTable<JobAssignment>;
      field_clock_settings: RowTable<FieldClockSettings>;
      field_clock_verifications: RowTable<FieldClockVerification>;
    };
    Views: { [_ in never]: never };
    Functions: {
      current_profile_id: {
        Args: Record<PropertyKey, never>;
        Returns: string | null;
      };
      create_organization: {
        Args: { organization_name: string; organization_slug: string; organization_timezone: string };
        Returns: string;
      };
      create_employee: {
        Args: {
          target_organization_id: string;
          employee_first_name: string;
          employee_last_name: string;
          employee_email: string;
          employee_phone?: string | null;
          employee_number_value?: string | null;
          employee_status?: EmploymentStatus;
          employee_hire_date?: string | null;
          employee_hourly_rate?: number | null;
        };
        Returns: string;
      };
      has_permission: {
        Args: { target_organization_id: string; requested_capability: string };
        Returns: boolean;
      };
      current_employee_id: {
        Args: { target_organization_id: string };
        Returns: string | null;
      };
      create_weekly_schedule: {
        Args: { target_organization_id: string; target_location_id: string; target_week_start: string };
        Returns: string;
      };
      create_schedule_shift: {
        Args: {
          target_schedule_id: string;
          target_department_id: string;
          target_role_id: string | null;
          target_employee_id: string | null;
          shift_start_local: string;
          shift_end_local: string;
          shift_break_minutes?: number;
          shift_notes?: string;
        };
        Returns: string;
      };
      update_schedule_shift: {
        Args: {
          target_shift_id: string;
          target_department_id: string;
          target_role_id: string | null;
          target_employee_id: string | null;
          shift_start_local: string;
          shift_end_local: string;
          shift_break_minutes: number;
          shift_notes: string;
        };
        Returns: undefined;
      };
      delete_schedule_shift: {
        Args: { target_shift_id: string };
        Returns: undefined;
      };
      assign_schedule_shift: {
        Args: { target_shift_id: string; target_employee_id: string };
        Returns: undefined;
      };
      remove_schedule_shift_employee: {
        Args: { target_shift_id: string };
        Returns: undefined;
      };
      publish_weekly_schedule: {
        Args: { target_schedule_id: string };
        Returns: undefined;
      };
      copy_schedule_shift: {
        Args: { source_shift_id: string; target_local_date: string };
        Returns: string;
      };
      copy_schedule_week: {
        Args: { source_schedule_id: string; target_week_start: string };
        Returns: string;
      };
      save_my_availability: {
        Args: {
          target_organization_id: string;
          availability_day_of_week: number;
          availability_available: boolean;
          availability_start_time: string | null;
          availability_end_time: string | null;
          availability_effective_from: string;
          availability_effective_until?: string | null;
        };
        Returns: string;
      };
      delete_my_availability: {
        Args: { target_availability_id: string };
        Returns: undefined;
      };
      create_my_time_off_request: {
        Args: {
          target_organization_id: string;
          request_start_date: string;
          request_end_date: string;
          request_reason?: string;
        };
        Returns: string;
      };
      cancel_my_time_off_request: {
        Args: { target_request_id: string };
        Returns: undefined;
      };
      review_time_off_request: {
        Args: {
          target_request_id: string;
          review_status: TimeOffRequestStatus;
          review_note?: string;
        };
        Returns: undefined;
      };
      scheduling_mark_shift_open: {
        Args: { target_shift_id: string };
        Returns: undefined;
      };
      create_my_open_shift_request: {
        Args: { target_organization_id: string; target_shift_id: string };
        Returns: string;
      };
      cancel_my_open_shift_request: {
        Args: { target_request_id: string };
        Returns: undefined;
      };
      scheduling_approve_open_shift_request: {
        Args: { target_request_id: string; review_note?: string };
        Returns: undefined;
      };
      review_open_shift_request: {
        Args: {
          target_request_id: string;
          review_status: CoverageRequestStatus;
          review_note?: string;
        };
        Returns: undefined;
      };
      create_my_shift_swap_request: {
        Args: {
          target_organization_id: string;
          target_shift_id: string;
          requested_target_employee_id?: string | null;
        };
        Returns: string;
      };
      cancel_my_shift_swap_request: {
        Args: { target_request_id: string };
        Returns: undefined;
      };
      scheduling_approve_shift_swap: {
        Args: { target_request_id: string; review_note?: string };
        Returns: undefined;
      };
      review_shift_swap_request: {
        Args: {
          target_request_id: string;
          review_status: CoverageRequestStatus;
          review_note?: string;
        };
        Returns: undefined;
      };
      can_view_time_entry: {
        Args: { target_entry_id: string; target_organization_id: string };
        Returns: boolean;
      };
      clock_in: {
        Args: {
          target_organization_id: string;
          target_location_id: string;
          target_shift_id?: string | null;
        };
        Returns: string;
      };
      clock_out: {
        Args: { target_organization_id: string };
        Returns: undefined;
      };
      start_break: {
        Args: { target_organization_id: string };
        Returns: string;
      };
      end_break: {
        Args: { target_organization_id: string };
        Returns: undefined;
      };
      correct_time_entry: {
        Args: {
          target_entry_id: string;
          corrected_location_id: string;
          corrected_clock_in_local: string;
          corrected_clock_out_local: string;
          correction_reason: string;
        };
        Returns: undefined;
      };
      approve_time_entry: {
        Args: { target_entry_id: string };
        Returns: undefined;
      };
      employee_can_view_job: {
        Args: { target_job_id: string; target_organization_id: string; target_scheduled_start: string };
        Returns: boolean;
      };
      field_create_crew: {
        Args: { target_organization_id: string; crew_name: string; target_crew_leader_id?: string | null };
        Returns: string;
      };
      field_update_crew: {
        Args: { target_crew_id: string; crew_name: string; target_crew_leader_id: string | null; crew_active: boolean };
        Returns: undefined;
      };
      field_add_crew_member: {
        Args: { target_crew_id: string; target_employee_id: string; membership_effective_from: string; membership_effective_until?: string | null };
        Returns: string;
      };
      field_end_crew_membership: {
        Args: { target_membership_id: string; membership_effective_until: string };
        Returns: undefined;
      };
      field_create_job: {
        Args: {
          target_organization_id: string;
          target_customer_name: string;
          target_job_name: string;
          target_location_id: string | null;
          target_address: string;
          target_scheduled_start_local: string;
          target_scheduled_end_local: string;
          target_status: JobStatus;
          target_notes?: string;
        };
        Returns: string;
      };
      field_update_job: {
        Args: {
          target_job_id: string;
          target_customer_name: string;
          target_job_name: string;
          target_location_id: string | null;
          target_address: string;
          target_scheduled_start_local: string;
          target_scheduled_end_local: string;
          target_notes: string;
        };
        Returns: undefined;
      };
      field_change_job_status: {
        Args: { target_job_id: string; target_status: JobStatus };
        Returns: undefined;
      };
      field_assign_job: {
        Args: { target_job_id: string; target_crew_id?: string | null; target_employee_id?: string | null };
        Returns: string;
      };
      field_unassign_job: {
        Args: { target_assignment_id: string };
        Returns: undefined;
      };
      field_clock_attempt: {
        Args: {
          target_organization_id: string;
          target_job_id: string;
          target_location_id: string;
          target_shift_id: string | null;
          submitted_latitude: number;
          submitted_longitude: number;
          submitted_accuracy_m: number;
        };
        Returns: Json;
      };
      field_clock_in_with_override: {
        Args: { target_verification_id: string; target_location_id: string; target_shift_id: string | null };
        Returns: string;
      };
      configure_field_clock: {
        Args: {
          target_organization_id: string;
          field_clock_enabled: boolean;
          field_allowed_radius_m: number;
          field_max_accuracy_m: number;
          field_manager_override_enabled: boolean;
        };
        Returns: undefined;
      };
      field_update_job_coordinates: {
        Args: { target_job_id: string; target_latitude: number | null; target_longitude: number | null };
        Returns: undefined;
      };
      override_field_clock_verification: {
        Args: { target_verification_id: string; manager_override_reason: string };
        Returns: undefined;
      };
    };
    Enums: {
      membership_role: MembershipRole;
      membership_status: MembershipStatus;
      employment_status: EmploymentStatus;
      schedule_status: ScheduleStatus;
      shift_status: ShiftStatus;
      time_off_request_status: TimeOffRequestStatus;
      coverage_request_status: CoverageRequestStatus;
      time_entry_status: TimeEntryStatus;
      time_entry_source: TimeEntrySource;
      timesheet_review_status: TimesheetReviewStatus;
      job_status: JobStatus;
      field_clock_verification_status: FieldClockVerificationStatus;
    };
    CompositeTypes: { [_ in never]: never };
  };
}
