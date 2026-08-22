"use server";

import { revalidatePath } from "next/cache";
import { ZodError } from "zod";
import { requireOrganization } from "@/core/auth/context";
import { requireCapability } from "@/core/permissions/capabilities";
import { formValues, redirectWithMessage } from "@/core/shared/forms";
import * as timeClock from "@/modules/time-clock/services/time-clock-service";

function errorMessage(error: unknown) {
  if (error instanceof ZodError) return error.issues[0]?.message ?? "Invalid time-clock details.";
  return error instanceof Error ? error.message : "The time-clock change could not be completed.";
}

function refreshTimeClock() {
  revalidatePath("/time-clock");
  revalidatePath("/my-timesheet");
  revalidatePath("/timesheets");
}

async function employeeMutation(
  formData: FormData,
  operation: (input: Record<string, FormDataEntryValue> & { organizationId: string }) => Promise<unknown>,
  success: string,
) {
  const context = await requireOrganization();
  await requireCapability(context.organization.id, "timeclock.use");
  try {
    await operation({ ...formValues(formData), organizationId: context.organization.id });
  } catch (error) {
    redirectWithMessage("/time-clock", "error", errorMessage(error));
  }
  refreshTimeClock();
  redirectWithMessage("/time-clock", "message", success);
}

export async function clockInAction(formData: FormData) {
  await employeeMutation(formData, timeClock.clockIn, "Clocked in successfully.");
}

export async function clockOutAction(formData: FormData) {
  await employeeMutation(formData, timeClock.clockOut, "Clocked out successfully.");
}

export async function startBreakAction(formData: FormData) {
  await employeeMutation(formData, timeClock.startBreak, "Break started.");
}

export async function endBreakAction(formData: FormData) {
  await employeeMutation(formData, timeClock.endBreak, "Break ended.");
}

export async function correctTimeEntryAction(formData: FormData) {
  const context = await requireOrganization();
  await requireCapability(context.organization.id, "timeclock.edit");
  try {
    await timeClock.correctTimeEntry(formValues(formData));
  } catch (error) {
    redirectWithMessage("/timesheets", "error", errorMessage(error));
  }
  refreshTimeClock();
  redirectWithMessage("/timesheets", "message", "Time entry corrected.");
}

export async function approveTimeEntryAction(formData: FormData) {
  const context = await requireOrganization();
  await requireCapability(context.organization.id, "timeclock.edit");
  try {
    await timeClock.approveTimeEntry(formValues(formData));
  } catch (error) {
    redirectWithMessage("/timesheets", "error", errorMessage(error));
  }
  refreshTimeClock();
  redirectWithMessage("/timesheets", "message", "Time entry approved.");
}
