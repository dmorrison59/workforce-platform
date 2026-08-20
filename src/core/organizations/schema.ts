import { z } from "zod";

export const organizationSchema = z.object({
  name: z.string().trim().min(2, "Organization name must contain at least 2 characters.").max(120),
  slug: z.string().trim().toLowerCase().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Use lowercase letters, numbers, and hyphens for the slug."),
  timezone: z.string().trim().min(1, "Timezone is required.").max(80),
});

export const organizationSettingsSchema = z.object({
  name: z.string().trim().min(2).max(120),
  timezone: z.string().trim().min(1).max(80),
});
