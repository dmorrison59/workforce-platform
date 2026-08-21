import { z } from "zod";

const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use a valid date.");

export const timeOffRequestSchema = z.object({
  organizationId: z.string().uuid(),
  startDate: date,
  endDate: date,
  reason: z.string().trim().max(2000, "Reason must be 2,000 characters or fewer."),
}).refine((value) => value.endDate >= value.startDate, {
  path: ["endDate"],
  message: "End date must be on or after the start date.",
});

export const timeOffIdSchema = z.object({ requestId: z.string().uuid() });

export const timeOffReviewSchema = timeOffIdSchema.extend({
  decision: z.enum(["approved", "denied"]),
  managerNote: z.string().trim().max(2000, "Manager note must be 2,000 characters or fewer."),
});

