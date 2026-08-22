import { createClient } from "@/lib/supabase/server";
import {
  coverageDenialSchema,
  coverageRequestIdSchema,
  openShiftRequestSchema,
} from "@/modules/coverage/validation/schemas";

export async function createMyOpenShiftRequest(input: unknown) {
  const value = openShiftRequestSchema.parse(input);
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("create_my_open_shift_request", {
    target_organization_id: value.organizationId,
    target_shift_id: value.shiftId,
  });
  if (error) throw new Error(error.message);
  return data;
}

export async function cancelMyOpenShiftRequest(input: unknown) {
  const value = coverageRequestIdSchema.parse(input);
  const supabase = await createClient();
  const { error } = await supabase.rpc("cancel_my_open_shift_request", {
    target_request_id: value.requestId,
  });
  if (error) throw new Error(error.message);
}
export async function denyOpenShiftRequest(input: unknown) {
  const value = coverageDenialSchema.parse(input);
  const supabase = await createClient();
  const { error } = await supabase.rpc("review_open_shift_request", {
    target_request_id: value.requestId,
    review_status: value.decision,
    review_note: value.managerNote,
  });
  if (error) throw new Error(error.message);
}
