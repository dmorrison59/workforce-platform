import Link from "next/link";
import { DatePickerField } from "@/components/date-picker-field";
import { FormField, SelectField } from "@/components/form-field";
import { MessageBanner } from "@/components/message-banner";
import { PageHeader } from "@/components/page-header";
import { createEmployee } from "@/core/employees/actions";
import { AddressFields } from "@/core/employees/components/address-fields";

export default async function NewEmployeePage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const params = await searchParams;
  return (
    <>
      <PageHeader title="Add employee" description="A login can be linked later; it is not required." />
      <section className="panel form-panel employee-form-panel">
        <MessageBanner error={params.error} />
        <form action={createEmployee} className="form-grid employee-form">
          <fieldset className="employee-form-section">
            <legend>Personal</legend>
            <p>Contact details for the employee directory.</p>
            <div className="two-col">
              <FormField label="First name" name="firstName" autoComplete="given-name" required />
              <FormField label="Last name" name="lastName" autoComplete="family-name" required />
            </div>
            <div className="two-col">
              <FormField label="Email" name="email" type="email" autoComplete="email" required />
              <FormField label="Phone" name="phone" type="tel" autoComplete="tel" />
            </div>
          </fieldset>

          <fieldset className="employee-form-section">
            <legend>Address</legend>
            <p>Optional structured address details. Search for an address or enter it manually.</p>
            <AddressFields />
          </fieldset>

          <fieldset className="employee-form-section">
            <legend>Employment</legend>
            <p>Workforce status, start date, and wage details.</p>
            <div className="two-col">
              <FormField label="Employee number" name="employeeNumber" />
              <SelectField label="Employment status" name="employmentStatus" defaultValue="active">
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
                <option value="terminated">Terminated</option>
              </SelectField>
            </div>
            <div className="two-col">
              <DatePickerField
                label="Hire date"
                name="hireDate"
                hint="Select a calendar date; it is saved exactly as shown."
              />
              <FormField
                label="Hourly rate"
                name="hourlyRate"
                type="number"
                min="0"
                step="0.01"
                hint="Stored separately under wage-specific RLS."
              />
            </div>
          </fieldset>

          <div className="button-row">
            <button className="button" type="submit">Add employee</button>
            <Link className="button ghost" href="/employees">Cancel</Link>
          </div>
        </form>
      </section>
    </>
  );
}
