import Link from "next/link";
import { PageHeader } from "@/components/page-header";
import { requireOrganization, requireUser } from "@/core/auth/context";

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
        <div className="stat"><span className="muted">Employees</span><span className="stat-value">{employees.count ?? 0}</span></div>
        <div className="stat"><span className="muted">Locations</span><span className="stat-value">{locations.count ?? 0}</span></div>
        <div className="stat"><span className="muted">Departments</span><span className="stat-value">{departments.count ?? 0}</span></div>
        <div className="stat"><span className="muted">Role</span><span className="stat-value" style={{ fontSize: "1.35rem" }}>{context.roleName}</span></div>
      </section>
      <section className="section-grid">
        <div className="panel"><h2>Build your workforce</h2><p className="muted">Add employees without requiring them to have login accounts.</p><Link className="button" href="/employees/new">Add employee</Link></div>
        <div className="panel"><h2>Structure your workplace</h2><p className="muted">Create locations first, then optionally attach departments to them.</p><div className="button-row"><Link className="button secondary" href="/locations/new">Add location</Link><Link className="button secondary" href="/departments/new">Add department</Link></div></div>
      </section>
    </>
  );
}
