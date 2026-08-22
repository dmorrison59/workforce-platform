import { describe, expect, it } from "vitest";
import {
  fieldClockAttemptSchema,
  fieldClockOverrideSchema,
  fieldClockSettingsSchema,
  jobCoordinatesSchema,
} from "@/modules/field-clock/validation/schemas";

const organizationId = "00000000-0000-4000-8000-000000000001";

describe("field clock validation", () => {
  it("rejects invalid submitted coordinates", () => {
    expect(fieldClockAttemptSchema.safeParse({
      organizationId,
      jobId: organizationId,
      locationId: organizationId,
      shiftId: "",
      latitude: 91,
      longitude: -181,
      accuracyM: 10,
    }).success).toBe(false);
  });

  it("accepts radius and accuracy limits at their boundaries", () => {
    expect(fieldClockSettingsSchema.safeParse({
      organizationId,
      enabled: "on",
      allowedRadiusM: 25,
      maxAccuracyM: 1000,
      managerOverrideEnabled: "on",
    }).success).toBe(true);
  });

  it("rejects an out-of-bounds radius", () => {
    expect(fieldClockSettingsSchema.safeParse({
      organizationId,
      allowedRadiusM: 5001,
      maxAccuracyM: 100,
    }).success).toBe(false);
  });

  it("requires coordinate pairs", () => {
    expect(jobCoordinatesSchema.safeParse({
      jobId: organizationId,
      latitude: 40.7128,
      longitude: "",
    }).success).toBe(false);
  });

  it("requires a meaningful manager override reason", () => {
    expect(fieldClockOverrideSchema.safeParse({
      verificationId: organizationId,
      reason: "  ",
    }).success).toBe(false);
  });
});
