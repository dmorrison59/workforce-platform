import Link from "next/link";
import { signOut } from "@/core/auth/actions";
import { requireOrganization } from "@/core/auth/context";
import { hasCapability } from "@/core/permissions/capabilities";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const context = await requireOrganization();
  const [canManageSchedules, canViewSchedules] = await Promise.all([
    hasCapability(context.organization.id, "schedule.manage"),
    hasCapability(context.organization.id, "schedule.view"),
  ]);
  const navigation = [
    ["Dashboard", "/dashboard"],
    ["Employees", "/employees"],
    ["Locations", "/locations"],
    ["Departments", "/departments"],
    ...(canManageSchedules ? [["Schedule", "/schedule"]] : []),
    ...(canViewSchedules ? [["My Schedule", "/my-schedule"]] : []),
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
