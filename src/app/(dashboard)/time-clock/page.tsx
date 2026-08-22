import { redirect } from "next/navigation";
import { MessageBanner } from "@/components/message-banner";
import { PageHeader } from "@/components/page-header";
import { requireOrganization, requireUser } from "@/core/auth/context";
import { hasCapability } from "@/core/permissions/capabilities";
import { fieldClockOverrideUseAction } from "@/modules/field-clock/actions/actions";
import { GeolocationClockForm } from "@/modules/field-clock/components/geolocation-clock-form";
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
  const [{ data: entries }, { data: locations }, { data: shifts }, { data: fieldClockSettings }, { data: jobs }, { data: verifications }] = await Promise.all([
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
    supabase.from("field_clock_settings").select("*").eq("organization_id", context.organization.id).maybeSingle(),
    employeeId ? supabase.from("jobs").select("*")
      .eq("organization_id", context.organization.id)
      .in("status", ["scheduled", "in_progress"])
      .not("latitude", "is", null)
      .order("scheduled_start") : Promise.resolve({ data: [] }),
    employeeId ? supabase.from("field_clock_verifications").select("*")
      .eq("organization_id", context.organization.id)
      .eq("employee_id", employeeId)
      .order("attempted_at", { ascending: false })
      .limit(10) : Promise.resolve({ data: [] }),
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
  const jobNames = new Map(jobs?.map((job) => [job.id, job.job_name]));
  const locationOptions = locations?.map((location) => ({ id: location.id, label: location.name })) ?? [];
  const shiftOptions = todayShifts.map((shift) => ({
    id: shift.id,
    label: `${formatShiftTime(shift.start_at, context.organization.timezone)}–${formatShiftTime(shift.end_at, context.organization.timezone)} · ${locationNames.get(shift.location_id)}`,
  }));
  const jobOptions = jobs?.map((job) => ({
    id: job.id,
    label: `${job.job_name} · ${job.address}`,
  })) ?? [];
  const approvedOverride = verifications?.find((verification) => verification.status === "overridden" && !verification.time_entry_id);
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
            {!openEntry && approvedOverride ? <form action={fieldClockOverrideUseAction} className="form-grid clock-in-form">
              <input type="hidden" name="verificationId" value={approvedOverride.id} />
              <p className="correction-note">A manager approved your failed verification for {jobNames.get(approvedOverride.job_id)}. Clock in explicitly to use it.</p>
              <div className="field"><label htmlFor="overrideLocationId">Time-entry location</label><select id="overrideLocationId" name="locationId" required defaultValue={locations?.[0]?.id ?? ""}>{locations?.map((location) => <option key={location.id} value={location.id}>{location.name}</option>)}</select></div>
              <div className="field"><label htmlFor="overrideShiftId">Assigned shift (optional)</label><select id="overrideShiftId" name="shiftId" defaultValue=""><option value="">No scheduled shift</option>{shiftOptions.map((shift) => <option key={shift.id} value={shift.id}>{shift.label}</option>)}</select></div>
              <button className="button clock-primary" type="submit" disabled={!locations?.length}>Clock in with approved override</button>
            </form> : !openEntry && fieldClockSettings?.enabled && jobOptions.length ? <GeolocationClockForm jobs={jobOptions} locations={locationOptions} shifts={shiftOptions} /> : !openEntry ? <form action={clockInAction} className="form-grid clock-in-form">
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

          {fieldClockSettings?.enabled ? <section className="panel today-time">
            <h2>Recent location verifications</h2>
            {verifications?.length ? <ul className="request-list">{verifications.map((verification) => <li key={verification.id}><div className="request-heading"><strong>{jobNames.get(verification.job_id) ?? "Field job"}</strong><span className={verification.status === "outside_radius" || verification.status === "low_accuracy" ? "status warning-status" : "status"}>{verification.status.replaceAll("_", " ")}</span></div><p>{Math.round(verification.calculated_distance_m)} m from the job point · device accuracy {Math.round(verification.submitted_accuracy_m)} m</p>{verification.override_reason ? <p className="muted">Manager override: {verification.override_reason}</p> : null}</li>)}</ul> : <div className="empty">No location verification attempts yet.</div>}
          </section> : null}

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
