import { redirect } from "next/navigation";
import { MessageBanner } from "@/components/message-banner";
import { PageHeader } from "@/components/page-header";
import { requireOrganization } from "@/core/auth/context";
import { hasCapability } from "@/core/permissions/capabilities";
import { updateJobCoordinatesAction } from "@/modules/field-clock/actions/actions";
import {
  assignJobAction,
  changeJobStatusAction,
  createJobAction,
  unassignJobAction,
  updateJobAction,
} from "@/modules/field-operations/actions/actions";
import { getJobManagerData } from "@/modules/field-operations/services/field-query-service";
import { canTransitionJobStatus, TERMINAL_JOB_STATUSES } from "@/modules/field-operations/validation/rules";
import { formatShiftDate, formatShiftTime, localDateTimeValue } from "@/modules/scheduling/lib/dates";
import type { JobStatus } from "@/types/database";

const statusLabels: Record<JobStatus, string> = { draft: "Draft", scheduled: "Scheduled", in_progress: "In progress", completed: "Completed", cancelled: "Cancelled" };

export default async function JobsPage({ searchParams }: { searchParams: Promise<{ error?: string; message?: string }> }) {
  const context = await requireOrganization();
  if (!(await hasCapability(context.organization.id, "job.manage"))) redirect("/my-jobs");
  const data = await getJobManagerData(context.organization.id);
  const params = await searchParams;
  const now = new Date();
  const defaultStart = localDateTimeValue(now.toISOString(), context.organization.timezone);
  const defaultEnd = localDateTimeValue(new Date(now.getTime() + 8 * 60 * 60 * 1000).toISOString(), context.organization.timezone);
  const crewNames = new Map(data.crews.map((crew) => [crew.id, crew.name]));
  const employeeNames = new Map(data.employees.map((employee) => [employee.id, `${employee.first_name} ${employee.last_name}`]));
  return (
    <>
      <PageHeader title="Jobs" description="Schedule field work independently from workforce shifts and actual time." />
      <MessageBanner error={params.error} message={params.message} />
      <section className="panel field-create-panel"><h2>Create job</h2><form action={createJobAction} className="form-grid">
        <div className="two-col"><div className="field"><label htmlFor="new-customer">Customer name</label><input id="new-customer" name="customerName" maxLength={160} required /></div><div className="field"><label htmlFor="new-job">Job name</label><input id="new-job" name="jobName" maxLength={160} required /></div></div>
        <div className="field"><label htmlFor="new-address">Job address</label><input id="new-address" name="address" maxLength={500} required /></div>
        <div className="two-col"><div className="field"><label htmlFor="new-location">Existing location (optional)</label><select id="new-location" name="locationId"><option value="">No linked location</option>{data.locations.map((location) => <option key={location.id} value={location.id}>{location.name}</option>)}</select></div><div className="field"><label htmlFor="new-status">Initial status</label><select id="new-status" name="status" defaultValue="scheduled"><option value="draft">Draft</option><option value="scheduled">Scheduled</option></select></div></div>
        <div className="two-col"><div className="field"><label htmlFor="new-start">Scheduled start</label><input id="new-start" name="scheduledStartLocal" type="datetime-local" defaultValue={defaultStart} required /></div><div className="field"><label htmlFor="new-end">Scheduled end</label><input id="new-end" name="scheduledEndLocal" type="datetime-local" defaultValue={defaultEnd} required /></div></div>
        <div className="field"><label htmlFor="new-notes">Notes</label><textarea id="new-notes" name="notes" rows={3} maxLength={4000} /></div><button className="button" type="submit">Create job</button>
      </form></section>
      <section className="field-list">
        {data.jobs.length ? data.jobs.map((job) => {
          const assignments = data.assignments.filter((assignment) => assignment.job_id === job.id);
          const terminal = TERMINAL_JOB_STATUSES.includes(job.status);
          const transitions = (["scheduled", "in_progress", "completed", "cancelled"] as JobStatus[]).filter((status) => canTransitionJobStatus(job.status, status));
          return <article className="panel field-card" key={job.id}>
            <div className="request-heading"><div><span className="eyebrow">{job.customer_name}</span><h2>{job.job_name}</h2><p className="muted">{formatShiftDate(job.scheduled_start, context.organization.timezone)} · {formatShiftTime(job.scheduled_start, context.organization.timezone)}–{formatShiftTime(job.scheduled_end, context.organization.timezone)}</p></div><span className={terminal ? "status off" : "status"}>{statusLabels[job.status]}</span></div>
            <p className="job-address"><strong>{job.address}</strong></p>{job.notes ? <p className="job-notes">{job.notes}</p> : null}
            {job.latitude !== null && job.longitude !== null ? <p className="muted">Verification point: {job.latitude}, {job.longitude}</p> : <p className="muted">No field-clock verification point configured.</p>}
            {!terminal ? <form action={updateJobCoordinatesAction} className="form-grid coordinate-form">
              <input type="hidden" name="jobId" value={job.id} />
              <div className="two-col"><div className="field"><label htmlFor={`latitude-${job.id}`}>Verification latitude</label><input id={`latitude-${job.id}`} name="latitude" type="number" step="any" min={-90} max={90} defaultValue={job.latitude ?? ""} /></div><div className="field"><label htmlFor={`longitude-${job.id}`}>Verification longitude</label><input id={`longitude-${job.id}`} name="longitude" type="number" step="any" min={-180} max={180} defaultValue={job.longitude ?? ""} /></div></div>
              <p className="help">Enter both coordinates for the job site, or clear both to disable job-site verification for this job.</p>
              <button className="button secondary" type="submit">Save verification coordinates</button>
            </form> : null}
            {!terminal ? <form action={updateJobAction} className="form-grid job-edit-form">
              <input type="hidden" name="jobId" value={job.id} />
              <div className="two-col"><div className="field"><label htmlFor={`customer-${job.id}`}>Customer name</label><input id={`customer-${job.id}`} name="customerName" defaultValue={job.customer_name} maxLength={160} required /></div><div className="field"><label htmlFor={`job-${job.id}`}>Job name</label><input id={`job-${job.id}`} name="jobName" defaultValue={job.job_name} maxLength={160} required /></div></div>
              <div className="field"><label htmlFor={`address-${job.id}`}>Address</label><input id={`address-${job.id}`} name="address" defaultValue={job.address} maxLength={500} required /></div>
              <div className="field"><label htmlFor={`location-${job.id}`}>Linked location</label><select id={`location-${job.id}`} name="locationId" defaultValue={job.location_id ?? ""}><option value="">No linked location</option>{data.locations.map((location) => <option key={location.id} value={location.id}>{location.name}</option>)}</select></div>
              <div className="two-col"><div className="field"><label htmlFor={`start-${job.id}`}>Scheduled start</label><input id={`start-${job.id}`} name="scheduledStartLocal" type="datetime-local" defaultValue={localDateTimeValue(job.scheduled_start, context.organization.timezone)} required /></div><div className="field"><label htmlFor={`end-${job.id}`}>Scheduled end</label><input id={`end-${job.id}`} name="scheduledEndLocal" type="datetime-local" defaultValue={localDateTimeValue(job.scheduled_end, context.organization.timezone)} required /></div></div>
              <div className="field"><label htmlFor={`notes-${job.id}`}>Notes</label><textarea id={`notes-${job.id}`} name="notes" rows={2} maxLength={4000} defaultValue={job.notes} /></div><button className="button secondary" type="submit">Save job details</button>
            </form> : <p className="muted terminal-note">Completed and cancelled jobs are read-only.</p>}
            {transitions.length ? <div className="button-row">{transitions.map((status) => <form action={changeJobStatusAction} key={status}><input type="hidden" name="jobId" value={job.id} /><input type="hidden" name="status" value={status} /><button className={status === "cancelled" ? "button ghost" : "button secondary"} type="submit">Mark {statusLabels[status].toLowerCase()}</button></form>)}</div> : null}
            <div className="field-subsection"><h3>Assignments</h3>{assignments.length ? <div className="member-list">{assignments.map((assignment) => <div className="member-row" key={assignment.id}><strong>{assignment.crew_id ? `Crew: ${crewNames.get(assignment.crew_id)}` : `Employee: ${employeeNames.get(assignment.employee_id ?? "")}`}</strong>{!terminal ? <form action={unassignJobAction}><input type="hidden" name="assignmentId" value={assignment.id} /><button className="text-button" type="submit">Remove</button></form> : null}</div>)}</div> : <p className="muted">No crew or employee assigned.</p>}</div>
            {job.status === "scheduled" || job.status === "in_progress" ? <div className="assignment-grid"><form action={assignJobAction} className="form-grid"><input type="hidden" name="jobId" value={job.id} /><div className="field"><label htmlFor={`crew-${job.id}`}>Assign active crew</label><select id={`crew-${job.id}`} name="crewId" required><option value="">Choose crew</option>{data.crews.filter((crew) => crew.active).map((crew) => <option key={crew.id} value={crew.id}>{crew.name}</option>)}</select></div><button className="button" type="submit">Assign crew</button></form><form action={assignJobAction} className="form-grid"><input type="hidden" name="jobId" value={job.id} /><div className="field"><label htmlFor={`employee-${job.id}`}>Assign employee</label><select id={`employee-${job.id}`} name="employeeId" required><option value="">Choose employee</option>{data.employees.map((employee) => <option key={employee.id} value={employee.id}>{employeeNames.get(employee.id)}</option>)}</select></div><button className="button" type="submit">Assign employee</button></form></div> : null}
          </article>;
        }) : <div className="panel empty">No jobs yet.</div>}
      </section>
      <p className="muted field-note">Jobs do not create or change workforce shifts or time entries. Completed and cancelled jobs remain visible but cannot be edited or reassigned.</p>
    </>
  );
}
