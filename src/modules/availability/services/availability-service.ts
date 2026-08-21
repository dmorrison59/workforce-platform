import { createClient } from "@/lib/supabase/server";
import { availabilityIdSchema, availabilitySchema } from "@/modules/availability/validation/schemas";

export async function saveMyAvailability(input: unknown) {
  const value = availabilitySchema.parse(input);
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("save_my_availability", {
    target_organization_id: value.organizationId,
    availability_day_of_week: value.dayOfWeek,
    availability_available: value.available,
    availability_start_time: value.available ? value.startTime : null,
    availability_end_time: value.available ? value.endTime : null,
    availability_effective_from: value.effectiveFrom,
    availability_effective_until: value.effectiveUntil,
  });
  if (error) throw new Error(error.message);
  return data;
}

export async function deleteMyAvailability(input: unknown) {
  const value = availabilityIdSchema.parse(input);
  const supabase = await createClient();
  const { error } = await supabase.rpc("delete_my_availability", {
    target_availability_id: value.availabilityId,
  });
  if (error) throw new Error(error.message);
}

