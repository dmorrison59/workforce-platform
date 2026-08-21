import { z } from "zod";

const uuid = z.string().uuid("Select a valid record.");
const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use a valid date.");
const localDateTime = z.string().regex(
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/,
  "Use a valid date and time.",
);
const optionalUuid = z.string().transform((value) => value || null).pipe(z.union([z.string().uuid(), z.null()]));

export const weeklyScheduleSchema = z.object({
  organizationId: uuid,
  locationId: uuid,
  weekStart: date.refine((value) => new Date(`${value}T00:00:00Z`).getUTCDay() === 1, "Week must start on Monday."),
});

export const shiftSchema = z.object({
  scheduleId: uuid,
  departmentId: uuid,
  roleId: optionalUuid,
  employeeId: optionalUuid,
  startLocal: localDateTime,
  endLocal: localDateTime,
  breakMinutes: z.coerce.number().int("Break must use whole minutes.").min(0, "Break cannot be negative."),
  notes: z.string().trim().max(2000, "Notes must be 2,000 characters or fewer."),
}).superRefine((value, context) => {
  if (value.endLocal <= value.startLocal) {
    context.addIssue({ code: "custom", path: ["endLocal"], message: "End time must be after start time." });
  }
  const durationMinutes = (Date.parse(`${value.endLocal}Z`) - Date.parse(`${value.startLocal}Z`)) / 60_000;
  if (Number.isFinite(durationMinutes) && value.breakMinutes > durationMinutes) {
    context.addIssue({ code: "custom", path: ["breakMinutes"], message: "Break cannot exceed the shift length." });
  }
});

export const updateShiftSchema = shiftSchema.and(z.object({ shiftId: uuid }));
export const shiftIdSchema = z.object({ shiftId: uuid });
export const scheduleIdSchema = z.object({ scheduleId: uuid });
export const assignmentSchema = z.object({ shiftId: uuid, employeeId: uuid });
export const copyShiftSchema = z.object({ shiftId: uuid, targetDate: date });
export const copyWeekSchema = z.object({
  scheduleId: uuid,
  targetWeekStart: date.refine((value) => new Date(`${value}T00:00:00Z`).getUTCDay() === 1, "Week must start on Monday."),
});
