import { createClient } from "@/lib/supabase/server";
import { timeOffIdSchema, timeOffRequestSchema, timeOffReviewSchema } from "@/modules/time-off/validation/schemas";

export async function createMyTimeOffRequest(input: unknown) {
  const value = timeOffRequestSchema.parse(input);
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("create_my_time_off_request", {
    target_organization_id: value.organizationId,
    request_start_date: value.startDate,
    request_end_date: value.endDate,
    request_reason: value.reason,
  });
  if (error) throw new Error(error.message);
  return data;
}

export async function cancelMyTimeOffRequest(input: unknown) {
  const value = timeOffIdSchema.parse(input);
  const supabase = await createClient();
  const { error } = await supabase.rpc("cancel_my_time_off_request", { target_request_id: value.requestId });
  if (error) throw new Error(error.message);
}

export async function reviewTimeOffRequest(input: unknown) {
  const value = timeOffReviewSchema.parse(input);
  const supabase = await createClient();
  const { error } = await supabase.rpc("review_time_off_request", {
    target_request_id: value.requestId,
    review_status: value.decision,
    review_note: value.managerNote,
  });
  if (error) throw new Error(error.message);
}

