import { z } from "zod";

const uuid = z.string().uuid("Select a valid record.");
const optionalUuid = z.preprocess((value) => value || null, uuid.nullable());
const checkbox = z.preprocess((value) => value === "on" || value === true, z.boolean());
const coordinate = (minimum: number, maximum: number, label: string) => z.coerce.number()
  .min(minimum, `${label} is outside its valid range.`)
  .max(maximum, `${label} is outside its valid range.`);

export const fieldClockAttemptSchema = z.object({
  organizationId: uuid,
  jobId: uuid,
  locationId: uuid,
  shiftId: optionalUuid,
  latitude: coordinate(-90, 90, "Latitude"),
  longitude: coordinate(-180, 180, "Longitude"),
  accuracyM: z.coerce.number().nonnegative("Location accuracy is invalid.").max(100_000),
});

export const fieldClockOverrideUseSchema = z.object({
  verificationId: uuid,
  locationId: uuid,
  shiftId: optionalUuid,
});

export const fieldClockSettingsSchema = z.object({
  organizationId: uuid,
  enabled: checkbox,
  allowedRadiusM: z.coerce.number().int().min(25).max(5000),
  maxAccuracyM: z.coerce.number().int().min(5).max(1000),
  managerOverrideEnabled: checkbox,
});

export const fieldClockOverrideSchema = z.object({
  verificationId: uuid,
  reason: z.string().trim().min(3, "Provide an override reason of at least 3 characters.").max(2000),
});

const nullableCoordinate = (minimum: number, maximum: number) => z.preprocess(
  (value) => value === "" || value === undefined ? null : value,
  z.coerce.number().min(minimum).max(maximum).nullable(),
);

export const jobCoordinatesSchema = z.object({
  jobId: uuid,
  latitude: nullableCoordinate(-90, 90),
  longitude: nullableCoordinate(-180, 180),
}).refine((value) => (value.latitude === null) === (value.longitude === null), {
  message: "Provide both latitude and longitude or leave both blank.",
});
