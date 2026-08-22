import { redirect } from "next/navigation";
import { MessageBanner } from "@/components/message-banner";
import { PageHeader } from "@/components/page-header";
import { requireOrganization, requireUser } from "@/core/auth/context";
import { hasCapability } from "@/core/permissions/capabilities";
import { reviewOpenShiftRequestAction } from "@/modules/open-shifts/actions/actions";
import { formatShiftDate, formatShiftTime } from "@/modules/scheduling/lib/dates";
import { reviewShiftSwapRequestAction } from "@/modules/shift-swaps/actions/actions";

export default async function CoverageRequestsPage({ searchParams }: { searchParams: Promise<{ error?: string; message?: string; warning?: string }> }) {
  const context = await requireOrganization();
  const [canManageOpenShifts, canApproveSwaps] = await Promise.all([
    hasCapability(context.organization.id, "open_shift.manage"),
    hasCapability(context.organization.id, "shift_swap.approve"),
  ]);
  if (!canManageOpenShifts && !canApproveSwaps) redirect("/dashboard");
  const { supabase } = await requireUser();
  const [{ data: openRequests }, { data: swapRequests }, { data: shifts }, { data: employees }, { data: locations }, { data: departments }] = await Promise.all([
    canManageOpenShifts ? supabase.from("open_shift_requests").select("*")
      .eq("organization_id", context.organization.id).eq("status", "pending").order("requested_at") : Promise.resolve({ data: [] }),
    canApproveSwaps ? supabase.from("shift_swap_requests").select("*")
      .eq("organization_id", context.organization.id).eq("status", "pending").order("requested_at") : Promise.resolve({ data: [] }),
    supabase.from("shifts").select("*").eq("organization_id", context.organization.id),
    supabase.from("employees").select("*").eq("organization_id", context.organization.id).order("last_name"),
    supabase.from("locations").select("*").eq("organization_id", context.organization.id),
    supabase.from("departments").select("*").eq("organization_id", context.organization.id),
  ]);
  const shiftById = new Map(shifts?.map((shift) => [shift.id, shift]));
  const employeeNames = new Map(employees?.map((employee) => [employee.id, `${employee.first_name} ${employee.last_name}`]));
  const locationNames = new Map(locations?.map((location) => [location.id, location.name]));
  const departmentNames = new Map(departments?.map((department) => [department.id, department.name]));
  const messages = await searchParams;
  const shiftSummary = (shiftId: string) => {
    const shift = shiftById.get(shiftId);
    return shift ? `${formatShiftDate(shift.start_at, context.organization.timezone)}, ${formatShiftTime(shift.start_at, context.organization.timezone)}–${formatShiftTime(shift.end_at, context.organization.timezone)}` : "Shift is no longer visible";
  };

  return (
    <>
      <PageHeader title="Coverage Requests" description="Review open-shift claims and employee-to-employee swaps." />
      <MessageBanner error={messages.error} message={messages.message} warning={messages.warning} />
      <section className="section-grid coverage-manager-grid">
        <div>
          <h2>Open-shift requests</h2>
          <div className="review-list">
            {openRequests?.length ? openRequests.map((request) => {
              const shift = shiftById.get(request.shift_id);
              return <article className="panel review-card open-request-card" key={request.id}>
                <div className="request-heading"><div><span className="eyebrow">Open-shift request</span><h2>{employeeNames.get(request.employee_id)}</h2></div><span className="status off">pending</span></div>
                <p><strong>{shiftSummary(request.shift_id)}</strong></p>
                {shift ? <p className="muted">{locationNames.get(shift.location_id)} · {departmentNames.get(shift.department_id)}</p> : null}
                <form action={reviewOpenShiftRequestAction} className="form-grid">
                  <input type="hidden" name="requestId" value={request.id} />
                  <div className="field"><label htmlFor={`open-note-${request.id}`}>Manager note (optional)</label><textarea id={`open-note-${request.id}`} name="managerNote" rows={2} maxLength={2000} /></div>
                  <label className="check-field"><input name="overrideWarnings" type="checkbox" />Approve despite availability or approved time-off warnings</label>
                  <div className="button-row"><button className="button" type="submit" name="decision" value="approved">Approve open shift</button><button className="button ghost" type="submit" name="decision" value="denied">Deny open shift</button></div>
                </form>
              </article>;
            }) : <div className="panel empty">No pending open-shift requests.</div>}
          </div>
        </div>
        <div>
          <h2>Shift-swap requests</h2>
          <div className="review-list">
            {swapRequests?.length ? swapRequests.map((request) => {
              const shift = shiftById.get(request.shift_id);
              return <article className="panel review-card swap-request-card" key={request.id}>
                <div className="request-heading"><div><span className="eyebrow">Shift swap</span><h2>{employeeNames.get(request.requesting_employee_id)} → {request.target_employee_id ? employeeNames.get(request.target_employee_id) : "Target needed"}</h2></div><span className="status off">pending</span></div>
                <p><strong>{shiftSummary(request.shift_id)}</strong></p>
                {shift ? <p className="muted">{locationNames.get(shift.location_id)} · {departmentNames.get(shift.department_id)}</p> : null}
                <form action={reviewShiftSwapRequestAction} className="form-grid">
                  <input type="hidden" name="requestId" value={request.id} />
                  <div className="field"><label htmlFor={`swap-note-${request.id}`}>Manager note (optional)</label><textarea id={`swap-note-${request.id}`} name="managerNote" rows={2} maxLength={2000} /></div>
                  <label className="check-field"><input name="overrideWarnings" type="checkbox" />Approve despite availability or approved time-off warnings</label>
                  <div className="button-row"><button className="button" type="submit" name="decision" value="approved">Approve swap</button><button className="button ghost" type="submit" name="decision" value="denied">Deny swap</button></div>
                </form>
              </article>;
            }) : <div className="panel empty">No pending shift-swap requests.</div>}
          </div>
        </div>
      </section>
    </>
  );
}
