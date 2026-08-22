import { redirect } from "next/navigation";
import { PageHeader } from "@/components/page-header";
import { requireOrganization } from "@/core/auth/context";
import { hasCapability } from "@/core/permissions/capabilities";
import { getMyJobsData } from "@/modules/field-operations/services/field-query-service";
import { formatShiftDate, formatShiftTime } from "@/modules/scheduling/lib/dates";

export default async function MyJobsPage() {
  const context = await requireOrganization();
  if (!(await hasCapability(context.organization.id, "job.view"))) redirect("/dashboard");
  const data = await getMyJobsData(context.organization.id);
  const crewNames = new Map(data.crews.map((crew) => [crew.id, crew.name]));
  return (
    <>
      <PageHeader title="My Jobs" description="Direct assignments and active crew work for the scheduled date." />
      <section className="my-jobs-list">
        {data.jobs.length ? data.jobs.map((job) => {
          const crewAssignments = data.assignments.filter((assignment) => assignment.job_id === job.id && assignment.crew_id !== null);
          return <article className="panel my-job-card" key={job.id}>
            <div className="request-heading"><div><span className="eyebrow">{job.customer_name}</span><h2>{job.job_name}</h2></div><span className={job.status === "completed" || job.status === "cancelled" ? "status off" : "status"}>{job.status.replace("_", " ")}</span></div>
            <div className="job-time"><strong>{formatShiftDate(job.scheduled_start, context.organization.timezone)}</strong><span>{formatShiftTime(job.scheduled_start, context.organization.timezone)}–{formatShiftTime(job.scheduled_end, context.organization.timezone)}</span></div>
            <p className="job-address">{job.address}</p>
            {crewAssignments.length ? <p className="muted">Crew: {crewAssignments.map((assignment) => crewNames.get(assignment.crew_id ?? "")).filter(Boolean).join(", ")}</p> : <p className="muted">Direct employee assignment</p>}
            {job.notes ? <p className="job-notes">{job.notes}</p> : null}
          </article>;
        }) : <div className="panel empty">No jobs are assigned to you or your active crew.</div>}
      </section>
    </>
  );
}
