import type {
  Employee,
  MembershipRole,
  Organization,
} from "@yardclock/database";

export const crewCapabilities = [
  "schedule.view",
  "timeclock.use",
  "timeclock.view_self",
  "timeoff.request",
  "timeoff.view_self",
  "job.view",
  "field_clock.use",
] as const;

export type CrewCapability = (typeof crewCapabilities)[number];

export interface CrewContext {
  user: {
    id: string;
    email: string | null;
  };
  organization: Pick<Organization, "id" | "name" | "timezone">;
  employee: Pick<Employee, "id" | "first_name" | "last_name" | "employment_status">;
  role: {
    id: string;
    name: string;
    membershipRole: MembershipRole;
  };
  permissions: Record<CrewCapability, boolean>;
}
