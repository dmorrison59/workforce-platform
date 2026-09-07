"use server";

import { revalidatePath } from "next/cache";
import { requireOrganization } from "@/core/auth/context";
import { hasCapability } from "@/core/permissions/capabilities";
import { formValues, redirectWithMessage } from "@/core/shared/forms";
import { changeMembershipRole } from "./role-service";
import { membershipRoleChangeSchema, roleLabel } from "./role-schema";

export async function updateMembershipRole(formData: FormData) {
  const context = await requireOrganization();
  if (!(await hasCapability(context.organization.id, "settings.manage"))) {
    redirectWithMessage("/employees", "error", "Only an Owner can change organization roles.");
  }

  const parsed = membershipRoleChangeSchema.safeParse(formValues(formData));
  if (!parsed.success) {
    redirectWithMessage("/employees", "error", parsed.error.issues[0]?.message ?? "Choose a valid organization role.");
  }

  try {
    await changeMembershipRole(context.organization.id, parsed.data.membershipId, parsed.data.role);
  } catch (error) {
    redirectWithMessage(
      "/employees",
      "error",
      error instanceof Error ? error.message : "The role could not be changed. Refresh the page and try again.",
    );
  }

  revalidatePath("/employees");
  revalidatePath("/dashboard");
  redirectWithMessage("/employees", "message", `Role changed to ${roleLabel(parsed.data.role)}.`);
}
