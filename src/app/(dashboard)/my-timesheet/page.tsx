import Link from "next/link";
import { redirect } from "next/navigation";
import { PageHeader } from "@/components/page-header";
import { requireOrganization, requireUser } from "@/core/auth/context";
import { hasCapability } from "@/core/permissions/capabilities";
import { addDays, formatShiftDate, formatShiftTime, localDateTimeValue, weekStartFor } from "@/modules/scheduling/lib/dates";
import {
  breakDurationMinutes,
  formatDuration,
  grossDurationMinutes,
  netWorkedMinutes,
  weeklyWorkedMinutes,
} from "@/modules/time-clock/services/calculations";

export default async function MyTimesheetPage({ searchParams }: { searchParams: Promise<{ week?: string }> }) {
  const context = await requireOrganization();
  if (!(await hasCapability(context.organization.id, "timeclock.view_self"))) redirect("/dashboard");
  const { supabase } = await requireUser();
  const params = await searchParams;
  const week = /^\d{4}-\d{2}-\d{2}$/.test(params.week ?? "")
    ? params.week!
    : weekStartFor(new Date(), context.organization.timezone);
  const weekEnd = addDays(week, 7);
  const { data: employeeId } = await supabase.rpc("current_employee_id", {
    target_organization_id: context.organization.id,
  });
  const [{ data: allEntries }, { data: locations }, { data: shifts }] = await Promise.all([
    employeeId ? supabase.from("time_entries").select("*")
      .eq("organization_id", context.organization.id)
      .eq("employee_id", employeeId)
      .order("clock_in_at") : Promise.resolve({ data: [] }),
    supabase.from("locations").select("*").eq("organization_id", context.organization.id),
    supabase.from("shifts").select("*").eq("organization_id", context.organization.id),
  ]);
  const entries = allEntries?.filter((entry) => {
    const date = localDateTimeValue(entry.clock_in_at, context.organization.timezone).slice(0, 10);
    return date >= week && date < weekEnd;
  }) ?? [];
  const { data: breaks } = entries.length
    ? await supabase.from("time_breaks").select("*").in("time_entry_id", entries.map((entry) => entry.id))
    : { data: [] };
  const locationNames = new Map(locations?.map((location) => [location.id, location.name]));
  const shiftById = new Map(shifts?.map((shift) => [shift.id, shift]));

  return (
    <>
      <PageHeader title="My Timesheet" description={`${week} through ${addDays(week, 6)} · ${formatDuration(weeklyWorkedMinutes(entries, breaks ?? []))} worked`} />
      <div className="button-row timesheet-nav"><Link className="button ghost" href={`/my-timesheet?week=${addDays(week, -7)}`}>Previous week</Link><Link className="button ghost" href={`/my-timesheet?week=${addDays(week, 7)}`}>Next week</Link></div>
      <section className="timesheet-list">
        {entries.length ? entries.map((entry) => {
          const entryBreaks = breaks?.filter((item) => item.time_entry_id === entry.id) ?? [];
          const shift = entry.shift_id ? shiftById.get(entry.shift_id) : null;
          return <article className="panel time-entry-card" key={entry.id}>
            <div className="request-heading"><div><span className="eyebrow">{formatShiftDate(entry.clock_in_at, context.organization.timezone)}</span><h2>{formatShiftTime(entry.clock_in_at, context.organization.timezone)}–{entry.clock_out_at ? formatShiftTime(entry.clock_out_at, context.organization.timezone) : "Open"}</h2></div><div className="button-row"><span className={`status ${entry.status === "completed" ? "" : "off"}`}>{entry.status}</span><span className={`status ${entry.review_status === "approved" ? "" : "off"}`}>{entry.review_status}</span></div></div>
            <div className="time-metrics"><span>Gross <strong>{formatDuration(grossDurationMinutes(entry))}</strong></span><span>Breaks <strong>{formatDuration(breakDurationMinutes(entryBreaks))}</strong></span><span>Net <strong>{formatDuration(netWorkedMinutes(entry, entryBreaks))}</strong></span></div>
            <p className="muted">{locationNames.get(entry.location_id)} · {shift ? `Scheduled ${formatShiftTime(shift.start_at, context.organization.timezone)}–${formatShiftTime(shift.end_at, context.organization.timezone)}` : "No linked shift"}</p>
            {entry.correction_note ? <p className="correction-note">Correction: {entry.correction_note}</p> : null}
          </article>;
        }) : <div className="panel empty">No time entries for this week.</div>}
      </section>
    </>
  );
}
