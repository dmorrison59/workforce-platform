import Link from "next/link";
import { MessageBanner } from "@/components/message-banner";
import { PageHeader } from "@/components/page-header";
import { requireOrganization, requireUser } from "@/core/auth/context";
import { MembershipRoleForm } from "@/core/employees/membership-role-form";
import type { OrganizationRole } from "@/core/employees/role-schema";
import { inviteEmployee, revokeInvitation } from "@/core/invitations/actions";
import { hasCapability } from "@/core/permissions/capabilities";

/* eslint-disable @typescript-eslint/no-explicit-any */
// The committed Database types predate employee_invitations and app_access_status.
function employeeRows(supabase: unknown) {
  return (supabase as any).from("employees");
}
function invitationRows(supabase: unknown) {
  return (supabase as any).from("employee_invitations");
}

export default async function EmployeesPage({ searchParams }: { searchParams: Promise<{ message?: string; error?: string; warning?: string }> }) {
  const context = await requireOrganization();
  const { supabase } = await requireUser();
  const canManageRoles = await hasCapability(context.organization.id, "settings.manage");

  const { data: employees } = await employeeRows(supabase)
    .select("id,profile_id,employee_number,first_name,last_name,email,phone,street_address,address_line_2,city,state_province,postal_code,country,employment_status,hire_date,app_access_status")
    .eq("organization_id", context.organization.id)
    .order("last_name");

  const [{ data: memberships }, { data: systemRoles }] = await Promise.all([
    supabase
      .from("organization_memberships")
      .select("id, profile_id, role_id, membership_role, status")
      .eq("organization_id", context.organization.id),
    supabase
      .from("roles")
      .select("id, name")
      .eq("organization_id", context.organization.id)
      .eq("is_system", true)
      .in("name", ["Employee", "Manager", "Owner"]),
  ]);

  const roleById = new Map((systemRoles ?? []).map((role) => [role.id, role.name]));
  const membershipByProfile = new Map(
    (memberships ?? []).filter((membership) => membership.status === "active")
      .map((membership) => [membership.profile_id, membership]),
  );
  const availableRoles = ["employee", "manager", "owner"].filter((role) =>
    (systemRoles ?? []).some((systemRole) => systemRole.name.toLowerCase() === role),
  ) as OrganizationRole[];
  const activeOwnerCount = (memberships ?? []).filter((membership) =>
    membership.status === "active"
      && membership.membership_role === "owner"
      && roleById.get(membership.role_id) === "Owner",
  ).length;

  const { data: invitations } = await invitationRows(supabase)
    .select("id, employee_id")
    .eq("organization_id", context.organization.id)
    .is("accepted_at", null)
    .is("revoked_at", null);
  const pendingByEmployee = new Map<string, string>(
    (invitations ?? []).map((i: any) => [String(i.employee_id), String(i.id)] as [string, string]),
  );

  const params = await searchParams;
  return (
    <>
      <PageHeader
        title="Employees"
        description="Employee records are independent of authentication accounts."
        action={
          <div className="button-row">
            <Link className="button" href="/employees/onboard">Onboard employee</Link>
            <Link className="button secondary" href="/employees/new">Add employee</Link>
          </div>
        }
      />
      <MessageBanner message={params.message} error={params.error} warning={params.warning} />
      <section className="panel table-wrap">
        {employees?.length ? (
          <table className="data-table">
            <thead>
              <tr>
                <th>Employee</th>
                <th>Number</th>
                <th>Contact</th>
                <th>Address</th>
                <th>Status</th>
                <th>App access</th>
                <th>Organization role</th>
                <th>Hire date</th>
              </tr>
            </thead>
            <tbody>
              {employees.map((employee: any) => {
                const address = [
                  employee.street_address,
                  employee.address_line_2,
                  [employee.city, [employee.state_province, employee.postal_code].filter(Boolean).join(" ")].filter(Boolean).join(", "),
                  employee.country,
                ].filter(Boolean);
                const pendingInvitationId = pendingByEmployee.get(employee.id);
                const membership = employee.profile_id ? membershipByProfile.get(employee.profile_id) : undefined;
                const systemRoleName = membership ? roleById.get(membership.role_id) : undefined;
                const currentRole = systemRoleName?.toLowerCase() as OrganizationRole | undefined;
                return (
                  <tr key={employee.id}>
                    <td><strong>{employee.first_name} {employee.last_name}</strong></td>
                    <td>{employee.employee_number ?? "—"}</td>
                    <td>
                      {employee.email}
                      <br />
                      <span className="muted">{employee.phone ?? "No phone"}</span>
                    </td>
                    <td>
                      {address.length ? address.map((line: string) => <span className="address-line" key={line}>{line}</span>) : "—"}
                    </td>
                    <td>
                      <span className={employee.employment_status === "active" ? "status" : "status off"}>
                        {employee.employment_status}
                      </span>
                    </td>
                    <td>
                      <span className={employee.app_access_status === "active" || employee.app_access_status === "invited" ? "status" : "status off"}>
                        {String(employee.app_access_status ?? "none")}
                      </span>
                      {employee.app_access_status !== "active" && (
                        <form action={inviteEmployee} className="inline">
                          <input type="hidden" name="employeeId" value={employee.id} />
                          <button className="button secondary" type="submit">
                            {employee.app_access_status === "invited" ? "Resend" : "Invite"}
                          </button>
                        </form>
                      )}
                      {employee.app_access_status === "invited" && pendingInvitationId && (
                        <form action={revokeInvitation} className="inline">
                          <input type="hidden" name="invitationId" value={pendingInvitationId} />
                          <button className="button secondary" type="submit">Revoke</button>
                        </form>
                      )}
                    </td>
                    <td>
                      {membership && currentRole && availableRoles.includes(currentRole) ? (
                        canManageRoles ? (
                          <MembershipRoleForm
                            membershipId={membership.id}
                            currentRole={currentRole}
                            availableRoles={availableRoles}
                            isLastOwner={currentRole === "owner" && activeOwnerCount === 1}
                          />
                        ) : (
                          <div className="role-access">
                            <strong>Access &amp; Role</strong>
                            <span>{systemRoleName}</span>
                          </div>
                        )
                      ) : (
                        <span className="muted">
                          {employee.profile_id ? "No active organization membership" : "No linked app account"}
                        </span>
                      )}
                    </td>
                    <td>{employee.hire_date ?? "—"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        ) : (
          <div className="empty">No employees yet. Add the first employee to begin your directory.</div>
        )}
      </section>
    </>
  );
}
