import { createClient } from "@/lib/supabase/server";
import {
  jobAssignmentSchema,
  jobCreateSchema,
  jobStatusSchema,
  jobUnassignmentSchema,
  jobUpdateSchema,
} from "@/modules/field-operations/validation/schemas";

function fail(error: { message: string } | null) {
  if (error) throw new Error(error.message);
}

export async function createJob(input: unknown) {
  const value = jobCreateSchema.parse(input);
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("field_create_job", {
    target_organization_id: value.organizationId,
    target_customer_name: value.customerName,
    target_job_name: value.jobName,
    target_location_id: value.locationId,
    target_address: value.address,
    target_scheduled_start_local: value.scheduledStartLocal,
    target_scheduled_end_local: value.scheduledEndLocal,
    target_status: value.status,
    target_notes: value.notes,
  });
  fail(error);
  return data;
}

export async function updateJob(input: unknown) {
  const value = jobUpdateSchema.parse(input);
  const supabase = await createClient();
  const { error } = await supabase.rpc("field_update_job", {
    target_job_id: value.jobId,
    target_customer_name: value.customerName,
    target_job_name: value.jobName,
    target_location_id: value.locationId,
    target_address: value.address,
    target_scheduled_start_local: value.scheduledStartLocal,
    target_scheduled_end_local: value.scheduledEndLocal,
    target_notes: value.notes,
  });
  fail(error);
}

export async function changeJobStatus(input: unknown) {
  const value = jobStatusSchema.parse(input);
  const supabase = await createClient();
  const { error } = await supabase.rpc("field_change_job_status", {
    target_job_id: value.jobId,
    target_status: value.status,
  });
  fail(error);
}

export async function assignJob(input: unknown) {
  const value = jobAssignmentSchema.parse(input);
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("field_assign_job", {
    target_job_id: value.jobId,
    target_crew_id: value.crewId,
    target_employee_id: value.employeeId,
  });
  fail(error);
  return data;
}

export async function unassignJob(input: unknown) {
  const value = jobUnassignmentSchema.parse(input);
  const supabase = await createClient();
  const { error } = await supabase.rpc("field_unassign_job", { target_assignment_id: value.assignmentId });
  fail(error);
}
