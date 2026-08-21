"use server";

import { revalidatePath } from "next/cache";
import { ZodError } from "zod";
import { requireOrganization } from "@/core/auth/context";
import { requireCapability } from "@/core/permissions/capabilities";
import { formValues, redirectWithMessage } from "@/core/shared/forms";
import { deleteMyAvailability, saveMyAvailability } from "@/modules/availability/services/availability-service";

function message(error: unknown) {
  if (error instanceof ZodError) return error.issues[0]?.message ?? "Invalid availability.";
  return error instanceof Error ? error.message : "Availability could not be saved.";
}

export async function saveAvailabilityAction(formData: FormData) {
  const context = await requireOrganization();
  await requireCapability(context.organization.id, "availability.manage_self");
  try {
    await saveMyAvailability({ ...formValues(formData), organizationId: context.organization.id });
  } catch (error) {
    redirectWithMessage("/my-availability", "error", message(error));
  }
  revalidatePath("/my-availability");
  revalidatePath("/schedule");
  redirectWithMessage("/my-availability", "message", "Availability saved.");
}

export async function deleteAvailabilityAction(formData: FormData) {
  const context = await requireOrganization();
  await requireCapability(context.organization.id, "availability.manage_self");
  try {
    await deleteMyAvailability(formValues(formData));
  } catch (error) {
    redirectWithMessage("/my-availability", "error", message(error));
  }
  revalidatePath("/my-availability");
  revalidatePath("/schedule");
  redirectWithMessage("/my-availability", "message", "Availability period removed.");
}

