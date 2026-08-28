import Link from "next/link";
import { PageHeader } from "@/components/page-header";
import { requireOrganization, requireUser } from "@/core/auth/context";
import { orgDayWindow } from "@/core/shared/day-window";
import { summarizeToday } from "@/modules/labor/services/today-summary";

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
  const timeZone = (context.organization as { timezone?: string }).timezone ?? "America/New_York";
  const now = new Date();
  const window = orgDayWindow(timeZone, now);

  const [employees, locations, departments, shiftsRes, entriesRes, openRes, swapRes, compRes] =
    await Promise.all([
      supabase.from("employees").select("id", { count: "exact", head: true }).eq("organization_id", organizationId),
      supabase.from("locations").select("id", { count: "exact", head: true }).eq("organization_id", organizationId),
      supabase.from("departments").select("id", { count: "exact", head: true }).eq("organization_id", organizationId),
      supabase
        .from("shifts")
        .select("id, start_at, end_at, break_minutes, employee_id, status")
        .eq("organization_id", organizationId)
        .lt("start_at", window.end)
        .gt("end_at", window.start),
      supabase
        .from("time_entries")
        .select("id, clock_in_at, clock_out_at, status, employee_id")
        .eq("organization_id", organizationId)
        .lt("clock_in_at", window.end),
      supabase.from("open_shift_requests").select("id, status").eq("organization_id", organizationId).eq("status", "pending"),
      supabase.from("shift_swap_requests").select("id, status").eq("organization_id", organizationId).eq("status", "pending"),
      supabase.from("employee_compensation").select("employee_id, hourly_rate").eq("organization_id", organizationId),
    ]);

  const rates = new Map<string, number>(
    (compRes.data ?? []).map((c) => [c.employee_id, Number(c.hourly_rate)] as [string, number]),
  );
  const today = summarizeToday({
    shifts: shiftsRes.data ?? [],
    timeEntries: entriesRes.data ?? [],
    coverage: [...(openRes.data ?? []), ...(swapRes.data ?? [])],
    rates,
    window,
    now,
  });

  return (
    <>
      <PageHeader title="Dashboard" description={`A secure overview of ${context.organization.name}.`} />
      <section className="stats" aria-label="Today">
        <div className="stat"><span className="muted">On schedule today</span><span className="stat-value">{today.scheduledCount}</span></div>
        <div className="stat"><span className="muted">Clocked in now</span><span className="stat-value">{today.clockedInCount}</span></div>
        <div className="stat"><span className="muted">Unfilled shifts</span><span className="stat-value">{today.unfilledCount}</span></div>
        <div className="stat"><span className="muted">Pending coverage</span><span className="stat-value">{today.pendingCoverageCount}</span></div>
      </section>
      <section className="panel" aria-label="Labor today">
        <h2>Labor today · {window.day}</h2>
        <div className="stats">
          <div className="stat"><span className="muted">Scheduled</span><span className="stat-value compact">{today.scheduledHours}h · ${today.scheduledCost.toFixed(2)}</span></div>
          <div className="stat"><span className="muted">Actual so far</span><span className="stat-value compact">{today.actualHours}h · ${today.actualCost.toFixed(2)}</span></div>
        </div>
      </section>
      <section className="stats" aria-label="Organization totals">
        <DashboardMetricLink href="/employees" label="Employees" value={employees.count ?? 0} />
        <DashboardMetricLink href="/locations" label="Locations" value={locations.count ?? 0} />
        <DashboardMetricLink href="/departments" label="Departments" value={departments.count ?? 0} />
        <div className="stat"><span className="muted">Role</span><span className="stat-value compact">{context.roleName}</span></div>
      </section>
      <section className="section-grid dashboard-actions" aria-label="Dashboard shortcuts">
        <div className="panel">
          <h2>Build your workforce</h2>
          <p className="muted">Use guided onboarding for workplace setup, or keep the quick employee workflow.</p>
          <div className="button-row">
            <Link className="button" href="/employees/onboard">Onboard employee</Link>
            <Link className="button secondary" href="/employees/new">Add employee</Link>
          </div>
        </div>
        <div className="panel">
          <h2>Structure your workplace</h2>
          <p className="muted">Create locations first, then optionally attach departments to them.</p>
          <div className="button-row">
            <Link className="button secondary" href="/locations/new">Add location</Link>
            <Link className="button secondary" href="/departments/new">Add department</Link>
          </div>
        </div>
      </section>
    </>
  );
}