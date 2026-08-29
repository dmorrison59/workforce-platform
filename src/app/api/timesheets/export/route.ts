import { requireOrganization, requireUser } from "@/core/auth/context";
import { hasCapability } from "@/core/permissions/capabilities";
import { addDays, localDateTimeValue, weekStartFor } from "@/modules/scheduling/lib/dates";
import { netWorkedMinutes, breakDurationMinutes } from "@/modules/time-clock/services/calculations";

export async function GET(request: Request) {
  const context = await requireOrganization();
  if (!(await hasCapability(context.organization.id, "timeclock.view"))) {
    return new Response("Forbidden", { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const weekParam = searchParams.get("week");
  const week = /^\d{4}-\d{2}-\d{2}$/.test(weekParam ?? "")
    ? weekParam!
    : weekStartFor(new Date(), context.organization.timezone);
  const weekEnd = addDays(week, 7);

  const { supabase } = await requireUser();
  const [{ data: allEntries }, { data: employees }, { data: locations }] = await Promise.all([
    supabase.from("time_entries").select("*").eq("organization_id", context.organization.id).order("clock_in_at"),
    supabase.from("employees").select("*").eq("organization_id", context.organization.id),
    supabase.from("locations").select("*").eq("organization_id", context.organization.id),
  ]);

  const entries = (allEntries ?? []).filter((entry) => {
    const date = localDateTimeValue(entry.clock_in_at, context.organization.timezone).slice(0, 10);
    return date >= week && date < weekEnd;
  });

  const { data: breaks } = entries.length
    ? await supabase.from("time_breaks").select("*").in("time_entry_id", entries.map((e) => e.id))
    : { data: [] };

  const employeeNames = new Map((employees ?? []).map((e) => [e.id, `${e.first_name} ${e.last_name}`]));
  const locationNames = new Map((locations ?? []).map((l) => [l.id, l.name]));

  const headers = ["Date", "Employee", "Location", "Clock In", "Clock Out", "Breaks (m)", "Net Hours", "Status"];
  const rows = entries.map((entry) => {
    const entryBreaks = (breaks ?? []).filter((b) => b.time_entry_id === entry.id);
    const date = localDateTimeValue(entry.clock_in_at, context.organization.timezone).slice(0, 10);
    const clockIn = localDateTimeValue(entry.clock_in_at, context.organization.timezone);
    const clockOut = entry.clock_out_at ? localDateTimeValue(entry.clock_out_at, context.organization.timezone) : "";
    const netMinutes = netWorkedMinutes(entry, entryBreaks);
    const breakMinutes = breakDurationMinutes(entryBreaks);

    return [
      date,
      employeeNames.get(entry.employee_id) ?? "Unknown",
      locationNames.get(entry.location_id) ?? "Unknown",
      clockIn,
      clockOut,
      breakMinutes.toString(),
      (netMinutes / 60).toFixed(2),
      entry.status,
    ];
  });

  const csvContent = [
    headers.join(","),
    ...rows.map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(",")),
  ].join("\n");

  return new Response(csvContent, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="timesheet-${week}.csv"`,
    },
  });
}