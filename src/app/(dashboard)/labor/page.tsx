import Link from "next/link";
import { redirect } from "next/navigation";
import { PageHeader } from "@/components/page-header";
import { requireOrganization } from "@/core/auth/context";
import { hasCapability } from "@/core/permissions/capabilities";
import { getWeeklyLaborReport } from "@/modules/labor/services/labor-service";
import type { EmployeeLaborRow } from "@/modules/labor/services/report";
import { addDays, weekStartFor } from "@/modules/scheduling/lib/dates";
import { formatDuration } from "@/modules/time-clock/services/calculations";

type SearchParams = { week?: string; location?: string; department?: string };

function formatCurrency(cents: number | null) {
  return cents === null ? "Unavailable" : new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(cents / 100);
}

function formatRate(rate: number | null) {
  return rate === null ? "Missing wage" : `${new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(rate)}/hr`;
}

function signedDuration(minutes: number) {
  if (minutes === 0) return "0h 0m";
  return `${minutes > 0 ? "+" : "−"}${formatDuration(Math.abs(minutes))}`;
}

function signedCurrency(cents: number | null) {
  if (cents === null) return "Unavailable";
  if (cents === 0) return "$0.00";
  return `${cents > 0 ? "+" : "−"}${formatCurrency(Math.abs(cents))}`;
}

function overtimeLabel(row: EmployeeLaborRow) {
  if (row.actualOvertime.status === "over") return `Actual over 40h by ${formatDuration(row.actualOvertime.overMinutes)}`;
  if (row.scheduledOvertime.status === "over") return `Scheduled over 40h by ${formatDuration(row.scheduledOvertime.overMinutes)}`;
  if (row.actualOvertime.status === "near") return `Actual approaching 40h · ${formatDuration(row.actualOvertime.remainingMinutes)} remaining`;
  if (row.scheduledOvertime.status === "near") return `Scheduled approaching 40h · ${formatDuration(row.scheduledOvertime.remainingMinutes)} remaining`;
  return "Below overtime warning threshold";
}

function laborHref(week: string, locationId?: string, departmentId?: string) {
  const query = new URLSearchParams({ week });
  if (locationId) query.set("location", locationId);
  if (departmentId) query.set("department", departmentId);
  return `/labor?${query}`;
}

export default async function LaborPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const context = await requireOrganization();
  if (!(await hasCapability(context.organization.id, "labor.view"))) redirect("/dashboard");
  const params = await searchParams;
  const week = /^\d{4}-\d{2}-\d{2}$/.test(params.week ?? "")
    ? params.week!
    : weekStartFor(new Date(), context.organization.timezone);
  const data = await getWeeklyLaborReport({
    organizationId: context.organization.id,
    timeZone: context.organization.timezone,
    weekStart: week,
    locationId: params.location,
    departmentId: params.department,
  });
  const { report } = data;

  return (
    <>
      <PageHeader title="Labor" description={`${week} through ${addDays(week, 6)} · Variance is actual minus scheduled.`} />
      <section className="panel labor-toolbar">
        <div className="button-row">
          <Link className="button ghost" href={laborHref(addDays(week, -7), data.selectedLocationId, data.selectedDepartmentId)}>Previous week</Link>
          <Link className="button ghost" href={laborHref(addDays(week, 7), data.selectedLocationId, data.selectedDepartmentId)}>Next week</Link>
        </div>
        <form method="get" className="labor-filters">
          <input type="hidden" name="week" value={week} />
          <div className="field"><label htmlFor="labor-location">Location</label><select id="labor-location" name="location" defaultValue={data.selectedLocationId ?? ""}><option value="">All locations</option>{data.locations.map((location) => <option key={location.id} value={location.id}>{location.name}</option>)}</select></div>
          <div className="field"><label htmlFor="labor-department">Department</label><select id="labor-department" name="department" defaultValue={data.selectedDepartmentId ?? ""}><option value="">All departments</option>{data.departments.map((department) => <option key={department.id} value={department.id}>{department.name}</option>)}</select></div>
          <button className="button secondary" type="submit">Apply filters</button>
        </form>
      </section>

      <section className="labor-metrics" aria-label="Labor totals">
        <article className="panel metric-card"><span>Scheduled hours</span><strong>{formatDuration(report.scheduledMinutes)}</strong></article>
        <article className="panel metric-card"><span>Actual hours</span><strong>{formatDuration(report.actualMinutes)}</strong><small>Includes unapproved completed entries as provisional.</small></article>
        <article className="panel metric-card"><span>Hour variance</span><strong>{signedDuration(report.hourVarianceMinutes)}</strong><small>Actual − scheduled</small></article>
        {data.canViewCosts ? <>
          <article className="panel metric-card"><span>Scheduled labor cost</span><strong>{formatCurrency(report.scheduledCostCents)}</strong>{!report.costDataComplete ? <small>Known subtotal; compensation is incomplete.</small> : null}</article>
          <article className="panel metric-card"><span>Actual labor cost</span><strong>{formatCurrency(report.actualCostCents)}</strong>{!report.costDataComplete ? <small>Known subtotal; compensation is incomplete.</small> : null}</article>
          <article className="panel metric-card"><span>Cost variance</span><strong>{signedCurrency(report.costVarianceCents)}</strong><small>{report.costDataComplete ? "Actual − scheduled" : "Unavailable until wage data is complete"}</small></article>
        </> : <article className="panel metric-card cost-hidden"><span>Labor cost</span><strong>Restricted</strong><small>Requires labor-cost and wage-view capabilities.</small></article>}
      </section>

      {(report.openEntryCount || report.provisionalEntryCount || report.scheduledWithoutActualCount || report.unlinkedActualCount || report.missingCompensationCount || report.unassignedShiftCount) ? <section className="panel labor-attention"><h2>Needs attention</h2><div className="time-metrics">
        {report.openEntryCount ? <span><strong>{report.openEntryCount}</strong> open time {report.openEntryCount === 1 ? "entry" : "entries"}</span> : null}
        {report.provisionalEntryCount ? <span><strong>{report.provisionalEntryCount}</strong> provisional actual {report.provisionalEntryCount === 1 ? "entry" : "entries"}</span> : null}
        {report.scheduledWithoutActualCount ? <span><strong>{report.scheduledWithoutActualCount}</strong> scheduled {report.scheduledWithoutActualCount === 1 ? "shift" : "shifts"} without completed actual time</span> : null}
        {report.unlinkedActualCount ? <span><strong>{report.unlinkedActualCount}</strong> actual {report.unlinkedActualCount === 1 ? "entry" : "entries"} without a linked shift</span> : null}
        {data.canViewCosts && report.missingCompensationCount ? <span><strong>{report.missingCompensationCount}</strong> {report.missingCompensationCount === 1 ? "employee" : "employees"} missing hourly compensation</span> : null}
        {report.unassignedShiftCount ? <span><strong>{report.unassignedShiftCount}</strong> unassigned published {report.unassignedShiftCount === 1 ? "shift" : "shifts"}</span> : null}
      </div><div className="button-row"><Link className="button ghost" href="/schedule">Open Schedule</Link><Link className="button ghost" href="/timesheets">Open Timesheets</Link></div></section> : null}

      <section className="labor-list">
        {report.rows.length ? report.rows.map((row) => <article className="panel labor-row" key={row.employeeId}>
          <div className="request-heading"><div><span className="eyebrow">Employee</span><h2>{row.employeeName}</h2></div><span className={`status ${row.actualOvertime.status === "over" || row.scheduledOvertime.status === "over" ? "off" : ""}`}>{overtimeLabel(row)}</span></div>
          <div className="labor-row-metrics"><span>Scheduled <strong>{formatDuration(row.scheduledMinutes)}</strong></span><span>Actual <strong>{formatDuration(row.actualMinutes)}</strong></span><span>Variance <strong>{signedDuration(row.hourVarianceMinutes)}</strong></span>{data.canViewCosts ? <><span>Rate <strong>{formatRate(row.hourlyRate)}</strong></span><span>Scheduled cost <strong>{formatCurrency(row.scheduledCostCents)}</strong></span><span>Actual cost <strong>{formatCurrency(row.actualCostCents)}</strong></span><span>Cost variance <strong>{signedCurrency(row.costVarianceCents)}</strong></span></> : null}</div>
          <div className="labor-flags">
            {row.missingCompensation ? <span className="status off">Missing wage</span> : null}
            {row.openEntryCount ? <span className="status off">Open time entry</span> : null}
            {row.provisionalEntryCount ? <span className="status off">Provisional actual time</span> : null}
            {row.scheduledWithoutActualCount ? <span className="status off">Scheduled shift without actual</span> : null}
            {row.unlinkedActualCount ? <span className="status off">Unlinked actual time</span> : null}
          </div>
        </article>) : <div className="panel empty">No scheduled or actual labor activity for this week and filter.</div>}
      </section>
      <p className="muted labor-note">Costs use each employee&apos;s current hourly rate. Gate 5 does not maintain historical wage versions, so later rate changes can affect older reports. Overtime is an operational 40-hour weekly warning, not payroll calculation.</p>
    </>
  );
}
