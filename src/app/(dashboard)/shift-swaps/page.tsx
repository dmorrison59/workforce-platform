import { redirect } from "next/navigation";
import { MessageBanner } from "@/components/message-banner";
import { PageHeader } from "@/components/page-header";
import { requireOrganization, requireUser } from "@/core/auth/context";
import { hasCapability } from "@/core/permissions/capabilities";
import { formatShiftDate, formatShiftTime } from "@/modules/scheduling/lib/dates";
import {
  cancelShiftSwapRequestAction,
  requestShiftSwapAction,
} from "@/modules/shift-swaps/actions/actions";

export default async function ShiftSwapsPage({ searchParams }: { searchParams: Promise<{ error?: string; message?: string }> }) {
  const context = await requireOrganization();
  if (!(await hasCapability(context.organization.id, "shift_swap.request"))) redirect("/dashboard");
  const { supabase } = await requireUser();
  const { data: employeeId } = await supabase.rpc("current_employee_id", {
    target_organization_id: context.organization.id,
  });
  const [{ data: shifts }, { data: requests }, { data: employees }, { data: locations }, { data: departments }] = await Promise.all([
    employeeId ? supabase.from("shifts").select("*")
      .eq("organization_id", context.organization.id)
      .eq("employee_id", employeeId)
      .eq("status", "published")
      .gte("end_at", new Date().toISOString())
      .order("start_at") : Promise.resolve({ data: [] }),
    employeeId ? supabase.from("shift_swap_requests").select("*")
      .eq("organization_id", context.organization.id)
      .eq("requesting_employee_id", employeeId)
      .order("requested_at", { ascending: false }) : Promise.resolve({ data: [] }),
    supabase.from("employees").select("*").eq("organization_id", context.organization.id)
      .eq("employment_status", "active").order("last_name"),
    supabase.from("locations").select("*").eq("organization_id", context.organization.id),
    supabase.from("departments").select("*").eq("organization_id", context.organization.id),
  ]);
  const employeeNames = new Map(employees?.map((employee) => [employee.id, `${employee.first_name} ${employee.last_name}`]));
  const locationNames = new Map(locations?.map((location) => [location.id, location.name]));
  const departmentNames = new Map(departments?.map((department) => [department.id, department.name]));
  const pendingByShift = new Map(requests?.filter((request) => request.status === "pending")
    .map((request) => [request.shift_id, request]));
  const messages = await searchParams;

  return (
    <>
      <PageHeader title="Shift Swaps" description="Ask another active employee to take one of your upcoming shifts." />
      <MessageBanner error={messages.error} message={messages.message} />
      {!employeeId ? <section className="panel empty">Your login is not linked to an active employee profile.</section> : (
        <section className="coverage-list" aria-label="Shifts eligible for swap">
          {shifts?.length ? shifts.map((shift) => {
            const pending = pendingByShift.get(shift.id);
            return <article className="panel coverage-card" key={shift.id}>
              <div>
                <span className="eyebrow">{formatShiftDate(shift.start_at, context.organization.timezone)}</span>
                <h2>{formatShiftTime(shift.start_at, context.organization.timezone)} – {formatShiftTime(shift.end_at, context.organization.timezone)}</h2>
              </div>
              <div className="my-shift-details"><span>{locationNames.get(shift.location_id)}</span><span>{departmentNames.get(shift.department_id)}</span></div>
              {pending ? <form action={cancelShiftSwapRequestAction}>
                <input type="hidden" name="requestId" value={pending.id} />
                <div className="button-row"><span className="status off">pending</span><button className="button ghost" type="submit">Cancel swap</button></div>
              </form> : <form action={requestShiftSwapAction} className="form-grid compact-form">
                <input type="hidden" name="shiftId" value={shift.id} />
                <div className="field">
                  <label htmlFor={`target-${shift.id}`}>Target employee</label>
                  <select id={`target-${shift.id}`} name="targetEmployeeId" required defaultValue="">
                    <option value="" disabled>Select employee</option>
                    {employees?.filter((employee) => employee.id !== employeeId).map((employee) => <option key={employee.id} value={employee.id}>{employee.first_name} {employee.last_name}</option>)}
                  </select>
                </div>
                <button className="button" type="submit">Request swap</button>
              </form>}
            </article>;
          }) : <div className="panel empty">No upcoming published shifts are eligible for a swap.</div>}
        </section>
      )}
      {employeeId ? <section className="panel coverage-history">
        <h2>Swap history</h2>
        {requests?.length ? <ul className="request-list">{requests.map((request) => <li key={request.id}>
          <div className="request-heading"><strong>Target: {request.target_employee_id ? employeeNames.get(request.target_employee_id) : "Not selected"}</strong><span className={`status ${request.status === "approved" ? "" : "off"}`}>{request.status}</span></div>
          {request.manager_note ? <p>Manager note: {request.manager_note}</p> : null}
        </li>)}</ul> : <div className="empty">No swap requests yet.</div>}
      </section> : null}
    </>
  );
}
