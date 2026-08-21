import { redirect } from "next/navigation";
import { FormField } from "@/components/form-field";
import { MessageBanner } from "@/components/message-banner";
import { PageHeader } from "@/components/page-header";
import { requireOrganization, requireUser } from "@/core/auth/context";
import { hasCapability } from "@/core/permissions/capabilities";
import { cancelTimeOffRequestAction, createTimeOffRequestAction } from "@/modules/time-off/actions/actions";

export default async function TimeOffPage({ searchParams }: { searchParams: Promise<{ error?: string; message?: string }> }) {
  const context = await requireOrganization();
  if (!(await hasCapability(context.organization.id, "timeoff.view_self"))) redirect("/dashboard");
  const { supabase } = await requireUser();
  const { data: employeeId } = await supabase.rpc("current_employee_id", {
    target_organization_id: context.organization.id,
  });
  const { data: requests } = employeeId
    ? await supabase.from("time_off_requests").select("*")
      .eq("organization_id", context.organization.id)
      .eq("employee_id", employeeId)
      .order("requested_at", { ascending: false })
    : { data: [] };
  const messages = await searchParams;
  return (
    <>
      <PageHeader title="Time Off" description="Request time away and follow its approval status." />
      <MessageBanner error={messages.error} message={messages.message} />
      {!employeeId ? <section className="panel empty">Your login is not linked to an active employee profile.</section> : (
        <section className="section-grid self-service-grid">
          <div className="panel form-panel">
            <h2>New request</h2>
            <form action={createTimeOffRequestAction} className="form-grid">
              <div className="two-col">
                <FormField label="Start date" name="startDate" type="date" required />
                <FormField label="End date" name="endDate" type="date" required />
              </div>
              <div className="field">
                <label htmlFor="reason">Reason (optional)</label>
                <textarea id="reason" name="reason" rows={4} maxLength={2000} />
              </div>
              <button className="button" type="submit">Submit request</button>
            </form>
          </div>
          <div className="panel">
            <h2>Request history</h2>
            {requests?.length ? <ul className="request-list">{requests.map((request) => (
              <li key={request.id}>
                <div className="request-heading">
                  <strong>{request.start_date} to {request.end_date}</strong>
                  <span className={`status ${request.status === "approved" ? "" : "off"}`}>{request.status}</span>
                </div>
                {request.reason ? <p>{request.reason}</p> : null}
                {request.manager_note ? <p className="muted">Manager note: {request.manager_note}</p> : null}
                {request.status === "pending" ? <form action={cancelTimeOffRequestAction}>
                  <input type="hidden" name="requestId" value={request.id} />
                  <button className="text-button" type="submit">Cancel request</button>
                </form> : null}
              </li>
            ))}</ul> : <div className="empty">No requests yet.</div>}
          </div>
        </section>
      )}
    </>
  );
}

