import { redirect } from "next/navigation";
import { MessageBanner } from "@/components/message-banner";
import { PageHeader } from "@/components/page-header";
import { requireOrganization, requireUser } from "@/core/auth/context";
import { hasCapability } from "@/core/permissions/capabilities";
import { formatShiftTime, localDateTimeValue } from "@/modules/scheduling/lib/dates";
import {
  clockInAction,
  clockOutAction,
  endBreakAction,
  startBreakAction,
} from "@/modules/time-clock/actions/actions";
import {
  breakDurationMinutes,
  formatDuration,
  netWorkedMinutes,
} from "@/modules/time-clock/services/calculations";

export default async function TimeClockPage({ searchParams }: { searchParams: Promise<{ error?: string; message?: string }> }) {
  const context = await requireOrganization();
  if (!(await hasCapability(context.organization.id, "timeclock.use"))) redirect("/dashboard");
  const { supabase } = await requireUser();
  const { data: employeeId } = await supabase.rpc("current_employee_id", {
    target_organization_id: context.organization.id,
  });
  const [{ data: entries }, { data: locations }, { data: shifts }] = await Promise.all([
    employeeId ? supabase.from("time_entries").select("*")
      .eq("organization_id", context.organization.id)
      .eq("employee_id", employeeId)
      .order("clock_in_at", { ascending: false }) : Promise.resolve({ data: [] }),
    supabase.from("locations").select("*").eq("organization_id", context.organization.id)
      .eq("active", true).order("name"),
    employeeId ? supabase.from("shifts").select("*")
      .eq("organization_id", context.organization.id)
      .eq("employee_id", employeeId)
      .eq("status", "published")
      .order("start_at") : Promise.resolve({ data: [] }),
  ]);
  const entryIds = entries?.map((entry) => entry.id) ?? [];
  const { data: breaks } = entryIds.length
    ? await supabase.from("time_breaks").select("*").in("time_entry_id", entryIds).order("start_at")
    : { data: [] };
  const now = new Date().toISOString();
  const today = localDateTimeValue(now, context.organization.timezone).slice(0, 10);
  const openEntry = entries?.find((entry) => entry.status === "open");
  const openBreak = breaks?.find((item) => item.time_entry_id === openEntry?.id && !item.end_at);
  const todayEntries = entries?.filter((entry) => (
    localDateTimeValue(entry.clock_in_at, context.organization.timezone).startsWith(today)
    && entry.status !== "open" && entry.status !== "cancelled"
  )) ?? [];
  const todayShifts = shifts?.filter((shift) => (
    localDateTimeValue(shift.start_at, context.organization.timezone).startsWith(today)
  )) ?? [];
  const locationNames = new Map(locations?.map((location) => [location.id, location.name]));
  const messages = await searchParams;

  return (
    <>
      <PageHeader title="Time Clock" description="Record actual worked time without changing your scheduled shift." />
      <MessageBanner error={messages.error} message={messages.message} />
      {!employeeId ? <section className="panel empty">Your login is not linked to an active employee profile.</section> : (
        <section className="time-clock-shell">
          <article className="panel clock-card">
            <span className="eyebrow">Current status</span>
            <h2>{openBreak ? "On break" : openEntry ? "Clocked in" : "Clocked out"}</h2>
            {openEntry ? <div className="clock-details">
              <span>Since {formatShiftTime(openEntry.clock_in_at, context.organization.timezone)}</span>
              <span>{locationNames.get(openEntry.location_id)}</span>
              {openEntry.shift_id ? <span>Linked to scheduled shift</span> : <span>Unscheduled time</span>}
            </div> : null}
            {!openEntry ? <form action={clockInAction} className="form-grid clock-in-form">
              <div className="field">
                <label htmlFor="locationId">Location</label>
                <select id="locationId" name="locationId" required defaultValue={locations?.[0]?.id ?? ""}>
                  {locations?.map((location) => <option key={location.id} value={location.id}>{location.name}</option>)}
                </select>
              </div>
              <div className="field">
                <label htmlFor="shiftId">Assigned shift (optional)</label>
                <select id="shiftId" name="shiftId" defaultValue="">
                  <option value="">No scheduled shift</option>
                  {todayShifts.map((shift) => <option key={shift.id} value={shift.id}>
                    {formatShiftTime(shift.start_at, context.organization.timezone)}–{formatShiftTime(shift.end_at, context.organization.timezone)} · {locationNames.get(shift.location_id)}
                  </option>)}
                </select>
              </div>
              <button className="button clock-primary" type="submit" disabled={!locations?.length}>Clock in</button>
            </form> : <div className="clock-actions">
              {openBreak ? <form action={endBreakAction}><button className="button" type="submit">End break</button></form>
                : <form action={startBreakAction}><button className="button secondary" type="submit">Start break</button></form>}
              {!openBreak ? <form action={clockOutAction}><button className="button ghost" type="submit">Clock out</button></form> : null}
            </div>}
          </article>

          <section className="panel today-time">
            <h2>Today&apos;s completed time</h2>
            {todayEntries.length ? <ul className="request-list">{todayEntries.map((entry) => {
              const entryBreaks = breaks?.filter((item) => item.time_entry_id === entry.id) ?? [];
              return <li key={entry.id}>
                <div className="request-heading"><strong>{formatShiftTime(entry.clock_in_at, context.organization.timezone)}–{entry.clock_out_at ? formatShiftTime(entry.clock_out_at, context.organization.timezone) : "Open"}</strong><span className={`status ${entry.status === "corrected" ? "off" : ""}`}>{entry.status}</span></div>
                <p>{locationNames.get(entry.location_id)} · Break {formatDuration(breakDurationMinutes(entryBreaks))} · Worked {formatDuration(netWorkedMinutes(entry, entryBreaks))}</p>
              </li>;
            })}</ul> : <div className="empty">No completed time entries today.</div>}
          </section>
        </section>
      )}
    </>
  );
}
