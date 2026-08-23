import Link from "next/link";
import { redirect } from "next/navigation";
import { MessageBanner } from "@/components/message-banner";
import { PageHeader } from "@/components/page-header";
import { requireOrganization, requireUser } from "@/core/auth/context";
import { hasCapability } from "@/core/permissions/capabilities";
import { weekStartFor } from "@/modules/scheduling/lib/dates";
import { completeOnboardingAction } from "@/modules/onboarding/actions";
import { OnboardingWizard } from "@/modules/onboarding/onboarding-wizard";

export default async function EmployeeOnboardingWizardPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const context = await requireOrganization();
  if (!(await hasCapability(context.organization.id, "employee.manage"))) redirect("/employees");
  const params = await searchParams;

  const { supabase } = await requireUser();
  const [{ data: locations }, { data: departments }, { data: roles }, { data: crews }] = await Promise.all([
    supabase.from("locations").select("*").eq("organization_id", context.organization.id).eq("active", true).order("name"),
    supabase.from("departments").select("*").eq("organization_id", context.organization.id).eq("active", true).order("name"),
    supabase.from("roles").select("*").eq("organization_id", context.organization.id).order("name"),
    supabase.from("crews").select("*").eq("organization_id", context.organization.id).eq("active", true).order("name"),
  ]);

  const now = new Date();
  const defaultToday = new Intl.DateTimeFormat("en-CA", { timeZone: context.organization.timezone }).format(now);

  return (
    <>
      <PageHeader
        title="Add employee — guided setup"
        description="Walk through employee details, address, work setup, app access, and optional crew or first-shift assignment."
        action={<Link className="button ghost" href="/employees/new">Quick add instead</Link>}
      />
      <MessageBanner error={params.error} />
      <OnboardingWizard
        action={completeOnboardingAction}
        organizationTimezone={context.organization.timezone}
        defaultWeekStart={weekStartFor(now, context.organization.timezone)}
        defaultToday={defaultToday}
        locations={locations ?? []}
        departments={departments ?? []}
        roles={roles ?? []}
        crews={crews ?? []}
      />
    </>
  );
}
