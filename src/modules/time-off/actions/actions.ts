"use server";

import { revalidatePath } from "next/cache";
import { ZodError } from "zod";
import { requireOrganization } from "@/core/auth/context";
import { requireCapability } from "@/core/permissions/capabilities";
import { formValues, redirectWithMessage } from "@/core/shared/forms";
import {
  cancelMyTimeOffRequest,
  createMyTimeOffRequest,
  reviewTimeOffRequest,
} from "@/modules/time-off/services/time-off-service";

function message(error: unknown) {
  if (error instanceof ZodError) return error.issues[0]?.message ?? "Invalid time-off request.";
  return error instanceof Error ? error.message : "The time-off change could not be completed.";
}

async function selfServiceMutation(formData: FormData, operation: (values: Record<string, FormDataEntryValue>) => Promise<unknown>, success: string) {
  const context = await requireOrganization();
  await requireCapability(context.organization.id, "timeoff.request");
  try {
    await operation(formValues(formData));
  } catch (error) {
    redirectWithMessage("/time-off", "error", message(error));
  }
  revalidatePath("/time-off");
  revalidatePath("/time-off-requests");
  revalidatePath("/schedule");
  redirectWithMessage("/time-off", "message", success);
}

export async function createTimeOffRequestAction(formData: FormData) {
  const context = await requireOrganization();
  await selfServiceMutation(formData, (values) => createMyTimeOffRequest({
    ...values,
    organizationId: context.organization.id,
  }), "Time-off request submitted.");
}

export async function cancelTimeOffRequestAction(formData: FormData) {
  await selfServiceMutation(formData, cancelMyTimeOffRequest, "Time-off request cancelled.");
}

export async function reviewTimeOffRequestAction(formData: FormData) {
  const context = await requireOrganization();
  await requireCapability(context.organization.id, "timeoff.approve");
  try {
    await reviewTimeOffRequest(formValues(formData));
  } catch (error) {
    redirectWithMessage("/time-off-requests", "error", message(error));
  }
  revalidatePath("/time-off");
  revalidatePath("/time-off-requests");
  revalidatePath("/schedule");
  redirectWithMessage("/time-off-requests", "message", "Time-off request reviewed.");
}
