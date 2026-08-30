import Link from "next/link";
import { Suspense } from "react";
import { DashboardNavigation } from "@/components/dashboard-navigation";
import { signOut } from "@/core/auth/actions";
import { requireOrganization } from "@/core/auth/context";
import { hasCapability } from "@/core/permissions/capabilities";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const context = await requireOrganization();
  const [canManageSchedules, canViewSchedules, canManageAvailability, canViewOwnTimeOff, canApproveTimeOff, canViewOpenShifts, canRequestSwaps, canManageCoverage, canUseTimeClock, canViewOwnTimesheet, canReviewTimesheets, canViewLabor, canManageCrews, canViewJobs, canManageJobs, canManageFieldClock] = await Promise.all([
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
    hasCapability(context.organization.id, "crew.manage"),
    hasCapability(context.organization.id, "job.view"),
    hasCapability(context.organization.id, "job.manage"),
    hasCapability(context.organization.id, "field_clock.manage"),
  ]);
  const navigation = [
    { label: "Dashboard", href: "/dashboard", group: "Workspace" },
    { label: "Dashboard", href: "/dashboard", group: "Workspace" },
{ label: "Help", href: "/help", group: "Workspace" },
    { label: "Employees", href: "/employees", group: "Workforce" },
    { label: "Locations", href: "/locations", group: "Workforce" },
    { label: "Departments", href: "/departments", group: "Workforce" },
    ...(canManageSchedules ? [{ label: "Schedule", href: "/schedule", group: "Management" }] : []),
    ...(canViewSchedules ? [{ label: "My Schedule", href: "/my-schedule", group: "My work" }] : []),
    ...(canManageAvailability ? [{ label: "My Availability", href: "/my-availability", group: "My work" }] : []),
    ...(canViewOwnTimeOff ? [{ label: "Time Off", href: "/time-off", group: "My work" }] : []),
    ...(canApproveTimeOff ? [{ label: "Time Off Requests", href: "/time-off-requests", group: "Management" }] : []),
    ...(canViewOpenShifts ? [{ label: "Open Shifts", href: "/open-shifts", group: "My work" }] : []),
    ...(canRequestSwaps ? [{ label: "Shift Swaps", href: "/shift-swaps", group: "My work" }] : []),
    ...(canManageCoverage ? [{ label: "Coverage Requests", href: "/coverage-requests", group: "Management" }] : []),
    ...(canUseTimeClock ? [{ label: "Time Clock", href: "/time-clock", group: "My work" }] : []),
    ...(canViewOwnTimesheet ? [{ label: "My Timesheet", href: "/my-timesheet", group: "My work" }] : []),
    ...(canReviewTimesheets ? [{ label: "Timesheets", href: "/timesheets", group: "Management" }] : []),
    ...(canViewLabor ? [{ label: "Labor", href: "/labor", group: "Management" }] : []),
    ...(canManageCrews ? [{ label: "Crews", href: "/crews", group: "Fieldwork" }] : []),
    ...(canManageJobs ? [{ label: "Jobs", href: "/jobs", group: "Fieldwork" }] : []),
    ...(canViewJobs && !canManageJobs ? [{ label: "My Jobs", href: "/my-jobs", group: "My work" }] : []),
    ...(canManageFieldClock ? [{ label: "Field Clock", href: "/field-clock", group: "Fieldwork" }] : []),
    { label: "Settings", href: "/settings", group: "Workspace" },
  ];
  return (
    <div className="dashboard-shell">
      <aside className="sidebar">
        <div className="sidebar-heading">
          <Link className="brand-lockup" href="/dashboard" aria-label="Workforce Core dashboard">
            <span className="brand-mark" aria-hidden="true">W</span>
            <span className="brand">Workforce Core</span>
          </Link>
          <div className="org-name"><span>{context.organization.name}</span><span className="role-pill">{context.roleName}</span></div>
        </div>
        <Suspense fallback={<nav className="nav" aria-label="Main navigation" />}>
          <DashboardNavigation items={navigation} />
        </Suspense>
        <div className="sidebar-footer">
          <form action={signOut}><button className="button ghost" type="submit">Sign out</button></form>
        </div>
      </aside>
      <main className="main"><div className="main-inner">{children}</div></main>
    </div>
  );
}
