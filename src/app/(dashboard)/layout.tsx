import Link from "next/link";
import { signOut } from "@/core/auth/actions";
import { requireOrganization } from "@/core/auth/context";
import { hasCapability } from "@/core/permissions/capabilities";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const context = await requireOrganization();
  const [canManageSchedules, canViewSchedules, canManageAvailability, canViewOwnTimeOff, canApproveTimeOff, canViewOpenShifts, canRequestSwaps, canManageCoverage, canUseTimeClock, canViewOwnTimesheet, canReviewTimesheets, canViewLabor] = await Promise.all([
    hasCapability(context.organization.id, "schedule.manage"),
    hasCapability(context.organization.id, "schedule.view"),
    hasCapability(context.organization.id, "availability.manage_self"),
    hasCapability(context.organization.id, "timeoff.view_self"),
    hasCapability(context.organization.id, "timeoff.approve"),
    hasCapability(context.organization.id, "open_shift.view"),
    hasCapability(context.organization.id, "shift_swap.request"),
    hasCapability(context.organization.id, "open_shift.manage"),
    hasCapability(context.organization.id, "timeclock.use"),
    hasCapability(context.organization.id, "timeclock.view_self"),
    hasCapability(context.organization.id, "timeclock.view"),
    hasCapability(context.organization.id, "labor.view"),
  ]);
  const navigation = [
    ["Dashboard", "/dashboard"],
    ["Employees", "/employees"],
    ["Locations", "/locations"],
    ["Departments", "/departments"],
    ...(canManageSchedules ? [["Schedule", "/schedule"]] : []),
    ...(canViewSchedules ? [["My Schedule", "/my-schedule"]] : []),
    ...(canManageAvailability ? [["My Availability", "/my-availability"]] : []),
    ...(canViewOwnTimeOff ? [["Time Off", "/time-off"]] : []),
    ...(canApproveTimeOff ? [["Time Off Requests", "/time-off-requests"]] : []),
    ...(canViewOpenShifts ? [["Open Shifts", "/open-shifts"]] : []),
    ...(canRequestSwaps ? [["Shift Swaps", "/shift-swaps"]] : []),
    ...(canManageCoverage ? [["Coverage Requests", "/coverage-requests"]] : []),
    ...(canUseTimeClock ? [["Time Clock", "/time-clock"]] : []),
    ...(canViewOwnTimesheet ? [["My Timesheet", "/my-timesheet"]] : []),
    ...(canReviewTimesheets ? [["Timesheets", "/timesheets"]] : []),
    ...(canViewLabor ? [["Labor", "/labor"]] : []),
    ["Settings", "/settings"],
  ];
  return (
    <div className="dashboard-shell">
      <aside className="sidebar">
        <div>
          <div className="brand">Workforce Core</div>
          <div className="org-name">{context.organization.name} · {context.roleName}</div>
        </div>
        <nav className="nav" aria-label="Main navigation">
          {navigation.map(([label, href]) => <Link key={href} href={href}>{label}</Link>)}
        </nav>
        <div className="sidebar-footer">
          <form action={signOut}><button className="button ghost" type="submit">Sign out</button></form>
        </div>
      </aside>
      <main className="main">{children}</main>
    </div>
  );
}
