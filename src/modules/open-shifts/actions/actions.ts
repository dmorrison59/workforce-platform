"use server";

import { revalidatePath } from "next/cache";
import { ZodError } from "zod";
import { requireOrganization } from "@/core/auth/context";
import { requireCapability } from "@/core/permissions/capabilities";
import { formValues, redirectWithMessage } from "@/core/shared/forms";
import * as scheduling from "@/modules/scheduling/services/scheduling-service";
import {
  cancelMyOpenShiftRequest,
  createMyOpenShiftRequest,
  denyOpenShiftRequest,
} from "@/modules/open-shifts/services/open-shift-service";

function errorMessage(error: unknown) {
  if (error instanceof ZodError) return error.issues[0]?.message ?? "Invalid open-shift request.";
  return error instanceof Error ? error.message : "The open-shift change could not be completed.";
}

function refreshCoverage() {
  revalidatePath("/open-shifts");
  revalidatePath("/coverage-requests");
  revalidatePath("/schedule");
  revalidatePath("/my-schedule");
}

export async function requestOpenShiftAction(formData: FormData) {
  const context = await requireOrganization();
  await requireCapability(context.organization.id, "open_shift.request");
  try {
    await createMyOpenShiftRequest({
      ...formValues(formData),
      organizationId: context.organization.id,
    });
  } catch (error) {
    redirectWithMessage("/open-shifts", "error", errorMessage(error));
  }
  refreshCoverage();
  redirectWithMessage("/open-shifts", "message", "Open shift requested.");
}

export async function cancelOpenShiftRequestAction(formData: FormData) {
  const context = await requireOrganization();
  await requireCapability(context.organization.id, "open_shift.request");
  try {
    await cancelMyOpenShiftRequest(formValues(formData));
  } catch (error) {
    redirectWithMessage("/open-shifts", "error", errorMessage(error));
  }
  refreshCoverage();
  redirectWithMessage("/open-shifts", "message", "Open-shift request cancelled.");
}

export async function reviewOpenShiftRequestAction(formData: FormData) {
  const context = await requireOrganization();
  await requireCapability(context.organization.id, "open_shift.manage");
  const values = formValues(formData);
  try {
    if (values.decision === "approved") {
      await scheduling.approveOpenShiftRequest(values);
    } else {
      await denyOpenShiftRequest(values);
    }
  } catch (error) {
    redirectWithMessage(
      "/coverage-requests",
      error instanceof scheduling.SchedulingWarningError ? "warning" : "error",
      errorMessage(error),
    );
  }
  refreshCoverage();
  redirectWithMessage("/coverage-requests", "message", "Open-shift request reviewed.");
}
