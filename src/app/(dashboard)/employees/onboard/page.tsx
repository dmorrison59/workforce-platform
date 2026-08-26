import { redirect } from "next/navigation";
import { PageHeader } from "@/components/page-header";
import { requireOrganization, requireUser } from "@/core/auth/context";
import { hasCapability } from "@/core/permissions/capabilities";
import { OnboardingWizard } from "@/modules/onboarding/components/onboarding-wizard";

function localDate(timeZone: string) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

export default async function OnboardEmployeePage() {
  const context = await requireOrganization();
  const organizationId = context.organization.id;
  const [canManageEmployees, canManageWage, canManageCrew, canManageSchedule] = await Promise.all([
    hasCapability(organizationId, "employee.manage"),
    hasCapability(organizationId, "employee_wage.manage"),
    hasCapability(organizationId, "crew.manage"),
    hasCapability(organizationId, "schedule.manage"),
  ]);
  if (!canManageEmployees) redirect("/employees");

  const { supabase } = await requireUser();
  const [locationsResult, departmentsResult, rolesResult, modulesResult, crewsResult] = await Promise.all([
    supabase.from("locations").select("id,name").eq("organization_id", organizationId).eq("active", true).order("name"),
    supabase.from("departments").select("id,name,location_id").eq("organization_id", organizationId).eq("active", true).order("name"),
    supabase.from("roles").select("id,name").eq("organization_id", organizationId).order("name"),
    supabase.from("organization_modules").select("module_key,enabled").eq("organization_id", organizationId)
      .in("module_key", ["crews", "scheduling"]),
    canManageCrew
      ? supabase.from("crews").select("id,name").eq("organization_id", organizationId).eq("active", true).order("name")
      : Promise.resolve({ data: [] }),
  ]);
  const enabledModules = new Set(modulesResult.data?.filter((module) => module.enabled).map((module) => module.module_key));

  return (
    <>
      <PageHeader
        title="Onboard employee"
        description="Guide a new hire from employee details through optional crew and draft-schedule setup."
      />
      <OnboardingWizard
        canManageWage={canManageWage}
        canManageCrew={canManageCrew}
        canManageSchedule={canManageSchedule}
        crewsEnabled={enabledModules.has("crews")}
        schedulingEnabled={enabledModules.has("scheduling")}
        locations={locationsResult.data ?? []}
        departments={(departmentsResult.data ?? []).map((department) => ({
          id: department.id,
          name: department.name,
          locationId: department.location_id,
        }))}
        crews={crewsResult.data ?? []}
        roles={rolesResult.data ?? []}
        today={localDate(context.organization.timezone)}
      />
    </>
  );
}
