"use server";

import { revalidatePath } from "next/cache";
import { ZodError } from "zod";
import { requireOrganization } from "@/core/auth/context";
import { requireCapability } from "@/core/permissions/capabilities";
import { formValues, redirectWithMessage } from "@/core/shared/forms";
import * as scheduling from "@/modules/scheduling/services/scheduling-service";
import {
  cancelMyShiftSwapRequest,
  createMyShiftSwapRequest,
  denyShiftSwapRequest,
} from "@/modules/shift-swaps/services/shift-swap-service";

function errorMessage(error: unknown) {
  if (error instanceof ZodError) return error.issues[0]?.message ?? "Invalid shift-swap request.";
  return error instanceof Error ? error.message : "The shift-swap change could not be completed.";
}

function refreshCoverage() {
  revalidatePath("/shift-swaps");
  revalidatePath("/coverage-requests");
  revalidatePath("/schedule");
  revalidatePath("/my-schedule");
}

export async function requestShiftSwapAction(formData: FormData) {
  const context = await requireOrganization();
  await requireCapability(context.organization.id, "shift_swap.request");
  try {
    await createMyShiftSwapRequest({
      ...formValues(formData),
      organizationId: context.organization.id,
    });
  } catch (error) {
    redirectWithMessage("/shift-swaps", "error", errorMessage(error));
  }
  refreshCoverage();
  redirectWithMessage("/shift-swaps", "message", "Shift swap requested.");
}

export async function cancelShiftSwapRequestAction(formData: FormData) {
  const context = await requireOrganization();
  await requireCapability(context.organization.id, "shift_swap.request");
  try {
    await cancelMyShiftSwapRequest(formValues(formData));
  } catch (error) {
    redirectWithMessage("/shift-swaps", "error", errorMessage(error));
  }
  refreshCoverage();
  redirectWithMessage("/shift-swaps", "message", "Shift-swap request cancelled.");
}

export async function reviewShiftSwapRequestAction(formData: FormData) {
  const context = await requireOrganization();
  await requireCapability(context.organization.id, "shift_swap.approve");
  const values = formValues(formData);
  try {
    if (values.decision === "approved") {
      await scheduling.approveShiftSwap(values);
    } else {
      await denyShiftSwapRequest(values);
    }
  } catch (error) {
    redirectWithMessage(
      "/coverage-requests",
      error instanceof scheduling.SchedulingWarningError ? "warning" : "error",
      errorMessage(error),
    );
  }
  refreshCoverage();
  redirectWithMessage("/coverage-requests", "message", "Shift-swap request reviewed.");
}
