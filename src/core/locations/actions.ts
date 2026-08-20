"use server";

import { redirect } from "next/navigation";
import { requireOrganization, requireUser } from "@/core/auth/context";
import { requireCapability } from "@/core/permissions/capabilities";
import { formValues, redirectWithMessage } from "@/core/shared/forms";
import { locationSchema } from "./schema";

export async function createLocation(formData: FormData) {
  const context = await requireOrganization();
  await requireCapability(context.organization.id, "location.manage");
  const parsed = locationSchema.safeParse(formValues(formData));
  if (!parsed.success) {
    redirectWithMessage("/locations/new", "error", parsed.error.issues[0]?.message ?? "Invalid location details.");
  }

  const { supabase } = await requireUser();
  const { error } = await supabase.from("locations").insert({
    organization_id: context.organization.id,
    name: parsed.data.name,
    address: parsed.data.address,
    city: parsed.data.city,
    state: parsed.data.state,
    postal_code: parsed.data.postalCode,
  });
  if (error) redirectWithMessage("/locations/new", "error", error.message);
  redirect("/locations?message=Location+added");
}
