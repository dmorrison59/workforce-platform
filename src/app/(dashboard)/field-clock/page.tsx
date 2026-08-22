import { redirect } from "next/navigation";
import { MessageBanner } from "@/components/message-banner";
import { PageHeader } from "@/components/page-header";
import { requireOrganization, requireUser } from "@/core/auth/context";
import { hasCapability } from "@/core/permissions/capabilities";
import {
  configureFieldClockAction,
  overrideFieldClockAction,
} from "@/modules/field-clock/actions/actions";
import { formatShiftDate, formatShiftTime } from "@/modules/scheduling/lib/dates";

const labels = {
  verified: "Verified",
  outside_radius: "Outside radius",
  low_accuracy: "Low accuracy",
  not_required: "Not required",
  overridden: "Overridden",
};

export default async function FieldClockPage({ searchParams }: { searchParams: Promise<{ error?: string; message?: string }> }) {
  const context = await requireOrganization();
  if (!(await hasCapability(context.organization.id, "field_clock.manage"))) redirect("/dashboard");
  const { supabase } = await requireUser();
  const [{ data: settings }, { data: verifications }, { data: jobs }, { data: employees }, { data: profiles }] = await Promise.all([
    supabase.from("field_clock_settings").select("*").eq("organization_id", context.organization.id).single(),
    supabase.from("field_clock_verifications").select("*").eq("organization_id", context.organization.id).order("attempted_at", { ascending: false }).limit(100),
    supabase.from("jobs").select("id,job_name").eq("organization_id", context.organization.id),
    supabase.from("employees").select("id,first_name,last_name").eq("organization_id", context.organization.id),
    supabase.from("profiles").select("id,first_name,last_name"),
  ]);
  const jobNames = new Map(jobs?.map((job) => [job.id, job.job_name]));
  const employeeNames = new Map(employees?.map((employee) => [employee.id, `${employee.first_name} ${employee.last_name}`]));
  const profileNames = new Map(profiles?.map((profile) => [profile.id, `${profile.first_name} ${profile.last_name}`]));
  const params = await searchParams;
  return <>
    <PageHeader title="Field Clock" description="Configure one-time job-site verification and review failed clock-in attempts." />
    <MessageBanner error={params.error} message={params.message} />
    <section className="section-grid field-clock-manager-grid">
      <article className="panel">
        <h2>Verification policy</h2>
        <form action={configureFieldClockAction} className="form-grid">
          <label className="check-field"><input type="checkbox" name="enabled" defaultChecked={settings?.enabled} />Require job-site verification for field clock-in</label>
          <div className="field"><label htmlFor="allowedRadiusM">Allowed radius (meters)</label><input id="allowedRadiusM" name="allowedRadiusM" type="number" min={25} max={5000} defaultValue={settings?.allowed_radius_m ?? 150} required /></div>
          <div className="field"><label htmlFor="maxAccuracyM">Maximum device uncertainty (meters)</label><input id="maxAccuracyM" name="maxAccuracyM" type="number" min={5} max={1000} defaultValue={settings?.max_accuracy_m ?? 100} required /></div>
          <label className="check-field"><input type="checkbox" name="managerOverrideEnabled" defaultChecked={settings?.manager_override_enabled} />Allow manager overrides with a required reason</label>
          <button className="button" type="submit">Save field clock settings</button>
        </form>
      </article>
      <article className="panel">
        <h2>Privacy boundary</h2>
        <p>Location is requested only when an employee explicitly attempts a field clock-in. Each attempt stores that submitted point, device accuracy, expected job point, configured radius, calculated distance, and result.</p>
        <p className="muted">There is no continuous tracking, background tracking, route history, or live map.</p>
      </article>
    </section>
    <section className="field-clock-review">
      <h2>Verification review</h2>
      {verifications?.length ? <div className="review-list">{verifications.map((verification) => {
        const failed = verification.status === "outside_radius" || verification.status === "low_accuracy";
        return <article className="panel review-card" key={verification.id}>
          <div className="request-heading"><div><span className="eyebrow">{employeeNames.get(verification.employee_id)}</span><h2>{jobNames.get(verification.job_id)}</h2></div><span className={failed ? "status warning-status" : "status"}>{labels[verification.status]}</span></div>
          <p>{formatShiftDate(verification.attempted_at, context.organization.timezone)} at {formatShiftTime(verification.attempted_at, context.organization.timezone)}</p>
          <div className="verification-metrics"><span>Distance <strong>{Math.round(verification.calculated_distance_m)} m</strong></span><span>Radius <strong>{verification.allowed_radius_m} m</strong></span><span>Accuracy <strong>{Math.round(verification.submitted_accuracy_m)} m</strong></span></div>
          <details><summary>Location evidence</summary><p className="muted">Submitted {verification.submitted_latitude}, {verification.submitted_longitude} · Expected {verification.expected_latitude}, {verification.expected_longitude}</p></details>
          {failed && settings?.manager_override_enabled ? <form action={overrideFieldClockAction} className="form-grid override-form"><input type="hidden" name="verificationId" value={verification.id} /><div className="field"><label htmlFor={`reason-${verification.id}`}>Override reason</label><textarea id={`reason-${verification.id}`} name="reason" minLength={3} maxLength={2000} required /></div><button className="button secondary" type="submit">Approve override</button></form> : null}
          {verification.status === "overridden" ? <p className="correction-note">Overridden by {profileNames.get(verification.overridden_by ?? "") ?? "manager"}: {verification.override_reason}</p> : null}
          {verification.time_entry_id ? <p className="muted">Linked time entry: {verification.time_entry_id}</p> : null}
        </article>;
      })}</div> : <div className="panel empty">No field clock attempts yet.</div>}
    </section>
  </>;
}
