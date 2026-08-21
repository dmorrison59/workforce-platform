import { z } from "zod";

const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use a valid date.");
const optionalDate = z.string().trim().transform((value) => value || null)
  .pipe(z.union([date, z.null()]));
const optionalTime = z.string().trim().transform((value) => value || null)
  .pipe(z.union([z.string().regex(/^\d{2}:\d{2}$/, "Use a valid time."), z.null()]));

export const availabilitySchema = z.object({
  organizationId: z.string().uuid(),
  dayOfWeek: z.coerce.number().int().min(1, "Select a valid weekday.").max(7, "Select a valid weekday."),
  available: z.preprocess((value) => value === true || value === "on", z.boolean()),
  startTime: optionalTime,
  endTime: optionalTime,
  effectiveFrom: date,
  effectiveUntil: optionalDate,
}).superRefine((value, context) => {
  if (value.effectiveUntil && value.effectiveUntil < value.effectiveFrom) {
    context.addIssue({ code: "custom", path: ["effectiveUntil"], message: "Effective end date must be on or after its start." });
  }
  if (value.available && (!value.startTime || !value.endTime)) {
    context.addIssue({ code: "custom", path: ["startTime"], message: "Available days require start and end times." });
  } else if (value.available && value.startTime && value.endTime && value.endTime <= value.startTime) {
    context.addIssue({ code: "custom", path: ["endTime"], message: "Availability end time must be after its start." });
  }
});

export const availabilityIdSchema = z.object({ availabilityId: z.string().uuid() });

