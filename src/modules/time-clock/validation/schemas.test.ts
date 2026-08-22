import { describe, expect, it } from "vitest";
import {
  clockInSchema,
  correctionSchema,
  timeClockOrganizationSchema,
  timeEntryIdSchema,
} from "@/modules/time-clock/validation/schemas";

const organizationId = "10000000-0000-4000-8000-000000000001";
const locationId = "10000000-0000-4000-8000-000000000002";
const entryId = "10000000-0000-4000-8000-000000000003";

describe("Gate 4 time-clock schemas", () => {
  it("accepts clock-in with or without a scheduled shift", () => {
    expect(clockInSchema.safeParse({ organizationId, locationId, shiftId: "" }).success).toBe(true);
    expect(clockInSchema.safeParse({ organizationId, locationId, shiftId: entryId }).success).toBe(true);
  });

  it("rejects malformed organization and entry identifiers", () => {
    expect(timeClockOrganizationSchema.safeParse({ organizationId: "bad" }).success).toBe(false);
    expect(timeEntryIdSchema.safeParse({ entryId: "bad" }).success).toBe(false);
  });

  it("requires ordered local correction times and a reason", () => {
    const valid = {
      entryId,
      locationId,
      clockInLocal: "2026-08-17T09:00",
      clockOutLocal: "2026-08-17T17:00",
      correctionNote: "Manager verified the paper log.",
    };
    expect(correctionSchema.safeParse(valid).success).toBe(true);
    expect(correctionSchema.safeParse({ ...valid, clockOutLocal: valid.clockInLocal }).success).toBe(false);
    expect(correctionSchema.safeParse({ ...valid, correctionNote: " " }).success).toBe(false);
  });
});
