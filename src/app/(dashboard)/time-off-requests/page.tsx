import { redirect } from "next/navigation";
import { MessageBanner } from "@/components/message-banner";
import { PageHeader } from "@/components/page-header";
import { requireOrganization, requireUser } from "@/core/auth/context";
import { hasCapability } from "@/core/permissions/capabilities";
import { reviewTimeOffRequestAction } from "@/modules/time-off/actions/actions";

export default async function TimeOffRequestsPage({ searchParams }: { searchParams: Promise<{ error?: string; message?: string }> }) {
  const context = await requireOrganization();
  if (!(await hasCapability(context.organization.id, "timeoff.approve"))) redirect("/time-off");
  const { supabase } = await requireUser();
  const [{ data: requests }, { data: employees }, { data: availability }] = await Promise.all([
    supabase.from("time_off_requests").select("*")
      .eq("organization_id", context.organization.id).eq("status", "pending").order("requested_at"),
    supabase.from("employees").select("*").eq("organization_id", context.organization.id).order("last_name"),
    supabase.from("employee_availability").select("*")
      .eq("organization_id", context.organization.id).order("employee_id").order("day_of_week"),
  ]);
  const employeeNames = new Map(employees?.map((employee) => [employee.id, `${employee.first_name} ${employee.last_name}`]));
  const messages = await searchParams;
  return (
    <>
      <PageHeader title="Time Off Requests" description="Review pending employee requests." />
      <MessageBanner error={messages.error} message={messages.message} />
      <section className="review-list">
        {requests?.length ? requests.map((request) => (
          <article className="panel review-card" key={request.id}>
            <div className="request-heading">
              <div><span className="eyebrow">Pending request</span><h2>{employeeNames.get(request.employee_id)}</h2></div>
              <strong>{request.start_date} to {request.end_date}</strong>
            </div>
            <p>{request.reason || "No reason provided."}</p>
            <form action={reviewTimeOffRequestAction} className="form-grid">
              <input type="hidden" name="requestId" value={request.id} />
              <div className="field">
                <label htmlFor={`note-${request.id}`}>Manager note (optional)</label>
                <textarea id={`note-${request.id}`} name="managerNote" rows={3} maxLength={2000} />
              </div>
              <div className="button-row">
                <button className="button" type="submit" name="decision" value="approved">Approve</button>
                <button className="button ghost" type="submit" name="decision" value="denied">Deny</button>
              </div>
            </form>
          </article>
        )) : <div className="panel empty">No pending requests.</div>}
      </section>
      <section className="panel manager-availability">
        <h2>Employee availability</h2>
        <p className="muted">Current saved effective periods are visible here for scheduling context.</p>
        {availability?.length ? <div className="table-wrap"><table className="data-table"><thead><tr><th>Employee</th><th>Day</th><th>Availability</th><th>Effective</th></tr></thead><tbody>
          {availability.map((record) => <tr key={record.id}><td>{employeeNames.get(record.employee_id)}</td><td>{["", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"][record.day_of_week]}</td><td>{record.available ? `${record.start_time?.slice(0, 5)}–${record.end_time?.slice(0, 5)}` : "Unavailable"}</td><td>{record.effective_from}{record.effective_until ? ` to ${record.effective_until}` : " onward"}</td></tr>)}
        </tbody></table></div> : <div className="empty">No availability has been saved.</div>}
      </section>
    </>
  );
}
