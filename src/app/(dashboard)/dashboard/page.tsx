import Link from "next/link";
import { PageHeader } from "@/components/page-header";
import { requireOrganization, requireUser } from "@/core/auth/context";

function DashboardMetricLink({ href, label, value }: { href: string; label: string; value: number }) {
  return (
    <Link className="stat stat-link" href={href}>
      <span className="muted">{label}</span>
      <span className="stat-value">{value}</span>
      <span className="stat-link-label">
        View {label.toLowerCase()}
        <svg aria-hidden="true" viewBox="0 0 16 16">
          <path d="M3.5 8h8.25M8.5 4.75 11.75 8 8.5 11.25" />
        </svg>
      </span>
    </Link>
  );
}

export default async function DashboardPage() {
  const context = await requireOrganization();
  const { supabase } = await requireUser();
  const organizationId = context.organization.id;
  const [employees, locations, departments] = await Promise.all([
    supabase.from("employees").select("id", { count: "exact", head: true }).eq("organization_id", organizationId),
    supabase.from("locations").select("id", { count: "exact", head: true }).eq("organization_id", organizationId),
    supabase.from("departments").select("id", { count: "exact", head: true }).eq("organization_id", organizationId),
  ]);

  return (
    <>
      <PageHeader title="Dashboard" description={`A secure overview of ${context.organization.name}.`} />
      <section className="stats" aria-label="Organization totals">
        <DashboardMetricLink href="/employees" label="Employees" value={employees.count ?? 0} />
        <DashboardMetricLink href="/locations" label="Locations" value={locations.count ?? 0} />
        <DashboardMetricLink href="/departments" label="Departments" value={departments.count ?? 0} />
        <div className="stat"><span className="muted">Role</span><span className="stat-value compact">{context.roleName}</span></div>
      </section>
      <section className="section-grid dashboard-actions" aria-label="Dashboard shortcuts">
        <div className="panel"><h2>Build your workforce</h2><p className="muted">Use guided onboarding for workplace setup, or keep the quick employee workflow.</p><div className="button-row"><Link className="button" href="/employees/onboard">Onboard employee</Link><Link className="button secondary" href="/employees/new">Add employee</Link></div></div>
        <div className="panel"><h2>Structure your workplace</h2><p className="muted">Create locations first, then optionally attach departments to them.</p><div className="button-row"><Link className="button secondary" href="/locations/new">Add location</Link><Link className="button secondary" href="/departments/new">Add department</Link></div></div>
      </section>
    </>
  );
}
