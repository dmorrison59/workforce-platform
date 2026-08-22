import { z } from "zod";

const uuid = z.string().uuid("Select a valid record.");
const optionalUuid = z.preprocess((value) => value || null, z.string().uuid().nullable());
const localDateTime = z.string().regex(
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/,
  "Use a valid local date and time.",
);

export const clockInSchema = z.object({
  organizationId: uuid,
  locationId: uuid,
  shiftId: optionalUuid,
});
export const timeClockOrganizationSchema = z.object({ organizationId: uuid });
export const timeEntryIdSchema = z.object({ entryId: uuid });
export const correctionSchema = timeEntryIdSchema.extend({
  locationId: uuid,
  clockInLocal: localDateTime,
  clockOutLocal: localDateTime,
  correctionNote: z.string().trim()
    .min(1, "A correction reason is required.")
    .max(2000, "Correction reason must be 2,000 characters or fewer."),
}).refine((value) => value.clockOutLocal > value.clockInLocal, {
  path: ["clockOutLocal"],
  message: "Corrected clock-out must be after clock-in.",
});
