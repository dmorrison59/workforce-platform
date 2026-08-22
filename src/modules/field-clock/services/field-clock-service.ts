import { createClient } from "@/lib/supabase/server";
import {
  fieldClockAttemptSchema,
  fieldClockOverrideSchema,
  fieldClockOverrideUseSchema,
  fieldClockSettingsSchema,
  jobCoordinatesSchema,
} from "@/modules/field-clock/validation/schemas";
import type { FieldClockVerificationStatus } from "@/types/database";

function fail(error: { message: string } | null) {
  if (error) throw new Error(error.message);
}

export interface FieldClockAttemptResult {
  verificationId: string;
  timeEntryId: string | null;
  status: FieldClockVerificationStatus;
  distanceM: number;
}

export async function attemptClockIn(input: unknown) {
  const value = fieldClockAttemptSchema.parse(input);
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("field_clock_attempt", {
    target_organization_id: value.organizationId,
    target_job_id: value.jobId,
    target_location_id: value.locationId,
    target_shift_id: value.shiftId,
    submitted_latitude: value.latitude,
    submitted_longitude: value.longitude,
    submitted_accuracy_m: value.accuracyM,
  });
  fail(error);
  return data as unknown as FieldClockAttemptResult;
}

export async function clockInWithOverride(input: unknown) {
  const value = fieldClockOverrideUseSchema.parse(input);
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("field_clock_in_with_override", {
    target_verification_id: value.verificationId,
    target_location_id: value.locationId,
    target_shift_id: value.shiftId,
  });
  fail(error);
  return data;
}

export async function configure(input: unknown) {
  const value = fieldClockSettingsSchema.parse(input);
  const supabase = await createClient();
  const { error } = await supabase.rpc("configure_field_clock", {
    target_organization_id: value.organizationId,
    field_clock_enabled: value.enabled,
    field_allowed_radius_m: value.allowedRadiusM,
    field_max_accuracy_m: value.maxAccuracyM,
    field_manager_override_enabled: value.managerOverrideEnabled,
  });
  fail(error);
}

export async function overrideVerification(input: unknown) {
  const value = fieldClockOverrideSchema.parse(input);
  const supabase = await createClient();
  const { error } = await supabase.rpc("override_field_clock_verification", {
    target_verification_id: value.verificationId,
    manager_override_reason: value.reason,
  });
  fail(error);
}

export async function updateJobCoordinates(input: unknown) {
  const value = jobCoordinatesSchema.parse(input);
  const supabase = await createClient();
  const { error } = await supabase.rpc("field_update_job_coordinates", {
    target_job_id: value.jobId,
    target_latitude: value.latitude,
    target_longitude: value.longitude,
  });
  fail(error);
}
