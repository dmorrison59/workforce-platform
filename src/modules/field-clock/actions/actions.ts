"use server";

import { revalidatePath } from "next/cache";
import { ZodError } from "zod";
import { requireOrganization } from "@/core/auth/context";
import { requireCapability } from "@/core/permissions/capabilities";
import { formValues, redirectWithMessage } from "@/core/shared/forms";
import * as fieldClock from "@/modules/field-clock/services/field-clock-service";

function errorMessage(error: unknown) {
  if (error instanceof ZodError) return error.issues[0]?.message ?? "Invalid field-clock details.";
  return error instanceof Error ? error.message : "The field-clock change could not be completed.";
}

function refresh() {
  revalidatePath("/time-clock");
  revalidatePath("/field-clock");
  revalidatePath("/timesheets");
  revalidatePath("/my-timesheet");
}

export async function fieldClockInAction(formData: FormData) {
  const context = await requireOrganization();
  await requireCapability(context.organization.id, "field_clock.use");
  let result;
  try {
    result = await fieldClock.attemptClockIn({
      ...formValues(formData), organizationId: context.organization.id,
    });
  } catch (error) {
    redirectWithMessage("/time-clock", "error", errorMessage(error));
  }
  refresh();
  if (result.status === "outside_radius") {
    redirectWithMessage("/time-clock", "error", `Clock-in blocked: ${Math.round(result.distanceM)} m from the job site, outside the allowed radius.`);
  }
  if (result.status === "low_accuracy") {
    redirectWithMessage("/time-clock", "error", "Clock-in blocked because the device location accuracy is too low. Try again or ask a manager to review it.");
  }
  redirectWithMessage("/time-clock", "message", "Location verified and clock-in recorded.");
}

export async function fieldClockOverrideUseAction(formData: FormData) {
  const context = await requireOrganization();
  await requireCapability(context.organization.id, "field_clock.use");
  try {
    await fieldClock.clockInWithOverride(formValues(formData));
  } catch (error) {
    redirectWithMessage("/time-clock", "error", errorMessage(error));
  }
  refresh();
  redirectWithMessage("/time-clock", "message", "Clock-in recorded with the approved manager override.");
}

export async function configureFieldClockAction(formData: FormData) {
  const context = await requireOrganization();
  await requireCapability(context.organization.id, "field_clock.manage");
  try {
    await fieldClock.configure({ ...formValues(formData), organizationId: context.organization.id });
  } catch (error) {
    redirectWithMessage("/field-clock", "error", errorMessage(error));
  }
  refresh();
  redirectWithMessage("/field-clock", "message", "Field clock settings updated.");
}

export async function overrideFieldClockAction(formData: FormData) {
  const context = await requireOrganization();
  await requireCapability(context.organization.id, "field_clock.override");
  try {
    await fieldClock.overrideVerification(formValues(formData));
  } catch (error) {
    redirectWithMessage("/field-clock", "error", errorMessage(error));
  }
  refresh();
  redirectWithMessage("/field-clock", "message", "Verification override approved and audited.");
}

export async function updateJobCoordinatesAction(formData: FormData) {
  const context = await requireOrganization();
  await requireCapability(context.organization.id, "field_clock.manage");
  try {
    await fieldClock.updateJobCoordinates(formValues(formData));
  } catch (error) {
    redirectWithMessage("/jobs", "error", errorMessage(error));
  }
  revalidatePath("/jobs");
  revalidatePath("/my-jobs");
  redirectWithMessage("/jobs", "message", "Job verification coordinates updated.");
}
