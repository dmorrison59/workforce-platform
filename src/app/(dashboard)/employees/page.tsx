import Link from "next/link";
import { MessageBanner } from "@/components/message-banner";
import { PageHeader } from "@/components/page-header";
import { requireOrganization, requireUser } from "@/core/auth/context";

export default async function EmployeesPage({ searchParams }: { searchParams: Promise<{ message?: string }> }) {
  const context = await requireOrganization();
  const { supabase } = await requireUser();
  const { data: employees } = await supabase.from("employees").select("id,employee_number,first_name,last_name,email,phone,street_address,address_line_2,city,state_province,postal_code,country,employment_status,hire_date").eq("organization_id", context.organization.id).order("last_name");
  const params = await searchParams;
  return (
    <>
      <PageHeader title="Employees" description="Employee records are independent of authentication accounts." action={<Link className="button" href="/employees/new">Add employee</Link>} />
      <MessageBanner message={params.message} />
      <section className="panel table-wrap">
        {employees?.length ? <table className="data-table"><thead><tr><th>Employee</th><th>Number</th><th>Contact</th><th>Address</th><th>Status</th><th>Hire date</th></tr></thead><tbody>{employees.map((employee) => {
          const address = [
            employee.street_address,
            employee.address_line_2,
            [employee.city, [employee.state_province, employee.postal_code].filter(Boolean).join(" ")].filter(Boolean).join(", "),
            employee.country,
          ].filter(Boolean);
          return <tr key={employee.id}><td><strong>{employee.first_name} {employee.last_name}</strong></td><td>{employee.employee_number ?? "—"}</td><td>{employee.email}<br /><span className="muted">{employee.phone ?? "No phone"}</span></td><td>{address.length ? address.map((line) => <span className="address-line" key={line}>{line}</span>) : "—"}</td><td><span className={employee.employment_status === "active" ? "status" : "status off"}>{employee.employment_status}</span></td><td>{employee.hire_date ?? "—"}</td></tr>;
        })}</tbody></table> : <div className="empty">No employees yet. Add the first employee to begin your directory.</div>}
      </section>
    </>
  );
}
