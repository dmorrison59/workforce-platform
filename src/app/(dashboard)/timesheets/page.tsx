import Link from "next/link";
import { redirect } from "next/navigation";
import { MessageBanner } from "@/components/message-banner";
import { PageHeader } from "@/components/page-header";
import { requireOrganization, requireUser } from "@/core/auth/context";
import { hasCapability } from "@/core/permissions/capabilities";
import { addDays, formatShiftDate, formatShiftTime, localDateTimeValue, weekStartFor } from "@/modules/scheduling/lib/dates";
import { approveTimeEntryAction, correctTimeEntryAction } from "@/modules/time-clock/actions/actions";
import {
  breakDurationMinutes,
  formatDuration,
  grossDurationMinutes,
  netWorkedMinutes,
  weeklyWorkedMinutes,
} from "@/modules/time-clock/services/calculations";

export default async function TimesheetsPage({ searchParams }: { searchParams: Promise<{ week?: string; error?: string; message?: string }> }) {
  const context = await requireOrganization();
  if (!(await hasCapability(context.organization.id, "timeclock.view"))) redirect("/my-timesheet");
  const { supabase } = await requireUser();
  const params = await searchParams;
  const week = /^\d{4}-\d{2}-\d{2}$/.test(params.week ?? "")
    ? params.week!
    : weekStartFor(new Date(), context.organization.timezone);
  const weekEnd = addDays(week, 7);
  const [{ data: allEntries }, { data: employees }, { data: locations }, { data: shifts }, { data: profiles }] = await Promise.all([
    supabase.from("time_entries").select("*").eq("organization_id", context.organization.id).order("clock_in_at"),
    supabase.from("employees").select("*").eq("organization_id", context.organization.id).order("last_name"),
    supabase.from("locations").select("*").eq("organization_id", context.organization.id).order("name"),
    supabase.from("shifts").select("*").eq("organization_id", context.organization.id),
    supabase.from("profiles").select("*").order("last_name"),
  ]);
  const entries = allEntries?.filter((entry) => {
    const date = localDateTimeValue(entry.clock_in_at, context.organization.timezone).slice(0, 10);
    return date >= week && date < weekEnd;
  }) ?? [];
  const { data: breaks } = entries.length
    ? await supabase.from("time_breaks").select("*").in("time_entry_id", entries.map((entry) => entry.id))
    : { data: [] };
  const employeeNames = new Map(employees?.map((employee) => [employee.id, `${employee.first_name} ${employee.last_name}`]));
  const locationNames = new Map(locations?.map((location) => [location.id, location.name]));
  const shiftById = new Map(shifts?.map((shift) => [shift.id, shift]));
  const profileNames = new Map(profiles?.map((profile) => [profile.id, `${profile.first_name} ${profile.last_name}`.trim()]));
  const totalsByEmployee = new Map(employees?.map((employee) => [employee.id, weeklyWorkedMinutes(
    entries.filter((entry) => entry.employee_id === employee.id), breaks ?? [],
  )]));

  return (
    <>
      <PageHeader title="Weekly Timesheets" description={`${week} through ${addDays(week, 6)}`} />
      <MessageBanner error={params.error} message={params.message} />
<div className="button-row timesheet-nav">
  <Link className="button ghost" href={`/timesheets?week=${addDays(week, -7)}`}>Previous week</Link>
  <Link className="button ghost" href={`/timesheets?week=${addDays(week, 7)}`}>Next week</Link>
  <a className="button secondary" href={`/api/timesheets/export?week=${week}`} download>Download CSV</a>
</div>
      {employees?.length ? <section className="panel weekly-totals"><h2>Weekly totals</h2><div className="time-metrics">{employees.map((employee) => <span key={employee.id}>{employee.first_name} {employee.last_name} <strong>{formatDuration(totalsByEmployee.get(employee.id) ?? 0)}</strong></span>)}</div></section> : null}
      <section className="timesheet-list manager-timesheets">
        {entries.length ? entries.map((entry) => {
          const entryBreaks = breaks?.filter((item) => item.time_entry_id === entry.id) ?? [];
          const shift = entry.shift_id ? shiftById.get(entry.shift_id) : null;
          return <article className="panel time-entry-card" key={entry.id}>
            <div className="request-heading"><div><span className="eyebrow">{employeeNames.get(entry.employee_id)}</span><h2>{formatShiftTime(entry.clock_in_at, context.organization.timezone)}–{entry.clock_out_at ? formatShiftTime(entry.clock_out_at, context.organization.timezone) : "Open / incomplete"}</h2></div><div className="button-row"><span className={`status ${entry.status === "completed" ? "" : "off"}`}>{entry.status}</span><span className={`status ${entry.review_status === "approved" ? "" : "off"}`}>{entry.review_status}</span></div></div>
            <div className="time-metrics"><span>Gross <strong>{formatDuration(grossDurationMinutes(entry))}</strong></span><span>Breaks <strong>{formatDuration(breakDurationMinutes(entryBreaks))}</strong></span><span>Net <strong>{formatDuration(netWorkedMinutes(entry, entryBreaks))}</strong></span></div>
            <p className="muted">Actual: {locationNames.get(entry.location_id)} · {shift ? `Scheduled ${formatShiftTime(shift.start_at, context.organization.timezone)}–${formatShiftTime(shift.end_at, context.organization.timezone)}` : "No linked shift"}</p>
            {entry.corrected_at ? <p className="correction-note">Corrected by {profileNames.get(entry.corrected_by ?? "") || "manager"} on {formatShiftDate(entry.corrected_at, context.organization.timezone)} at {formatShiftTime(entry.corrected_at, context.organization.timezone)}: {entry.correction_note}</p> : null}
            <form action={correctTimeEntryAction} className="form-grid correction-form">
              <input type="hidden" name="entryId" value={entry.id} />
              <div className="two-col">
                <div className="field"><label htmlFor={`in-${entry.id}`}>Corrected clock-in</label><input id={`in-${entry.id}`} name="clockInLocal" type="datetime-local" defaultValue={localDateTimeValue(entry.clock_in_at, context.organization.timezone)} required /></div>
                <div className="field"><label htmlFor={`out-${entry.id}`}>Corrected clock-out</label><input id={`out-${entry.id}`} name="clockOutLocal" type="datetime-local" defaultValue={entry.clock_out_at ? localDateTimeValue(entry.clock_out_at, context.organization.timezone) : localDateTimeValue(new Date().toISOString(), context.organization.timezone)} required /></div>
              </div>
              <div className="field"><label htmlFor={`location-${entry.id}`}>Corrected location</label><select id={`location-${entry.id}`} name="locationId" defaultValue={entry.location_id} required>{locations?.map((location) => <option key={location.id} value={location.id}>{location.name}</option>)}</select></div>
              <div className="field"><label htmlFor={`note-${entry.id}`}>Correction reason</label><textarea id={`note-${entry.id}`} name="correctionNote" rows={2} maxLength={2000} required /></div>
              <button className="button secondary" type="submit">Save correction</button>
            </form>
            {entry.status !== "open" && entry.status !== "cancelled" && entry.review_status !== "approved" ? <form action={approveTimeEntryAction}>
              <input type="hidden" name="entryId" value={entry.id} />
              <button className="button" type="submit">Approve time entry</button>
            </form> : null}
          </article>;
        }) : <div className="panel empty">No time entries for this week.</div>}
      </section>
    </>
  );
}
