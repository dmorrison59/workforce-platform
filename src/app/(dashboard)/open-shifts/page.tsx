import { redirect } from "next/navigation";
import { MessageBanner } from "@/components/message-banner";
import { PageHeader } from "@/components/page-header";
import { requireOrganization, requireUser } from "@/core/auth/context";
import { hasCapability } from "@/core/permissions/capabilities";
import {
  cancelOpenShiftRequestAction,
  requestOpenShiftAction,
} from "@/modules/open-shifts/actions/actions";
import { formatShiftDate, formatShiftTime } from "@/modules/scheduling/lib/dates";

export default async function OpenShiftsPage({ searchParams }: { searchParams: Promise<{ error?: string; message?: string }> }) {
  const context = await requireOrganization();
  if (!(await hasCapability(context.organization.id, "open_shift.view"))) redirect("/dashboard");
  const { supabase } = await requireUser();
  const { data: employeeId } = await supabase.rpc("current_employee_id", {
    target_organization_id: context.organization.id,
  });
  const [{ data: shifts }, { data: requests }, { data: locations }, { data: departments }] = await Promise.all([
    supabase.from("shifts").select("*")
      .eq("organization_id", context.organization.id)
      .eq("status", "open")
      .is("employee_id", null)
      .gte("end_at", new Date().toISOString())
      .order("start_at"),
    employeeId ? supabase.from("open_shift_requests").select("*")
      .eq("organization_id", context.organization.id)
      .eq("employee_id", employeeId)
      .order("requested_at", { ascending: false }) : Promise.resolve({ data: [] }),
    supabase.from("locations").select("*").eq("organization_id", context.organization.id),
    supabase.from("departments").select("*").eq("organization_id", context.organization.id),
  ]);
  const locationNames = new Map(locations?.map((location) => [location.id, location.name]));
  const departmentNames = new Map(departments?.map((department) => [department.id, department.name]));
  const pendingByShift = new Map(requests?.filter((request) => request.status === "pending")
    .map((request) => [request.shift_id, request]));
  const messages = await searchParams;

  return (
    <>
      <PageHeader title="Open Shifts" description="Request available coverage shifts from your phone or desktop." />
      <MessageBanner error={messages.error} message={messages.message} />
      {!employeeId ? <section className="panel empty">Your login is not linked to an active employee profile.</section> : (
        <section className="coverage-list" aria-label="Available open shifts">
          {shifts?.length ? shifts.map((shift) => {
            const pending = pendingByShift.get(shift.id);
            return <article className="panel coverage-card" key={shift.id}>
              <div>
                <span className="eyebrow">{formatShiftDate(shift.start_at, context.organization.timezone)}</span>
                <h2>{formatShiftTime(shift.start_at, context.organization.timezone)} – {formatShiftTime(shift.end_at, context.organization.timezone)}</h2>
              </div>
              <div className="my-shift-details">
                <span>{locationNames.get(shift.location_id)}</span>
                <span>{departmentNames.get(shift.department_id)}</span>
                <span>{shift.break_minutes} minute break</span>
              </div>
              {pending ? <form action={cancelOpenShiftRequestAction}>
                <input type="hidden" name="requestId" value={pending.id} />
                <div className="button-row"><span className="status off">pending</span><button className="button ghost" type="submit">Cancel request</button></div>
              </form> : <form action={requestOpenShiftAction}>
                <input type="hidden" name="shiftId" value={shift.id} />
                <button className="button" type="submit">Request shift</button>
              </form>}
            </article>;
          }) : <div className="panel empty">No open shifts are currently available.</div>}
        </section>
      )}
      {employeeId ? <section className="panel coverage-history">
        <h2>Request history</h2>
        {requests?.length ? <ul className="request-list">{requests.map((request) => <li key={request.id}>
          <div className="request-heading"><strong>Shift request</strong><span className={`status ${request.status === "approved" ? "" : "off"}`}>{request.status}</span></div>
          <p className="muted">Requested {new Date(request.requested_at).toLocaleDateString()}</p>
          {request.manager_note ? <p>Manager note: {request.manager_note}</p> : null}
        </li>)}</ul> : <div className="empty">No requests yet.</div>}
      </section> : null}
    </>
  );
}
