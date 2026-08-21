import { createClient } from "@/lib/supabase/server";
import {
  assignmentSchema,
  copyShiftSchema,
  copyWeekSchema,
  scheduleIdSchema,
  shiftIdSchema,
  shiftSchema,
  updateShiftSchema,
  weeklyScheduleSchema,
} from "@/modules/scheduling/validation/schemas";

function assertDatabaseResult(error: { message: string } | null) {
  if (error) throw new Error(error.message);
}

export async function createWeeklySchedule(input: unknown) {
  const value = weeklyScheduleSchema.parse(input);
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("create_weekly_schedule", {
    target_organization_id: value.organizationId,
    target_location_id: value.locationId,
    target_week_start: value.weekStart,
  });
  assertDatabaseResult(error);
  return data;
}

export async function createShift(input: unknown) {
  const value = shiftSchema.parse(input);
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("create_schedule_shift", {
    target_schedule_id: value.scheduleId,
    target_department_id: value.departmentId,
    target_role_id: value.roleId,
    target_employee_id: value.employeeId,
    shift_start_local: value.startLocal,
    shift_end_local: value.endLocal,
    shift_break_minutes: value.breakMinutes,
    shift_notes: value.notes,
  });
  assertDatabaseResult(error);
  return data;
}

export async function updateShift(input: unknown) {
  const value = updateShiftSchema.parse(input);
  const supabase = await createClient();
  const { error } = await supabase.rpc("update_schedule_shift", {
    target_shift_id: value.shiftId,
    target_department_id: value.departmentId,
    target_role_id: value.roleId,
    target_employee_id: value.employeeId,
    shift_start_local: value.startLocal,
    shift_end_local: value.endLocal,
    shift_break_minutes: value.breakMinutes,
    shift_notes: value.notes,
  });
  assertDatabaseResult(error);
}

export async function deleteShift(input: unknown) {
  const value = shiftIdSchema.parse(input);
  const supabase = await createClient();
  const { error } = await supabase.rpc("delete_schedule_shift", { target_shift_id: value.shiftId });
  assertDatabaseResult(error);
}

export async function assignEmployee(input: unknown) {
  const value = assignmentSchema.parse(input);
  const supabase = await createClient();
  const { error } = await supabase.rpc("assign_schedule_shift", {
    target_shift_id: value.shiftId,
    target_employee_id: value.employeeId,
  });
  assertDatabaseResult(error);
}

export async function removeEmployee(input: unknown) {
  const value = shiftIdSchema.parse(input);
  const supabase = await createClient();
  const { error } = await supabase.rpc("remove_schedule_shift_employee", { target_shift_id: value.shiftId });
  assertDatabaseResult(error);
}

export async function publishSchedule(input: unknown) {
  const value = scheduleIdSchema.parse(input);
  const supabase = await createClient();
  const { error } = await supabase.rpc("publish_weekly_schedule", { target_schedule_id: value.scheduleId });
  assertDatabaseResult(error);
}

export async function copyShift(input: unknown) {
  const value = copyShiftSchema.parse(input);
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("copy_schedule_shift", {
    source_shift_id: value.shiftId,
    target_local_date: value.targetDate,
  });
  assertDatabaseResult(error);
  return data;
}

export async function copyWeek(input: unknown) {
  const value = copyWeekSchema.parse(input);
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("copy_schedule_week", {
    source_schedule_id: value.scheduleId,
    target_week_start: value.targetWeekStart,
  });
  assertDatabaseResult(error);
  return data;
}
