import { createClient } from "@/lib/supabase/server";
import {
  coverageDenialSchema,
  coverageRequestIdSchema,
  shiftSwapRequestSchema,
} from "@/modules/coverage/validation/schemas";

export async function createMyShiftSwapRequest(input: unknown) {
  const value = shiftSwapRequestSchema.parse(input);
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("create_my_shift_swap_request", {
    target_organization_id: value.organizationId,
    target_shift_id: value.shiftId,
    requested_target_employee_id: value.targetEmployeeId,
  });
  if (error) throw new Error(error.message);
  return data;
}

export async function cancelMyShiftSwapRequest(input: unknown) {
  const value = coverageRequestIdSchema.parse(input);
  const supabase = await createClient();
  const { error } = await supabase.rpc("cancel_my_shift_swap_request", {
    target_request_id: value.requestId,
  });
  if (error) throw new Error(error.message);
}
export async function denyShiftSwapRequest(input: unknown) {
  const value = coverageDenialSchema.parse(input);
  const supabase = await createClient();
  const { error } = await supabase.rpc("review_shift_swap_request", {
    target_request_id: value.requestId,
    review_status: value.decision,
    review_note: value.managerNote,
  });
  if (error) throw new Error(error.message);
}
