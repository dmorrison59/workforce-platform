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

export interface Database {
  public: {
    Tables: {
      profiles: RowTable<Profile>;
      organizations: RowTable<Organization>;
      organization_memberships: RowTable<OrganizationMembership>;
      employees: RowTable<Employee, Omit<Employee, "id" | "created_at" | "updated_at" | "profile_id"> & { id?: string; profile_id?: string | null; created_at?: string; updated_at?: string }>;
      locations: RowTable<Location, Omit<Location, "id" | "created_at" | "updated_at" | "latitude" | "longitude" | "active"> & { id?: string; latitude?: number | null; longitude?: number | null; active?: boolean; created_at?: string; updated_at?: string }>;
      departments: RowTable<Department, Omit<Department, "id" | "created_at" | "updated_at" | "location_id" | "active"> & { id?: string; location_id?: string | null; active?: boolean; created_at?: string; updated_at?: string }>;
      roles: RowTable<Role>;
      organization_modules: RowTable<OrganizationModule>;
      schedules: RowTable<Schedule>;
      shifts: RowTable<Shift>;
      employee_availability: RowTable<EmployeeAvailability>;
      time_off_requests: RowTable<TimeOffRequest>;
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
    };
    Enums: {
      membership_role: MembershipRole;
      membership_status: MembershipStatus;
      employment_status: EmploymentStatus;
      schedule_status: ScheduleStatus;
      shift_status: ShiftStatus;
      time_off_request_status: TimeOffRequestStatus;
    };
    CompositeTypes: { [_ in never]: never };
  };
}
