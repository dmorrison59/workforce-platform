import type { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import type { employeeSchema } from "./schema";

type EmployeeInput = z.infer<typeof employeeSchema> & { organizationId: string };

/**
 * Creates a tenant-scoped employee record through the authoritative
 * `create_employee` RPC. Shared by the quick "Add employee" form action and
 * the onboarding wizard so both paths run the same permission and RLS checks
 * instead of duplicating the Supabase call.
 */
export async function createEmployee(input: EmployeeInput): Promise<string> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("create_employee", {
    target_organization_id: input.organizationId,
    employee_first_name: input.firstName,
    employee_last_name: input.lastName,
    employee_email: input.email,
    employee_phone: input.phone,
    employee_number_value: input.employeeNumber,
    employee_status: input.employmentStatus,
    employee_hire_date: input.hireDate,
    employee_hourly_rate: input.hourlyRate,
    employee_street_address: input.streetAddress,
    employee_address_line_2: input.addressLine2,
    employee_city: input.city,
    employee_state_province: input.stateProvince,
    employee_postal_code: input.postalCode,
    employee_country: input.country,
  });
  if (error) throw new Error(error.message);
  return data as string;
}
