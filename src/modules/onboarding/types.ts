export type AppAccessChoice = "give-now" | "later" | "none";

export type FollowOnState = "success" | "failed" | "skipped" | "pending";

export interface FollowOnResult {
  state: FollowOnState;
  message: string;
}

export interface OnboardingActionState {
  outcome: "idle" | "error" | "complete";
  message: string;
  employeeId?: string;
  employeeName?: string;
  workSetup?: FollowOnResult;
  appAccess?: FollowOnResult;
  crew?: FollowOnResult;
  shift?: FollowOnResult;
  schedulePath?: string;
}

export interface OnboardingOption {
  id: string;
  name: string;
}

export interface OnboardingDepartment extends OnboardingOption {
  locationId: string | null;
}

export interface OnboardingWizardProps {
  canManageWage: boolean;
  canManageCrew: boolean;
  canManageSchedule: boolean;
  crewsEnabled: boolean;
  schedulingEnabled: boolean;
  locations: OnboardingOption[];
  departments: OnboardingDepartment[];
  crews: OnboardingOption[];
  roles: OnboardingOption[];
  today: string;
}
