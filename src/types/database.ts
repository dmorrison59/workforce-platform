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
    };
    Views: { [_ in never]: never };
    Functions: {
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
    };
    Enums: {
      membership_role: MembershipRole;
      membership_status: MembershipStatus;
      employment_status: EmploymentStatus;
    };
    CompositeTypes: { [_ in never]: never };
  };
}
