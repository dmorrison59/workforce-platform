"use server";

import { redirect } from "next/navigation";
import { requireOrganization } from "@/core/auth/context";
import { requireCapability } from "@/core/permissions/capabilities";
import { formValues, redirectWithMessage } from "@/core/shared/forms";
import { employeeSchema } from "./schema";
import { createEmployee as createEmployeeRecord } from "./service";

export async function createEmployee(formData: FormData) {
  const context = await requireOrganization();
  await requireCapability(context.organization.id, "employee.manage");
  const parsed = employeeSchema.safeParse(formValues(formData));
  if (!parsed.success) {
    redirectWithMessage("/employees/new", "error", parsed.error.issues[0]?.message ?? "Invalid employee details.");
  }

  try {
    await createEmployeeRecord({ ...parsed.data, organizationId: context.organization.id });
  } catch (error) {
    redirectWithMessage("/employees/new", "error", error instanceof Error ? error.message : "The employee could not be created.");
  }
  redirect("/employees?message=Employee+added");
}
