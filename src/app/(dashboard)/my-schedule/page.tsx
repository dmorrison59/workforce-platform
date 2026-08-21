import { PageHeader } from "@/components/page-header";
import { requireOrganization, requireUser } from "@/core/auth/context";
import { formatShiftDate, formatShiftTime } from "@/modules/scheduling/lib/dates";

export default async function MySchedulePage() {
  const context = await requireOrganization();
  const { supabase } = await requireUser();
  const { data: employeeId } = await supabase.rpc("current_employee_id", {
    target_organization_id: context.organization.id,
  });
  const { data: shifts } = employeeId
    ? await supabase.from("shifts").select("*")
      .eq("organization_id", context.organization.id)
      .eq("employee_id", employeeId)
      .eq("status", "published")
      .gte("end_at", new Date().toISOString())
      .order("start_at")
    : { data: [] };
  const [{ data: locations }, { data: departments }] = await Promise.all([
    supabase.from("locations").select("*").eq("organization_id", context.organization.id),
    supabase.from("departments").select("*").eq("organization_id", context.organization.id),
  ]);
  const locationNames = new Map(locations?.map((location) => [location.id, location.name]));
  const departmentNames = new Map(departments?.map((department) => [department.id, department.name]));

  return (
    <>
      <PageHeader title="My Schedule" description="Your upcoming published shifts." />
      <section className="my-schedule-list">
        {shifts?.length ? shifts.map((shift) => (
          <article className="panel my-shift" key={shift.id}>
            <div>
              <span className="eyebrow">{formatShiftDate(shift.start_at, context.organization.timezone)}</span>
              <h2>{formatShiftTime(shift.start_at, context.organization.timezone)} – {formatShiftTime(shift.end_at, context.organization.timezone)}</h2>
            </div>
            <div className="my-shift-details">
              <span>{locationNames.get(shift.location_id)}</span>
              <span>{departmentNames.get(shift.department_id)}</span>
              <span>{shift.break_minutes} minute break</span>
            </div>
            {shift.notes ? <p>{shift.notes}</p> : null}
          </article>
        )) : <div className="panel empty">No upcoming published shifts are assigned to your employee profile.</div>}
      </section>
    </>
  );
}
