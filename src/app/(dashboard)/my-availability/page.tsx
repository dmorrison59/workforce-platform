import { redirect } from "next/navigation";
import { FormField } from "@/components/form-field";
import { MessageBanner } from "@/components/message-banner";
import { PageHeader } from "@/components/page-header";
import { requireOrganization, requireUser } from "@/core/auth/context";
import { hasCapability } from "@/core/permissions/capabilities";
import { deleteAvailabilityAction, saveAvailabilityAction } from "@/modules/availability/actions/actions";

const weekdays = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

export default async function MyAvailabilityPage({ searchParams }: { searchParams: Promise<{ error?: string; message?: string }> }) {
  const context = await requireOrganization();
  if (!(await hasCapability(context.organization.id, "availability.manage_self"))) redirect("/dashboard");
  const { supabase } = await requireUser();
  const { data: employeeId } = await supabase.rpc("current_employee_id", {
    target_organization_id: context.organization.id,
  });
  const { data: records } = employeeId
    ? await supabase.from("employee_availability").select("*")
      .eq("organization_id", context.organization.id)
      .eq("employee_id", employeeId)
      .order("day_of_week")
      .order("effective_from", { ascending: false })
    : { data: [] };
  const latestByDay = new Map<number, NonNullable<typeof records>[number]>();
  records?.forEach((record) => { if (!latestByDay.has(record.day_of_week)) latestByDay.set(record.day_of_week, record); });
  const messages = await searchParams;
  const today = new Date().toISOString().slice(0, 10);

  return (
    <>
      <PageHeader title="My Availability" description="Set your recurring weekly availability and effective dates." />
      <MessageBanner error={messages.error} message={messages.message} />
      {!employeeId ? <section className="panel empty">Your login is not linked to an active employee profile.</section> : (
        <section className="availability-grid">
          {weekdays.map((weekday, index) => {
            const day = index + 1;
            const record = latestByDay.get(day);
            return (
              <article className="panel availability-card" key={weekday}>
                <h2>{weekday}</h2>
                <form action={saveAvailabilityAction} className="form-grid">
                  <input type="hidden" name="dayOfWeek" value={day} />
                  <label className="check-field">
                    <input type="checkbox" name="available" defaultChecked={record?.available ?? true} />
                    Available to work
                  </label>
                  <div className="two-col">
                    <FormField label="Start time" name="startTime" type="time" defaultValue={record?.start_time?.slice(0, 5) ?? "09:00"} />
                    <FormField label="End time" name="endTime" type="time" defaultValue={record?.end_time?.slice(0, 5) ?? "17:00"} />
                  </div>
                  <div className="two-col">
                    <FormField label="Effective from" name="effectiveFrom" type="date" required defaultValue={record?.effective_from ?? today} />
                    <FormField label="Effective until" name="effectiveUntil" type="date" defaultValue={record?.effective_until ?? ""} />
                  </div>
                  <button className="button" type="submit">Save {weekday}</button>
                </form>
                {record ? <form action={deleteAvailabilityAction} className="availability-delete">
                  <input type="hidden" name="availabilityId" value={record.id} />
                  <button type="submit">Remove this effective period</button>
                </form> : null}
              </article>
            );
          })}
        </section>
      )}
    </>
  );
}

