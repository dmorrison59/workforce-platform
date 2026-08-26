import { createClient } from "@/lib/supabase/server";
import type { employeeSchema } from "./schema";
import type { z } from "zod";

export type EmployeeDetails = z.output<typeof employeeSchema>;

export async function createEmployeeRecord(organizationId: string, employee: EmployeeDetails) {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("create_employee", {
    target_organization_id: organizationId,
    employee_first_name: employee.firstName,
    employee_last_name: employee.lastName,
    employee_email: employee.email,
    employee_phone: employee.phone,
    employee_number_value: employee.employeeNumber,
    employee_status: employee.employmentStatus,
    employee_hire_date: employee.hireDate,
    employee_hourly_rate: employee.hourlyRate,
    employee_street_address: employee.streetAddress,
    employee_address_line_2: employee.addressLine2,
    employee_city: employee.city,
    employee_state_province: employee.stateProvince,
    employee_postal_code: employee.postalCode,
    employee_country: employee.country,
  });
  if (error) throw new Error(error.message);
  return data;
}
