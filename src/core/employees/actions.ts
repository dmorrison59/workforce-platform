"use server";

import { redirect } from "next/navigation";
import { requireOrganization, requireUser } from "@/core/auth/context";
import { requireCapability } from "@/core/permissions/capabilities";
import { formValues, redirectWithMessage } from "@/core/shared/forms";
import { employeeSchema } from "./schema";

export async function createEmployee(formData: FormData) {
  const context = await requireOrganization();
  await requireCapability(context.organization.id, "employee.manage");
  const parsed = employeeSchema.safeParse(formValues(formData));
  if (!parsed.success) {
    redirectWithMessage("/employees/new", "error", parsed.error.issues[0]?.message ?? "Invalid employee details.");
  }

  const { supabase } = await requireUser();
  const { error } = await supabase.rpc("create_employee", {
    target_organization_id: context.organization.id,
    employee_first_name: parsed.data.firstName,
    employee_last_name: parsed.data.lastName,
    employee_email: parsed.data.email,
    employee_phone: parsed.data.phone,
    employee_number_value: parsed.data.employeeNumber,
    employee_status: parsed.data.employmentStatus,
    employee_hire_date: parsed.data.hireDate,
    employee_hourly_rate: parsed.data.hourlyRate,
    employee_street_address: parsed.data.streetAddress,
    employee_address_line_2: parsed.data.addressLine2,
    employee_city: parsed.data.city,
    employee_state_province: parsed.data.stateProvince,
    employee_postal_code: parsed.data.postalCode,
    employee_country: parsed.data.country,
  });
  if (error) redirectWithMessage("/employees/new", "error", error.message);
  redirect("/employees?message=Employee+added");
}
