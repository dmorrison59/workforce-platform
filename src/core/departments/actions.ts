"use server";

import { redirect } from "next/navigation";
import { requireOrganization, requireUser } from "@/core/auth/context";
import { requireCapability } from "@/core/permissions/capabilities";
import { formValues, redirectWithMessage } from "@/core/shared/forms";
import { departmentSchema } from "./schema";

export async function createDepartment(formData: FormData) {
  const context = await requireOrganization();
  await requireCapability(context.organization.id, "department.manage");
  const parsed = departmentSchema.safeParse(formValues(formData));
  if (!parsed.success) {
    redirectWithMessage("/departments/new", "error", parsed.error.issues[0]?.message ?? "Invalid department details.");
  }

  const { supabase } = await requireUser();
  const { error } = await supabase.from("departments").insert({
    organization_id: context.organization.id,
    name: parsed.data.name,
    location_id: parsed.data.locationId,
  });
  if (error) redirectWithMessage("/departments/new", "error", error.message);
  redirect("/departments?message=Department+added");
}
