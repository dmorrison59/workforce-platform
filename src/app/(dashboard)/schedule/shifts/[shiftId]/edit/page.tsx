import Link from "next/link";
import { redirect } from "next/navigation";
import { MessageBanner } from "@/components/message-banner";
import { PageHeader } from "@/components/page-header";
import { requireOrganization, requireUser } from "@/core/auth/context";
import { hasCapability } from "@/core/permissions/capabilities";
import { updateShiftAction } from "@/modules/scheduling/actions/actions";
import { ShiftFields } from "@/modules/scheduling/components/shift-fields";
import { localDateTimeValue } from "@/modules/scheduling/lib/dates";

export default async function EditShiftPage({
  params,
  searchParams,
}: {
  params: Promise<{ shiftId: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const context = await requireOrganization();
  if (!(await hasCapability(context.organization.id, "schedule.manage"))) redirect("/my-schedule");
  const { shiftId } = await params;
  const { supabase } = await requireUser();
  const { data: shift } = await supabase.from("shifts").select("*").eq("id", shiftId).maybeSingle();
  if (!shift) redirect("/schedule?error=Shift+not+found");
  const [{ data: schedule }, { data: departments }, { data: employees }, { data: roles }] = await Promise.all([
    supabase.from("schedules").select("*").eq("id", shift.schedule_id).single(),
    supabase.from("departments").select("*").eq("organization_id", context.organization.id)
      .eq("active", true).or(`location_id.eq.${shift.location_id},location_id.is.null`).order("name"),
    supabase.from("employees").select("*").eq("organization_id", context.organization.id)
      .eq("employment_status", "active").order("last_name"),
    supabase.from("roles").select("*").eq("organization_id", context.organization.id).order("name"),
  ]);
  if (!schedule) redirect("/schedule?error=Schedule+not+found");
  const query = `location=${schedule.location_id}&week=${schedule.week_start}`;
  const messages = await searchParams;
  return (
    <>
      <PageHeader title="Edit shift" description="Saving changes returns this schedule to draft status." />
      <section className="panel form-panel">
        <MessageBanner error={messages.error} />
        <form action={updateShiftAction} className="form-grid">
          <input type="hidden" name="shiftId" value={shift.id} />
          <input type="hidden" name="scheduleId" value={schedule.id} />
          <input type="hidden" name="returnLocation" value={schedule.location_id} />
          <input type="hidden" name="returnWeek" value={schedule.week_start} />
          <ShiftFields
            departments={departments ?? []}
            employees={employees ?? []}
            roles={roles ?? []}
            defaults={{
              departmentId: shift.department_id,
              roleId: shift.role_id,
              employeeId: shift.employee_id,
              startLocal: localDateTimeValue(shift.start_at, context.organization.timezone),
              endLocal: localDateTimeValue(shift.end_at, context.organization.timezone),
              breakMinutes: shift.break_minutes,
              notes: shift.notes,
            }}
          />
          <div className="button-row">
            <button className="button" type="submit">Save shift</button>
            <Link className="button ghost" href={`/schedule?${query}`}>Cancel</Link>
          </div>
        </form>
      </section>
    </>
  );
}

