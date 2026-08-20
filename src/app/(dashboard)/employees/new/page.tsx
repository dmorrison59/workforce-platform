import Link from "next/link";
import { FormField, SelectField } from "@/components/form-field";
import { MessageBanner } from "@/components/message-banner";
import { PageHeader } from "@/components/page-header";
import { createEmployee } from "@/core/employees/actions";

export default async function NewEmployeePage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const params = await searchParams;
  return (<><PageHeader title="Add employee" description="A login can be linked later; it is not required." /><section className="panel form-panel"><MessageBanner error={params.error} /><form action={createEmployee} className="form-grid"><div className="two-col"><FormField label="First name" name="firstName" required /><FormField label="Last name" name="lastName" required /></div><div className="two-col"><FormField label="Email" name="email" type="email" required /><FormField label="Phone" name="phone" type="tel" /></div><div className="two-col"><FormField label="Employee number" name="employeeNumber" /><SelectField label="Employment status" name="employmentStatus" defaultValue="active"><option value="active">Active</option><option value="inactive">Inactive</option><option value="terminated">Terminated</option></SelectField></div><div className="two-col"><FormField label="Hire date" name="hireDate" type="date" /><FormField label="Hourly rate" name="hourlyRate" type="number" min="0" step="0.01" hint="Stored separately under wage-specific RLS." /></div><div className="button-row"><button className="button" type="submit">Add employee</button><Link className="button ghost" href="/employees">Cancel</Link></div></form></section></>);
}
