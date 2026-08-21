"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { ZodError } from "zod";
import { requireOrganization } from "@/core/auth/context";
import { requireCapability } from "@/core/permissions/capabilities";
import { formValues, redirectWithMessage } from "@/core/shared/forms";
import * as scheduling from "@/modules/scheduling/services/scheduling-service";

function schedulePath(formData: FormData) {
  const location = String(formData.get("returnLocation") ?? "");
  const week = String(formData.get("returnWeek") ?? "");
  const params = new URLSearchParams();
  if (/^[0-9a-f-]{36}$/i.test(location)) params.set("location", location);
  if (/^\d{4}-\d{2}-\d{2}$/.test(week)) params.set("week", week);
  return `/schedule${params.size ? `?${params}` : ""}`;
}

function actionError(error: unknown) {
  if (error instanceof ZodError) return error.issues[0]?.message ?? "Invalid scheduling details.";
  return error instanceof Error ? error.message : "The scheduling change could not be completed.";
}

async function mutation(formData: FormData, capability: "schedule.manage" | "schedule.publish", operation: () => Promise<unknown>, success: string) {
  const context = await requireOrganization();
  await requireCapability(context.organization.id, capability);
  const destination = schedulePath(formData);
  try {
    await operation();
  } catch (error) {
    redirectWithMessage(destination, "error", actionError(error));
  }
  revalidatePath("/schedule");
  revalidatePath("/my-schedule");
  redirectWithMessage(destination, "message", success);
}

export async function createScheduleAction(formData: FormData) {
  const context = await requireOrganization();
  const values = formValues(formData);
  await mutation(formData, "schedule.manage", () => scheduling.createWeeklySchedule({
    organizationId: context.organization.id,
    locationId: values.locationId,
    weekStart: values.weekStart,
  }), "Draft schedule created.");
}

export async function createShiftAction(formData: FormData) {
  const values = formValues(formData);
  await mutation(formData, "schedule.manage", () => scheduling.createShift(values), "Shift created.");
}

export async function updateShiftAction(formData: FormData) {
  const values = formValues(formData);
  const destination = schedulePath(formData);
  const context = await requireOrganization();
  await requireCapability(context.organization.id, "schedule.manage");
  try {
    await scheduling.updateShift(values);
  } catch (error) {
    const params = new URLSearchParams({ error: actionError(error) });
    redirect(`/schedule/shifts/${String(values.shiftId)}/edit?${params}`);
  }
  revalidatePath("/schedule");
  revalidatePath("/my-schedule");
  redirectWithMessage(destination, "message", "Shift updated.");
}

export async function deleteShiftAction(formData: FormData) {
  await mutation(formData, "schedule.manage", () => scheduling.deleteShift(formValues(formData)), "Shift deleted.");
}

export async function copyShiftAction(formData: FormData) {
  await mutation(formData, "schedule.manage", () => scheduling.copyShift(formValues(formData)), "Shift copied.");
}

export async function copyWeekAction(formData: FormData) {
  const values = formValues(formData);
  const context = await requireOrganization();
  await requireCapability(context.organization.id, "schedule.manage");
  try {
    await scheduling.copyWeek(values);
  } catch (error) {
    redirectWithMessage(schedulePath(formData), "error", actionError(error));
  }
  revalidatePath("/schedule");
  redirect(`/schedule?location=${encodeURIComponent(String(values.returnLocation))}&week=${encodeURIComponent(String(values.targetWeekStart))}&message=Week+copied`);
}

export async function publishScheduleAction(formData: FormData) {
  await mutation(formData, "schedule.publish", () => scheduling.publishSchedule(formValues(formData)), "Schedule published.");
}
