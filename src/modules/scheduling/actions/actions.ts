"use server";
import { processPendingNotifications } from "@/core/notifications/notification-service";
import { EVENT_TYPES, recordEvent } from "@/core/events/event-service";
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

async function mutation(formData: FormData, capability: "schedule.manage" | "schedule.publish" | "open_shift.manage", operation: () => Promise<unknown>, success: string) {
  const context = await requireOrganization();
  await requireCapability(context.organization.id, capability);
  const destination = schedulePath(formData);
  try {
    await operation();
  } catch (error) {
    redirectWithMessage(
      destination,
      error instanceof scheduling.SchedulingWarningError ? "warning" : "error",
      actionError(error),
    );
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
  const context = await requireOrganization();
  const values = formValues(formData);
  await mutation(formData, "schedule.manage", () => scheduling.createShift({
    ...values,
    organizationId: context.organization.id,
  }), "Shift created.");
}

export async function updateShiftAction(formData: FormData) {
  const values = formValues(formData);
  const destination = schedulePath(formData);
  const context = await requireOrganization();
  await requireCapability(context.organization.id, "schedule.manage");
  try {
    await scheduling.updateShift({ ...values, organizationId: context.organization.id });
  } catch (error) {
    const params = new URLSearchParams({
      [error instanceof scheduling.SchedulingWarningError ? "warning" : "error"]: actionError(error),
    });
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
  const context = await requireOrganization();
  const values = formValues(formData);
  await mutation(formData, "schedule.publish", async () => {
    await scheduling.publishSchedule(values);
    await recordEvent({
      organizationId: context.organization.id,
      eventType: EVENT_TYPES.schedulePublished,
      payload: {
        scheduleId: values.scheduleId ?? "",
        locationId: values.returnLocation ?? "",
        weekStart: values.returnWeek ?? "",
      },
    });
      await processPendingNotifications();
    }, "Schedule published.");  
}

export async function markShiftOpenAction(formData: FormData) {
  await mutation(formData, "open_shift.manage", () => scheduling.markShiftOpen(formValues(formData)), "Shift marked open.");
}
