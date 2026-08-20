import { z } from "zod";

export const departmentSchema = z.object({
  name: z.string().trim().min(1, "Department name is required.").max(120),
  locationId: z.string().trim().transform((value) => value || null).refine(
    (value) => value === null || z.string().uuid().safeParse(value).success,
    "Select a valid location.",
  ),
});
