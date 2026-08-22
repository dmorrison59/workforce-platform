import { z } from "zod";

const uuid = z.string().uuid("Select a valid record.");
const optionalUuid = z.preprocess((value) => value || null, z.string().uuid().nullable());

export const coverageRequestIdSchema = z.object({ requestId: uuid });
export const openShiftRequestSchema = z.object({ organizationId: uuid, shiftId: uuid });
export const shiftSwapRequestSchema = z.object({
  organizationId: uuid,
  shiftId: uuid,
  targetEmployeeId: optionalUuid,
});
export const coverageDenialSchema = coverageRequestIdSchema.extend({
  decision: z.literal("denied"),
  managerNote: z.string().trim().max(2000, "Manager note must be 2,000 characters or fewer."),
});
export const coverageApprovalSchema = coverageRequestIdSchema.extend({
  managerNote: z.string().trim().max(2000, "Manager note must be 2,000 characters or fewer."),
  overrideWarnings: z.preprocess((value) => value === true || value === "on", z.boolean()),
});
