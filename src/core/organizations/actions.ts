"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireOrganization, requireUser } from "@/core/auth/context";
import { requireCapability } from "@/core/permissions/capabilities";
import { formValues, redirectWithMessage } from "@/core/shared/forms";
import { organizationSchema, organizationSettingsSchema } from "./schema";

export async function createOrganization(formData: FormData) {
  const parsed = organizationSchema.safeParse(formValues(formData));
  if (!parsed.success) {
    redirectWithMessage("/organization-setup", "error", parsed.error.issues[0]?.message ?? "Invalid organization details.");
  }

  const { supabase } = await requireUser();
  const { error } = await supabase.rpc("create_organization", {
    organization_name: parsed.data.name,
    organization_slug: parsed.data.slug,
    organization_timezone: parsed.data.timezone,
  });
  if (error) {
    const message = error.code === "23505" ? "That organization slug is already in use." : error.message;
    redirectWithMessage("/organization-setup", "error", message);
  }
  redirect("/dashboard");
}

export async function updateOrganization(formData: FormData) {
  const context = await requireOrganization();
  await requireCapability(context.organization.id, "settings.manage");
  const parsed = organizationSettingsSchema.safeParse(formValues(formData));
  if (!parsed.success) {
    redirectWithMessage("/settings", "error", parsed.error.issues[0]?.message ?? "Invalid settings.");
  }

  const { supabase } = await requireUser();
  const { error } = await supabase
    .from("organizations")
    .update({ name: parsed.data.name, timezone: parsed.data.timezone })
    .eq("id", context.organization.id);
  if (error) redirectWithMessage("/settings", "error", error.message);
  revalidatePath("/", "layout");
  redirectWithMessage("/settings", "message", "Organization settings saved.");
}
