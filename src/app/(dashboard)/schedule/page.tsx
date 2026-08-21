import Link from "next/link";
import { redirect } from "next/navigation";
import { MessageBanner } from "@/components/message-banner";
import { PageHeader } from "@/components/page-header";
import { requireOrganization, requireUser } from "@/core/auth/context";
import { hasCapability } from "@/core/permissions/capabilities";
import {
  copyShiftAction,
  copyWeekAction,
  createScheduleAction,
  createShiftAction,
  deleteShiftAction,
  publishScheduleAction,
} from "@/modules/scheduling/actions/actions";
import { ShiftFields } from "@/modules/scheduling/components/shift-fields";
import { addDays, formatShiftTime, formatWeekDay, localDateTimeValue, weekStartFor } from "@/modules/scheduling/lib/dates";

type SearchParams = { week?: string; location?: string; error?: string; message?: string; warning?: string };

export default async function SchedulePage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const context = await requireOrganization();
  if (!(await hasCapability(context.organization.id, "schedule.manage"))) redirect("/my-schedule");
  const canPublish = await hasCapability(context.organization.id, "schedule.publish");
  const { supabase } = await requireUser();
  const params = await searchParams;
  const week = /^\d{4}-\d{2}-\d{2}$/.test(params.week ?? "")
    ? params.week!
    : weekStartFor(new Date(), context.organization.timezone);
  const { data: locations } = await supabase.from("locations").select("*")
    .eq("organization_id", context.organization.id).eq("active", true).order("name");
  const locationId = locations?.some((location) => location.id === params.location)
    ? params.location!
    : locations?.[0]?.id;
  const query = new URLSearchParams({ week });
  if (locationId) query.set("location", locationId);

  if (!locationId) {
    return <><PageHeader title="Schedule" description="Create a location before building a weekly schedule." action={<Link className="button" href="/locations/new">Add location</Link>} /><section className="panel empty">Scheduling requires an active location.</section></>;
  }

  const [{ data: schedule }, { data: departments }, { data: employees }, { data: roles }] = await Promise.all([
    supabase.from("schedules").select("*").eq("organization_id", context.organization.id)
      .eq("location_id", locationId).eq("week_start", week).maybeSingle(),
    supabase.from("departments").select("*").eq("organization_id", context.organization.id)
      .eq("active", true).or(`location_id.eq.${locationId},location_id.is.null`).order("name"),
    supabase.from("employees").select("*").eq("organization_id", context.organization.id)
      .eq("employment_status", "active").order("last_name"),
    supabase.from("roles").select("*").eq("organization_id", context.organization.id).order("name"),
  ]);
  const { data: shifts } = schedule
    ? await supabase.from("shifts").select("*").eq("schedule_id", schedule.id).order("start_at")
    : { data: [] };
  const days = Array.from({ length: 7 }, (_, index) => addDays(week, index));
  const employeeNames = new Map(employees?.map((employee) => [employee.id, `${employee.first_name} ${employee.last_name}`]));
  const departmentNames = new Map(departments?.map((department) => [department.id, department.name]));

  return (
    <>
      <PageHeader title="Weekly schedule" description={`${formatWeekDay(week)} – ${formatWeekDay(addDays(week, 6))}`} />
      <MessageBanner error={params.error} message={params.message} warning={params.warning} />
      <section className="panel schedule-toolbar">
        <div className="button-row">
          <Link className="button ghost" href={`/schedule?location=${locationId}&week=${addDays(week, -7)}`}>Previous week</Link>
          <Link className="button ghost" href={`/schedule?location=${locationId}&week=${addDays(week, 7)}`}>Next week</Link>
          <form method="get" className="location-picker">
            <input type="hidden" name="week" value={week} />
            <label htmlFor="location">Location</label>
            <select id="location" name="location" defaultValue={locationId}>
              {locations?.map((location) => <option key={location.id} value={location.id}>{location.name}</option>)}
            </select>
            <button className="button secondary" type="submit">View</button>
          </form>
        </div>
        {schedule ? <span className={schedule.status === "published" ? "status" : "status off"}>{schedule.status}</span> : null}
      </section>

      {!schedule ? (
        <section className="panel empty">
          <p>No schedule exists for this location and week.</p>
          <form action={createScheduleAction}>
            <input type="hidden" name="organizationId" value={context.organization.id} />
            <input type="hidden" name="locationId" value={locationId} />
            <input type="hidden" name="weekStart" value={week} />
            <input type="hidden" name="returnLocation" value={locationId} />
            <input type="hidden" name="returnWeek" value={week} />
            <button className="button" type="submit">Create draft schedule</button>
          </form>
        </section>
      ) : (
        <>
          <section className="schedule-grid" aria-label="Weekly calendar">
            {days.map((day) => {
              const dayShifts = shifts?.filter((shift) => localDateTimeValue(shift.start_at, context.organization.timezone).startsWith(day)) ?? [];
              return (
                <article className="schedule-day" key={day}>
                  <h2>{formatWeekDay(day)}</h2>
                  {dayShifts.length ? dayShifts.map((shift) => (
                    <div className="shift-card" key={shift.id}>
                      <strong>{formatShiftTime(shift.start_at, context.organization.timezone)} – {formatShiftTime(shift.end_at, context.organization.timezone)}</strong>
                      <span>{shift.employee_id ? employeeNames.get(shift.employee_id) : "Open assignment"}</span>
                      <span className="muted">{departmentNames.get(shift.department_id)} · {shift.break_minutes} min break</span>
                      {shift.notes ? <span className="shift-notes">{shift.notes}</span> : null}
                      <div className="shift-actions">
                        <Link href={`/schedule/shifts/${shift.id}/edit`}>Edit</Link>
                        <form action={deleteShiftAction}>
                          <input type="hidden" name="shiftId" value={shift.id} />
                          <input type="hidden" name="returnLocation" value={locationId} />
                          <input type="hidden" name="returnWeek" value={week} />
                          <button type="submit">Delete</button>
                        </form>
                      </div>
                      <form action={copyShiftAction} className="copy-shift-form">
                        <input type="hidden" name="shiftId" value={shift.id} />
                        <input type="hidden" name="returnLocation" value={locationId} />
                        <input type="hidden" name="returnWeek" value={week} />
                        <label htmlFor={`copy-${shift.id}`}>Copy to</label>
                        <input id={`copy-${shift.id}`} name="targetDate" type="date" min={week} max={addDays(week, 6)} defaultValue={day === addDays(week, 6) ? week : addDays(day, 1)} required />
                        <button type="submit">Copy</button>
                      </form>
                    </div>
                  )) : <p className="empty compact">No shifts</p>}
                </article>
              );
            })}
          </section>

          <section className="section-grid scheduling-forms">
            <div className="panel form-panel">
              <h2>Create shift</h2>
              {departments?.length ? (
                <form action={createShiftAction} className="form-grid">
                  <input type="hidden" name="scheduleId" value={schedule.id} />
                  <input type="hidden" name="returnLocation" value={locationId} />
                  <input type="hidden" name="returnWeek" value={week} />
                  <ShiftFields
                    departments={departments}
                    employees={employees ?? []}
                    roles={roles ?? []}
                    defaults={{ startLocal: `${week}T09:00`, endLocal: `${week}T17:00` }}
                  />
                  <button className="button" type="submit">Create shift</button>
                </form>
              ) : <p className="muted">Create an active department for this location before adding shifts.</p>}
            </div>
            <div className="panel">
              <h2>Schedule actions</h2>
              <p className="muted">Publishing makes assigned shifts visible in each employee’s My Schedule view.</p>
              <div className="form-grid">
                {canPublish ? <form action={publishScheduleAction}>
                  <input type="hidden" name="scheduleId" value={schedule.id} />
                  <input type="hidden" name="returnLocation" value={locationId} />
                  <input type="hidden" name="returnWeek" value={week} />
                  <button className="button" type="submit">Publish schedule</button>
                </form> : null}
                <form action={copyWeekAction} className="form-grid compact-form">
                  <input type="hidden" name="scheduleId" value={schedule.id} />
                  <input type="hidden" name="returnLocation" value={locationId} />
                  <input type="hidden" name="returnWeek" value={week} />
                  <label htmlFor="targetWeekStart">Copy week to</label>
                  <input id="targetWeekStart" name="targetWeekStart" type="date" defaultValue={addDays(week, 7)} required />
                  <button className="button secondary" type="submit">Copy week</button>
                </form>
              </div>
            </div>
          </section>
        </>
      )}
    </>
  );
}
