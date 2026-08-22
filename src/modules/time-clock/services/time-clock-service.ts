import { createClient } from "@/lib/supabase/server";
import {
  clockInSchema,
  correctionSchema,
  timeClockOrganizationSchema,
  timeEntryIdSchema,
} from "@/modules/time-clock/validation/schemas";

function assertDatabaseResult(error: { message: string } | null) {
  if (error) throw new Error(error.message);
}

export async function clockIn(input: unknown) {
  const value = clockInSchema.parse(input);
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("clock_in", {
    target_organization_id: value.organizationId,
    target_location_id: value.locationId,
    target_shift_id: value.shiftId,
  });
  assertDatabaseResult(error);
  return data;
}

export async function clockOut(input: unknown) {
  const value = timeClockOrganizationSchema.parse(input);
  const supabase = await createClient();
  const { error } = await supabase.rpc("clock_out", { target_organization_id: value.organizationId });
  assertDatabaseResult(error);
}

export async function startBreak(input: unknown) {
  const value = timeClockOrganizationSchema.parse(input);
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("start_break", { target_organization_id: value.organizationId });
  assertDatabaseResult(error);
  return data;
}

export async function endBreak(input: unknown) {
  const value = timeClockOrganizationSchema.parse(input);
  const supabase = await createClient();
  const { error } = await supabase.rpc("end_break", { target_organization_id: value.organizationId });
  assertDatabaseResult(error);
}

export async function correctTimeEntry(input: unknown) {
  const value = correctionSchema.parse(input);
  const supabase = await createClient();
  const { error } = await supabase.rpc("correct_time_entry", {
    target_entry_id: value.entryId,
    corrected_location_id: value.locationId,
    corrected_clock_in_local: value.clockInLocal,
    corrected_clock_out_local: value.clockOutLocal,
    correction_reason: value.correctionNote,
  });
  assertDatabaseResult(error);
}

export async function approveTimeEntry(input: unknown) {
  const value = timeEntryIdSchema.parse(input);
  const supabase = await createClient();
  const { error } = await supabase.rpc("approve_time_entry", { target_entry_id: value.entryId });
  assertDatabaseResult(error);
}
